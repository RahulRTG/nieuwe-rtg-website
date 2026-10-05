/* ============================================================================
   DE TECHNIEK-INLOG VRAAGT DE TWEEDE FACTOR -- regressie voor N1 uit de V1-audit.

   DE FOUT: /api/techniek/inloggen gaf na wachtwoord en toegangslijst meteen een
   accounttoken, zonder tweede factor -- juist voor de eigenaar en de
   techniektoegangslijst. Wie het wachtwoord van de eigenaar had, kwam langs de
   authenticator.

   DE FIX (server/routes/techniek/inlog.js): met de tweede factor aan komt er een
   kort bewijs met een EIGEN doel (`tech2`) uit, en dezelfde route ruilt dat met
   een code om voor het korte techniektoken. Een gewoon inlogbewijs werkt hier
   niet, en dit bewijs werkt niet bij /api/auth/tweede. De rem op de code is die
   van server/kern/identiteit/tweedestap-rem.js.

   Draai los: node --test test/techniek-tweede.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { totpCode } = require('../server/kern/totp');

const LOGIN = 'roellie.i@gmail.com', WACHTWOORD = 'Imran';
let srv, dir, geheim, ownerToken;

async function api(pad, body, token, ip) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (ip) headers['X-Forwarded-For'] = ip;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const foutCode = () => {
  const geldig = new Set([-30000, 0, 30000].map(d => totpCode(geheim, Date.now() + d, 30)));
  let c = '000000';
  for (let i = 0; geldig.has(c); i++) c = String(100000 + i);
  return c;
};
const juisteCode = () => totpCode(geheim, Date.now() + 30000, 30);

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tech2-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  const login = await api('/api/auth/login', { login: LOGIN, password: WACHTWOORD, pasApp: 'business' });
  assert.ok(login.body.token, 'de eigenaar logt in: ' + JSON.stringify(login.body).slice(0, 160));
  ownerToken = login.body.token;
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder tweede factor verandert er niets: het techniektoken komt meteen', async () => {
  const r = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.token, 'zonder tweede factor is het wachtwoord genoeg, zoals bij de gewone inlog');
  assert.equal(r.body.tweedeFactorNodig, undefined);
});

test('2. met de tweede factor aan geeft het wachtwoord alleen een bewijs, geen token', async () => {
  const begin = await api('/api/mijn/tweefactor/begin', { huidig: WACHTWOORD }, ownerToken);
  assert.ok(begin.body.geheim, 'tweede factor beginnen: ' + JSON.stringify(begin.body).slice(0, 160));
  geheim = begin.body.geheim;
  const aan = await api('/api/mijn/tweefactor/bevestig', { code: totpCode(geheim, Date.now(), 30) }, ownerToken);
  assert.equal(aan.status, 200, JSON.stringify(aan.body));

  const r = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD });
  assert.equal(r.status, 200);
  assert.equal(r.body.token, undefined, 'op alleen het wachtwoord hoort er geen token uit te komen');
  assert.equal(r.body.tweedeFactorNodig, true);
  assert.ok(r.body.bewijs, 'wel een bewijs voor de tweede stap');
});

test('3. de tweede stap: een foute code weigert, de juiste geeft het korte techniektoken', async () => {
  const stap1 = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD });
  const fout = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: foutCode() });
  assert.equal(fout.status, 403);
  assert.equal(fout.body.token, undefined);
  const goed = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: juisteCode() });
  assert.equal(goed.status, 200, JSON.stringify(goed.body));
  assert.ok(goed.body.token);
  assert.equal(goed.body.eigenaar, true);
  // het token is dat van deze pagina: een dag, geen dertig
  const [, exp] = Buffer.from(goed.body.token.split('.')[0], 'base64url').toString().split('.');
  assert.ok(Number(exp) - Date.now() <= 86400000 + 5000, 'een techniektoken geldt een dag');
  // en het bewijs is na gebruik ingetrokken
  const nogEens = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: juisteCode() });
  assert.equal(nogEens.status, 401, 'een gebruikt bewijs werkt geen tweede keer');
});

test('4. de bewijzen zijn niet uitwisselbaar tussen de twee deuren', async () => {
  const tech = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD });
  const viaLid = await api('/api/auth/tweede', { bewijs: tech.body.bewijs, code: juisteCode() });
  assert.equal(viaLid.status, 401, 'een techniekbewijs geeft bij /api/auth/tweede geen token van dertig dagen');
  const lid = await api('/api/auth/login', { login: LOGIN, password: WACHTWOORD, pasApp: 'business' });
  assert.ok(lid.body.bewijs, 'de gewone inlog vraagt ook de tweede factor');
  const viaTech = await api('/api/techniek/inloggen', { bewijs: lid.body.bewijs, code: juisteCode() });
  assert.equal(viaTech.status, 401, 'een gewoon inlogbewijs opent de techniekpagina niet');
});

test('5. de rem is gedeeld: tien foute codes hier sluiten ook de gewone tweede stap', async () => {
  for (let i = 1; i <= 10; i++) {
    const stap1 = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD }, null, '198.51.100.' + i);
    const r = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: foutCode() }, null, '198.51.100.' + i);
    assert.equal(r.status, 403, 'poging ' + i);
  }
  const stap1 = await api('/api/techniek/inloggen', { login: LOGIN, wachtwoord: WACHTWOORD }, null, '198.51.100.99');
  const dicht = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: juisteCode() }, null, '198.51.100.99');
  assert.equal(dicht.status, 429, 'op slot is op slot, ook voor de juiste code');
  const lid = await api('/api/auth/login', { login: LOGIN, password: WACHTWOORD, pasApp: 'business' }, null, '198.51.100.98');
  const viaLid = await api('/api/auth/tweede', { bewijs: lid.body.bewijs, code: juisteCode() }, null, '198.51.100.98');
  assert.equal(viaLid.status, 429, 'dezelfde accountemmer');
});

test('6. het recht wordt in de tweede stap opnieuw gelezen: ingetrokken tussen stap een en twee is dicht', async () => {
  /* Het bewijs leeft vijf minuten. De herkeuring liet de hercontrole weg en geen
     toets zakte; met deze wel. Een eigen account, want de eigenaar zit na toets 5
     op slot. */
  const email = 'techniek-tweede6@voorbeeld.test';
  const reg = await api('/api/auth/register', { name: 'Tech Zes', email, password: 'geheim12', geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + JSON.stringify(reg.body).slice(0, 160));
  const verleen = await api('/api/techniek/toegang', { email }, ownerToken);
  assert.equal(verleen.status, 200, 'de eigenaar verleent toegang: ' + JSON.stringify(verleen.body).slice(0, 160));
  const begin = await api('/api/mijn/tweefactor/begin', { huidig: 'geheim12' }, reg.body.token);
  await api('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.body.geheim, Date.now(), 30) }, reg.body.token);
  const stap1 = await api('/api/techniek/inloggen', { login: email, wachtwoord: 'geheim12' });
  assert.ok(stap1.body.bewijs, 'met recht en tweede factor komt er een bewijs: ' + JSON.stringify(stap1.body).slice(0, 160));
  const intrek = await api('/api/techniek/toegang', { email, actie: 'intrek' }, ownerToken);
  assert.equal(intrek.status, 200, 'de eigenaar trekt het recht in: ' + JSON.stringify(intrek.body).slice(0, 160));
  const stap2 = await api('/api/techniek/inloggen', { bewijs: stap1.body.bewijs, code: totpCode(begin.body.geheim, Date.now() + 30000, 30) });
  assert.equal(stap2.status, 401, 'zonder recht geen techniektoken, ook met de juiste code (kreeg ' + stap2.status + ')');
  assert.equal(stap2.body.token, undefined);
});
