/* DE SESSIESTROOM: geen sessie meer in het adres van een live-stroom of een
   video (server/kern/sessiestroom.js, server/opzet/stroomtoegang.js).

   Twee helften. Eerst de mechaniek met een eigen klok en een eigen opslag --
   128 bits en alleen de hash, eenmalig, kort, gebonden aan soort, sessie en
   onderwerp, de hercontrole bij openen, de verzegelde sessie -- en daarna de
   deuren op een ECHTE server: een volledig token in ?token= wordt overal
   geweigerd, ook als het klopt; een ticket opent precies een keer; een sessie
   die na de uitgifte uitlogt opent met haar ticket niets meer.

   Draai los: node --test test/sessiestroom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maak } = require('../server/kern/sessiestroom');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

/* ------------------------------------------------------------ de mechaniek */

function wereld(opties = {}) {
  let klok = Date.parse('2026-10-06T12:00:00.000Z');
  const nu = () => new Date(klok).toISOString();
  const opslag = {};
  // de semantiek van bewerkCollectie: een KOPIE die pas na afloop de collectie wordt
  const bewerkCollectie = (naam, werk) => {
    const k = JSON.parse(JSON.stringify(opslag[naam] || {}));
    const uit = werk(k); opslag[naam] = k; return uit;
  };
  const sleutel = 'sleutel' in opties ? opties.sleutel : crypto.randomBytes(32);
  const dienst = maak({ db: { data: {} }, crypto, bewerkCollectie, nu, zegelSleutel: () => sleutel });
  const levend = new Set(['SESSIE-A-' + 'x'.repeat(40), 'SESSIE-B-' + 'y'.repeat(40)]);
  dienst.soort('lid', { geldig: raw => levend.has(raw) });
  dienst.soort('kantoor', { geldig: raw => raw.startsWith('SESSIE-B') && levend.has(raw) });
  dienst.soort('kijk', { geldig: raw => levend.has(raw), metBij: true, geldigMs: 300000, maxGebruik: 3 });
  return { dienst, opslag, levend, schuif: ms => { klok += ms; }, A: [...levend][0], B: [...levend][1] };
}

test('1. uitgifte: 128 bits, en in de opslag alleen de hash en een verzegelde sessie', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.A);
  assert.equal(t.ok, true);
  assert.match(t.ticket, /^ST\.[0-9A-F]{32}$/, '128 bits uit kern/bearercode.js');
  const tekst = JSON.stringify(w.opslag);
  assert.equal(tekst.includes(t.ticket.slice(3)), false, 'nooit het ticket zelf op schijf');
  assert.equal(tekst.includes(w.A), false, 'nooit de sessie in leesbare vorm op schijf');
  const rij = w.opslag.sessieStroomTickets.lid[0];
  assert.equal(rij.max_gebruik, 1, 'standaard eenmalig');
  assert.equal(Date.parse(rij.expires_at) - Date.parse(rij.issued_at), 60000, 'een minuut, niet dertig dagen');
});

test('2. een ticket opent EEN keer, en geeft dan de sessie voor de hercontrole per bericht', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.A);
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { ok: true, token: w.A });
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 }, 'een tweede opening (een overgespeeld adres) opent niets');
});

test('3. een verlopen ticket opent niets', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.A);
  w.schuif(60001);
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 });
});

test('4. gebonden aan de soort: een ledenticket opent de kantoorstroom niet, en een lid krijgt geen kantoorticket', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.B);
  assert.deepEqual(await w.dienst.open('kantoor', t.ticket), { status: 401 });
  assert.equal((await w.dienst.geef('kantoor', w.A)).status, 401, 'de ruil stelt dezelfde vraag als de deur');
  assert.equal((await w.dienst.geef('bestaat-niet', w.A)).status, 400);
});

test('5. hercontrole bij openen: een sessie die na de uitgifte uitlogt, opent met haar ticket niets', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.A);
  w.levend.delete(w.A);
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 });
});

test('6. gebonden aan het onderwerp, begrensd in gebruik (het kijkticket van een video)', async () => {
  const w = wereld();
  assert.equal((await w.dienst.geef('kijk', w.A)).status, 400, 'een kijkticket zonder onderwerp bestaat niet');
  const t = await w.dienst.geef('kijk', w.A, 'video-1');
  assert.deepEqual(await w.dienst.open('kijk', t.ticket, 'video-2'), { status: 401 }, 'een andere video opent niet');
  const u = await w.dienst.geef('kijk', w.A, 'video-1');
  for (let i = 0; i < 3; i++) assert.deepEqual(await w.dienst.open('kijk', u.ticket, 'video-1'), { ok: true, token: w.A }, 'opening ' + (i + 1));
  assert.deepEqual(await w.dienst.open('kijk', u.ticket, 'video-1'), { status: 401 }, 'na maxGebruik is het op');
});

test('7. een geknoeide zegel opent niets, en zonder zegelsleutel komt er geen ticket', async () => {
  const w = wereld();
  const t = await w.dienst.geef('lid', w.A);
  const rij = w.opslag.sessieStroomTickets.lid[0];
  const b = Buffer.from(rij.onderwerp.zegel, 'base64'); b[b.length - 1] ^= 1;
  rij.onderwerp.zegel = b.toString('base64');
  assert.deepEqual(await w.dienst.open('lid', t.ticket), { status: 401 });
  const zonder = wereld({ sleutel: null });
  assert.equal((await zonder.dienst.geef('lid', zonder.A)).status, 503, 'liever geen stroom dan een sessie in leesbare vorm');
});

test('8. het plafond per sessie verdringt de oudste, niet die van een ander', async () => {
  const w = wereld();
  const b = await w.dienst.geef('lid', w.B);
  const eerste = await w.dienst.geef('lid', w.A);
  for (let i = 0; i < 8; i++) await w.dienst.geef('lid', w.A);
  assert.deepEqual(await w.dienst.open('lid', eerste.ticket), { status: 401 }, 'de oudste van A is verdrongen');
  assert.equal((await w.dienst.open('lid', b.ticket)).ok, true, 'het ticket van B staat er nog');
});

/* ---------------------------------------------------------- de echte deuren */

let srv, base, lid, zaak, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sessiestroom-'));
const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
/* Een stroom: status en de eerste brok, daarna meteen weer dicht. */
async function open(adres) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 5000);
  try {
    const r = await fetch(adres, { signal: ac.signal });
    let eerste = '';
    if (r.status === 200) { const s = await r.body.getReader().read(); eerste = Buffer.from(s.value || []).toString(); }
    ac.abort();
    return { status: r.status, eerste };
  } catch (e) { return { status: 0, eerste: '' }; } finally { clearTimeout(t); }
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await post('/api/login', { tier: 'business' })).body.token;
  const roster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(lid && zaak && kantoor, 'een lid, een zaak en een kantoormens staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const DEUREN = [
  { pad: '/api/stream', stroom: 'lid', tok: () => lid },
  { pad: '/api/supplier/stream', stroom: 'zaak', tok: () => zaak },
  { pad: '/api/office/stream', stroom: 'kantoor', tok: () => kantoor }
];

test('9. een VOLLEDIGE, geldige sessie in ?token= wordt op elke stroom geweigerd', async () => {
  for (const d of DEUREN) {
    const r = await open(base + d.pad + '?token=' + encodeURIComponent(d.tok()));
    assert.equal(r.status, 401, d.pad + ' nam een sessie uit het adres aan');
  }
});

test('10. een ticket opent elke stroom precies een keer', async () => {
  for (const d of DEUREN) {
    const t = await post('/api/stroom/ticket', { stroom: d.stroom }, d.tok());
    assert.equal(t.status, 200, d.pad + ': ' + JSON.stringify(t.body));
    const adres = base + d.pad + '?ticket=' + encodeURIComponent(t.body.ticket);
    const eerste = await open(adres);
    assert.equal(eerste.status, 200, d.pad + ' opende niet met een vers ticket');
    assert.match(eerste.eerste, /retry: 3000/, d.pad + ' is echt een stroom');
    assert.equal((await open(adres)).status, 401, d.pad + ': hetzelfde ticket opende een tweede keer');
  }
});

test('11. de ruil neemt de sessie alleen uit de kop, en een andere soort opent de deur niet', async () => {
  assert.equal((await post('/api/stroom/ticket', { stroom: 'lid', token: lid })).status, 401, 'een token in het lijf telt niet');
  assert.equal((await post('/api/stroom/ticket', { stroom: 'zaak' }, lid)).status, 401, 'een lid krijgt geen zaakticket');
  assert.equal((await post('/api/stroom/ticket', { stroom: 'kantoor' }, zaak)).status, 401, 'een zaak krijgt geen kantoorticket');
  const t = await post('/api/stroom/ticket', { stroom: 'lid' }, lid);
  assert.equal((await open(base + '/api/supplier/stream?ticket=' + encodeURIComponent(t.body.ticket))).status, 401,
    'een ledenticket opent de zaakstroom niet');
});

test('12. wie na de uitgifte uitlogt, opent met zijn ticket niets meer', async () => {
  const eigen = (await post('/api/login', { tier: 'rtg' })).body.token;
  const t = await post('/api/stroom/ticket', { stroom: 'lid' }, eigen);
  assert.equal(t.status, 200);
  assert.equal((await post('/api/logout', {}, eigen)).status, 200);
  assert.equal((await open(base + '/api/stream?ticket=' + encodeURIComponent(t.body.ticket))).status, 401);
});
