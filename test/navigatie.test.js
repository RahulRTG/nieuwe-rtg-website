/* RTG Navigatie (server/kern/navigatie.js): het huiseigen navigatiesysteem.
   Getoetst als pure motor met de echte haversine en fakes voor de Flits-koppeling:
   het eigen wegennet + A*-route, de bocht-voor-bocht en ETA per vervoerwijze, en
   de koppeling aan leveranciers/OV/loketten/tank/laad + Flits. Geen externe kaart.
   Draai los: node --test test/navigatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { haversine } = require('../server/lib/geo');
const { maakNavigatie } = require('../server/kern/navigatie');
const { rdNaarWgs } = require('../server/kern/navigatie/nwb-geo');
const { maakNederlandNet } = require('../server/kern/navigatie/nederland');
const { bouwPakket } = require('./navigatie-pakket-fixture');

function opzet() {
  const db = { data: {
    supplierTypes: { horeca: { label: 'Horeca' }, ov: { label: 'Openbaar vervoer' } },
    suppliers: [
      { code: 'BEACH', name: 'Beach Club Talamanca', type: 'horeca', loc: { lat: 38.915, lng: 1.455 } },
      { code: 'TRANSIT', name: 'Ibiza Transit', type: 'ov', lijnen: [
        { naam: 'Kustlijn 1', haltes: [
          { naam: 'Aeroport', lat: 38.873, lng: 1.373 },
          { naam: 'Ibiza-stad', lat: 38.908, lng: 1.432 }
        ] }
      ] }
    ]
  } };
  const flitsCalls = [];
  const flitsRond = (hier, land) => { flitsCalls.push({ hier, land }); return { meldingen: [
    { naam: 'File', soort: 'file', icoon: '🚗', lat: 38.905, lng: 1.430, afstandKm: 0.4 }
  ] }; };
  const meldCalls = [];
  const flitsMeld = (key, cn, data) => { meldCalls.push({ key, cn, data }); return { status: 200, ok: true, melding: { soort: data.soort } }; };
  const nav = maakNavigatie({ db, save() {}, crypto: require('crypto'), haversine, flitsRond, flitsMeld });
  return { nav, flitsCalls, meldCalls };
}

test('1. navKaart: net-definitie + koppelpunten uit alle bronnen', () => {
  const { nav } = opzet();
  const r = nav.navKaart({ lat: 38.91, lng: 1.43 });
  assert.equal(r.status, 200);
  assert.ok(r.ref && r.bounds && r.grid > 0);
  const lagen = new Set(r.plekken.map(p => p.laag));
  assert.ok(lagen.has('leverancier'), 'leveranciers gekoppeld');
  assert.ok(lagen.has('ov'), 'OV-haltes gekoppeld');
  assert.ok(lagen.has('tank') && lagen.has('laad') && lagen.has('civic'), 'POI + loketten gekoppeld');
  // afstand berekend t.o.v. hier
  assert.ok(r.plekken.every(p => Number.isFinite(p.afstandM)));
});

test('2. navBestemmingen: filtert op zoekterm en sorteert op afstand', () => {
  const { nav } = opzet();
  const r = nav.navBestemmingen('laad', { lat: 38.874, lng: 1.377 });
  assert.equal(r.status, 200);
  assert.ok(r.bestemmingen.length >= 1);
  assert.ok(r.bestemmingen.every(b => b.laag === 'laad'), 'alleen laadpalen');
  for (let i = 1; i < r.bestemmingen.length; i++) assert.ok(r.bestemmingen[i].afstandM >= r.bestemmingen[i - 1].afstandM, 'oplopend op afstand');
});

test('3. navRoute: A*-route met bocht-voor-bocht en ETA per vervoerwijze', () => {
  const { nav } = opzet();
  const r = nav.navRoute({ van: { lat: 38.873, lng: 1.373 }, naar: { lat: 38.985, lng: 1.535 }, modus: 'auto' });
  assert.equal(r.status, 200);
  assert.ok(r.route.length >= 2, 'polylijn met meerdere punten');
  assert.ok(r.afstandM > 0);
  assert.equal(r.stappen[0].bocht, 'start');
  assert.equal(r.stappen[r.stappen.length - 1].bocht, 'eind');
  // ETA per modus aanwezig en logisch geordend (auto sneller dan fiets sneller dan lopen)
  assert.ok(r.etaMin.auto >= 1 && r.etaMin.fiets >= 1 && r.etaMin.lopen >= 1);
  assert.ok(r.etaMin.auto <= r.etaMin.fiets && r.etaMin.fiets <= r.etaMin.lopen);
  assert.match(r.bron, /eigen wegennet/);
});

test('4. navRoute: ongeldige invoer wordt netjes geweigerd', () => {
  const { nav } = opzet();
  const r = nav.navRoute({ van: { lat: 'x' }, naar: { lat: 38.9, lng: 1.4 } });
  assert.equal(r.status, 400);
  assert.match(r.error, /geldig/);
});

test('5. navPoi: laag "flits" koppelt aan de Flits-laag', () => {
  const { nav, flitsCalls } = opzet();
  const r = nav.navPoi(['flits', 'laad'], { lat: 38.908, lng: 1.432, land: 'ES' });
  assert.equal(r.status, 200);
  assert.ok(r.lagen.flits && r.lagen.flits.length >= 1, 'flitsmeldingen erbij');
  assert.ok(r.lagen.laad && r.lagen.laad.length >= 1, 'laadpalen erbij');
  assert.equal(flitsCalls.length, 1, 'Flits-laag precies één keer geraadpleegd');
});

test('6. navMeld: een wegprobleem gaat op codenaam terug het Flits-netwerk in', () => {
  const { nav, meldCalls } = opzet();
  const r = nav.navMeld('sleutel-abc', 'Zilveren Valk', { soort: 'wegwerk', lat: 38.9, lng: 1.43, land: 'ES' });
  assert.equal(r.status, 200);
  assert.equal(meldCalls.length, 1);
  assert.equal(meldCalls[0].cn, 'Zilveren Valk', 'codenaam, nooit een echte naam');
  assert.equal(meldCalls[0].data.soort, 'wegwerk');
  // onbekende soort valt terug op een veilige standaard
  nav.navMeld('k', 'Codenaam', { soort: 'flitser', lat: 38.9, lng: 1.43 });
  assert.equal(meldCalls[1].data.soort, 'object', 'geen flitser via de meldweg');
});

test('7. navRoute: route langs de route levert flits + laad mee', () => {
  const { nav } = opzet();
  const r = nav.navRoute({ van: { lat: 38.916, lng: 1.448 }, naar: { lat: 38.905, lng: 1.436 }, modus: 'ev' });
  assert.equal(r.status, 200);
  assert.ok(r.langs && Array.isArray(r.langs.laad) && Array.isArray(r.langs.flits));
});

test('8. Route Intelligence levert advies, vertrouwen, aankomst en echte alternatieven', () => {
  const { nav } = opzet();
  const r = nav.navRoute({
    van: { lat: 38.873, lng: 1.373 }, naar: { lat: 38.985, lng: 1.535 },
    modus: 'ev', profiel: 'eco', accuProcent: 72, bereikKm: 210
  });
  assert.equal(r.status, 200);
  assert.match(r.routeId, /^rtg-/);
  assert.equal(r.intelligence.profiel, 'eco');
  assert.ok(r.intelligence.vertrouwen >= 70 && r.intelligence.vertrouwen <= 99);
  assert.ok(Number.isFinite(new Date(r.intelligence.aankomstAt).getTime()));
  assert.ok(r.intelligence.energie && r.intelligence.energie.kwh > 0);
  assert.ok(r.alternatieven.length >= 1);
  assert.ok(r.alternatieven.every(a => a.routeId && a.advies && a.naam));
  assert.match(r.privacy, /niet bewaard/);
});

test('9. een partner levert een tijdelijk signaal, nooit een voorgeschreven route', () => {
  const { nav } = opzet();
  const vraag = {
    van: { lat: 38.895, lng: 1.410 }, naar: { lat: 38.918, lng: 1.448 }, modus: 'auto'
  };
  const zonder = nav.navRoute(vraag);
  const routePunt = zonder.route[Math.floor(zonder.route.length / 2)];
  const supplier = { code: 'HOTEL-X', name: 'Hotel X' };
  const gezet = nav.navPartnerEvent(supplier, {
    soort: 'file', naam: 'Drukte bij de hoofdingang', lat: routePunt.lat, lng: routePunt.lng,
    straalM: 1200, ernst: 4, betrouwbaarheid: 96
  });
  assert.equal(gezet.status, 200);
  assert.equal(gezet.gebeurtenis.bron, 'partner');
  assert.equal(nav.navPartnerEvents('HOTEL-X').gebeurtenissen.length, 1);
  assert.equal(Object.hasOwn(gezet.gebeurtenis, 'route'), false, 'partner schrijft geen route voor');
  const r = nav.navRoute(vraag);
  assert.equal(r.status, 200);
  assert.ok(r.intelligence.signalen >= 1 || r.routeId !== zonder.routeId,
    'het signaal ligt op de route of de motor ontwijkt het');
});

test('10. status maakt bronversheid en eigen motor controleerbaar', () => {
  const { nav } = opzet();
  const r = nav.navStatus({ lat: 38.91, lng: 1.43, land: 'ES' });
  assert.equal(r.status, 200);
  assert.equal(r.eigenMotor, true);
  assert.equal(r.motor, 'RTG Route Intelligence');
  assert.ok(r.profielen.some(p => p.id === 'rustig'));
  assert.ok(r.mogelijkheden.includes('eta-confidence'));
});

test('11. NWB-meetkunde zet het RD-nulpunt aantoonbaar om naar WGS84', () => {
  const p = rdNaarWgs(155000, 463000);
  assert.ok(Math.abs(p.lat - 52.1551744) < 1e-8);
  assert.ok(Math.abs(p.lng - 5.38720621) < 1e-8);
});

test('12. de compacte Nederlandse graaf snapt, zoekt en respecteert voertuigtoegang', () => {
  /* Het pakket komt uit test/navigatie-pakket-fixture.js: dezelfde bouwer die
     de gebiedstoets gebruikt, zodat er niet twee handgeschreven pakketten
     rondlopen die iets anders bouwen (LAT.md regel 4). */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nwb-test-'));
  const { bestand } = bouwPakket({ map });
  const n = maakNederlandNet({ bestand, haversine });
  const van = n.snap({ lat: 52.36, lng: 4.89 }), naar = n.snap({ lat: 52.362, lng: 4.91 });
  const route = n.zoek(van, naar, { modus: 'auto' });
  assert.deepEqual(route.map(p => p.i), [0, 1, 2]);
  assert.equal(route[2]._ref, 'A1');
  assert.equal(n.zoekPlekken('Amsterdam')[0].naam, 'Amsterdam');
  fs.rmSync(map, { recursive: true, force: true });
});

/* 13. ZONDER NEDERLANDS WEGENNET LIEGT DE KAART NIET MEER.

   Dit is de reparatie van een stil defect: `route()` weigerde een Nederlandse
   rit netjes met 503, maar `kaart()`, `bestemmingen()` en `poi()` vielen zonder
   een woord terug op het demonstratieraster rond Ibiza. Een lid in Amsterdam
   kreeg dus een kaart van een ander eiland, zocht zijn straat en vond nul, en
   las intussen "Motor actief". Vier antwoorden op dezelfde ontbrekende bron
   zijn vier waarheden; het zijn er nu twee: binnen Nederland weigeren alle vier
   met DEZELFDE zin, en buiten Nederland verandert er niets.

   Deze opzet() heeft met opzet GEEN nederlandNet -- dat is de situatie op elke
   verse installatie, want de NWB-data staat in RTG_DATA_DIR en niet in git. */
test('13. binnen Nederland zonder NWB-import weigert de kaart met de reden, in plaats van Ibiza te tonen', () => {
  const { nav } = opzet();
  const amsterdam = { lat: 52.3676, lng: 4.9041 };
  const reden = 'Het Nederlandse wegennet is nog niet ingeladen.';

  for (const [naam, uitkomst] of [
    ['navKaart', nav.navKaart(amsterdam)],
    ['navBestemmingen', nav.navBestemmingen('Amsterdam', amsterdam)],
    ['navPoi', nav.navPoi(['tank'], amsterdam)],
    ['navRoute', nav.navRoute({ van: amsterdam, naar: { lat: 52.0907, lng: 5.1214 }, modus: 'auto' })]
  ]) {
    assert.equal(uitkomst.status, 503, naam + ' weigert');
    assert.equal(uitkomst.error, reden, naam + ' geeft dezelfde reden');
  }
  // en de weigering wijst de weg naar de oplossing, in plaats van alleen nee te zeggen
  assert.match(nav.navKaart(amsterdam).hoe, /navigatie:nederland/);

  // buiten de Nederlandse dekking blijft het eigen net gewoon werken
  const ibiza = nav.navKaart({ lat: 38.91, lng: 1.43 });
  assert.equal(ibiza.status, 200);
  assert.ok(ibiza.plekken.length > 0, 'buiten NL onveranderd');
});

/* 14. DE STATUS ZEGT WAT DE MOTOR HIER KAN, NIET DAT HIJ BESTAAT.

   De badge in het scherm leidde zijn tekst af uit `dekking`, en kwam daardoor
   op "Motor actief" uit terwijl elke Nederlandse route 503 gaf. De motor
   antwoordt nu zelf op die vraag (`net` + `routeerbaarHier`) zodat er maar een
   plek is waar dit geweten wordt. */
test('14. status noemt het net en of hier te routeren valt', () => {
  const { nav } = opzet();
  const nl = nav.navStatus({ lat: 52.3676, lng: 4.9041 });
  assert.equal(nl.net, 'geen');
  assert.equal(nl.routeerbaarHier, false);
  assert.equal(nl.dekking.actief, false);
  assert.equal(nl.dekking.hierBinnenNederland, true);
  assert.match(nl.netReden, /nog niet ingeladen/);

  const buiten = nav.navStatus({ lat: 38.91, lng: 1.43 });
  assert.equal(buiten.net, 'demonstratie');
  assert.equal(buiten.routeerbaarHier, true, 'buiten NL rekent het eigen net gewoon');
});
