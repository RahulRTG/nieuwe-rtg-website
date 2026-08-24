/* EEN PASSKEY ALS TWEEDE MOMENT -- de step-up die niets erft van hoe je
   binnenkwam.

   HET GAT DAT DIT DICHT IS DOOR DEZE LAAG ZELF GEMAAKT, en dat maakt hem het
   waard om apart te toetsen. Sinds alle zes deuren hun manier wegschrijven,
   draagt een sessie van de identiteitsprovider van de klant de band
   `overgenomen` -- terecht, want wij weten niet hoe hard die provider heeft
   geverifieerd. Alleen kon zo'n mens het gevraagde tweede moment niet GEVEN:
   de technische deur vroeg een wachtwoord, en de werkruimtedeur weigerde een
   RTG-sessie die zelf te zacht is. "Nodig, maar onmogelijk", een laag hoger.

   Een passkey lost dat op omdat hij niets erft: hij is de enige manier hier met
   de band `sterk`, hij zit aan een apparaat, en hij staat los van de manier
   waarop de sessie ontstond. Dat is precies wat een tweede bewijsvoering hoort
   te zijn -- en niet dezelfde sleutel nog een keer.

   VIER BEWERINGEN, EN DRIE ERVAN ZIJN AANVALLEN:

   1. HET GELUKKIGE PAD BESTAAT. Een deur die alleen weigert, haalt elke toets
      moeiteloos; zonder deze eerste is de rest geen bewijs.
   2. DE PASSKEY VAN EEN ANDER WERKT NIET. Zonder die regel is "iemand met een
      geldige passkey" genoeg, en dat is iedereen met een eigen account.
   3. EEN CEREMONIE IS VOOR EEN KEER. Anders is een onderschepte assertie een
      abonnement op bevestigingen.
   4. HIJ MUNT GEEN SESSIE. /api/webauthn/login doet dat wel, en die route is
      dus met opzet niet hergebruikt: een step-up die een tweede sessietoken
      oplevert, vergroot de blast radius in plaats van hem te begrenzen.

   ACHT MUTATIES. Zeven raak, en de achtste OVERLEEFT met opzet:

     de ceremonie niet meer aan het account binden      -> 2
     de grens uit een kop van het verzoek halen         -> 1
     de passkey wordt niet gecontroleerd (werkruimte)   -> 1
     de passkey wordt niet gecontroleerd (techniek)     -> 4
     iedereen mag andermans ceremonie opvragen          -> 2
     de reden verzwijgt dat een passkey ook kan         -> 4
     de bon noteert een passkey als tweesleutels        -> 1
     de dubbele accountvergelijking eruit               -> GEEN

   Die laatste is verdediging in de diepte en hoort dus alleen te vallen samen
   met de grendel die hem dekt. Nagemeten en niet aangenomen: elk van de twee
   apart weghalen laat alles groen, allebei tegelijk laat toets 2 zakken.

   TWEE GATEN DIE DEZE RONDE IN DE TOETSEN ZELF ZATEN, en ze zijn allebei van
   de soort "groen om de verkeerde reden":
   - toets 4 vroeg alleen "niet 200". Dat was ook waar als de passkey helemaal
     niet werd gekeurd: dan viel hij een regel verder om op een bon die niet
     bestaat. Nu wordt de REDEN nagelopen, want de passkey hoort voor de bon te
     worden gekeurd.
   - de manier die in de bon terechtkomt werd nergens nagekeken, dus een passkey
     als `tweesleutels` wegschrijven bleef onopgemerkt.

   Draai los: node --experimental-sqlite --test test/vertrouwenpasskey.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pkstap-'));
let srv, BASE, rpID, origin;

const api = (pad, body, bearer) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, bearer ? { Authorization: 'Bearer ' + bearer } : {}),
  body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een account met een echte, geregistreerde passkey. */
async function metPasskey(naam) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
  const reg = await api('/api/auth/register', { name: naam, email: 'pk' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  const token = reg.body.token;
  const auth = maakAuthenticator(rpID);
  const opties = await api('/api/webauthn/registreer/opties', {}, token);
  const gezet = await api('/api/webauthn/registreer',
    { antwoord: auth.registratieAntwoord(opties.body.opties.challenge, origin), naam: 'Toestel' }, token);
  assert.equal(gezet.status, 200, 'de passkey staat er: ' + JSON.stringify(gezet.body).slice(0, 200));
  return { token, auth };
}

/* Een werkruimte met een directielid dat aan `rtg` gekoppeld is. */
async function werkruimte(rtgToken) {
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Passkey BV' });
  const W = w.body.werkruimte, S = { werkruimte: W, beheerToken: w.body.beheerToken };
  const maak = async (naam) => {
    const a = await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam });
    await api('/api/bedrijf/lid/besluit', { ...S, lidId: a.body.lidId, akkoord: true });
    return a.body;
  };
  const baas = await maak('Directie');
  await api('/api/bedrijf/lid/rollen', { ...S, lidId: baas.lidId, rollen: ['directie'] });
  await api('/api/bedrijf/lid/koppel', { werkruimte: W, lidToken: baas.lidToken }, rtgToken);
  return { W, S, baas, maak };
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  BASE = srv.base;
  const url = new URL(BASE);
  rpID = url.hostname; origin = url.origin;
});
test.after(async () => { await stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let mens, ruimte;

test('1. het gelukkige pad: een passkey lost de bon op, en de handeling gaat door', async () => {
  mens = await metPasskey('Directie Passkey');
  ruimte = await werkruimte(mens.token);
  const { W, baas, maak } = ruimte;

  /* Zes uitdiensttredingen op een dag: de zesde vraagt een tweede moment. */
  const mensen = [];
  for (let i = 0; i < 6; i++) mensen.push(await maak('Mens ' + i));
  const uit = (lidId, extra) => api('/api/bedrijf/lid/uit-dienst',
    Object.assign({ werkruimte: W, lidToken: baas.lidToken, lidId, reden: 'Reorganisatie.' }, extra || {}));
  for (let i = 0; i < 5; i++) assert.equal((await uit(mensen[i].lidId)).status, 200, 'nummer ' + (i + 1));

  const zes = await uit(mensen[5].lidId);
  assert.equal(zes.status, 428, JSON.stringify(zes.body).slice(0, 200));
  const bon = zes.body.bevestiging.id;

  const opties = await api('/api/bedrijf/bevestig/opties', { werkruimte: W, lidToken: baas.lidToken }, mens.token);
  assert.equal(opties.status, 200, JSON.stringify(opties.body).slice(0, 200));
  assert.ok(opties.body.ceremonie && opties.body.opties.challenge, 'een verse ceremonie om te ondertekenen');

  const goed = await api('/api/bedrijf/bevestig', { werkruimte: W, lidToken: baas.lidToken, id: bon,
    passkey: { ceremonie: opties.body.ceremonie,
      antwoord: mens.auth.loginAntwoord(opties.body.opties.challenge, origin, 1) } }, mens.token);
  assert.equal(goed.status, 200, 'de passkey bevestigt: ' + JSON.stringify(goed.body).slice(0, 200));

  assert.equal((await uit(mensen[5].lidId, { bevestiging: bon })).status, 200, 'en de handeling gaat door');

  /* HIJ MUNT GEEN SESSIE. Zou deze deur er een teruggeven, dan levert elke
     bevestiging een extra sleutel op -- een step-up die de blast radius
     vergroot in plaats van hem te begrenzen. */
  assert.equal(goed.body.token, undefined, 'een bevestiging geeft geen sessietoken terug');
  assert.equal(goed.body.state, undefined, 'en ook geen ingelogde staat');

  /* EN DE BON ZEGT WAARMEE ER IS BEVESTIGD. Een passkey als `tweesleutels`
     wegschrijven laat de Trust Receipt liegen over hoe hard dit moment was --
     de gunstige kant op deze keer, maar even onwaar. */
  const tech = (await api('/api/techniek/inloggen',
    { login: 'roellie.i@gmail.com', wachtwoord: process.env.DEMO_PASS || 'Imran' })).body.token;
  const bonnen = await api('/api/techniek/vertrouwen/bonnen', { hoeveel: 30 }, tech);
  const rij = bonnen.body.bonnen.filter(b => b.soort === 'mens.uitdienst' && b.doel === mensen[5].lidId);
  assert.equal(rij.length, 1, 'de zesde uitdiensttreding staat er precies een keer als bon');
  const zin = JSON.stringify(rij[0].beweringen);
  assert.match(zin, /passkey/,
    'de bon noemt de passkey en niet de manier die het zonder passkey zou zijn geweest: ' + zin.slice(0, 300));
  assert.match(zin, /tweede moment is gevraagd en gegeven/, zin.slice(0, 300));
});

test('2. de passkey van een ander bevestigt niets', async () => {
  const { W, baas, maak } = ruimte;
  const vreemde = await metPasskey('Iemand anders');

  const nog = await maak('Mens 9');
  const zes = await api('/api/bedrijf/lid/uit-dienst',
    { werkruimte: W, lidToken: baas.lidToken, lidId: nog.lidId, reden: 'Reorganisatie.' });
  assert.equal(zes.status, 428, 'het budget is nog steeds op');
  const bon = zes.body.bevestiging.id;

  /* De vreemde vraagt zijn EIGEN ceremonie op en tekent die netjes -- een
     geldige assertie, alleen van het verkeerde account. Zonder de vergelijking
     in passkeystap.js zou dit doorgaan. */
  const zijne = await api('/api/webauthn/opties', { login: null });
  const antwoord = vreemde.auth.loginAntwoord(zijne.body.opties.challenge, origin, 1);

  const mis = await api('/api/bedrijf/bevestig', { werkruimte: W, lidToken: baas.lidToken, id: bon,
    passkey: { ceremonie: zijne.body.ceremonie, antwoord } }, mens.token);
  assert.notEqual(mis.status, 200, 'een passkey van een ander account bevestigt niets: ' + JSON.stringify(mis.body).slice(0, 200));

  /* TWEE GRENDELS DIE ELKAAR DEKKEN, en dat is met opzet. De ceremonie is al
     aan een account gebonden (kern/webauthn.js bewaart de login bij de
     challenge), en passkeystap.js legt de uitkomst er daarna NOG een keer
     naast. Elk van de twee alleen weghalen laat deze toets groen -- ze dekken
     elkaar. Allebei tegelijk weghalen laat hem zakken, en dat is precies wat
     "verdediging in de diepte" hoort te betekenen: nagemeten en niet beweerd. */

  /* En de RTG-sessie van de vreemde helpt hem ook niet: dat lid-token is niet
     van hem, en dat wordt gecontroleerd voordat er iets met een passkey gebeurt. */
  const anders = await api('/api/bedrijf/bevestig/opties', { werkruimte: W, lidToken: baas.lidToken }, vreemde.token);
  assert.equal(anders.status, 403, 'en hij krijgt niet eens een ceremonie voor andermans lid');
  assert.match(anders.body.error, /ander account/);

  const naderhand = await api('/api/bedrijf/lid/uit-dienst',
    { werkruimte: W, lidToken: baas.lidToken, lidId: nog.lidId, reden: 'Reorganisatie.', bevestiging: bon });
  assert.equal(naderhand.status, 428, 'de bon is nooit opgelost, dus de handeling gaat niet door');
});

test('3. een ceremonie is voor EEN keer', async () => {
  const { W, baas, maak } = ruimte;
  const een = await maak('Mens 10');
  const twee = await maak('Mens 11');
  const vraag = (lidId) => api('/api/bedrijf/lid/uit-dienst',
    { werkruimte: W, lidToken: baas.lidToken, lidId, reden: 'Reorganisatie.' });

  const bonA = (await vraag(een.lidId)).body.bevestiging.id;
  const opties = await api('/api/bedrijf/bevestig/opties', { werkruimte: W, lidToken: baas.lidToken }, mens.token);
  const antwoord = mens.auth.loginAntwoord(opties.body.opties.challenge, origin, 2);
  const bewijs = { ceremonie: opties.body.ceremonie, antwoord };

  assert.equal((await api('/api/bedrijf/bevestig',
    { werkruimte: W, lidToken: baas.lidToken, id: bonA, passkey: bewijs }, mens.token)).status, 200);

  /* Dezelfde assertie, een tweede bon. Wie hem onderschept mag er geen
     abonnement op bevestigingen aan overhouden. */
  const bonB = (await vraag(twee.lidId)).body.bevestiging.id;
  const nogmaals = await api('/api/bedrijf/bevestig',
    { werkruimte: W, lidToken: baas.lidToken, id: bonB, passkey: bewijs }, mens.token);
  assert.notEqual(nogmaals.status, 200, 'een gebruikte ceremonie is op: ' + JSON.stringify(nogmaals.body).slice(0, 200));
});

test('4. de technische deur neemt ook een passkey, en zegt waarom als je er geen hebt', async () => {
  /* Dezelfde reparatie aan de andere kant van het huis: een tenant vernietigen
     vraagt elke keer een bon, en die was alleen met een wachtwoord te geven. */
  const tech = (await api('/api/techniek/inloggen',
    { login: 'roellie.i@gmail.com', wachtwoord: process.env.DEMO_PASS || 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op de technische pagina');

  const opties = await api('/api/techniek/vertrouwen/passkey', {}, tech);
  assert.equal(opties.status, 200, JSON.stringify(opties.body).slice(0, 200));
  assert.ok(opties.body.ceremonie, 'ook hier een verse ceremonie');

  /* Dit account heeft geen passkey, dus de assertie van een ANDER toestel hoort
     te falen -- en met een reden die uitlegt wat er wel kan. */
  const mis = await api('/api/techniek/tenant/bevestig',
    { id: 'bestaat-niet', passkey: { ceremonie: opties.body.ceremonie,
      antwoord: mens.auth.loginAntwoord(opties.body.opties.challenge, origin, 3) } }, tech);
  assert.notEqual(mis.status, 200, JSON.stringify(mis.body).slice(0, 200));
  /* EN OP WELKE GROND HIJ FAALT, want daar zat een gat in deze toets. "Niet
     200" was ook waar als de passkey helemaal niet werd gecontroleerd: dan viel
     hij een regel verder om op de bon die niet bestaat. Een mutatie die de
     controle eruit haalde, bleef daardoor groen. De passkey hoort VOOR de bon
     te worden gekeurd, en dat is aan de reden te zien. */
  assert.match(mis.body.error, /passkey/i,
    'de passkey wordt gekeurd voordat er naar de bon wordt gekeken: ' + JSON.stringify(mis.body).slice(0, 200));

  const zonder = await api('/api/techniek/tenant/bevestig', { id: 'bestaat-niet', wachtwoord: 'fout' }, tech);
  assert.equal(zonder.status, 401);
  assert.match(zonder.body.error, /passkey/,
    'wie geen wachtwoord heeft, hoort te lezen dat een passkey ook kan');
});
