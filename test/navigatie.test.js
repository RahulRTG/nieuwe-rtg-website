/* RTG Navigatie (server/kern/navigatie.js): het huiseigen navigatiesysteem.
   Getoetst als pure motor met de echte haversine en fakes voor de Flits-koppeling:
   het eigen wegennet + A*-route, de bocht-voor-bocht en ETA per vervoerwijze, en
   de koppeling aan leveranciers/OV/loketten/tank/laad + Flits. Geen externe kaart.
   Draai los: node --experimental-sqlite --test test/navigatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { haversine } = require('../server/lib/geo');
const { maakNavigatie } = require('../server/kern/navigatie');

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
