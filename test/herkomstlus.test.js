/* DE HERKOMSTPOORT IN DE LUS -- de regel stond, en werkte nergens.

   WAT HIER GEREPAREERD IS EN WAAROM HET DE ERGSTE SOORT FOUT WAS. De
   herkomstlaag (kern/isolatie/herkomst.js: 13 kanalen, 4 klassen) werd
   afgedwongen in kern/stuur/isolatiefilter.js, maar de enige productie-aanroeper
   gaf het argument niet mee -- `stuurPaden(app, wereld, context)`, drie
   argumenten. Daardoor was `bronnen` altijd `undefined`, gaf
   `sluitDoorHerkomst([])` altijd `[]` terug en draaide de hele herkomstbranche
   NOOIT. Het register meldde ondertussen `handhaaft: true`.

   Een regel die staat en nergens draait, is gevaarlijker dan geen regel: hij
   ziet er in een register uit als bescherming, dus niemand bouwt hem.

   DRIE BEWERINGEN, en de derde is de belangrijkste:
   1. de lus geeft zijn kanalen door (bron gelezen, geen gedrag);
   2. een geslaagd toolantwoord besmet het gesprek, en LEZEN loopt door;
   3. de poort staat bij `doe` en niet alleen bij de kaart. Dat is de dragende
      helft: de kaart komt bij stap n en `doe` bij stap n+3, dus het model heeft
      de bredere lijst allang gezien. Alleen de lijst versmallen sluit niets.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `vuil.bronnen()` weghalen uit de stuurPaden-aanroep in lus.js
     -> 1 ZAKT (RAAK; en test/herkomst.test.js toets 7 zakt mee).
   - `meldToolantwoord` tot een lege functie maken   -> 2 EN 3 ZAKKEN (RAAK).
   - het melden NA de aanroep-teruggave zetten       -> 3 ZAKT (RAAK: de eerste
     besmette beurt komt er dan doorheen).
   - de aanroep van magMetHerkomst uit lusstap.js halen -> 3 ZAKT (RAAK).
   - in herkomstpoort.js de leesset-toets weghalen   -> 2 ZAKT op het lezen.

   WAT DEZE TOETS NIET BEWEERT: dat de poort vandaag ook BIJT. Hij loopt in de
   schaduw (RTG_HERKOMST_AFDWINGEN), want CONTROLPLANE.md zegt dat je niet kunt
   afdwingen wat nooit in de schaduw heeft gelopen. Toets 3 zet de vlag daarom
   expliciet aan en meet de bijtende stand; toets 4 meet dat hij zonder vlag
   TELT en niets tegenhoudt. Die twee horen allebei te bestaan -- een poort die
   alleen bijtend is getoetst, weet niemand hoe hij zich in de schaduw gedraagt.

   Draai los: node --test test/herkomstlus.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const besmetting = require('../server/kern/stuur/besmetting');
const maakLusstap = require('../server/kern/stuur/lusstap');
const beleid = require('../server/kern/stuur/beleid');
const { maakIsolatiefilter } = require('../server/kern/stuur/isolatiefilter');
const maakIsolatie = require('../server/kern/isolatie');
const functies = require('../server/functies');
const klok = require('../server/lib/klok');

/* Een isolatielaag op een lege database: er staat geen enkele stand aan, zodat
   wat deze toets meet ALLEEN van de herkomst komt en niet van een stand. */
function laag() {
  const db = { data: {} };
  return maakIsolatie({ db, save: () => {}, functies, klok, huisStand: () => 'normaal' });
}

test('1. de lus geeft zijn kanalen door aan de kaart', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/lus.js'), 'utf8');
  assert.match(bron, /stuurPaden\(app, opties\.wereld, isoContext\(\), vuil\.bronnen\(\)\)/,
    'de kaart van de lus hoort de kanalen van dit gesprek mee te krijgen; zonder dat vierde ' +
    'argument staat de hele herkomstregel er voor niets');
  assert.match(bron, /besmetting\.nieuw\(\)/,
    'en de boekhouding hoort PER GESPREK te worden gemaakt: een exemplaar per proces laat twee ' +
    'gesprekken elkaars besmetting erven');
});

/* Een nagebouwde lusstap met een gestubde stuurRoep. De echte lus praat met een
   model; wat hier wordt gemeten is de POORT en de BOEKHOUDING, en die zitten
   allebei in lusstap.js. */
function opstelling({ afdwingen }) {
  const iso = laag();
  const filter = maakIsolatiefilter({ isolatie: iso, beleid });
  const vuil = besmetting.nieuw();
  const geroepen = [];
  const stap = maakLusstap({
    filter, vuil,
    stuurRoep: async (req, pad) => { geroepen.push(pad); return { status: 200, ok: true }; }
  });
  const oud = process.env.RTG_HERKOMST_AFDWINGEN;
  if (afdwingen) process.env.RTG_HERKOMST_AFDWINGEN = '1';
  else delete process.env.RTG_HERKOMST_AFDWINGEN;
  return { iso, filter, vuil, stap, geroepen,
    herstel: () => { if (oud === undefined) delete process.env.RTG_HERKOMST_AFDWINGEN;
      else process.env.RTG_HERKOMST_AFDWINGEN = oud; } };
}

/* De twijfelpoort (kern/rahul/twijfel.js) staat VOOR de herkomstpoort en eist
   `zeker: true` plus een uitgeschreven `begrepen`. Die worden hier echt
   geleverd: een toets die om de eerste poort heen gaat, meet de tweede nooit. */
const doe = (pad) => ({ name: 'doe', id: 't1',
  input: { pad, zeker: true, begrepen: 'de gebruiker vroeg dit voor zichzelf' } });

test('2. een geslaagd toolantwoord besmet het gesprek, en lezen loopt door', async () => {
  const o = opstelling({ afdwingen: false });
  try {
    const iso = o.iso;
    const alles = ['/api/agenda/mijn', '/api/bank/afschrift', '/api/pay/stuur'];
    const ctx = iso.context({ identiteit: 'cn-1' });

    /* Vers gesprek: alleen gezaghebbende bronnen, dus er valt niets te sluiten. */
    const voor = o.filter.versmal(alles, ctx, 'member', o.vuil.bronnen());
    assert.deepEqual(voor.paden, alles, 'een vers gesprek versmalt niets');

    await o.stap.voerUit({}, doe('/api/agenda/mijn'),
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });
    assert.ok(o.vuil.bronnen().includes('toolantwoord'),
      'het antwoord van een gereedschap is onvertrouwd: ' + JSON.stringify(o.vuil.bronnen()));

    const na = o.filter.versmal(alles, ctx, 'member', o.vuil.bronnen());
    assert.ok(!na.paden.includes('/api/pay/stuur'), 'geld bewegen valt weg');
    const weg = na.weggevallen.find(w => w.pad === '/api/pay/stuur');
    assert.equal(weg && weg.reden, 'HERKOMST');
    /* EN HET LEZEN LOOPT DOOR. Zonder deze helft is de verdediging in de
       praktijk een uitknop voor de assistent, en dan zet iemand hem uit. */
    assert.ok(na.paden.includes('/api/bank/afschrift'), 'je eigen afschrift lezen blijft');
    assert.ok(na.paden.includes('/api/agenda/mijn'), 'je eigen agenda lezen blijft');
  } finally { o.herstel(); }
});

test('3. de poort staat bij doe en niet alleen bij de kaart', async () => {
  const o = opstelling({ afdwingen: true });
  try {
    const alles = ['/api/agenda/mijn', '/api/pay/stuur'];
    /* Eerst een onschuldige aanroep die het gesprek besmet... */
    await o.stap.voerUit({}, doe('/api/agenda/mijn'),
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });
    assert.deepEqual(o.geroepen, ['/api/agenda/mijn']);

    /* ...en dan geld sturen, ZONDER de kaart opnieuw op te vragen. Precies wat
       een model doet dat de bredere lijst nog in zijn geheugen heeft. */
    const uit = await o.stap.voerUit({}, doe('/api/pay/stuur'),
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });
    assert.deepEqual(o.geroepen, ['/api/agenda/mijn'],
      'stuurRoep hoort NIET te zijn aangeroepen; de lijst versmallen sluit niets als de poort ontbreekt');
    assert.equal(uit.ok, false);
    assert.equal(uit.reden, 'HERKOMST');
    assert.match(String(uit.zegTegenDeGebruiker), /niet dat de mogelijkheid niet bestaat/,
      'een verhindering draagt altijd een reden (GRAMMATICA.md)');
  } finally { o.herstel(); }
});

test('4. zonder de vlag telt de poort en houdt hij niets tegen', async () => {
  const o = opstelling({ afdwingen: false });
  try {
    const alles = ['/api/agenda/mijn', '/api/pay/stuur'];
    await o.stap.voerUit({}, doe('/api/agenda/mijn'),
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });
    const uit = await o.stap.voerUit({}, doe('/api/pay/stuur'),
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });

    assert.deepEqual(o.geroepen, ['/api/agenda/mijn', '/api/pay/stuur'],
      'in de schaduw loopt de aanroep gewoon door');
    assert.equal(uit.status, 200);
    const s = o.stap.schaduw();
    assert.equal(s.zouSluiten, 1, 'maar hij is wel GETELD: ' + JSON.stringify(s));
    assert.ok(s.paden.includes('/api/pay/stuur'));

    /* En de kaart draagt de prijs, zodat wie besluit of de vlag omgaat hem op
       zijn scherm ziet in plaats van in een logregel. */
    const kaart = await o.stap.voerUit({}, { name: 'kaart', id: 'k1', input: { alles: true } },
      { wereld: 'member', kaartVraag: 'x', paden: () => alles, acties: [] });
    assert.equal(kaart.herkomstSchaduw.zouSluiten, 1);
    assert.equal(kaart.herkomstSchaduw.afdwingen, false);
  } finally { o.herstel(); }
});
