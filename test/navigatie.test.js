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
const { DatabaseSync } = require('node:sqlite');
const { haversine } = require('../server/lib/geo');
const { maakNavigatie } = require('../server/kern/navigatie');
const { rdNaarWgs } = require('../server/kern/navigatie/nwb-geo');
const { maakNederlandNet } = require('../server/kern/navigatie/nederland');

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
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nwb-test-'));
  const bestand = path.join(map, 'nederland.sqlite'), grafiek = path.join(map, 'nederland-graaf');
  fs.mkdirSync(grafiek);
  const db = new DatabaseSync(bestand);
  db.exec(`CREATE TABLE meta(sleutel TEXT PRIMARY KEY,waarde TEXT);
    INSERT INTO meta VALUES('wegvakken','2'),('bron','NWB test'),('licentie','CC0 1.0');
    CREATE TABLE node_seq(idx INTEGER PRIMARY KEY,id INTEGER UNIQUE,lat REAL,lng REAL);
    INSERT INTO node_seq VALUES(0,100,52.3600,4.8900),(1,101,52.3610,4.9000),(2,102,52.3620,4.9100);
    CREATE VIRTUAL TABLE node_seq_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    INSERT INTO node_seq_rtree SELECT idx,lng,lng,lat,lat FROM node_seq;
    CREATE TABLE roads(id INTEGER PRIMARY KEY,lengte REAL,hoofd INTEGER,naam TEXT,ref TEXT,geom BLOB,minLat REAL,maxLat REAL,minLng REAL,maxLng REAL);
    INSERT INTO roads(id,lengte,hoofd,naam,ref,geom) VALUES(10,700,1,'Testweg','A1',x'00'),(11,700,1,'Testweg','A1',x'00');
    CREATE VIRTUAL TABLE road_rtree USING rtree(id,minLng,maxLng,minLat,maxLat);
    CREATE TABLE plaatsen(id INTEGER PRIMARY KEY,naam TEXT,extra TEXT,soort TEXT,lat REAL,lng REAL,gewicht INTEGER);
    INSERT INTO plaatsen VALUES(1,'Amsterdam','Nederland','woonplaats',52.36,4.89,100);
    CREATE VIRTUAL TABLE plaatsen_fts USING fts5(naam,extra,content='plaatsen',content_rowid='id');
    INSERT INTO plaatsen_fts(plaatsen_fts) VALUES('rebuild');`);
  db.close();
  const schrijf = (naam, rij) => fs.writeFileSync(path.join(grafiek, naam), Buffer.from(rij.buffer));
  schrijf('coords.f64', new Float64Array([52.36, 4.89, 52.361, 4.90, 52.362, 4.91]));
  schrijf('offsets.u32', new Uint32Array([0, 1, 3, 4]));
  schrijf('doelen.u32', new Uint32Array([1, 0, 2, 1]));
  schrijf('kosten.f32', new Float32Array([20, 20, 20, 20]));
  schrijf('lengtes.f32', new Float32Array([700, 700, 700, 700]));
  schrijf('wegen.u32', new Uint32Array([10, 10, 11, 11]));
  schrijf('vlaggen.u8', new Uint8Array([15, 15, 15, 15]));
  fs.writeFileSync(path.join(grafiek, 'graaf.json'), JSON.stringify({ versie: 1, knopen: 3, kanten: 4 }));
  const n = maakNederlandNet({ bestand, haversine });
  const van = n.snap({ lat: 52.36, lng: 4.89 }), naar = n.snap({ lat: 52.362, lng: 4.91 });
  const route = n.zoek(van, naar, { modus: 'auto' });
  assert.deepEqual(route.map(p => p.i), [0, 1, 2]);
  assert.equal(route[2]._ref, 'A1');
  assert.equal(n.zoekPlekken('Amsterdam')[0].naam, 'Amsterdam');
  fs.rmSync(map, { recursive: true, force: true });
});

test('13. de ingebouwde wereldatlas zoekt echte wereldsteden en landen', () => {
  const { nav } = opzet();
  const tokyo = nav.navBestemmingen('Tokyo', { lat: 52.36, lng: 4.89 });
  assert.equal(tokyo.status, 200);
  assert.ok(tokyo.bestemmingen.some(p => p.naam === 'Tokyo' && p.laag === 'wereld'));
  const brazilie = nav.navBestemmingen('Brazil', { lat: 52.36, lng: 4.89 });
  assert.ok(brazilie.bestemmingen.some(p => p.soort === 'land' && p.laag === 'wereld'));
});

test('14. buiten echte routedekking toont RTG de wereld en verzint geen rasterrit', () => {
  const { nav } = opzet();
  const kaart = nav.navKaart({ lat: 35.6762, lng: 139.6503 });
  assert.equal(kaart.status, 200);
  assert.equal(kaart.netwerk, 'RTG-WORLD-ATLAS');
  assert.ok(kaart.landen.length >= 170 && kaart.steden.length >= 200);
  const route = nav.navRoute({ van: { lat: 35.6762, lng: 139.6503 }, naar: { lat: 35.6895, lng: 139.6917 }, modus: 'auto' });
  assert.equal(route.status, 503);
  assert.match(route.error, /routepakket/);
});
