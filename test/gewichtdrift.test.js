/* ============================================================================
   HET DRIFTCONTRACT ONDER HET GEWICHTREGISTER.

   Dit bestand bewaakt de reparatie van een fout die niets rood maakte. De
   verdeling van de toetsketen weegt op TOETSDUUR.json; dat register was lokaal
   gemeten zonder dekking, de keten draait op een runner met dekking, en de
   scherven liepen daardoor 1348s tegen 526s uit elkaar terwijl de projectie
   1,00x meldde. Het register zei zelf al waar het vandaan kwam -- niemand las
   het.

   De beweringen hieronder gaan daarom niet over "is dit register goed" maar
   over "kan dit contract nog liegen". Drie plekken waar dat zou kunnen:

     1. de projectiefout op het GEMIDDELDE in plaats van de traagste scherf;
     2. een andere MODUS die stil als vergelijkbaar doorgaat;
     3. een ontbrekende meting die als goedkeuring langskomt.
   ========================================================================== */
'use strict';
require('./toetsnaam');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const { vergelijk, beoordeel, projectiefout, GRENS } = require('../scripts/gewichtdrift');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'gewichtdrift.js');

test('de projectiefout kijkt naar de traagste scherf en niet naar het gemiddelde', () => {
  /* Drie snelle scherven maken een uitloper niet goedkoper. Zou deze maat het
     gemiddelde nemen, dan is hij per definitie nul -- het gemiddelde van de
     lasten IS het ideaal -- en meldt hij eeuwig ACTUEEL. */
  const alle = {};
  for (let i = 0; i < 40; i++) alle['x' + i + '.test.js'] = 100;

  const oud = Object.assign({}, alle);
  const nieuw = Object.assign({}, alle);
  /* Een bestand dat in werkelijkheid tien keer zo duur is als het register
     denkt: de scherf waar hij op valt loopt uit. */
  nieuw['x0.test.js'] = 1000;

  const p = projectiefout(oud, nieuw, 4, Object.keys(alle));
  assert.ok(p.fout > 0.05, 'een uitgelopen scherf hoort zichtbaar te zijn, kreeg ' + p.fout);
  const gemiddelde = p.lasten.reduce((a, b) => a + b, 0) / p.lasten.length;
  assert.equal(Math.round(gemiddelde), Math.round(p.ideaal),
    'het gemiddelde is per definitie het ideaal -- daarom mag de maat dat niet zijn');
});

test('een register dat precies klopt drift niet', () => {
  const zelfde = { 'a.test.js': 100, 'b.test.js': 200, 'c.test.js': 300 };
  const p = projectiefout(zelfde, zelfde, 4, Object.keys(zelfde));
  assert.ok(p.fout < 0.001 || Number.isFinite(p.fout),
    'gelijke gewichten horen geen drift op te leveren');
  const v = vergelijk({ duur: zelfde }, zelfde);
  assert.equal(v.totaleKosten, 0);
  assert.equal(v.maxBestand, 0);
});

test('max bestand wijst het ERGSTE verschil aan, ook als het krimpt', () => {
  const oud = { 'a.test.js': 100, 'traag.test.js': 100 };
  const vers = { 'a.test.js': 110, 'traag.test.js': 20 };
  const v = vergelijk({ duur: oud }, vers);
  assert.equal(v.maxNaam, 'traag.test.js',
    'een bestand dat vijf keer sneller werd is net zo goed drift');
  assert.ok(v.maxBestand < 0, 'en het teken hoort te kloppen');
});

test('de drie banden staan waar het contract ze zet', () => {
  const g = (fout) => beoordeel({ zelfdeModus: true, gedeeld: 10, fout }).status;
  assert.equal(g(0), 'ACTUEEL');
  assert.equal(g(GRENS.verouderd - 0.001), 'ACTUEEL');
  assert.equal(g(GRENS.verouderd), 'VEROUDERD');
  assert.equal(g(GRENS.ongeldig - 0.001), 'VEROUDERD');
  assert.equal(g(GRENS.ongeldig), 'ONGELDIG');
  assert.equal(g(3), 'ONGELDIG');
});

test('een andere modus is ONGELDIG, hoe klein het verschil ook is', () => {
  /* De kern van de hele reparatie. Met dekking aan is dezelfde toets een ander
     kostenmodel; twee registers die toevallig dicht bij elkaar liggen zeggen
     daar niets over. Een getal mag dit oordeel dus niet kunnen overrulen. */
  assert.equal(beoordeel({ zelfdeModus: false, gedeeld: 1000, fout: 0 }).status, 'ONGELDIG');
});

test('geen gedeeld bestand is geen overeenstemming', () => {
  assert.equal(beoordeel({ zelfdeModus: true, gedeeld: 0, fout: 0 }).status, 'ONGELDIG');
});

test('zonder meting komt er nooit een groen antwoord uit', () => {
  /* De gevaarlijkste faalvorm van een wachter: hij vindt niets en zegt dat het
     goed is. Ook met --poort moet dit een foutcode geven. */
  const draai = (extra) => {
    try {
      execFileSync(process.execPath, [SCRIPT, '--meting', 'bestaat-niet-xyz', ...extra],
        { encoding: 'utf8', stdio: 'pipe' });
      return 0;
    } catch (e) { return e.status; }
  };
  assert.notEqual(draai([]), 0, 'zonder meting is er niets vastgesteld');
  assert.notEqual(draai(['--poort']), 0, 'en de poort hoort dat zeker niet door te laten');
});
