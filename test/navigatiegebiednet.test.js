/* KAN RTG WERKELIJK IN EEN ANDER GEBIED ROUTEREN?

   Dat is een andere vraag dan die van test/navigatiegebieden.test.js. Die
   toetst de CATALOGUS: wat wordt aangeboden, wat is gebouwd, welk gebied ligt
   onder een punt. Hier gaat het om de motor: er ligt een echt pakket buiten
   Nederland, en de gewone navRoute/navKaart van een lid moeten erop rekenen in
   plaats van op het demonstratieraster.

   WAAROM DIT ERTOE DOET. De catalogus kon al tweehonderd landen aanbieden
   terwijl `route()` maar EEN vak kende (`binnenNederland`) en al het andere
   naar het raster rond Ibiza stuurde. Een lid in Parijs kreeg dan een route
   over een verzonnen net, met een echte reistijd eronder -- de gevaarlijkste
   vorm van fout, want hij ziet compleet uit.

   Het pakket is echt: test/navigatie-pakket-fixture.js schrijft een SQLite met
   r-tree en FTS plus een binaire graaf, precies zoals het bouwscript dat doet.
   Draai los: node --test test/navigatiegebiednet.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { haversine } = require('../server/lib/geo');
const { bouwPakket } = require('./navigatie-pakket-fixture');

const PARIJS = { lat: 48.85, lng: 2.35 };
const FR_VAK = { lat0: 41, lat1: 51.2, lng0: -5.2, lng1: 9.6 };

/* Een wereld met een gebiedsindex EN een gebouwd pakket. RTG_DATA_DIR wordt
   verzet, want dat is waar de gebiedenlaag en pakket.js allebei kijken; de
   require-cache wordt geleegd omdat die laag zijn index op de wijzigingstijd
   onthoudt en de motoren per gebied bijhoudt. */
function wereld({ gebieden, bouw = true, licentie = 'ODbL 1.0', naamsvermelding = 'OpenStreetMap-bijdragers' }) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebiednet-'));
  fs.mkdirSync(path.join(map, 'navigatie'), { recursive: true });
  const lijst = gebieden || [{ code: 'europe-frankrijk', naam: 'Frankrijk', soort: 'land', vak: FR_VAK }];
  fs.writeFileSync(path.join(map, 'navigatie', 'gebieden.json'), JSON.stringify({
    bron: 'fixture', licentie, naamsvermelding, gelezenAt: new Date().toISOString(), gebieden: lijst
  }));
  if (bouw) {
    for (const g of lijst) {
      bouwPakket({ map: path.join(map, 'navigatie'), code: g.code,
        lat: (g.vak.lat0 + g.vak.lat1) / 2, lng: (g.vak.lng0 + g.vak.lng1) / 2,
        stapLat: 0.001, stapLng: 0.001, plaats: g.naam, land: g.naam,
        bron: 'OpenStreetMap', licentie });
    }
  }
  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = map;
  for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
    delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
  }
  delete require.cache[require.resolve('../server/kern/navigatie.js')];
  const { maakNavigatie } = require('../server/kern/navigatie.js');
  const nav = maakNavigatie({ db: { data: { suppliers: [], supplierTypes: {} } }, save() {},
    crypto: require('crypto'), haversine,
    flitsRond: () => ({ meldingen: [] }), flitsMeld: () => ({ status: 200 }) });
  const midden = (g) => ({ lat: (g.vak.lat0 + g.vak.lat1) / 2, lng: (g.vak.lng0 + g.vak.lng1) / 2 });
  return {
    nav, map, midden,
    op: (g, i) => {
      const m = midden(g);
      return { lat: m.lat + i * 0.001, lng: m.lng + i * 0.001 };
    },
    weg() {
      if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
      for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
        delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
      }
      delete require.cache[require.resolve('../server/kern/navigatie.js')];
      try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
    }
  };
}

test('1. met een gebouwd pakket rekent navRoute op DAT gebied en niet op het raster', () => {
  const w = wereld({});
  try {
    const r = w.nav.navRoute({ van: w.op({ vak: FR_VAK }, 0), naar: w.op({ vak: FR_VAK }, 2), modus: 'auto' });
    assert.equal(r.status, 200, 'de route komt uit: ' + JSON.stringify(r).slice(0, 200));
    /* HET BEWIJS DAT HET NIET HET RASTER IS: de wegnaam komt uit het pakket.
       Het demonstratieraster rond Ibiza kent geen `A1` en geen `Testweg`. */
    const namen = JSON.stringify(r);
    assert.match(namen, /Testweg|A1/, 'de route loopt over de wegen uit het pakket');
  } finally { w.weg(); }
});

test('2. navKaart geeft de dekking van dat gebied, met zijn eigen naam en net', () => {
  const w = wereld({});
  try {
    const k = w.nav.navKaart(PARIJS);
    assert.equal(k.status, 200);
    assert.equal(k.dekking.land, 'Frankrijk', 'de kaart noemt het gebied waarin hij staat');
    assert.equal(k.netwerk, 'OSM');
    /* En niet het eiland: het raster heeft `grid` en `arterie`, een pakket niet. */
    assert.equal(k.grid, undefined, 'dit is geen rasterkaart');
  } finally { w.weg(); }
});

test('3. zonder gebiedsindex verandert er NIETS: buiten Nederland blijft het raster', () => {
  /* Dit is de belangrijkste toets van dit bestand. De gebiedslaag mag alleen
     TOEVOEGEN; op een verse installatie (geen index, geen pakket) hoort de
     navigatie zich exact te gedragen als hiervoor. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gebiednet-leeg-'));
  const oud = process.env.RTG_DATA_DIR;
  try {
    process.env.RTG_DATA_DIR = map;
    for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/navigatie.js')];
    const { maakNavigatie, REF } = require('../server/kern/navigatie.js');
    const nav = maakNavigatie({ db: { data: { suppliers: [], supplierTypes: {} } }, save() {},
      crypto: require('crypto'), haversine,
      flitsRond: () => ({ meldingen: [] }), flitsMeld: () => ({ status: 200 }) });
    const k = nav.navKaart(REF);
    assert.equal(k.status, 200);
    assert.ok(k.grid > 0, 'het demonstratieraster staat er nog');
    const r = nav.navRoute({ van: REF, naar: { lat: REF.lat + 0.01, lng: REF.lng + 0.01 }, modus: 'auto' });
    assert.equal(r.status, 200, 'en een route op het raster werkt onveranderd');
  } finally {
    if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
    for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/navigatie.js')];
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('4. een pakket zonder naamsvermelding wordt NIET geladen, met de reden erbij', () => {
  /* De licentiepoort is geen veld maar een grendel: ODbL eist vermelding, en
     een kaart tonen zonder die vermelding overtreedt de voorwaarde waaronder
     wij de data mogen gebruiken. De motor hoort dus te weigeren, niet te
     tonen -- en te zeggen waarom. */
  const w = wereld({ naamsvermelding: '' });
  try {
    /* HIER STOND `notEqual(k.dekking.land, 'Frankrijk')`, EN DAT WAS TE ZWAK:
       de kaart viel terug op het demonstratieraster rond Ibiza en die
       bewering was dus waar terwijl een lid in Parijs een kaart van een
       eiland kreeg. Weigeren is het antwoord, met de reden. */
    const k = w.nav.navKaart(PARIJS);
    assert.equal(k.status, 503, 'de kaart weigert: ' + JSON.stringify(k).slice(0, 160));
    assert.match(k.error, /naamsvermelding/);
    /* En alle vier de antwoorden zeggen hetzelfde -- vier antwoorden op een
       ontbrekende bron zijn vier waarheden (toets 13 van navigatie.test.js). */
    for (const [naam, uit] of [
      ['navBestemmingen', w.nav.navBestemmingen('Parijs', PARIJS)],
      ['navPoi', w.nav.navPoi(['tank'], PARIJS)],
      ['navRoute', w.nav.navRoute({ van: PARIJS, naar: { lat: 48.86, lng: 2.36 }, modus: 'auto' })]
    ]) {
      assert.equal(uit.status, 503, naam + ' weigert ook');
      assert.match(uit.error, /naamsvermelding/, naam + ' geeft dezelfde reden');
    }
    const stand = w.nav.navStatus(PARIJS).pakketten;
    const stuk = stand.nietGeladen.find(x => x.code === 'europe-frankrijk');
    assert.ok(stuk, 'de stand noemt het geweigerde pakket');
    assert.match(stuk.reden, /naamsvermelding/, 'en zegt waarom: ' + stuk.reden);
    /* En hij staat NIET ook in de geladen lijst. Dat lijkt vanzelfsprekend en
       is het niet: de mutatiemotor liet een versie overleven waarin hetzelfde
       pakket in beide lijsten stond, en dan leest een scherm "Frankrijk
       geladen" pal naast de weigering. */
    assert.equal(stand.geladen.some(x => x.code === 'europe-frankrijk'), false,
      'een geweigerd pakket staat nooit bij de geladen: ' + JSON.stringify(stand.geladen));
  } finally { w.weg(); }
});

test('5. een gebied uit de index waarvan het pakket NIET gebouwd is, wordt geweigerd met de weg erheen', () => {
  const w = wereld({ bouw: false });
  try {
    const r = w.nav.navRoute({ van: w.op({ vak: FR_VAK }, 0), naar: w.op({ vak: FR_VAK }, 2), modus: 'auto' });
    /* Aangeboden is geen dekking: er staat een gebied in de catalogus zonder
       pakket, en dan hoort er een weigering MET reden te komen -- geen route
       over een verzonnen net. */
    assert.equal(r.status, 503, 'weigert: ' + JSON.stringify(r).slice(0, 160));
    assert.match(r.error, /niet geladen|gebouwd/);
    const k = w.nav.navKaart(w.op({ vak: FR_VAK }, 0));
    assert.equal(k.status, 503, 'en de kaart toont geen ander eiland');
    assert.match(k.hoe, /gebouwd/, 'de weigering wijst de weg: ' + k.hoe);
    /* EN DE STAND ZEGT HET OOK. Het scherm hangt zijn badge aan deze twee
       velden; zou `routeerbaarHier` hier true blijven, dan staat er "Motor
       actief" boven een kaart die weigert. De mutatiemotor liet die versie
       overleven omdat niemand ernaar keek. */
    const st = w.nav.navStatus(w.op({ vak: FR_VAK }, 0));
    assert.equal(st.net, 'gebied-geen');
    assert.equal(st.routeerbaarHier, false);
    assert.match(String(st.netReden), /niet geladen|gebouwd/);
  } finally { w.weg(); }
});

test('6. een route van het ene gebied naar het andere houdt op bij de rand, met beide namen', () => {
  const DE_VAK = { lat0: 47.2, lat1: 55.1, lng0: 5.8, lng1: 15.1 };
  const w = wereld({ gebieden: [
    { code: 'europe-frankrijk', naam: 'Frankrijk', soort: 'land', vak: FR_VAK },
    { code: 'europe-duitsland', naam: 'Duitsland', soort: 'land', vak: DE_VAK }
  ] });
  try {
    const r = w.nav.navRoute({ van: w.op({ vak: FR_VAK }, 0), naar: w.op({ vak: DE_VAK }, 0), modus: 'auto' });
    assert.equal(r.status, 422, 'twee grafen raken elkaar niet: ' + JSON.stringify(r).slice(0, 160));
    /* De namen staan erin. Een melding als "buiten de dekking" laat een lid
       raden welke helft van zijn rit het probleem is. */
    assert.match(r.error, /Frankrijk/);
    assert.match(r.error, /Duitsland/);
  } finally { w.weg(); }
});

test('7. de status zegt welke pakketten geladen zijn, en dat een nieuw pakket een herstart vraagt', () => {
  const w = wereld({});
  try {
    w.nav.navKaart(PARIJS);                       // laadt het pakket
    const stand = w.nav.navStatus(PARIJS).pakketten;
    assert.deepEqual(stand.geladen.map(x => x.code), ['europe-frankrijk']);
    /* Een pakket dat na de start is gebouwd, wordt niet vanzelf opgepikt. Dat
       is een echte voorwaarde en die hoort in het antwoord te staan, niet
       alleen in een commentaarregel. */
    assert.match(stand.herstartNodig, /herstart/);
  } finally { w.weg(); }
});

test('8. het eigen NWB-pakket gaat voor een OSM-gebied dat Nederland ook dekt', () => {
  /* Twee pakketten over hetzelfde punt is geen verzonnen geval: wie
     `europe-netherlands` uit de catalogus bouwt, heeft naast het NWB een
     tweede kaart van Nederland liggen. Dan wint het NWB -- RTG bouwt dat zelf
     uit een CC0-bron en verst het dagelijks. Zonder deze toets is die regel
     alleen een commentaarregel: de mutatiemotor kon de voorkeur weghalen
     zonder dat er iets zakte. */
  const NL_VAK = { lat0: 50.7, lat1: 53.72, lng0: 3.2, lng1: 7.3 };
  const w = wereld({ gebieden: [{ code: 'europe-netherlands', naam: 'Nederland (OSM)', soort: 'land', vak: NL_VAK }] });
  try {
    /* Het NWB-pakket komt op de plek waar kern/navigatie/nederland.js kijkt:
       `<RTG_DATA_DIR>/navigatie/nederland.sqlite`. */
    bouwPakket({ map: path.join(w.map, 'navigatie'), code: 'nederland',
      lat: 52.36, lng: 4.89, plaats: 'Amsterdam', land: 'Nederland', bron: 'NWB test', licentie: 'CC0 1.0' });
    for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/navigatie.js')];
    const nav = require('../server/kern/navigatie.js').maakNavigatie({
      db: { data: { suppliers: [], supplierTypes: {} } }, save() {}, crypto: require('crypto'), haversine,
      flitsRond: () => ({ meldingen: [] }), flitsMeld: () => ({ status: 200 }) });
    const k = nav.navKaart({ lat: 52.36, lng: 4.89 });
    assert.equal(k.status, 200, JSON.stringify(k).slice(0, 160));
    assert.equal(k.netwerk, 'NWB', 'het eigen pakket wint van het OSM-gebied');
    assert.equal(k.dekking.land, 'Nederland');
    /* En het OSM-gebied is dus niet geladen: er is geen reden om er een motor
       voor te openen zolang het eigen pakket er ligt. */
    assert.equal(nav.navStatus({ lat: 52.36, lng: 4.89 }).pakketten.geladen
      .some(x => x.code === 'europe-netherlands'), false);
  } finally { w.weg(); }
});

test('9. een NIET-gebouwd OSM-gebied over Nederland blokkeert het eigen NWB-net niet', () => {
  /* DIT IS DE REGRESSIE DIE DE MUTATIEMOTOR AANWEES. De voorkeur voor het
     eigen pakket (`eersteKeus` in gebiednetten.js) leek dubbelop, want
     kern/navigatie.js kijkt zelf al eerst naar Nederland. Weghalen liet geen
     enkele toets zakken -- en toch is hij nodig: staat er een gebied
     `europe-netherlands` in de catalogus dat NIET gebouwd is, dan zou
     `gebiedStuk()` een punt in Amsterdam gaan weigeren terwijl het NWB-net er
     gewoon ligt. Een laag die alleen mag toevoegen, nam dan iets weg. */
  const NL_VAK = { lat0: 50.7, lat1: 53.72, lng0: 3.2, lng1: 7.3 };
  const w = wereld({ bouw: false,
    gebieden: [{ code: 'europe-netherlands', naam: 'Nederland (OSM)', soort: 'land', vak: NL_VAK }] });
  try {
    bouwPakket({ map: path.join(w.map, 'navigatie'), code: 'nederland',
      lat: 52.36, lng: 4.89, plaats: 'Amsterdam', land: 'Nederland' });
    for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/navigatie.js')];
    const nav = require('../server/kern/navigatie.js').maakNavigatie({
      db: { data: { suppliers: [], supplierTypes: {} } }, save() {}, crypto: require('crypto'), haversine,
      flitsRond: () => ({ meldingen: [] }), flitsMeld: () => ({ status: 200 }) });
    const amsterdam = { lat: 52.36, lng: 4.89 };
    for (const [naam, uit] of [
      ['navKaart', nav.navKaart(amsterdam)],
      ['navBestemmingen', nav.navBestemmingen('Amsterdam', amsterdam)],
      ['navPoi', nav.navPoi(['tank'], amsterdam)]
    ]) {
      assert.equal(uit.status, 200, naam + ' werkt gewoon: ' + JSON.stringify(uit).slice(0, 140));
    }
    assert.equal(nav.navKaart(amsterdam).netwerk, 'NWB');
  } finally { w.weg(); }
});

test('10. een half gebouwd pakket (graaf zonder database) weigert, en stort niet in', () => {
  /* Ook dit wees de motor aan: de controle op het BESTAND was onbereikbaar,
     want elke toets miste de graaf al. Een half pakket is echter het gewone
     geval bij een afgebroken bouw, en dan hoort er een weigering te komen --
     geen uitzondering uit node:sqlite die als 500 bij een lid landt. */
  const w = wereld({});
  try {
    fs.rmSync(path.join(w.map, 'navigatie', 'europe-frankrijk.sqlite'), { force: true });
    for (const m of ['gebieden', 'pakket', 'gebiednetten', 'gebiednet', 'nederland', 'dekking']) {
      delete require.cache[require.resolve('../server/kern/navigatie/' + m + '.js')];
    }
    delete require.cache[require.resolve('../server/kern/navigatie.js')];
    const nav = require('../server/kern/navigatie.js').maakNavigatie({
      db: { data: { suppliers: [], supplierTypes: {} } }, save() {}, crypto: require('crypto'), haversine,
      flitsRond: () => ({ meldingen: [] }), flitsMeld: () => ({ status: 200 }) });
    const k = nav.navKaart(PARIJS);
    assert.equal(k.status, 503, 'weigert in plaats van te struikelen: ' + JSON.stringify(k).slice(0, 140));
    assert.match(k.error, /niet geladen/);
  } finally { w.weg(); }
});

test('11. een pakket dat NA een mislukte poging gebouwd wordt, werkt zonder herstart', () => {
  /* De catalogus ziet een nieuw pakket (zijn cache hangt aan de mtime van de
     pakketmap). Zou de motorlaag een mislukking voor altijd onthouden, dan
     stond op het scherm van een lid "Gebouwd" terwijl de route bleef weigeren
     -- twee schermen die op een dag iets anders zeggen over hetzelfde, en dat
     is precies wat BESTUUR.md verbiedt. */
  const w = wereld({ bouw: false });
  try {
    const eerst = w.nav.navKaart(PARIJS);
    assert.equal(eerst.status, 503, 'eerst is er niets: ' + JSON.stringify(eerst).slice(0, 120));

    const nav = path.join(w.map, 'navigatie');
    bouwPakket({ map: nav, code: 'europe-frankrijk',
      lat: (FR_VAK.lat0 + FR_VAK.lat1) / 2, lng: (FR_VAK.lng0 + FR_VAK.lng1) / 2,
      stapLat: 0.001, stapLng: 0.001, plaats: 'Frankrijk', land: 'Frankrijk', licentie: 'ODbL 1.0' });
    /* De mtime van de map moet echt verschillen; binnen dezelfde milliseconde
       schrijven is op een snelle schijf geen theoretisch geval. */
    const t = Date.now() + 5000;
    fs.utimesSync(nav, t / 1000, t / 1000);

    /* GEEN NIEUWE maakNavigatie: dat zou een herstart zijn, en juist dat is
       wat hier niet nodig mag zijn. */
    const daarna = w.nav.navKaart(PARIJS);
    assert.equal(daarna.status, 200, 'en nu werkt hij: ' + JSON.stringify(daarna).slice(0, 160));
    assert.equal(daarna.dekking.land, 'Frankrijk');
  } finally { w.weg(); }
});

test('12. de routemotor van een gebied wordt EEN keer gebouwd, niet per verzoek', () => {
  /* `voorPunt()` hangt aan navKaart, navBestemmingen en navPoi. Bouwde die de
     motor mee, dan bouwde elk verzoek van een lid een hele route-engine die
     meteen werd weggegooid -- kosten die op geen enkele nota staan en die
     niemand terugvindt (KOSTEN.md). Alleen `routeVoor()` heeft hem nodig. */
  const { maakGebiedNetten } = require('../server/kern/navigatie/gebiednetten');
  let gebouwd = 0;
  const nepNet = { snap: () => null, zoek: () => null, stappenVan: () => [], kaart: () => ({ status: 200 }),
    binnen: () => true, info: {} };
  const netten = maakGebiedNetten({ haversine,
    eersteKeus: nepNet, eersteKeusBinnen: () => true,
    maakRouteMotor: () => { gebouwd++; return () => ({ status: 200 }); } });

  for (let i = 0; i < 25; i++) netten.voorPunt({ lat: 52, lng: 5 });
  assert.equal(gebouwd, 0, 'kijken naar het gebied bouwt geen motor');

  netten.routeVoor({ lat: 52, lng: 5 }, { lat: 52.1, lng: 5.1 });
  assert.equal(gebouwd, 1, 'de eerste route bouwt hem');
  for (let i = 0; i < 25; i++) netten.routeVoor({ lat: 52, lng: 5 }, { lat: 52.1, lng: 5.1 });
  assert.equal(gebouwd, 1, 'en daarna wordt hij hergebruikt');
});

test('13. een GEBOUWD OSM-pakket over Nederland gaat voor de Nederlandse weigering', () => {
  /* De orde stond verkeerd, en dat is gemeten: `inNLZonderNet` kwam eerst, dus
     wie het OSM-pakket van Nederland had gebouwd en het NWB niet, kreeg "Geen
     kaartdata voor Nederland" -- terwijl er een bruikbare kaart klaarlag. Een
     echte kaart gaat voor een weigering; alleen als er niets ligt, blijft de
     weigering staan (toets 5 en 9 houden die kant vast). */
  const NL_VAK = { lat0: 50.7, lat1: 53.72, lng0: 3.2, lng1: 7.3 };
  const w = wereld({ gebieden: [{ code: 'europe-netherlands', naam: 'Nederland (OSM)', soort: 'land', vak: NL_VAK }] });
  try {
    /* GEEN nederland.sqlite in deze wereld: het NWB is er niet. */
    const amsterdam = w.midden({ vak: NL_VAK });
    const k = w.nav.navKaart(amsterdam);
    assert.equal(k.status, 200, 'de kaart komt uit het OSM-pakket: ' + JSON.stringify(k).slice(0, 160));
    assert.equal(k.dekking.land, 'Nederland (OSM)');
    const r = w.nav.navRoute({ van: w.op({ vak: NL_VAK }, 0), naar: w.op({ vak: NL_VAK }, 2), modus: 'auto' });
    assert.equal(r.status, 200, 'en de route ook: ' + JSON.stringify(r).slice(0, 160));
    /* De stand zegt het ook: `gebied` en niet `geen`. Een badge die "Geen
       kaartdata" toont boven een werkende kaart, liegt. */
    const st = w.nav.navStatus(amsterdam);
    assert.equal(st.net, 'gebied');
    assert.equal(st.routeerbaarHier, true);
    /* En de naamsvermelding die ODbL eist, staat in het antwoord waar een
       scherm hem kan zetten. */
    assert.match(String(st.dekking.naamsvermelding), /OpenStreetMap/);
  } finally { w.weg(); }
});
