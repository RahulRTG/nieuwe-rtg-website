/* DE KANTOORUITNODIGING (AUTHORITY.md fase 2, gebouwd naast de gedeelde code).

   Vijf dingen die niet mogen sneuvelen:
   1. alleen de eigenaar maakt een uitnodiging; de gedeelde code niet;
   2. de uitnodiging is OP NAAM: een ander account kan hem niet verzilveren, en
      die poging verbruikt hem ook niet;
   3. hij is EENMALIG, en een nieuwe uitnodiging voor dezelfde mens maakt de oude
      ongeldig;
   4. de code staat niet in de opslag (alleen een hash), en na zeven dagen is hij
      dicht;
   5. de gedeelde code werkt nog (schaduw), en elke koppeling telt mee onder de
      weg waarlangs hij kwam.

   Draai los: node --test test/kantooruitnodiging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { maakUitnodiging } = require('../server/kern/kantoor/uitnodiging');

const CODE = 'UITNODIG-KANTOOR';
const mappen = [];
let srv, gedeeld, eig;
function api(pad, body, token) {
  return fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let n = 0;
async function lid() {
  n += 1;
  const reg = (await api('/api/auth/register', { name: 'Uitnodiging Toets ' + n, email: 'uitnodiging' + n + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren lukt');
  await api('/api/auth/me', {}, reg.token);
  const u = (reg.state && reg.state.user) || {};
  return { token: reg.token, codenaam: u.codename };
}
const nodig = (codenaam, token) => api('/api/office/kantoor/uitnodiging', { codenaam }, token || eig);
const koppel = (tok, uitnodiging) => api('/api/account/koppel', { soort: 'kantoor', uitnodiging }, tok);

test.before(async () => {
  const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitnodiging-')); mappen.push(m);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: m, OFFICE_CODE: CODE } });
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  eig = await kantoorAlsPersoon(srv.base, CODE);
  assert.ok(gedeeld && eig);
});
test.after(() => {
  stop(srv && srv.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1-3. op naam, eenmalig, en de oude vervalt', async () => {
  const a = await lid();
  const b = await lid();
  assert.equal((await nodig(a.codenaam, gedeeld)).status, 403, 'de gedeelde code nodigt niemand uit');
  /* Ook wie boardroomtoegang KREEG, is de eigenaar niet: personeel aannemen blijft van hem. */
  const mede = await lid();
  assert.equal((await api('/api/account/koppel', { soort: 'kantoor', code: CODE }, mede.token)).status, 200);
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: mede.codenaam }, eig)).status, 200);
  const medeKantoor = (await api('/api/account/start', { rol: 'kantoor' }, mede.token)).body.token;
  assert.equal((await api('/api/office/kantoor/uitnodigingen', {}, medeKantoor)).status, 200, 'hij komt de boardroom in');
  assert.equal((await nodig(a.codenaam, medeKantoor)).status, 403, 'maar nodigt niemand uit');

  const eerste = await nodig(a.codenaam);
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body));
  assert.match(eerste.body.code, /^[A-Z2-9]{10}$/);
  const tweede = await nodig(a.codenaam);
  assert.equal((await koppel(a.token, eerste.body.code)).status, 401, 'een nieuwe uitnodiging maakt de oude ongeldig');

  assert.equal((await koppel(b.token, tweede.body.code)).status, 401, 'een ander account kan hem niet verzilveren');
  const k = await koppel(a.token, tweede.body.code);
  assert.equal(k.status, 200, 'wie hij bedoeld is wel -- en de poging van een ander verbruikte hem niet: ' + JSON.stringify(k.body));
  assert.ok(k.body.rollen.some(r => r.rol === 'kantoor'), 'de kantoorrol hangt aan de sleutelbos');
  const start = await api('/api/account/start', { rol: 'kantoor' }, a.token);
  assert.equal((await api('/api/office/state', {}, start.body.token)).status, 200, 'en hij komt het kantoor in');

  await api('/api/account/ontkoppel', { rol: 'kantoor' }, a.token);
  assert.equal((await koppel(a.token, tweede.body.code)).status, 401, 'eenmalig: tweede keer is hij op');
});

test('5. de gedeelde code werkt nog, en de koppelwegen tellen mee', async () => {
  const c = await lid();
  assert.equal((await api('/api/account/koppel', { soort: 'kantoor', code: CODE }, c.token)).status, 200,
    'de schaduw: de gedeelde code blijft werken tot een apart besluit');
  const o = await api('/api/office/kantoor/uitnodigingen', {}, eig);
  assert.equal(o.status, 200);
  assert.equal(o.body.koppelwegen.uitnodiging, 1);
  assert.ok(o.body.koppelwegen.gedeeldeCode >= 1);
  assert.ok(o.body.uitnodigingen.some(u => u.stand === 'gebruikt'));
  assert.ok(o.body.uitnodigingen.some(u => u.stand === 'ingetrokken'));
  assert.ok(!JSON.stringify(o.body).includes('hash'), 'het overzicht draagt geen hash');
});

test('4. de code staat niet in de opslag, en na zeven dagen is hij dicht', () => {
  let t = Date.parse('2026-09-23T09:00:00Z');
  const db = { data: {} };
  const u = maakUitnodiging({ db, save: () => {}, crypto, nu: () => t });
  const r = u.maak({ voorKey: 'user-5', codenaam: 'Test' });
  assert.ok(r.ok);
  assert.ok(!JSON.stringify(db.data).includes(r.code), 'de code zelf staat niet in de opslag');
  assert.equal(u.maak({ voorKey: 'gedeeld' }).status, 400, 'een uitnodiging hangt aan een persoonlijke inlog');
  t += 8 * 86400000;
  assert.equal(u.verzilver('user-5', r.code).status, 401, 'na zeven dagen is hij dicht');
});
