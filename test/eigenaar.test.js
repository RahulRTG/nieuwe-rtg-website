/* De eigenaar (Roellie) heeft overal toegang tot de BEHEER-omgevingen met zijn
   eigen accountlogin, maar de juridische grenzen (kinderdata, privé tussen
   personen, ruwe identiteitsbewijzen, platte wachtwoorden) blijven ook voor de
   eigenaar dicht. Draai: node --experimental-sqlite --test test/eigenaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const eigenaar = require('../server/eigenaar');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eig-'));
let child, ownerToken;

function api(pad, body, token, method) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: method || 'POST', headers, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
}
const json = r => r.json();

test('eigenaar.js: de eigenaar staat op roellie.i@gmail.com (of RTG_OWNER_EMAIL)', () => {
  assert.equal(eigenaar.OWNER_EMAIL, (process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com').toLowerCase());
  assert.ok(eigenaar.GRENZEN.length >= 3, 'de juridische grenzen zijn benoemd');
});

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_OWNER_EMAIL: '' } }));
  // de eigenaar logt in met zijn eigen account (geseed op roellie.i@gmail.com / Imran)
  const login = await json(await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }));
  assert.ok(login.token, 'de eigenaar kan inloggen met zijn account');
  ownerToken = login.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('overal toegang: de eigenaar komt met zijn accountlogin in Backoffice en technische pagina', async () => {
  // Backoffice zonder de aparte OFFICE_CODE, puur op zijn accounttoken
  assert.equal((await api('/api/office/state', {}, ownerToken)).status, 200, 'Backoffice-state');
  assert.equal((await api('/api/office/verifications', {}, ownerToken)).status, 200, 'KYC-overzicht (backoffice)');
  const csv = await fetch(BASE + '/api/office/export.csv', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ownerToken }, body: '{}' });
  assert.equal(csv.status, 200, 'de boekhoud-export (token in de header, nooit in de URL)');
  // de technische pagina herkent hem als eigenaar
  const tech = await json(await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }));
  assert.equal(tech.eigenaar, true);
  const status = await json(await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tech.token } }));
  assert.ok(Array.isArray(status.grenzen) && status.grenzen.length >= 3, 'de grenzen staan op het bord');
});

test('een niet-eigenaar komt NIET zomaar in de Backoffice', async () => {
  const reg = await json(await api('/api/auth/register', { name: 'Gewoon Lid', email: 'gewoon@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  assert.equal((await api('/api/office/state', {}, reg.token)).status, 401, 'een gewoon lid krijgt geen backoffice-toegang');
});

test('juridische grens: ook de eigenaar leest geen privé kinder- of leden-inhoud', async () => {
  // een gezin met een beschermd kind (t/m 15) en een privébericht van het kind
  const g = await json(await api('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Grens', naam: 'Ouder', pin: '1234' }));
  const kind = await json(await api('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind Grens', rol: 'kind', groep: 'kind' }));
  const kindTok = (await json(await api('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;

  // het beschermde kind is onvindbaar in de sociale laag, OOK met een eigenaar-token:
  // er is simpelweg geen backoffice-endpoint dat privéberichten van een kind teruggeeft,
  // en de sociale zoek/inzage vereist de EIGEN gezins-sessie (niet die van de eigenaar).
  const zoek = await api('/api/rtf/social/find', { code: g.code, token: kindTok, q: 'Kind' });
  assert.equal(zoek.status, 403, 'zelfs binnen het gezin is een beschermd kind niet vindbaar');

  // de eigenaar heeft geen enkel kanaal om de sociale inhoud van een ander te lezen:
  // de social-endpoints werken alleen op de EIGEN sessie, een eigenaar-token telt daar niet.
  const alsEigenaar = await api('/api/rtf/social/connections', { code: g.code, token: ownerToken });
  assert.notEqual(alsEigenaar.status, 200, 'een eigenaar-token opent de sociale laag van een gezin niet');

  // en een plat wachtwoord bestaat nergens: er is geen endpoint dat het teruggeeft
  // (setPassword bewaart alleen een hash); dit is per ontwerp, niet per instelling.
  assert.ok(eigenaar.GRENZEN.some(g => /wachtwoord/i.test(g)));
});
