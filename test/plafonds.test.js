/* DE TWEE PLAFONDS ZIJN VAN DE BOARDROOM.

   `kern/bevoegdheid/lijst.js` staat RTG toe ledengeld aan te houden op grond
   van een BESLUIT en niet van een vergunning, en dat besluit rust op drie
   voorwaarden -- waarvan "harde plafonds" er een is. Die twee getallen (het
   maximum per wallet en het maximum aan verzilverd punten-tegoed) stonden als
   constante in de code. Daarmee was de grond onder het besluit alleen te
   verzetten door een programmeur, terwijl het juist het soort getal is dat een
   bestuurder hoort te kiezen.

   Wat hier wordt vastgehouden:
   1. de boardroom kan ze zetten, en dat telt METEEN -- niet pas na een herstart;
   2. de grenzen eromheen weigeren wat het huis stukmaakt, met een uitleg;
   3. de ondergrens van het walletplafond is niet vrij te kiezen: hij hoort
      gelijk te zijn aan de grootste toegestane boeking, anders bestaat er een
      betaling die een lid niet meer kan bijladen;
   4. een kapotte koppeling SLUIT het plafond en opent het niet.

   Draai los: node --experimental-sqlite --test test/plafonds.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv, base;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function lid() {
  const u = Date.now() + '-' + (++teller);
  const r = await api('/api/auth/register', {
    name: 'Plafond Toets ' + teller, email: 'plaf-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven');
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  return r.body.token;
}
async function kantoor() {
  const r = await api('/api/office/login', { code: 'RTG-OFFICE' });
  assert.ok(r.body.token, 'het kantoor logt in: ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '' } }); base = srv.base; });
test.after(() => stop(srv && srv.child));

/* MUTATIE GEZIEN ZAKKEN: in kernlaag4b.js de regel kern.pay.koppelPlafond(...)
   weggehaald, zodat pay op zijn eigen constante bleef staan; deze toets zakte op
   "een verlaagd plafond telt meteen" (de oplading werd gewoon aangenomen).
   Teruggedraaid, daarna groen. */
test('de boardroom verzet het walletplafond, en dat telt meteen', async () => {
  const kt = await kantoor();
  const tok = await lid();

  // met het standaardplafond past vijfduizend euro er zonder meer in
  assert.equal((await api('/api/pay/oplaad', { centen: 500000, idem: 'p-1' }, tok)).status, 200);

  // de boardroom zet het plafond op precies dat bedrag
  const zet = await api('/api/office/bank/instellingen', { walletPlafondEuro: 5000 }, kt);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 200));
  assert.equal(zet.body.walletPlafondCenten, 500000);

  /* GEEN HERSTART ERTUSSEN. Dit is de kern van deze toets: dezelfde draaiende
     server hoort de nieuwe grens te gebruiken. */
  const vol = await api('/api/pay/oplaad', { centen: 100, idem: 'p-2' }, tok);
  assert.equal(vol.status, 409, 'een verlaagd plafond telt meteen');
  assert.equal(vol.body.error.includes('5000 euro'), true, 'en de melding noemt het NIEUWE bedrag: ' + vol.body.error);

  // en het lid ziet dezelfde grens op zijn eigen scherm
  const beeld = await api('/api/pay/overzicht', {}, tok);
  assert.equal(beeld.body.plafond, 500000, 'het overzicht draagt het nieuwe plafond');
  assert.equal(beeld.body.ruimte, 0);

  // omhoog werkt net zo goed, en dan kan er weer bij
  assert.equal((await api('/api/office/bank/instellingen', { walletPlafondEuro: 10000 }, kt)).status, 200);
  assert.equal((await api('/api/pay/oplaad', { centen: 100, idem: 'p-3' }, tok)).status, 200, 'ruimer telt ook meteen');
});

/* MUTATIE GEZIEN ZAKKEN: WALLET_PLAFOND_MIN in
   kern/bankregie/instellingen.js op 0 gezet; deze toets zakte op "onder de
   grootste boeking mag niet". Teruggedraaid, daarna groen. */
test('de grenzen om de plafonds weigeren wat het huis stukmaakt, met een uitleg', async () => {
  const kt = await kantoor();

  const telaag = await api('/api/office/bank/instellingen', { walletPlafondEuro: 1000 }, kt);
  assert.equal(telaag.status, 400, 'onder de grootste boeking mag niet');
  assert.match(telaag.body.error, /bijladen/i, 'en het zegt waarom: ' + telaag.body.error);

  const tehoog = await api('/api/office/bank/instellingen', { walletPlafondEuro: 250000 }, kt);
  assert.equal(tehoog.status, 400, 'en boven de bovengrens ook niet');

  const puntenTeHoog = await api('/api/office/bank/instellingen', { puntenPlafondEuro: 9000 }, kt);
  assert.equal(puntenTeHoog.status, 400, 'het punten-tegoedplafond heeft zijn eigen bovengrens');

  /* Een geweigerde instelling laat NIETS achter: half opgeslagen zou betekenen
     dat de grendel op een ander getal staat dan het scherm toont. */
  const stand = await api('/api/office/bank', {}, kt);
  assert.equal(stand.body.regie.plafonds.walletCenten, 1000000, 'het walletplafond staat nog op de vorige waarde');
});

/* Het punten-tegoedplafond, over de route van het lid heen. De ronde ervoor gaf
   dit tegoed zijn eerste plafond; deze toets houdt vast dat het nu van de
   boardroom is.

   MUTATIE GEZIEN ZAKKEN: in kern/ervaring/leden/punten.js tegoedMax() vervangen
   door de constante STANDAARD_TEGOED_MAX; deze toets zakte op "het lid ziet het
   plafond van de boardroom". Teruggedraaid, daarna groen. */
test('het punten-tegoedplafond komt van de boardroom en staat op het scherm van het lid', async () => {
  const kt = await kantoor();
  const tok = await lid();

  assert.equal((await api('/api/office/bank/instellingen', { puntenPlafondEuro: 250 }, kt)).status, 200);
  const p = await api('/api/punten', {}, tok);
  assert.equal(p.status, 200, JSON.stringify(p.body).slice(0, 160));
  assert.equal(p.body.plafondCenten, 25000, 'het lid ziet het plafond van de boardroom');
});

/* DE ONDERGRENS IS GEEN SMAAK. Twee plekken rekenen erop dat een tekort altijd
   bij te laden is; dat klopt alleen zolang het plafond boven de grootste
   toegestane boeking ligt. Deze toets legt de twee getallen naast elkaar in
   plaats van te vertrouwen dat iemand eraan denkt.

   MUTATIE GEZIEN ZAKKEN: WALLET_PLAFOND_MIN op 400000 gezet (onder MAX_CENTEN);
   deze toets zakte meteen. Teruggedraaid, daarna groen. */
test('de ondergrens van het walletplafond is precies de grootste toegestane boeking', () => {
  const { GRENZEN } = require('../server/kern/bankregie/instellingen');
  const { MAX_CENTEN } = require('../server/kern/pay/stand')();
  assert.equal(GRENZEN.WALLET_PLAFOND_MIN, MAX_CENTEN,
    'zakt de ondergrens onder MAX_CENTEN, dan bestaat er een boeking die een lid niet meer kan bijladen');
  assert.ok(GRENZEN.WALLET_PLAFOND_MAX > GRENZEN.WALLET_PLAFOND_MIN, 'en de bovengrens ligt erboven');
});

/* FAIL-CLOSED. Een kapotte of ontbrekende koppeling mag het plafond nooit
   OPENEN -- dezelfde regel als de lege vergunningslijst, die ook "nee"
   betekent. Rechtstreeks op de module, want een stukke koppeling is over HTTP
   niet na te bootsen.

   MUTATIE GEZIEN ZAKKEN: de fail-closed-regel in kern/pay/plafond.js vervangen
   door `return v;`; deze toets zakte op "een stukke koppeling sluit". */
test('een kapotte plafondkoppeling sluit de wallet in plaats van hem te openen', () => {
  const maak = require('../server/kern/pay/plafond');
  for (const stuk of [() => undefined, () => NaN, () => -1, () => 'tienduizend']) {
    const { plafondFout, walletRuimte } = maak({ saldoVan: () => 0, rekLid: c => 'lid:' + c, walletMax: stuk });
    assert.ok(plafondFout('lid:X', 1), 'een stukke koppeling sluit, en opent niet: ' + String(stuk));
    assert.equal(walletRuimte('X'), 0, 'en er is geen ruimte');
  }
  // en met een werkende koppeling gaat hij gewoon open (LAT.md regel 9)
  const goed = maak({ saldoVan: () => 0, rekLid: c => 'lid:' + c, walletMax: () => 1000000 });
  assert.equal(goed.plafondFout('lid:X', 1), null, 'met een geldig plafond past het gewoon');
});
