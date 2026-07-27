/* De Genrepols: de kantoren-laag voor de acht dunnere genres (golf,
   fitclub, beauty, petcare, kinderopvang, weddings, marina, alpine).
   Bewaakt dat /api/supplier/puls de meters en signalen van vandaag uit
   de eigen genre-motor haalt, dat een nog niet geseede zaak netjes
   puls:null krijgt (de route seedt zelf niets), en dat genres met een
   eigen plus-laag (zoals horeca) geen pols zien.
   Draai los: node --experimental-sqlite --test test/genrepuls.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, haven, opvang, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-puls-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  haven = await supLogin('PORTELL');
  opvang = await supLogin('NIDO');
  resto = await supLogin('KIKUNOI');
  assert.ok(haven && opvang && resto, 'de drie zaken zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de pols staat er vanaf dag een: de route wekt de genre-motor zelf', async () => {
  const r = await api('supplier/puls', {}, haven);
  assert.equal(r.status, 200);
  assert.ok(r.body.puls && r.body.puls.genre === 'marina', 'geen leeg Kantoor op de eerste dag');
  assert.ok(r.body.puls.meters.length >= 3, 'de meters staan er meteen');
});

test('2. de marina-pols: meters en de vertrekdag van de passant als signaal', async () => {
  assert.equal((await api('supplier/marina', {}, haven)).status, 200, 'de haven wordt lazy geseed door de eigen route');
  const r = await api('supplier/puls', {}, haven);
  assert.equal(r.status, 200);
  assert.equal(r.body.puls.genre, 'marina');
  const meters = Object.fromEntries(r.body.puls.meters);
  assert.equal(meters['Ligplaatsen bezet'], '4 / 12', 'drie vaste liggers plus de passant');
  assert.equal(meters['Vaste liggers'], 3);
  const plat = r.body.puls.signalen.map(s => s.tekst).join(' | ');
  assert.ok(plat.indexOf('Petit Nord') >= 0 && plat.indexOf('vertrekdag') >= 0, 'de passant met vertrekdag vandaag staat als signaal');
  assert.ok(plat.indexOf('servicekaart') >= 0, 'de open servicekaart op de werf telt mee');
});

test('3. de opvang-pols: gescreende nannies geteld, en een rustige dag geeft geen signalen', async () => {
  assert.equal((await api('supplier/opvang', {}, opvang)).status, 200);
  const r = await api('supplier/puls', {}, opvang);
  assert.equal(r.body.puls.genre, 'kinderopvang');
  const meters = Object.fromEntries(r.body.puls.meters);
  assert.equal(meters['Nannies gescreend'], 2, 'Sofia en Mees zijn allebei gescreend');
  assert.equal(meters['Groepen'], 2);
  assert.equal(r.body.puls.signalen.length, 0, 'niets boven capaciteit en niemand ongescreend');
});

test('4. een genre met een eigen plus-laag (horeca) krijgt geen pols', async () => {
  const r = await api('supplier/puls', {}, resto);
  assert.equal(r.status, 200);
  assert.equal(r.body.puls, null, 'het restaurant heeft de volle backoffice al');
});

test('5. zonder inlog is de pols dicht', async () => {
  assert.equal((await api('supplier/puls', {})).status, 401);
});
