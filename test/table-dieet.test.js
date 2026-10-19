/* TABLE: ALLERGIE EN DIEET VAN EEN DERDE (domeinkaart LivingOS-B, Table T2/T3;
   besluit van de integrator van 19 oktober 2026).

   Een allergie of een medisch dieet is een gezondheidsgegeven (art. 9 AVG), en
   bij Table is het van een GAST -- iemand zonder account die zelf niets heeft
   ingestemd. Table bewaarde het onbeperkt, als vrije tekst, en gaf het met de
   naam van de gast erbij aan de AI-adviseur mee. Drie regels:

   1. De veertien allergenen van Verordening (EU) 1169/2011 bijlage II zijn een
      vaste keuzelijst; vrije tekst is alleen een aanvulling.
   2. Allergie en dieet vervallen: de dag na de gelegenheid, of 30 dagen na
      invoer bij een gelegenheid zonder datum. De gast zelf blijft staan. Het
      vervallen gebeurt in de opslag (de bewaarveger), niet alleen in beeld.
   3. Alleen het lid ziet het per gast. De maître krijgt een telling per
      allergeen, zonder namen en zonder de vrije tekst.

   Draai: node --test test/table-dieet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stopNet, elevateTier } = require('./helper');

const DAG = 86400000;
const dag = (n) => new Date(Date.now() + n * DAG).toISOString().slice(0, 10);

function kern() {
  const db = { data: {} };
  const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tablekern-'));
  const k = require('../server/kern/rechterhand')({ db, save: () => {}, crypto, liveCodename: () => '', anthropic: null, DATA_DIR });
  return { k, db };
}
const gastVan = (k, key, eventId, naam) => k.tables(key).events.find((e) => e.id === eventId).gasten.find((g) => g.naam === naam);

test('de allergenen zijn een vaste keuzelijst; vrije tekst is een aanvulling', () => {
  const { k } = kern();
  const e = k.tableZet('lid1', { naam: 'Diner', datum: dag(5) }).event;
  const goed = k.tableGast('lid1', { eventId: e.id, naam: 'Gast A', allergenen: ['noten', 'melk'], dieet: 'vegetarisch' });
  assert.equal(goed.status, 200);
  const g = gastVan(k, 'lid1', e.id, 'Gast A');
  assert.deepEqual(g.allergenen, ['noten', 'melk'], 'in de volgorde van bijlage II');
  assert.equal(g.dieet, 'vegetarisch');
  const fout = k.tableGast('lid1', { eventId: e.id, naam: 'Gast B', allergenen: ['aardbei'] });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /lijst/);
  assert.equal(k.tableGastZet('lid1', { eventId: e.id, gastId: g.id, allergenen: ['onzin'] }).status, 400);
  assert.ok(Array.isArray(k.tables('lid1').allergenen) && k.tables('lid1').allergenen.length === 14, 'het scherm krijgt de veertien van bijlage II');
});

test('allergie en dieet vervallen de dag na de gelegenheid, in de opslag; de gast blijft', () => {
  const { k, db } = kern();
  const e = k.tableZet('lid1', { naam: 'Diner', datum: dag(3) }).event;
  k.tableGast('lid1', { eventId: e.id, naam: 'Gast A', allergenen: ['pinda'], dieet: 'geen varkensvlees' });
  const g = gastVan(k, 'lid1', e.id, 'Gast A');
  assert.equal(g.dieetTot, dag(4), 'het lid ziet tot wanneer het bewaard blijft');

  const ervoor = Date.parse(dag(3) + 'T23:00:00Z');
  assert.equal(k.tableVergeetDieet(ervoor), 0, 'op de dag zelf blijft het staan');
  const erna = Date.parse(dag(5) + 'T00:00:00Z');
  assert.equal(k.tableVergeetDieet(erna), 1, 'de dag na de dag na de gelegenheid is het weg');
  const opslag = JSON.stringify(db.data);
  assert.doesNotMatch(opslag, /geen varkensvlees|pinda/, 'niet alleen uit beeld: uit de opslag');
  assert.match(opslag, /Gast A/, 'de gast zelf blijft op de lijst');
});

test('bij een gelegenheid zonder datum vervalt het dertig dagen na invoer', () => {
  const { k, db } = kern();
  const e = k.tableZet('lid1', { naam: 'Ooit' }).event;
  k.tableGast('lid1', { eventId: e.id, naam: 'Gast A', allergenen: ['eieren'] });
  assert.equal(k.tableVergeetDieet(Date.now() + 29 * DAG), 0);
  assert.equal(k.tableVergeetDieet(Date.now() + 31 * DAG), 1);
  assert.doesNotMatch(JSON.stringify(db.data), /eieren/);
});

test('een gelegenheid die al voorbij is toont geen dieet meer, ook voor de veger langskwam', () => {
  const { k } = kern();
  const e = k.tableZet('lid1', { naam: 'Gisteren', datum: dag(-2) }).event;
  k.tableGast('lid1', { eventId: e.id, naam: 'Gast A', allergenen: ['vis'], dieet: 'halal' });
  const g = gastVan(k, 'lid1', e.id, 'Gast A');
  assert.deepEqual(g.allergenen, []);
  assert.equal(g.dieet, '');
});

test('de maître krijgt een telling per allergeen, zonder namen en zonder vrije tekst', async () => {
  const { k } = kern();
  const e = k.tableZet('lid1', { naam: 'Diner', datum: dag(5) }).event;
  k.tableGast('lid1', { eventId: e.id, naam: 'Mevrouw Zonneveld', allergenen: ['noten'], dieet: 'zwanger, geen rauwe vis' });
  k.tableGast('lid1', { eventId: e.id, naam: 'Heer Achterberg', allergenen: ['noten', 'melk'] });
  const r = await k.rechterhandAI('lid1', 'table', 'Wat serveer ik?');
  assert.equal(r.status, 200);
  assert.doesNotMatch(r.antwoord, /Zonneveld|Achterberg|zwanger/);
  assert.match(r.antwoord, /noten 2/);
  assert.match(r.antwoord, /melk 1/);
});

test('de bewaarveger wist het in de opslag van een draaiende server', { timeout: 120000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tabledieet-'));
  let { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  const post = (p, b, t) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b || {}) })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
  try {
    const t = String(Date.now());
    const reg = await post('/api/auth/register', { name: 'Lid ' + t, email: 'td' + t + '@v.test', phone: '06' + t.slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
    const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token;
    await elevateTier(base, reg.data.token, 'lifestyle', office);
    const T = reg.data.token;
    const e = (await post('/api/member/rechterhand/table/zet', { naam: 'Zonder datum' }, T)).data.event;
    const g = await post('/api/member/rechterhand/table/gast', { eventId: e.id, naam: 'Gast Q', allergenen: ['lupine'], dieet: 'merkteken-dieet-' + t }, T);
    assert.equal(g.status, 200);
    const fout = await post('/api/member/rechterhand/table/gast', { eventId: e.id, naam: 'Gast R', allergenen: ['aardbei'] }, T);
    assert.equal(fout.status, 400);
    await stopNet(child);
    /* Dertig dagen en een beetje later: de veger draait bij de start. */
    ({ child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_KLOK: '+31d' } }));
    await new Promise((r) => setTimeout(r, 1500));
    await stopNet(child);
    child = null;
    const plekken = [];
    const loop = (map) => { for (const n of fs.readdirSync(map)) { const p = path.join(map, n); const s = fs.statSync(p);
      if (s.isDirectory()) { if (!/backup/i.test(n)) loop(p); } else if (fs.readFileSync(p).includes('merkteken-dieet-' + t)) plekken.push(path.relative(TMP, p)); } };
    loop(TMP);
    assert.deepEqual(plekken, [], 'het dieet staat na de termijn nergens meer in de opslag');
  } finally {
    if (child) await stopNet(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
