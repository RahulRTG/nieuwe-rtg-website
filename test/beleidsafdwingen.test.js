/* DE BELEIDSMOTOR AFDWINGEN PER DEUR (server/kern/beleidsmotor/afdwingen.js).

   Besluit van de eigenaar (24 september 2026): per kantoordeur schaduw of
   afdwingen, standaard schaduw. Wat hier vastligt:

   1. aanzetten weigert zolang de deur niet rijp is (200 waarnemingen, 7 dagen);
   2. een deur die ooit oneens was, gaat niet om;
   3. afgedwongen weigert de motor waar hij WEIGEREN zegt, OOK als de poort zou
      doorlaten -- en hij laat nooit iets door wat de poort tegenhoudt;
   4. ONBEKEND is een 503 en geen 403;
   5. terug naar de schaduw kan altijd;
   6. op een echte server: alleen de eigenaar, en een vers proces is nooit rijp.

   Draai los: node --test test/beleidsafdwingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { EventEmitter } = require('events');
const { startServer, stop, kantoorAlsPersoon, kantoorKoppelBody } = require('./helper');
const { maakBeleidsmotor } = require('../server/kern/beleidsmotor');

const DAG = 86400000;
function motor(t) {
  let stuk = false;
  const m = maakBeleidsmotor({ db: { data: {} }, save: () => {}, nu: () => t.nu,
    sessionFor: (tok) => { if (stuk) throw new Error('bron weg'); return tok === 'mens' ? { role: 'office', lidKey: 'k1' } : tok === 'gedeeld' ? { role: 'office' } : null; },
    accounts: { verifyToken: () => null }, eigenaar: { isEigenaar: () => false },
    boardroomWie: () => null, magBoardroom: () => false, balieBron: () => () => false });
  m.breek = (b) => { stuk = b; };
  return m;
}
/* Een verzoek door de gewikkelde poort; geeft terug of de route liep en wat de motor antwoordde. */
function roep(poort, token) {
  const req = { method: 'POST', routePatroon: '/api/office/proef', get: (k) => (k === 'authorization' ? 'Bearer ' + token : undefined) };
  const res = new EventEmitter();
  res.statusCode = 200; res.writableFinished = true; res.body = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  let liep = false;
  poort(req, res, () => { liep = true; });
  res.emit('close');
  return { liep, status: res.statusCode, body: res.body };
}
const echtePoort = (req, res, next) => (req.get('authorization') === 'Bearer mens' ? next() : res.status(403).json({ error: 'poort' }));
const ruimePoort = (req, res, next) => next();

test('1-5. rijp en nooit oneens, dan pas afdwingen; de motor komt naast de poort', () => {
  const t = { nu: Date.parse('2026-09-24T09:00:00Z') };
  const m = motor(t);
  const echt = m.bewaak('op-naam', echtePoort);
  for (let i = 0; i < 200; i++) assert.equal(roep(echt, 'mens').liep, true);
  const vroeg = m.afdwingen.zet('op-naam', true, 'eigenaar');
  assert.equal(vroeg.status, 409, 'nog geen zeven dagen: ' + JSON.stringify(vroeg));
  assert.match(vroeg.error, /dagen/);
  t.nu += 8 * DAG;
  assert.equal(m.afdwingen.zet('balie', true, 'eigenaar').status, 409, 'een deur zonder waarnemingen is niet rijp');
  const ok = m.afdwingen.zet('op-naam', true, 'eigenaar');
  assert.equal(ok.stand, 'afdwingen', JSON.stringify(ok));
  assert.equal(m.afdwingen.zet('nergens', true).status, 404);

  // de motor weigert, ook waar een (te) ruime poort zou doorlaten
  const ruim = m.bewaak('op-naam', ruimePoort);
  const weg = roep(ruim, 'gedeeld');
  assert.equal(weg.liep, false, 'afgedwongen: de gedeelde code komt niet door de deur op naam');
  assert.equal(weg.status, 403);
  assert.match(weg.body.error, /beleidsmotor weigert/);
  assert.ok(!/\.\.$/.test(weg.body.error), 'een zin, geen dubbele punt');
  assert.equal(roep(ruim, 'mens').liep, true, 'wie de motor toelaat, komt door');
  assert.equal(roep(echt, 'gedeeld').liep, false, 'en wat de poort tegenhoudt, blijft tegengehouden');

  m.breek(true);
  const onbekend = roep(ruim, 'mens');
  assert.equal(onbekend.status, 503, 'een bron die niet antwoordt is geen overtreding: ' + JSON.stringify(onbekend.body));
  m.breek(false);

  assert.equal(m.afdwingen.zet('op-naam', false, 'eigenaar').stand, 'schaduw', 'terug naar de schaduw kan altijd');
  assert.equal(roep(ruim, 'gedeeld').liep, true, 'in de schaduw beslist de poort weer alleen');
});

test('2. een deur die ooit oneens was, gaat niet om', () => {
  const t = { nu: Date.parse('2026-09-24T09:00:00Z') };
  const m = motor(t);
  const echt = m.bewaak('op-naam', echtePoort);
  for (let i = 0; i < 200; i++) roep(echt, 'mens');
  roep(m.bewaak('op-naam', ruimePoort), 'gedeeld');   // de poort liet door, de motor zei nee: oneens
  t.nu += 8 * DAG;
  const r = m.afdwingen.zet('op-naam', true, 'eigenaar');
  assert.equal(r.status, 409, JSON.stringify(r));
  assert.match(r.error, /oneens/);
});

test('6. de route: alleen de eigenaar, en een vers proces is nooit rijp', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beleidsafdwingen-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const eig = await kantoorAlsPersoon(srv.base, 'RTG-OFFICE');
    assert.ok(eig, 'de eigenaar en zijn kantoorsessie');
    const lees = await api('/api/office/beleidsmotor/afdwingen', {}, eig);
    assert.equal(lees.status, 200, JSON.stringify(lees.body));
    assert.deepEqual(Object.values(lees.body.deuren).map(d => d.stand), ['schaduw', 'schaduw', 'schaduw', 'schaduw'], 'standaard schaduw');

    const reg = (await api('/api/auth/register', { name: 'Afdwing Toets', email: 'afdw' + Date.now() + '@voorbeeld.test',
      password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
    assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(srv.base, reg.token), reg.token)).status, 200);
    assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: reg.state.user.codename }, eig)).status, 200);
    const mede = (await api('/api/account/start', { rol: 'kantoor' }, reg.token)).body.token;
    const r = await api('/api/office/beleidsmotor/afdwingen/zet', { deur: 'kantoor', aan: false }, mede);
    assert.equal(r.status, 403, 'wie de boardroom in mag, is de eigenaar nog niet: ' + JSON.stringify(r.body));

    const nietRijp = await api('/api/office/beleidsmotor/afdwingen/zet', { deur: 'kantoor', aan: true }, eig);
    assert.equal(nietRijp.status, 409, 'een vers proces heeft geen zeven dagen: ' + JSON.stringify(nietRijp.body));
    assert.equal((await api('/api/office/beleidsmotor/afdwingen/zet', { deur: 'kantoor', aan: false }, eig)).status, 200,
      'terug naar de schaduw kan altijd');
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
