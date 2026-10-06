/* ============================================================================
   HET AANMELDGESPREK VRAAGT DE TWEEDE FACTOR -- regressie voor N3 uit de V1-audit.

   DE FOUT: POST /api/aanmeld/zeg muntte na een geslaagde inlog met
   SLEUTELWOORDEN meteen een sessie van dertig dagen (accounts.issueToken), zonder
   tweefactor.inlogPoort en zonder de andere poorten van /api/auth/login. De
   herkeuring van ronde 3 liep het met de eigenaar door: tweede factor aan,
   sleutelwoorden gezet, gesprek doorlopen, en een token dat de techniekpagina
   opende. Daarmee stond ook het doel van N1 open.

   DE FIX (server/routes/aanmeldgesprek.js, besluit van de eigenaar): dezelfde
   tweede stap als de gewone inlog. Met de tweede factor aan geeft het gesprek een
   kort bewijs met doel `inlog2` en geen token; /api/auth/tweede ruilt dat met een
   code om, met de gedeelde rem uit server/kern/identiteit/tweedestap-rem.js. Een
   account dat door zijn organisatie op non-actief is gezet krijgt niets, met
   dezelfde tekst als de gewone inlog. En het gesprek staat in de inlogpauze van
   de noodrem-ladder (server/middleware/remmen.js), anders is het de ene inlogdeur
   die tijdens een brute-force-aanval openblijft. Zonder inlogpoort start de route
   niet: stil terugvallen op een sessie zou dezelfde fout opnieuw zijn.

   Draai los: node --test test/aanmeldgesprek-tweede.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');
const { zwaarApi } = require('./zwaarpasskey');

const EIGENAAR = 'roellie.i@gmail.com', EIGENAAR_WW = 'Imran';
const WOORDEN = ['lavendel', 'kompas', 'orkaan', 'veranda'];
const NIET_ACTIEF = 'Dit account is door uw organisatie op non-actief gezet. Neem contact op met uw beheerder.';
let srv, dir, eigenaarToken, eigenaarGeheim;

async function api(pad, body, token, ip, methode) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (ip) headers['X-Forwarded-For'] = ip;
  const get = methode === 'GET';
  const r = await fetch(srv.base + pad, { method: methode || 'POST', headers, body: get ? undefined : JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// de posities die Rahul vraagt uit zijn tekst halen (zoals test/aanmeldgesprek.test.js)
const ORD = { eerste: 0, tweede: 1, derde: 2, vierde: 3 };
const posities = (tekst) => [...String(tekst).matchAll(/\b(eerste|tweede|derde|vierde)\b/gi)].map(m => ORD[m[1].toLowerCase()]);

/* Het hele gesprek tot en met het laatste sleutelwoord. Elk gesprek op een eigen
   adres: de route remt op 40 berichten per minuut per adres, en die rem is hier
   niet het onderwerp. */
async function gesprekInlog(login, ip) {
  const s = await api('/api/aanmeld/start', {}, null, ip);
  assert.equal(s.status, 200, 'het gesprek begint: ' + JSON.stringify(s.body).slice(0, 160));
  const zeg = (tekst) => api('/api/aanmeld/zeg', { id: s.body.id, tekst }, null, ip);
  await zeg('Ik wil inloggen.');
  await zeg(login);
  let r = await zeg('doe het maar met mijn sleutelwoorden');
  const p = posities(r.body.tekst);
  assert.equal(p.length, 2, 'Rahul vraagt twee posities: ' + r.body.tekst);
  r = await zeg('Even denken, ' + WOORDEN[p[0]] + ' en ' + WOORDEN[p[1]] + ' natuurlijk.');
  const ps = posities(r.body.tekst);
  assert.equal(ps.length, 1, 'en daarna het laatste woord: ' + r.body.tekst);
  return zeg(WOORDEN[ps[0]]);
}

// een eigen account met sleutelwoorden, en desgewenst een tweede factor
async function lidMetWoorden(email, metTweede) {
  const reg = await api('/api/auth/register', { name: 'Gesprek Toets', email, password: 'geheim12', geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + JSON.stringify(reg.body).slice(0, 160));
  const zet = await api('/api/sleutelwoorden/zet', { woorden: WOORDEN }, reg.body.token);
  assert.equal(zet.status, 200, 'sleutelwoorden zetten: ' + JSON.stringify(zet.body).slice(0, 160));
  let geheim = null;
  if (metTweede) {
    const begin = await api('/api/mijn/tweefactor/begin', { huidig: 'geheim12' }, reg.body.token);
    geheim = begin.body.geheim;
    const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(geheim, Date.now(), 30) }, reg.body.token);
    assert.equal(aan.status, 200, 'tweede factor aan: ' + JSON.stringify(aan.body).slice(0, 160));
  }
  return { token: reg.body.token, geheim };
}

const foutCode = (geheim) => {
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(geheim, Date.now() + d, 30)));
  let c = '000000';
  for (let i = 0; geldig.has(c); i++) c = String(100000 + i);
  return c;
};
const juisteCode = (geheim) => totpCode(geheim, Date.now() + 30000, 30);

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ag2-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  const login = await api('/api/auth/login', { login: EIGENAAR, password: EIGENAAR_WW, pasApp: 'business' });
  assert.ok(login.body.token, 'de eigenaar logt in: ' + JSON.stringify(login.body).slice(0, 160));
  eigenaarToken = login.body.token;
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder tweede factor verandert er niets: de sleutelwoorden geven een sessie', async () => {
  await lidMetWoorden('ag2-zonder@voorbeeld.test', false);
  const r = await gesprekInlog('ag2-zonder@voorbeeld.test', '198.51.100.1');
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.ingelogd, true);
  assert.ok(r.body.token, 'zonder tweede factor zijn de sleutelwoorden genoeg, zoals het wachtwoord bij /api/auth/login');
  assert.equal(r.body.tweedeFactorNodig, undefined);
});

test('2. met de tweede factor aan geven de sleutelwoorden alleen een bewijs, geen token (de eigenaar uit de herkeuring)', async () => {
  const zet = await api('/api/sleutelwoorden/zet', { woorden: WOORDEN }, eigenaarToken);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  const begin = await api('/api/mijn/tweefactor/begin', { huidig: EIGENAAR_WW }, eigenaarToken);
  eigenaarGeheim = begin.body.geheim;
  assert.ok(eigenaarGeheim, 'tweede factor beginnen: ' + JSON.stringify(begin.body).slice(0, 160));
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(eigenaarGeheim, Date.now(), 30) }, eigenaarToken);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));

  const r = await gesprekInlog(EIGENAAR, '198.51.100.2');
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.token, undefined, 'op alleen de sleutelwoorden hoort er geen token uit te komen');
  assert.equal(r.body.state, undefined, 'en geen begintoestand: er is nog niemand binnen');
  assert.notEqual(r.body.ingelogd, true, 'het gesprek zegt niet dat iemand is ingelogd');
  assert.equal(r.body.tweedeFactorNodig, true);
  assert.ok(r.body.bewijs, 'wel een bewijs voor de tweede stap');
  // de uitleg van de inlogpoort zegt "uw wachtwoord klopt"; hier waren het sleutelwoorden
  assert.doesNotMatch(String(r.body.tekst) + ' ' + String(r.body.uitleg), /wachtwoord klopt/i,
    'het gesprek beweert niet dat er een wachtwoord is gebruikt');
  assert.doesNotMatch(String(r.body.tekst), /welkom terug/i, 'en heet niemand welkom die nog niet binnen is');

  // het bewijs is geen sessie: de techniekpagina (N1) gaat er niet mee open
  const tenant = await api('/api/techniek/tenant', null, r.body.bewijs, null, 'GET');
  assert.notEqual(tenant.status, 200, 'het bewijs opent de techniekpagina niet (kreeg ' + tenant.status + ')');
});

test('3. het bewijs uit het gesprek plus de juiste code geeft bij /api/auth/tweede een sessie', async () => {
  const r = await gesprekInlog(EIGENAAR, '198.51.100.3');
  assert.ok(r.body.bewijs, 'een bewijs uit het gesprek: ' + JSON.stringify(r.body).slice(0, 160));
  const fout = await api('/api/auth/tweede', { bewijs: r.body.bewijs, code: foutCode(eigenaarGeheim) });
  assert.equal(fout.status, 403, 'een foute code weigert');
  assert.equal(fout.body.token, undefined);
  const goed = await api('/api/auth/tweede', { bewijs: r.body.bewijs, code: juisteCode(eigenaarGeheim) });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 200));
  assert.ok(goed.body.token, 'met de code is er een sessie');
  assert.ok(goed.body.state, 'en de begintoestand');
  const status = await api('/api/sleutelwoorden/status', {}, goed.body.token);
  assert.equal(status.status, 200, 'de sessie werkt');
  const nogEens = await api('/api/auth/tweede', { bewijs: r.body.bewijs, code: juisteCode(eigenaarGeheim) });
  assert.equal(nogEens.status, 401, 'een gebruikt bewijs werkt geen tweede keer');
});

test('4. foute codes op het bewijs uit het gesprek tellen in de gedeelde rem: na tien is het dicht, ook voor de juiste code', async () => {
  const email = 'ag2-rem@voorbeeld.test';
  const { geheim } = await lidMetWoorden(email, true);
  const r = await gesprekInlog(email, '198.51.100.4');
  assert.ok(r.body.bewijs, 'een bewijs uit het gesprek: ' + JSON.stringify(r.body).slice(0, 160));
  // elke poging van een eigen adres: de ACCOUNTemmer moet het doen, niet die van de bron
  for (let i = 1; i <= 10; i++) {
    const f = await api('/api/auth/tweede', { bewijs: r.body.bewijs, code: foutCode(geheim) }, null, '203.0.113.' + i);
    assert.equal(f.status, 403, 'poging ' + i + ' is een gewone afwijzing');
  }
  const dicht = await api('/api/auth/tweede', { bewijs: r.body.bewijs, code: juisteCode(geheim) }, null, '203.0.113.50');
  assert.equal(dicht.status, 429, 'op slot is op slot, ook voor de juiste code');
  assert.equal(dicht.body.token, undefined);
  // en het is DEZELFDE emmer als die van de wachtwoordinlog
  const lid = await api('/api/auth/login', { login: email, password: 'geheim12', pasApp: 'rtg' }, null, '203.0.113.51');
  assert.ok(lid.body.bewijs, 'de gewone inlog vraagt ook de tweede factor');
  const viaLid = await api('/api/auth/tweede', { bewijs: lid.body.bewijs, code: juisteCode(geheim) }, null, '203.0.113.51');
  assert.equal(viaLid.status, 429, 'de rem van het gesprek en die van de wachtwoordinlog zijn een emmer');
});

test('5. een account dat zijn organisatie op non-actief zette, krijgt uit het gesprek geen token', async () => {
  // de eigenaar koppelt een organisatie met een domein en haalt een SCIM-sleutel
  const zw = await zwaarApi((p, b, t) => api(p, b, t), srv.base, eigenaarToken);
  const sso = await zw('/api/techniek/sso', { org: 'ag2org', naam: 'Gesprek BV', issuer: 'https://login.ag2-idp.test',
    clientId: 'rtg-ag2', clientSecret: 'ag2-geheim', domeinen: ['ag2-org.test'], actief: true }, eigenaarToken);
  assert.equal(sso.status, 200, 'SSO-koppeling: ' + JSON.stringify(sso.body).slice(0, 200));
  const sleutel = await api('/api/techniek/sso/scimsleutel', { org: 'ag2org' }, eigenaarToken);
  assert.equal(sleutel.status, 200, 'SCIM-sleutel: ' + JSON.stringify(sleutel.body).slice(0, 200));
  const scimKop = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sleutel.body.sleutel || sleutel.body.token) };

  const email = 'ag2-uit@ag2-org.test';
  await lidMetWoorden(email, false);
  const zoek = await fetch(srv.base + '/api/scim/v2/Users?filter=' + encodeURIComponent('userName eq "' + email + '"'), { headers: scimKop });
  const lijst = await zoek.json();
  const id = lijst.Resources && lijst.Resources[0] && lijst.Resources[0].id;
  assert.ok(id, 'de organisatie vindt haar medewerker: ' + JSON.stringify(lijst).slice(0, 200));
  const uit = await fetch(srv.base + '/api/scim/v2/Users/' + encodeURIComponent(id), { method: 'PATCH', headers: scimKop,
    body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: false }] }) });
  assert.equal(uit.status, 200, 'de organisatie meldt hem uit dienst');

  const r = await gesprekInlog(email, '198.51.100.5');
  assert.equal(r.status, 403, 'uit dienst is dicht, ook met de juiste sleutelwoorden: ' + JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.token, undefined);
  assert.equal(r.body.bewijs, undefined);
  assert.equal(r.body.error, NIET_ACTIEF, 'met dezelfde tekst als /api/auth/login');
});

test('6. het gesprek zit in de inlogpauze; het begin ervan niet', () => {
  const { inlogpauzePoort, INLOG_PADEN } = require('../server/middleware/remmen');
  assert.ok(INLOG_PADEN.includes('/api/aanmeld/zeg'), 'langs /api/aanmeld/zeg komt een sessie of een bewijs');
  const db = { data: { techniek: { zekeringen: { inlogpauze: { aan: false, tot: Date.now() + 60000 } } } } };
  const poort = inlogpauzePoort({ db });
  const res = () => { const r = { code: null }; r.set = () => r; r.status = (c) => { r.code = c; return r; }; r.json = () => r; return r; };
  let door = false;
  const dicht = res();
  poort({ path: '/api/aanmeld/zeg' }, dicht, () => { door = true; });
  assert.equal(door, false, 'tijdens de pauze gaat het gesprek niet verder');
  assert.equal(dicht.code, 503);
  door = false;
  poort({ path: '/api/aanmeld/start' }, res(), () => { door = true; });
  assert.equal(door, true, 'een gesprek beginnen geeft niemand iets, dus dat blijft open');
});

test('7. zonder inlogpoort start de route niet, in plaats van stil terug te vallen op een sessie', () => {
  const routes = [];
  const kern = { app: { post: (pad) => routes.push(pad) }, intakeStart() {}, intakeZeg() {}, accounts: {}, stateFor() {} };
  assert.throws(() => require('../server/routes/aanmeldgesprek')(kern), /tweefactor/,
    'een gesprek dat de tweede factor niet kan vragen, hoort niet te bestaan');
  assert.deepEqual(routes, [], 'er hangt dan ook geen enkele route');
});
