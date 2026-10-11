/* ============================================================================
   EEN UITGEZET ACCOUNT LAAT GEEN MANAGERCODE ACHTER -- regressie voor N54 uit
   de V1-audit (ronde 9).

   DE FOUT: SCIM (PATCH active=false, PUT, DELETE) en de AVG-wissing
   (/api/privacy/delete) zetten het RTG-ACCOUNT uit, niet de personeelsplek.
   De manager zelf kwam er niet meer in (de werksessie bewijst plek EN account),
   maar zijn open manageruitnodiging bleef geldig: een vers account claimde hem
   met /api/supplier/staff/join (200), was daarmee manager, en gaf zelf weer
   manageruitnodigingen uit. Zijn doossleutel bleef de zaak klonen. Live
   bevestigd op alle drie de wegen.

   DE FIX: wie iets uitgaf, telt alleen als uitgever zolang zijn plek actief is
   EN het account erachter (accounts.plekWerkt, server/accounts/staff-sessie.js,
   hetzelfde oordeel als de werksessie). De personeelsuitnodiging
   (routes/supplier/werving/uitnodiging.js) en de doossleutel
   (kern/zaakdoos/sleutels-uitgever.js) lezen allebei die ene functie. Een
   controle bij het lezen en geen cascade: zet SCIM het account weer aan, dan
   geldt de code weer -- uitzetten is geen wissen.

   Draai los: node --test test/staff-accountuit.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { zwaarApi } = require('./zwaarpasskey');

const WW = 'geheim12';
let srv, dir, baas, zaakNaam, eigenaar, scimSleutel;
let volgnummer = 1;

async function api(pad, body, token, methode, extra) {
  const n = volgnummer++;
  const headers = Object.assign({ 'Content-Type': 'application/json',
    'X-Forwarded-For': '198.21.' + (n >> 8) + '.' + (n & 255) }, extra || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  const m = methode || 'POST';
  const r = await fetch(srv.base + pad, { method: m, headers,
    body: (m === 'GET' || m === 'DELETE') ? undefined : JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {};
  try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst };
}
const kort = r => r.status + ' ' + r.tekst.slice(0, 200);
const scim = (pad, body, methode) => api('/api/scim/v2' + pad, body, scimSleutel, methode);
const kloon = (doos, sleutel) => api('/api/doos/kloon', null, null, 'GET', { 'x-doos-id': doos, 'x-doos-eigen-sleutel': sleutel });

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accountuit-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '', OFFICE_CODE: 'KANTOOR-N54' } });
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const manager = roster.body.staff.find(x => x.role === 'manager');
  const ml = await api('/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
  assert.ok(ml.body.token, 'baas logt in: ' + kort(ml));
  baas = ml.body.token; zaakNaam = roster.body.supplier.name;

  const o = await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.ok(o.body.token, 'eigenaar: ' + kort(o));
  eigenaar = o.body.token;
  const zw = await zwaarApi(api, srv.base, eigenaar);
  const zet = await zw('/api/techniek/sso', { org: 'klantx', naam: 'Klant X BV',
    issuer: 'https://login.klantx-idp.test', clientId: 'rtg-klantx', clientSecret: 'geheim-x',
    domeinen: ['klantx.nl'], actief: true }, eigenaar);
  assert.equal(zet.status, 200, 'koppeling: ' + kort(zet));
  const s = await api('/api/techniek/sso/scimsleutel', { org: 'klantx' }, eigenaar);
  scimSleutel = s.body.sleutel;
  assert.ok(scimSleutel, 'scimsleutel: ' + kort(s));
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

/* Een manager met een eigen account, die zelf een open manageruitnodiging en
   een doossleutel uitgeeft. */
async function manager(email, naam) {
  const reg = await api('/api/auth/register', { name: 'Lid ' + naam, email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + kort(reg));
  const inv = await api('/api/supplier/staff/invite', { name: 'Mgr ' + naam, role: 'manager', func: 'Leiding' }, baas);
  assert.equal(inv.status, 200, kort(inv));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: inv.body.invite.kassacode, login: email, password: WW });
  assert.equal(join.status, 200, 'join: ' + kort(join));
  const werk = await api('/api/supplier/mijn/login', { login: email, password: WW });
  assert.ok(werk.body.token, 'werksessie: ' + kort(werk));
  const eigen = await api('/api/supplier/staff/invite', { name: 'Achterdeur ' + naam, role: 'manager', func: 'Leiding' }, werk.body.token);
  assert.equal(eigen.status, 200, 'eigen uitnodiging: ' + kort(eigen));
  const doos = 'kassa-' + naam.toLowerCase();
  const sleutel = await api('/api/supplier/doos/sleutel', { doos }, werk.body.token);
  assert.equal(sleutel.status, 200, 'doossleutel: ' + kort(sleutel));
  return { email, lidToken: reg.body.token, eigen: eigen.body.invite, doos, sleutel: sleutel.body.sleutel };
}

/* Na het uitzetten: zijn code claimt niets en zijn sleutel kloont niets. */
async function nietsMeer(m, label) {
  const lijst = await api('/api/supplier/staff/invites', {}, baas);
  const open = (lijst.body.invites || []).find(x => x.id === m.eigen.id);
  assert.equal(open && open.status, 'uitgever-niet-actief', label + ': de baas ziet waarom: ' + JSON.stringify(open));
  const vreemd = 'vreemd-' + label + '@n54.test';
  const reg = await api('/api/auth/register', { name: 'Vreemd ' + label, email: vreemd, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, kort(reg));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaakNaam, kassacode: m.eigen.kassacode, login: vreemd, password: WW });
  assert.equal(join.status, 401, label + ': een vers account claimt zijn code niet: ' + kort(join));
  assert.equal((await api('/api/supplier/mijn/login', { login: vreemd, password: WW })).status, 404, label + ': en heeft geen werkplek');
  const k = await kloon(m.doos, m.sleutel);
  assert.equal(k.status, 403, label + ': zijn doossleutel kloont niets: ' + kort(k));
  assert.equal(k.body.code, 'doos-sleutel-uitgever-niet-actief', label);
}

const scimId = async email => {
  const zoek = await scim('/Users?filter=' + encodeURIComponent('userName eq "' + email + '"'), null, 'GET');
  const id = zoek.body.Resources && zoek.body.Resources[0] && zoek.body.Resources[0].id;
  assert.ok(id, 'scim kent ' + email + ': ' + kort(zoek));
  return id;
};
const actief = (id, aan) => scim('/Users/' + id, { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
  Operations: [{ op: 'replace', path: 'active', value: aan }] }, 'PATCH');

test('1. N54: SCIM zet het account uit, en daarmee zijn code en zijn doossleutel; weer aan geeft ze terug', async () => {
  const m = await manager('mara@klantx.nl', 'Mara');
  const id = await scimId(m.email);
  assert.equal((await actief(id, false)).status, 200);
  await nietsMeer(m, 'scim-uit');

  // TEGENPROEF: uitzetten is geen wissen. Weer aan, en de code en de sleutel gelden weer.
  assert.equal((await actief(id, true)).status, 200);
  assert.equal((await kloon(m.doos, m.sleutel)).status, 200, 'de sleutel opent weer');
  const lijst = await api('/api/supplier/staff/invites', {}, baas);
  assert.equal((lijst.body.invites || []).find(x => x.id === m.eigen.id).status, 'actief', 'de code geldt weer');
});

test('2. N54: SCIM DELETE', async () => {
  const m = await manager('joost@klantx.nl', 'Joost');
  const uit = await scim('/Users/' + await scimId(m.email), null, 'DELETE');
  assert.equal(uit.status, 204, kort(uit));
  await nietsMeer(m, 'scim-delete');
});

test('3. N54: de AVG-wissing (/api/privacy/delete)', async () => {
  const m = await manager('pien@ergens.test', 'Pien');
  const weg = await api('/api/privacy/delete', {}, m.lidToken);
  assert.equal(weg.status, 200, kort(weg));
  await nietsMeer(m, 'avg');
});

test('4. TEGENPROEF: de open code en de sleutel van de baas blijven gewoon geldig', async () => {
  const inv = await api('/api/supplier/staff/invite', { name: 'Gewoon nieuw', func: 'Bediening' }, baas);
  const sl = await api('/api/supplier/doos/sleutel', { doos: 'kassa-baas2' }, baas);
  const lijst = await api('/api/supplier/staff/invites', {}, baas);
  assert.equal((lijst.body.invites || []).find(x => x.id === inv.body.invite.id).status, 'actief');
  assert.equal((await kloon('kassa-baas2', sl.body.sleutel)).status, 200);
});
