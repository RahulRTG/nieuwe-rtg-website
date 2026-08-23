/* DE SAML-DEUR ALS DEUR: van de heenreis tot een echt sessietoken.

   test/samlxsw.test.js doet de aanvallen op de handtekening, los van een
   server. Dit doet de andere helft: gaat er ook werkelijk iemand naar binnen,
   via de drie routes, met de body-vorm die een provider echt gebruikt (een
   formulier-POST en geen JSON)? Die vraag valt niet met een unit-toets te
   beantwoorden, en juist daar zit bespoke code: het antwoordadres leest zijn
   eigen bytes omdat de web-laag hier alleen JSON kent.

   Vier beweringen:

   1. De metadata noemt ons antwoordadres, en de heenreis zet een verzoek klaar.
   2. Een geldig antwoord levert een echt sessietoken op -- dezelfde weg als
      OIDC, tot en met het overdrachtsbewijs dat een keer werkt.
   3. Een gewrapte assertie komt er via de ECHTE deur ook niet in, en het
      antwoord verklapt niet waarom.
   4. Hetzelfde antwoord een tweede keer werkt niet: het verzoek is op.

   Draai los: node --experimental-sqlite --test test/samlacs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { startServer, stop } = require('./helper');
const idp = require('./saml-idp');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samlacs-'));
const kp = idp.sleutelpaar('acs.test');
const UITGEVER = 'https://idp.klant-saml.nl/meta';
let srv, base, tech, ACS, ONS;

const json = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Precies zoals een provider het doet: een formulier-POST, geen JSON. */
const postAcs = (xml, relay) => fetch(base + '/api/sso/saml/acs', {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ SAMLResponse: Buffer.from(xml, 'utf8').toString('base64'), RelayState: relay })
});

/* De heenreis doen en het verzoek-ID eruit halen -- dat is wat de provider
   straks in InResponseTo moet zetten. */
async function heenreis() {
  const r = await fetch(base + '/api/sso/saml/start?org=O-SAML&terug=%2Fapps%2Fwerk.html', { redirect: 'manual' });
  assert.equal(r.status, 302, 'de heenreis stuurt door');
  const u = new URL(r.headers.get('location'));
  const verzoek = zlib.inflateRawSync(Buffer.from(u.searchParams.get('SAMLRequest'), 'base64')).toString('utf8');
  assert.ok(verzoek.includes('AssertionConsumerServiceURL="' + ACS + '"'));
  return u.searchParams.get('RelayState');
}
function antwoordVoor(id, extra) {
  return idp.geldig(Object.assign({
    id: '_a-' + Math.random().toString(16).slice(2, 10), issuer: UITGEVER, sub: 'saml-user-1',
    acs: ACS, inResponseTo: id, publiek: ONS, email: 'pia@klant-saml.nl',
    naam: 'Pia Klant', groepen: ['Uitvoering'], key: kp.key
  }, extra || {}));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  ACS = base + '/api/sso/saml/acs';
  ONS = base + '/saml/metadata';
  tech = (await json('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;

  const k = await json('/api/techniek/sso', { org: 'O-SAML', naam: 'Klant SAML', issuer: 'https://idp.klant-saml.nl',
    clientId: 'cid', clientSecret: 'geheim', domeinen: 'klant-saml.nl' }, tech);
  assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 160));
  const s = await json('/api/techniek/sso/saml', { org: 'O-SAML', entityId: UITGEVER,
    ssoUrl: 'https://idp.klant-saml.nl/sso', certificaat: kp.cert }, tech);
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de metadata noemt ons antwoordadres en vraagt om ondertekende asserties', async () => {
  const r = await fetch(base + '/api/sso/saml/metadata');
  assert.equal(r.status, 200);
  const xml = await r.text();
  assert.ok(xml.includes('entityID="' + ONS + '"'));
  assert.ok(xml.includes('Location="' + ACS + '"'));
  assert.ok(xml.includes('WantAssertionsSigned="true"'));
  /* Geen ondertekencertificaat, want wij ondertekenen het AuthnRequest niet.
     Een certificaat noemen dat nergens voor wordt gebruikt is een belofte
     zonder dekking. */
  assert.ok(!xml.includes('X509Certificate'), 'geen certificaat dat we niet gebruiken');
  assert.ok(xml.includes('AuthnRequestsSigned="false"'), 'en dat staat er ook zo in');
});

test('2. een geldig antwoord levert een echt sessietoken op', async () => {
  const relay = await heenreis();
  const r = await postAcs(antwoordVoor(relay).xml, relay);
  assert.equal(r.status, 302, 'de assertie wordt aanvaard');
  const terug = new URL(r.headers.get('location'), base);
  assert.equal(terug.pathname, '/apps/app.html');
  assert.equal(terug.searchParams.get('pas'), 'rtg', 'SSO geeft nooit een betaalde pas');
  assert.equal(terug.searchParams.get('terug'), '/apps/werk.html');

  /* HET SESSIETOKEN STAAT NIET IN DE URL, en dat is de hele reden dat er een
     overdrachtsbewijs bestaat. Dit is de ruil, en hij werkt EEN keer. */
  const bewijs = terug.searchParams.get('sso');
  assert.ok(bewijs, 'er komt een overdrachtsbewijs mee');
  const w = await json('/api/sso/wissel', { sso: bewijs });
  assert.equal(w.status, 200);
  assert.ok(w.body.token, 'en dat levert een echt sessietoken');
  assert.equal((await json('/api/sso/wissel', { sso: bewijs })).status, 401, 'een tweede ruil krijgt niets');
});

test('3. een gewrapte assertie komt ook via de echte deur niet binnen', async () => {
  const relay = await heenreis();
  const echt = antwoordVoor(relay).assertieXml;
  const vals = idp.assertie({ id: '_vals', issuer: UITGEVER, sub: 'baas', acs: ACS, inResponseTo: relay,
    publiek: ONS, email: 'directeur@klant-saml.nl', metSig: false });
  const r = await postAcs(idp.response(vals + echt), relay);
  assert.equal(r.status, 401);
  const body = await r.json();
  /* De reden gaat het logboek in en niet het antwoord: "de assertie ligt buiten
     het ondertekende stuk" is precies de terugkoppeling waarmee iemand zijn
     volgende poging bijstelt. */
  assert.match(body.error, /niet gelukt/);
  assert.ok(!/assertie|handtekening|ondertekend/i.test(body.error), 'en verder niets: ' + body.error);
});

test('4. hetzelfde antwoord een tweede keer werkt niet', async () => {
  const relay = await heenreis();
  const { xml } = antwoordVoor(relay);
  assert.equal((await postAcs(xml, relay)).status, 302);
  assert.equal((await postAcs(xml, relay)).status, 400, 'het verzoek is op');

  /* En zonder RelayState is er niets om het antwoord aan op te hangen. Dat
     sluit de ONGEVRAAGDE inlog af: een assertie die iemand ergens heeft
     opgevangen, is hier niets waard. */
  assert.equal((await postAcs(xml, '')).status, 400);
  assert.equal((await postAcs(xml, '_verzonnen')).status, 400);
});
