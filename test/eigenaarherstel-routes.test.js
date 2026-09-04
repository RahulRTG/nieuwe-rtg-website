/* HET EIGENAARSHERSTEL OVER DE ECHTE ROUTES.

   test/eigenaarherstel.test.js toetst de ceremonie met een gezette klok; dat is
   de enige manier om zeven dagen wachttijd te meten. Maar een kern die klopt
   zegt niets over de deuren eromheen -- dat is precies de blinde vlek die dit
   huis eerder bij het pasbesluit heeft betaald, waar de kerntoets de invoer
   zelf aanleverde en de fout in de route zat.

   Hier gaan alle zeven loketten een keer open, met de remmen en de poorten die
   er in het echt omheen staan.

   Draai los: node --test test/eigenaarherstel-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const OWNER = 'herstel-eigenaar@x.nl';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herstelroute-'));
let srv, base, tech, lid, delen, rpID, origin, sleutel;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  const url = new URL(base);
  rpID = url.hostname; origin = url.origin;
  sleutel = maakAuthenticator(rpID);
  tech = (await api('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op de technische pagina');
  lid = (await api('/api/auth/login', { login: OWNER, password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(lid, 'en heeft een ledensessie');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder ingericht quorum bestaat de publieke weg niet', async () => {
  const r = await api('/api/herstel/eigenaar/start', { deelA: 'RTGH1-1-aa', deelB: 'RTGH1-2-bb' });
  assert.equal(r.status, 404, 'fail-closed, en dat is het antwoord aan iedereen');
  const v = await api('/api/herstel/eigenaar/voltooien', { deelA: 'x', deelB: 'y' });
  assert.equal(v.status, 404);
});

test('2. de stand is van de eigenaar, en van niemand anders', async () => {
  const dicht = await api('/api/techniek/herstel/stand', {});
  assert.equal(dicht.status, 401, 'zonder sessie niet');
  const r = await api('/api/techniek/herstel/stand', {}, tech);
  assert.equal(r.status, 200);
  assert.equal(r.body.ingericht, false);
  assert.equal(r.body.wachttijdDagen, 7);
});

test('3. inrichten geeft drie delen -- en meldt luid dat er geen passkey was', async () => {
  const r = await api('/api/techniek/herstel/inrichten', {}, tech);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.delen.length, 3);
  delen = r.body.delen;
  for (const d of delen) assert.match(d, /^RTGH1-[123]-[A-Za-z0-9_-]+$/);
  assert.ok(r.body.uitleg.includes('drie plekken'), 'met de bewaarinstructie erbij');
  /* De ratel liet dit door omdat er nog geen passkey stond; dat hoort luid te
     gebeuren en niet stil (kern/zwaarbewijs.js). */
  const stand = await api('/api/techniek/herstel/stand', {}, tech);
  assert.equal(stand.body.ingericht, true);
});

test('4. een fout paar komt er niet door, een goed paar levert wachttijd', async () => {
  const fout = await api('/api/herstel/eigenaar/start', { deelA: delen[0], deelB: delen[0] });
  assert.equal(fout.status, 401, 'twee keer hetzelfde deel is geen quorum');

  const goed = await api('/api/herstel/eigenaar/start', { deelA: delen[0], deelB: delen[1] });
  assert.equal(goed.status, 200, JSON.stringify(goed.body).slice(0, 160));
  assert.ok(goed.body.klaarOp, 'er komt een moment terug en geen toegang');
  assert.ok(!goed.body.token && !goed.body.sessie, 'en zeker geen sessie');
});

test('5. voltooien kan niet binnen de wachttijd, en het venster blijft dicht', async () => {
  const v = await api('/api/herstel/eigenaar/voltooien', { deelA: delen[1], deelB: delen[2] });
  assert.equal(v.status, 425, 'de wachttijd loopt nog');
  assert.ok(v.body.klaarOp);

  const o = await api('/api/herstel/eigenaar/passkey/opties', {});
  assert.equal(o.status, 403, 'er staat geen venster open');
  const p = await api('/api/herstel/eigenaar/passkey', { antwoord: {} });
  assert.equal(p.status, 403, 'en er valt dus niets te registreren');
});

test('6. met een passkey worden inrichten en afbreken hard', async () => {
  const opties = await api('/api/webauthn/registreer/opties', {}, lid);
  const reg = await api('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(opties.body.opties.challenge, origin), naam: 'Toestel' }, lid);
  assert.equal(reg.status, 200, JSON.stringify(reg.body).slice(0, 160));

  const inr = await api('/api/techniek/herstel/inrichten', {}, tech);
  assert.equal(inr.status, 401, 'opnieuw inrichten vraagt nu de vinger');
  assert.equal(inr.body.actie, 'eigenaar-herstel-in');

  const af = await api('/api/techniek/herstel/afbreken', {}, tech);
  assert.equal(af.status, 401, 'afbreken ook');
  assert.equal(af.body.actie, 'eigenaar-herstel-af');
});

test('7. en met een geldige bevestiging breekt de eigenaar het herstel af', async () => {
  const o = await api('/api/techniek/bevestig/opties', { actie: 'eigenaar-herstel-af' }, tech);
  assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 160));
  const af = await api('/api/techniek/herstel/afbreken',
    { ceremonie: o.body.ceremonie,
      antwoord: sleutel.loginAntwoord(o.body.opties.challenge, origin, 42) }, tech);
  assert.equal(af.status, 200, 'het lopende herstel is weg: ' + JSON.stringify(af.body).slice(0, 160));

  /* EN DAARMEE IS HET GESTOLEN DELENPAAR WAARDELOOS -- de eigenschap waar het
     hele ontwerp op rust (EIGENAAR.md par. 5.3). */
  const nogmaals = await api('/api/herstel/eigenaar/voltooien', { deelA: delen[0], deelB: delen[1] });
  assert.equal(nogmaals.status, 409, 'er valt niets meer te voltooien');
  const stand = await api('/api/techniek/herstel/stand', {}, tech);
  assert.equal(stand.body.lopend, null);
});
