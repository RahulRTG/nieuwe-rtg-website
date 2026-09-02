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

/* ===========================================================================
   HOEVEEL VAN EEN MODUS KOMT ECHT UIT DEZE OMGEVING?

   Een modus bewaart het gewicht van een bestand dat deze ronde niet draaide.
   Dat is met opzet -- een scherf mag de andere drie kwarten niet wissen -- maar
   zo'n gewicht houdt wel zijn oude bron. Appels met peren, nu BINNEN een modus.
   =========================================================================== */
const { vreemdeBronnen } = require('../scripts/gewichtdrift');

test('een gewicht van een andere bron wordt geteld, niet weggepoetst', () => {
  const modus = { spreiding: {
    'vers-a.test.js': { bronnen: ['ci|v26|4|abc'], gemetenOp: '2026-09-01' },
    'vers-b.test.js': { bronnen: ['ci|v26|4|abc'], gemetenOp: '2026-09-01' },
    'oud.test.js':    { bronnen: ['lokaal|v22|4|xyz'], gemetenOp: '2026-08-01' }
  } };
  const h = vreemdeBronnen(modus);
  assert.equal(h.huidig, 'ci|v26|4|abc', 'de nieuwste bron komt van de jongste meting');
  assert.equal(h.vreemd, 1, 'het oude gewicht hoort geteld te worden');
  assert.equal(h.totaal, 3);
});

test('een modus die in een keer gemeten is, draagt geen vreemde bronnen', () => {
  const modus = { spreiding: {
    'a.test.js': { bronnen: ['ci|v26|4|abc'], gemetenOp: '2026-09-01' },
    'b.test.js': { bronnen: ['ci|v26|4|abc'], gemetenOp: '2026-09-01' }
  } };
  assert.equal(vreemdeBronnen(modus).vreemd, 0);
});

test('de herkomst verandert de status niet', () => {
  /* Een oude bron is geen bewijs dat het gewicht fout is; hij is een reden om
     het te WETEN. Wie hier een grens op zet, laat een register zakken omdat een
     toets een ronde niet meedraaide. */
  assert.equal(beoordeel({ zelfdeModus: true, gedeeld: 10, fout: 0 }).status, 'ACTUEEL');
});

test('zonder spreiding valt er niets over de herkomst te zeggen', () => {
  assert.equal(vreemdeBronnen({ duur: { 'a.test.js': 1 } }), null,
    'geen spreiding is geen nul vreemde bronnen maar geen antwoord');
});

test('de nieuwste bron komt uit de JONGSTE meting, niet uit de grootste hoop', () => {
  /* De gevaarlijkste faalvorm van deze meter: een register dat vooral uit oude
     gewichten bestaat. Telt hij over alle metingen, dan wint de oude bron op
     aantal, heet die "de nieuwste", en meldt hij bijna geen vreemde bronnen --
     precies wanneer er de meeste zijn. */
  const spreiding = {};
  for (let i = 0; i < 20; i++) {
    spreiding['oud-' + i + '.test.js'] = { bronnen: ['lokaal|v22|4|xyz'], gemetenOp: '2026-08-01' };
  }
  spreiding['vers.test.js'] = { bronnen: ['ci|v26|4|abc'], gemetenOp: '2026-09-01' };

  const h = vreemdeBronnen({ spreiding });
  assert.equal(h.huidig, 'ci|v26|4|abc',
    'de jongste meting bepaalt de huidige bron, ook al is zij in de minderheid');
  assert.equal(h.vreemd, 20, 'en dan zijn die twintig oude gewichten allemaal vreemd');
});
