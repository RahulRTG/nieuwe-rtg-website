/* ============================================================================
   DE HELE PASSKEY-CEREMONIE, OVER DE ECHTE ROUTES.

   test/webauthn.test.js toetst de randen: rommel eruit, geen enumeratie,
   poorten dicht, remmen aan. Wat daar NIET stond is het gelukkige pad --
   registreren en daarna met die passkey inloggen. De kop van dat bestand zei
   erover dat de echte ceremonie "in de browser-E2E met een virtuele
   authenticator" staat, en dat klopte, maar die draait niet mee in npm test.

   Het gevolg: /api/webauthn/registreer en /api/webauthn/login konden allebei
   stuk zijn zonder dat er iets rood werd. Alleen weigeren is geen bewijs dat er
   ook iets doorgelaten wordt -- een deur die altijd dicht zit haalt elke toets
   in dat bestand moeiteloos.

   EN WAAROM NIET IN test/webauthn-eigen.test.js? Die borgt de crypto, maar roept
   server/webauthn/ RECHTSTREEKS aan en geeft de verwachte origin en rpID met de
   hand mee. Precies dat verschil -- kern versus route -- verborg eerder de fout
   in het pasbesluit, waar de kern-toets de naam van de beslisser zelf aanleverde
   en de fout in de route zat. Hier komt de origin dus uit het verzoek, net zoals
   de route hem afleidt.

   Draai los: node --experimental-sqlite --test test/webauthn-ceremonie.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

let srv, base, lid, lidEmail;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wa-ceremonie-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lidEmail = 'ceremonie' + u + '@x.nl';
  const reg = await api('/api/auth/register', { name: 'Lid C', email: lidEmail, phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'het proeflid staat er');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('registreren, in de lijst, inloggen zonder wachtwoord, en weer weghalen', async () => {
  /* De route leidt rpID en origin af uit het verzoek zelf (host/origin-kop), dus
     de authenticator moet voor exact diezelfde gastheer tekenen. */
  const url = new URL(base);
  const rpID = url.hostname;                 // 127.0.0.1
  const origin = url.origin;                 // http://127.0.0.1:<poort>
  const auth = maakAuthenticator(rpID);

  const opties = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(opties.status, 200);
  const challenge = opties.body.opties.challenge;
  assert.ok(challenge, 'er is een verse challenge om te ondertekenen');

  const reg = await api('/api/webauthn/registreer',
    { antwoord: auth.registratieAntwoord(challenge, origin), naam: 'Telefoon van het lid' }, lid);
  assert.equal(reg.status, 200, 'een geldige passkey wordt aangenomen: ' + JSON.stringify(reg.body).slice(0, 200));

  const lijst = await api('/api/webauthn/lijst', {}, lid);
  assert.equal(lijst.body.sleutels.length, 1, 'en staat daarna in het beheer');
  assert.equal(lijst.body.sleutels[0].naam, 'Telefoon van het lid', 'met de naam die het lid hem gaf');

  /* INLOGGEN MET DIE PASSKEY, ZONDER WACHTWOORD. Nu verraden de login-opties wel
     degelijk een hint -- maar alleen aan wie het juiste account noemt, en dat is
     het verschil met de anti-enumeratie-toets in webauthn.test.js. */
  const lOpties = await api('/api/webauthn/opties', { login: lidEmail });
  assert.equal(lOpties.status, 200);
  assert.equal((lOpties.body.opties.allowCredentials || []).length, 1,
    'voor een account MET passkey komt er nu wel een sleutel-hint');

  const sessie = await api('/api/webauthn/login',
    { login: lidEmail, antwoord: auth.loginAntwoord(lOpties.body.opties.challenge, origin), pasApp: 'rtg' });
  assert.equal(sessie.status, 200, 'de handtekening wordt aanvaard: ' + JSON.stringify(sessie.body).slice(0, 200));
  assert.ok(sessie.body.token, 'en er komt een echte sessie uit, net als bij een wachtwoord');
  assert.equal(sessie.body.state.user.tier, 'rtg', 'op de pas van het lid zelf');

  /* DE TEGENPROEF OP DE HANDTEKENING: dezelfde ceremonie met een ANDERE sleutel
     komt er niet doorheen. Zonder deze regel zou deze toets ook groen staan op
     een server die de handtekening helemaal niet controleert.

     LET OP DE TELLER, want daar ging deze tegenproef eerst de mist in. Hij liep
     met de standaardteller, gelijk aan die van de echte login hierboven, en werd
     dus geweigerd door de kloon-controle (teller-regressie) -- hij kwam bij de
     handtekeningcontrole nooit aan. Groen om de verkeerde reden, en ontdekt
     doordat de mutatie (handtekeningcontrole uitgezet) deze toets NIET liet
     zakken. Met een hogere teller komt hij langs de kloon-controle en toetst hij
     wat hij hoort te toetsen. */
  const vreemde = maakAuthenticator(rpID);
  const lOpties2 = await api('/api/webauthn/opties', { login: lidEmail });
  const nep = await api('/api/webauthn/login',
    { login: lidEmail, pasApp: 'rtg',
      antwoord: { ...vreemde.loginAntwoord(lOpties2.body.opties.challenge, origin, 99), id: lijst.body.sleutels[0].id } });
  assert.notEqual(nep.status, 200, 'een handtekening van een andere sleutel wordt geweigerd');
  assert.ok(!nep.body.token, 'en levert geen sessie op');

  // en het lid kan zijn eigen sleutel weer weghalen
  assert.equal((await api('/api/webauthn/weg', { id: lijst.body.sleutels[0].id }, lid)).status, 200);
  assert.deepEqual((await api('/api/webauthn/lijst', {}, lid)).body.sleutels, [], 'daarna is het beheer weer leeg');
});
