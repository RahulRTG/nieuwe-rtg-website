/* DE STROOM VAN DE EIGENAAR TIJDENS ONDERHOUD -- met een stroomticket, nooit
   met een sessie in het adres.

   In onderhoud (de hoofdzekering, server/middleware/remmen.js) mag alleen de
   eigenaar erbij, en de zekering las dat uit de kop Authorization. Een
   EventSource stuurt geen kop; sinds `?token=` weg is opent de live-stroom met
   `?ticket=`, en de stroom van de eigenaar kreeg in onderhoud 503. De zekering
   kijkt nu naar het ticket (kern/sessiestroom.js `kijk`, zonder het te
   claimen) en stelt dezelfde vraag aan de sessie die erin zit.

   Draai los: node --test test/onderhoudstroom.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');
const { hoofdzekering } = require('../server/middleware/remmen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onderhoudstroom-'));
let srv, base, baas, lid;

const api = (pad, body, t) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
/* Een stroom openen en meteen weer dicht: de status en de soort antwoord. */
async function stroom(adres) {
  const af = new AbortController();
  const r = await fetch(base + adres, { signal: af.signal });
  const uit = { status: r.status, soort: r.headers.get('content-type') || '' };
  af.abort();
  return uit;
}
const ticket = async (t) => (await api('/api/stroom/ticket', { stroom: 'lid' }, t));
const zekering = (actie) => api('/api/techniek/zekering', { id: 'onderhoud', actie, reden: 'proef' }, baas);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(baas, 'de eigenaar is ingelogd');
  const reg = await api('/api/auth/register', { name: 'Olaf Onderhoud', email: 'olaf' + Date.now() + '@onderhoud.test',
    phone: '0644444444', password: 'geheim12345', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  lid = reg.body.token;
});
test.after(async () => { try { await zekering('reset'); } catch (e) {} stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('in onderhoud opent de eigenaar zijn stroom met een ticket, en verder niemand', async () => {
  const vooraf = await ticket(lid);
  assert.equal(vooraf.status, 200, 'een lid haalt voor het onderhoud nog gewoon een ticket');

  assert.equal((await zekering('spring')).status, 200, 'de eigenaar trekt de onderhoudszekering');
  assert.equal((await api('/api/state', {}, lid)).status, 503, 'de app is dicht voor een lid');

  const t = await ticket(baas);
  assert.equal(t.status, 200, 'de eigenaar haalt zijn ticket met de sessie in de kop: ' + JSON.stringify(t.body));
  const open = await stroom('/api/stream?ticket=' + encodeURIComponent(t.body.ticket));
  assert.equal(open.status, 200, 'de stroom van de eigenaar gaat open tijdens onderhoud');
  assert.match(open.soort, /text\/event-stream/);
  assert.equal((await stroom('/api/stream?ticket=' + encodeURIComponent(t.body.ticket))).status, 503,
    'en het ticket is daarna op: de zekering keek alleen, de deur claimde -- een gebruikt ticket opent de zekering niet');

  assert.equal((await stroom('/api/stream?ticket=' + encodeURIComponent(vooraf.body.ticket))).status, 503,
    'het ticket van een lid opent tijdens onderhoud niets');
  assert.equal((await ticket(lid)).status, 503, 'en een lid krijgt er geen nieuw');
  assert.equal((await stroom('/api/stream?ticket=ST.' + '0'.repeat(32))).status, 503, 'een verzonnen ticket ook niet');
  assert.equal((await stroom('/api/stream?token=' + encodeURIComponent(baas))).status, 503,
    'een sessie in het adres blijft dicht, ook die van de eigenaar');

  assert.equal((await zekering('reset')).status, 200);
  const na = await ticket(lid);
  assert.equal((await stroom('/api/stream?ticket=' + encodeURIComponent(na.body.ticket))).status, 200,
    'na het onderhoud opent een lid zijn stroom weer');
});

test('de zekering zelf: kijkt naar het ticket, nooit naar een token in het adres', async () => {
  const db = { data: { techniek: { zekeringen: { onderhoud: { aan: false } } } } };
  const accounts = { verifyToken: t => (t === 'baas' ? { id: 1 } : t === 'lid' ? { id: 2 } : null) };
  const eigenaar = { isEigenaar: (a, u) => !!(u && u.id === 1) };
  const gekeken = [];
  const dienst = { kijk: async (tk) => { gekeken.push(tk); return tk === 'ST.BAAS' ? { soort: 'lid', token: 'baas' }
    : tk === 'ST.LID' ? { soort: 'lid', token: 'lid' } : null; } };
  const laag = hoofdzekering({ db, accounts, eigenaar, stroom: () => dienst });
  const vraag = (pad, query) => new Promise(klaar => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json() { klaar({ door: false, status: this.code }); } };
    laag({ path: pad, get: () => '', query: query || {} }, res, () => klaar({ door: true }));
  });
  assert.equal((await vraag('/api/stream', { ticket: 'ST.BAAS' })).door, true, 'het ticket van de eigenaar');
  assert.equal((await vraag('/api/stream', { ticket: 'ST.LID' })).status, 503, 'het ticket van een ander');
  assert.equal((await vraag('/api/stream', { ticket: 'ST.ONBEKEND' })).status, 503);
  assert.equal((await vraag('/api/stream', { token: 'baas' })).status, 503, 'een token in het adres telt niet');
  assert.deepEqual(gekeken, ['ST.BAAS', 'ST.LID', 'ST.ONBEKEND'], 'zonder ticket wordt er niet eens gekeken');
});

test('kijk() claimt niets en weigert wat de deur ook zou weigeren', async () => {
  const crypto = require('crypto');
  const db = { data: {} };
  const s = require('../server/kern/sessiestroom').maak({ db, crypto, zegelSleutel: () => Buffer.alloc(32, 4), productie: false });
  s.soort('lid', { geldig: raw => raw === 'sessie-baas' });
  s.soort('zaak', { geldig: () => true });
  const t = await s.geef('lid', 'sessie-baas');
  assert.ok(t.ok);
  assert.deepEqual(await s.kijk(t.ticket), { soort: 'lid', token: 'sessie-baas' });
  assert.deepEqual(await s.kijk(t.ticket), { soort: 'lid', token: 'sessie-baas' }, 'kijken nog een keer: het ticket staat er nog');
  assert.equal((await s.open('lid', t.ticket)).ok, true, 'en de deur kan het daarna gewoon claimen');
  assert.equal(await s.kijk(t.ticket), null, 'een geclaimd ticket ziet de zekering niet meer');
  /* Een ticket dat in de rij van een ANDERE soort is beland: de deur zou het
     weigeren (verkeerd doel), dus de zekering ook. */
  const u = await s.geef('lid', 'sessie-baas');
  const kaart = db.data[s.COLLECTIE];
  kaart.zaak = kaart.lid; delete kaart.lid;
  assert.equal(await s.kijk(u.ticket), null, 'een ticket met het doel van een andere soort opent niets');
  /* Een ticket dat volgens zijn teller op is maar nog in de rij staat: de
     claim zegt 'opgebruikt', de zekering dus ook. */
  const w = await s.geef('lid', 'sessie-baas');
  for (const r of db.data[s.COLLECTIE].lid) r.gebruik = r.max_gebruik;
  assert.equal(await s.kijk(w.ticket), null, 'een opgebruikt ticket opent de zekering niet');
  assert.equal((await s.open('lid', w.ticket)).ok, undefined, 'en de deur weigert het ook');
});
