/* DE FOODCOURT: één mandje, meer keukens.

   De vijfde en laatste naad, en de enige die niet over TOEGANG gaat maar over
   VERDELING. Bij de tafel, de kamer, de bezorging en de band was de vraag "hoe
   bewijs je dat dit van jou is". Hier is het "hoe komt één mandje bij drie
   zaken terecht zonder dat ze elkaars bestelling zien".

   De drie beweringen die geld kosten als ze niet kloppen:

   1. PER ZAAK EEN REKENING. Eén rekening over drie zaken zou betekenen dat de
      ene zaak de omzet van de andere in zijn dagcijfers krijgt. De toets kijkt
      bij beide zaken of ze precies hun eigen deel zien -- en niet dat van de
      buurman.
   2. DEZELFDE SLEUTEL TELT PER LOKET EEN KEER. Twee keer op Bestellen tikken
      mag geen dubbel mandje geven -- bij geen van de loketten. (Hier stond
      eerst dat de sleutel de zaakcode erbij moet krijgen; een mutatie liet zien
      dat dat niet zo is, want de idempotentiekaart staat al per zaak. De
      bewering is aangepast aan wat er echt gebeurt.)
   3. DEELS GELUKT IS GEEN 200. Is de sushi uitverkocht terwijl de pizza al bij
      de keuken ligt, dan valt die pizza niet meer terug te halen. Het antwoord
      is dan 207 met per loket wat er wel en niet is gelukt -- niet een vinkje
      en niet een fout die doet alsof er niets is gebeurd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, LID, ZAAK_A, ZAAK_B;
const A = 'KIKUNOI';           // Sal de Mar
let B = null;                  // een tweede eetgelegenheid uit de zaaiset
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gastfc-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function zaakInlog(code) {
  const roster = (await post('/api/supplier/roster', { code })).body;
  if (!roster || !roster.staff || !roster.staff.length) return null;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  return (await post('/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const u = String(Date.now());
  const reg = await post('/api/auth/register', { name: 'Foodcourtganger', email: 'fc' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  LID = reg.body.token;
  assert.ok(LID, 'een lid kan zich registreren');

  ZAAK_A = await zaakInlog(A);
  assert.ok(ZAAK_A, 'de eerste zaak kan inloggen');

  /* HET TWEEDE LOKET. Van de negen zaken in de zaaiset hebben er precies twee
     een menu: KIKUNOI (restaurant) en PONTO (bar). Dat is hier geen detail maar
     de hele opstelling -- zonder tweede kaart valt er niets over twee loketten
     te bewijzen.

     En het staat als een HARDE eis en niet als een `skip`. Eerst stond hier een
     lijst met verzonnen codes en een `t.skip()` als er niets bij zat; alle vier
     de toetsen werden toen overgeslagen en het bestand meldde vrolijk "0 fail".
     Dat is LAT-regel 9: een toets die niet kan zakken is slechter dan geen
     toets, en een die zichzelf stil overslaat is precies dat. */
  B = 'PONTO';
  ZAAK_B = await zaakInlog(B);
  assert.ok(ZAAK_B, 'het tweede loket (' + B + ') kan inloggen');
  const kaartB = await post('/api/gast/bezorg/kaart', { zaak: B }, LID);
  assert.ok((kaartB.body.kaart || []).length,
    'het tweede loket heeft een kaart; zonder tweede kaart toetst dit bestand niets');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const kaartVan = async (code) => (await post('/api/gast/bezorg/kaart', { zaak: code }, LID)).body.kaart;

test('een mandje bij twee loketten wordt twee rekeningen, elk bij zijn eigen zaak', async () => {
  const kaartA = await kaartVan(A);
  const kaartB = await kaartVan(B);
  const itemA = kaartA.find(k => !k.alcohol && !k.uitverkocht);
  const itemB = kaartB.find(k => !k.alcohol && !k.uitverkocht);

  const uit = await post('/api/gast/foodcourt/bestel', { items: [
    { zaak: A, itemId: itemA.id, aantal: 1 },
    { zaak: B, itemId: itemB.id, aantal: 2 }
  ] }, LID);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 240));
  assert.equal(uit.body.gelukt, 2);
  assert.equal(uit.body.mandje.delen.length, 2, 'twee loketten, twee delen');
  assert.equal(uit.body.mandje.totaal, itemA.centen + itemB.centen * 2,
    'het totaal van het mandje is de som van de loketten');
  assert.ok(uit.body.mandje.delen.every(d => d.afhaalcode), 'elk loket geeft een eigen afhaalcode');

  /* En nu het punt: ziet elke zaak ALLEEN zijn eigen deel? */
  const bijA = await post('/api/supplier/horeca/rekeningen', { status: 'open', kanaal: 'afhaal' }, ZAAK_A);
  const bijB = await post('/api/supplier/horeca/rekeningen', { status: 'open', kanaal: 'afhaal' }, ZAAK_B);
  const somA = bijA.body.rekeningen.reduce((t, r) => t + r.totalen.netto, 0);
  const somB = bijB.body.rekeningen.reduce((t, r) => t + r.totalen.netto, 0);
  assert.equal(somA, itemA.centen, 'zaak A ziet alleen wat bij A is besteld');
  assert.equal(somB, itemB.centen * 2, 'zaak B ziet alleen wat bij B is besteld');
});

test('dezelfde idempotentiesleutel laat geen enkel loket overslaan', async () => {
  const kaartA = await kaartVan(A);
  const kaartB = await kaartVan(B);
  const itemA = kaartA.find(k => !k.alcohol && !k.uitverkocht);
  const itemB = kaartB.find(k => !k.alcohol && !k.uitverkocht);
  const mandje = { idem: 'fc-idem-1', items: [
    { zaak: A, itemId: itemA.id, aantal: 1 },
    { zaak: B, itemId: itemB.id, aantal: 1 } ] };

  const een = await post('/api/gast/foodcourt/bestel', mandje, LID);
  assert.equal(een.status, 200, JSON.stringify(een.body).slice(0, 200));
  assert.equal(een.body.gelukt, 2, 'beide loketten krijgen hun deel');

  const twee = await post('/api/gast/foodcourt/bestel',
    Object.assign({}, mandje, { mandjeId: een.body.mandjeId }), LID);
  assert.equal(twee.status, 200);
  /* Twee keer versturen met dezelfde sleutel hoort per loket EEN keer te
     tellen -- bij ALLEBEI de loketten. Gemeten als VERSCHIL en niet als
     absoluut aantal: het lid heeft per zaak hooguit een lopende
     afhaalrekening, dus wat de vorige toets bestelde staat er nog op. Een
     absolute eis van "een regel" zou hier zakken om een reden die niets met
     idempotentie te maken heeft. */
  assert.equal(twee.body.mandje.totaal, een.body.mandje.totaal,
    'de tweede verzending voegt niets toe aan het totaal');
  const voor = Object.fromEntries(een.body.mandje.delen.map(d => [d.zaak, d.regels.length]));
  for (const d of twee.body.mandje.delen) {
    assert.equal(d.regels.length, voor[d.zaak],
      'loket ' + d.zaak + ' hoort er geen regel bij te krijgen van dezelfde sleutel');
  }
});

test('een uitverkocht loket maakt de rest niet ongedaan, en zegt dat ook', async () => {
  const kaartA = await kaartVan(A);
  const kaartB = await kaartVan(B);
  const itemA = kaartA.filter(k => !k.alcohol && !k.uitverkocht).slice(-1)[0];
  const itemB = kaartB.find(k => !k.alcohol && !k.uitverkocht);
  await post('/api/supplier/horeca/gast/uitverkocht', { itemId: itemB.id, uit: true }, ZAAK_B);

  const uit = await post('/api/gast/foodcourt/bestel', { idem: 'fc-deels-1', items: [
    { zaak: A, itemId: itemA.id, aantal: 1 },
    { zaak: B, itemId: itemB.id, aantal: 1 }
  ] }, LID);
  assert.equal(uit.status, 207, 'deels gelukt is 207, geen 200 en geen kale fout');
  assert.equal(uit.body.gelukt, 1);
  assert.equal(uit.body.mislukt, 1);
  const stuk = uit.body.uitkomsten.find(x => !x.ok);
  assert.equal(stuk.zaak, B);
  assert.equal(stuk.code, 'uitverkocht');
  assert.match(uit.body.let, /niet worden teruggehaald|al bezig/,
    'en het antwoord zegt waarom het gelukte deel blijft staan');

  await post('/api/supplier/horeca/gast/uitverkocht', { itemId: itemB.id, uit: false }, ZAAK_B);
});

test('een mandje van iemand anders is niet op te vragen', async () => {
  const kaartA = await kaartVan(A);
  const itemA = kaartA.find(k => !k.alcohol && !k.uitverkocht);
  const mijn = await post('/api/gast/foodcourt/bestel',
    { idem: 'fc-prive-1', items: [{ zaak: A, itemId: itemA.id, aantal: 1 }] }, LID);
  assert.ok(mijn.body.mandjeId);

  const u = String(Date.now()) + '9';
  const reg = await post('/api/auth/register', { name: 'Nieuwsgierig', email: 'nieuws' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const ander = reg.body.token;

  const gluur = await post('/api/gast/foodcourt/mandje', { mandjeId: mijn.body.mandjeId }, ander);
  assert.equal(gluur.status, 404,
    'een mandje hangt aan de codenaam van de gast; een ander hoort het niet te kunnen lezen');
});
