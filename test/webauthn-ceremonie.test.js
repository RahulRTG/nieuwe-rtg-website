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

   Draai los: node --test test/webauthn-ceremonie.test.js
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

  const uvOpties = await api('/api/webauthn/registreer/opties', {}, lid);
  const zonderUv = await api('/api/webauthn/registreer',
    { antwoord: auth.registratieAntwoord(uvOpties.body.opties.challenge, origin, { zonderUv: true }),
      naam: 'Onbeveiligde sleutel' }, lid);
  assert.equal(zonderUv.status, 400,
    'alleen aanwezigheid is niet genoeg: de server eist ook lokale biometrie/pincode');

  const opties = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(opties.status, 200);
  assert.equal(opties.body.opties.authenticatorSelection.residentKey, 'required',
    'nieuwe passkeys zijn vindbaar, zodat de deur geen e-mailadres vooraf nodig heeft');
  assert.equal(opties.body.opties.authenticatorSelection.userVerification, 'required',
    'de authenticator moet de mens op het toestel controleren');
  const challenge = opties.body.opties.challenge;
  assert.ok(challenge, 'er is een verse challenge om te ondertekenen');

  const reg = await api('/api/webauthn/registreer',
    { antwoord: auth.registratieAntwoord(challenge, origin), naam: 'Telefoon van het lid' }, lid);
  assert.equal(reg.status, 200, 'een geldige passkey wordt aangenomen: ' + JSON.stringify(reg.body).slice(0, 200));

  const lijst = await api('/api/webauthn/lijst', {}, lid);
  assert.equal(lijst.body.sleutels.length, 1, 'en staat daarna in het beheer');
  assert.equal(lijst.body.sleutels[0].naam, 'Telefoon van het lid', 'met de naam die het lid hem gaf');

  // Een credential-id hoort wereldwijd bij één account. Ook iemand die op een
  // tweede, geldig ingelogd account dezelfde sleutel probeert te registreren,
  // mag de naamloze accountzoeker niet dubbelzinnig kunnen maken.
  const tweede = await api('/api/auth/register', { name: 'Lid Twee', email: 'tweede-' + Date.now() + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' });
  const optiesTweede = await api('/api/webauthn/registreer/opties', {}, tweede.body.token);
  const dubbel = await api('/api/webauthn/registreer',
    { antwoord: auth.registratieAntwoord(optiesTweede.body.opties.challenge, origin), naam: 'Dezelfde sleutel' }, tweede.body.token);
  assert.equal(dubbel.status, 409, 'dezelfde credential-id kan niet aan twee accounts hangen');

  /* DE NIEUWE DEUR: geen e-mailadres vooraf. Twee tegelijk geopende ceremonies
     krijgen elk hun eigen eenmalige sleutel; de tweede mag de eerste dus niet
     overschrijven. De authenticator geeft na lokale verificatie de credential-
     id terug en pas DAN zoekt RTG het account erbij. */
  const deurA = await api('/api/webauthn/opties', {});
  const deurB = await api('/api/webauthn/opties', {});
  assert.equal(deurA.status, 200);
  assert.equal(deurB.status, 200);
  assert.deepEqual(deurA.body.opties.allowCredentials || [], [], 'RTG stuurt vooraf geen account-hints');
  assert.notEqual(deurA.body.ceremonie, deurB.body.ceremonie, 'elke poging heeft een eigen ceremonie');

  const deurZonderUv = await api('/api/webauthn/opties', {});
  const loginZonderUv = await api('/api/webauthn/login', { ceremonie: deurZonderUv.body.ceremonie,
    antwoord: auth.loginAntwoord(deurZonderUv.body.opties.challenge, origin, 1, { zonderUv: true }), pasApp: 'rtg' });
  assert.equal(loginZonderUv.status, 401,
    'ook bij inloggen controleert de server zelf de UV-vlag, niet alleen het browserverzoek');

  const directA = await api('/api/webauthn/login', { ceremonie: deurA.body.ceremonie,
    antwoord: auth.loginAntwoord(deurA.body.opties.challenge, origin, 1), pasApp: 'rtg' });
  assert.equal(directA.status, 200, 'de naamloze deur aanvaardt de passkey: ' + JSON.stringify(directA.body).slice(0, 200));
  assert.ok(directA.body.token, 'de eerste ceremonie levert een echte sessie');

  const directB = await api('/api/webauthn/login', { ceremonie: deurB.body.ceremonie,
    antwoord: auth.loginAntwoord(deurB.body.opties.challenge, origin, 2), pasApp: 'rtg' });
  assert.equal(directB.status, 200, 'ook de gelijktijdig geopende tweede ceremonie blijft geldig');

  const herhaal = await api('/api/webauthn/login', { ceremonie: deurA.body.ceremonie,
    antwoord: auth.loginAntwoord(deurA.body.opties.challenge, origin, 3), pasApp: 'rtg' });
  assert.equal(herhaal.status, 400, 'een gebruikte ceremonie is niet opnieuw af te spelen');

  /* De gerichte route blijft bestaan voor oude, niet-vindbare passkeys: pas na
     "Andere manier" noemt iemand zijn account. */
  const lOpties = await api('/api/webauthn/opties', { login: lidEmail });
  assert.equal(lOpties.status, 200);
  assert.equal((lOpties.body.opties.allowCredentials || []).length, 8,
    'de gerichte terugval heeft een vaste vorm en verraadt het sleutelaantal niet');
  assert.ok(lOpties.body.opties.allowCredentials.some(c => c.id === lijst.body.sleutels[0].id),
    'de echte sleutel zit wel tussen de afgeschermde hints');

  const sessie = await api('/api/webauthn/login',
    { login: lidEmail, ceremonie: lOpties.body.ceremonie,
      antwoord: auth.loginAntwoord(lOpties.body.opties.challenge, origin, 3), pasApp: 'rtg' });
  assert.equal(sessie.status, 200, 'de handtekening wordt aanvaard: ' + JSON.stringify(sessie.body).slice(0, 200));
  assert.ok(sessie.body.token, 'en er komt een echte sessie uit, net als bij een wachtwoord');
  assert.equal(sessie.body.state.user.tier, 'rtg', 'op de pas van het lid zelf');

  /* De RTG PIN gebruikt diezelfde passkey voor een action-bound step-up. Een
     gestolen open sessie mag een noodslot wel AAN zetten (veilig), maar niet
     opheffen of het adres vernieuwen zonder de eigenaar opnieuw op het toestel
     te controleren. */
  const dicht = await api('/api/member/pin/uit', { bevroren: true }, lid);
  assert.equal(dicht.status, 200);
  assert.equal(dicht.body.bevroren, true);
  assert.notEqual((await api('/api/member/pin/uit', { bevroren: false }, lid)).status, 200,
    'een open sessie alleen kan het noodslot niet opheffen zodra een passkey bestaat');
  const stap = await api('/api/member/pin/actie/opties', { actie: 'rtg-pin-noodslot-uit' }, lid);
  assert.equal(stap.status, 200);
  assert.equal(stap.body.nodig, true);
  assert.equal(stap.body.opties.userVerification, 'required');
  const stapAntwoord = auth.loginAntwoord(stap.body.opties.challenge, origin, 4);
  const open = await api('/api/member/pin/uit', { bevroren: false,
    ceremonie: stap.body.ceremonie, antwoord: stapAntwoord }, lid);
  assert.equal(open.status, 200, 'de passkey bevestigt precies het opheffen van het noodslot');
  assert.equal(open.body.bevroren, false);
  assert.notEqual((await api('/api/member/pin/nieuw', {
    ceremonie: stap.body.ceremonie, antwoord: stapAntwoord }, lid)).status, 200,
  'dezelfde action-bound ceremonie is niet herbruikbaar voor PIN-vernieuwing');

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
    { login: lidEmail, ceremonie: lOpties2.body.ceremonie, pasApp: 'rtg',
      antwoord: { ...vreemde.loginAntwoord(lOpties2.body.opties.challenge, origin, 99), id: lijst.body.sleutels[0].id } });
  assert.notEqual(nep.status, 200, 'een handtekening van een andere sleutel wordt geweigerd');
  assert.ok(!nep.body.token, 'en levert geen sessie op');

  /* En het lid kan zijn eigen sleutel weer weghalen -- maar niet zomaar meer.
     Weghalen is sinds de zware poort (kern/zwaarbewijs.js) zelf een handeling
     die om de passkey vraagt: anders haalt een gestolen open sessie eerst de
     sleutels weg en staat daarna alles weer open met alleen een wachtwoord.
     Het gevolg voor een mens staat in EIGENAAR.md: wie maar één toestel heeft
     en dat kwijtraakt, krijgt zijn eigen sleutel er niet meer af. Vandaar de
     regel dat er twee staan. */
  const kaal = await api('/api/webauthn/weg', { id: lijst.body.sleutels[0].id }, lid);
  assert.equal(kaal.status, 401, 'weghalen zonder bevestiging kan niet meer');
  assert.equal(kaal.body.actie, 'passkey-weg');

  const wegOpties = await api('/api/webauthn/bevestig/opties', {}, lid);
  assert.equal(wegOpties.status, 200, JSON.stringify(wegOpties.body).slice(0, 160));
  const weg = await api('/api/webauthn/weg', { id: lijst.body.sleutels[0].id,
    ceremonie: wegOpties.body.ceremonie,
    antwoord: auth.loginAntwoord(wegOpties.body.opties.challenge, origin, 9) }, lid);
  assert.equal(weg.status, 200, 'met de vinger erbij mag het wel: ' + JSON.stringify(weg.body).slice(0, 160));
  assert.equal(weg.body.laatste, true,
    'en het antwoord zegt dat dit de laatste was -- dat hoort het scherm te weten op het moment ' +
    'zelf, want zonder sleutel valt de zware poort terug op het wachtwoord');

  const na = await api('/api/webauthn/lijst', {}, lid);
  assert.deepEqual(na.body.sleutels, [], 'daarna is het beheer weer leeg');
  /* MAAR HET SPOOR NIET. Een weggehaalde sleutel liet niets achter, en dat is
     precies de vraag die je stelt nadat er iets gebeurd is. */
  assert.equal(na.body.spoor.length, 1, 'het weghalen staat in het spoor');
  assert.equal(na.body.spoor[0].naam, 'Telefoon van het lid', 'met het label dat de mens zelf gaf');
  assert.ok(na.body.spoor[0].weg, 'en het moment waarop hij verdween');
  assert.ok(!('id' in na.body.spoor[0]),
    'zonder credential-id: dat is over accounts heen te herkennen en hoort niet achter te blijven');
});
