/* DE TESTHAL-METING -- en of hij werkelijk iets onderscheidt.

   scripts/magnaatlab.js beantwoordt de vraag uit MAGNAATLAB.md par. 2: bewijst
   Magnaat vandaag iets over RTG? De uitkomst is 0% -- de simulatielaag raakt
   geen enkel RTG-domein aan -- en juist daarom staat dit bestand hier.

   NUL IS DE GEVAARLIJKE KANT VAN DEZE METER. Een meter die 0% meldt omdat hij
   niets KAN zien, geeft exact hetzelfde getal als een meter die 0% meet omdat
   er niets IS. Het verschil is niet aan het getal te zien, en het hele document
   hangt eraan. Deze meter is er tijdens het bouwen ook echt ingetrapt: hij
   leende de wringer van objectmodel.js, die tekenreeksen wegpoetst, en meldde
   doodleuk "0 requires in de simulatielaag" -- de gewenste uitkomst, om de
   verkeerde reden.

   Daarom toetst dit bestand zes dingen, en de zesde is de belangrijkste:

     1. een require in CODE telt, een require in COMMENTAAR niet;
     2. de klok en node's eigen modules zijn geen capability;
     3. een aanroep naar de ANDERE synthetische wereld is geen bereik in RTG,
        maar wordt wel geteld -- dat is de vraag of dit een simulatielaag is of
        twee;
     4. het onderwerp van een module wordt goed afgeleid (anders vindt de
        dubbelingshelft niets, en dan is nul opnieuw betekenisloos);
     5. gedeeld ONDERWERP is niet gedeelde VORM;
     6. DE TEGENPROEF: als de simulatielaag RTG WEL aanroept, ziet de meter dat.

   Draai los: node --test test/magnaatlab.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../scripts/magnaatlab');

const WORTEL = path.join(__dirname, '..');

/* Een verzonnen module in de vorm die lees() oplevert, zodat analyse() te voeren
   is met invoer waarvan we WETEN wat eruit hoort te komen. */
const mod = (rel, requires, vormen) => ({
  rel,
  wereld: Object.keys(M.WERELDEN).find(w => M.WERELDEN[w].some(r => r.test(rel))) || null,
  requires: requires || [],
  naarBuiten: false,
  vormen: vormen || []
});
const SIM = 'server/kern/spellen/magnaat/';

test('1. een require in code telt, een require in commentaar niet', () => {
  const bron = [
    "const a = require('./sectoren');",
    "/* ooit stond hier require('./weggehaald') */",
    "// en hier require('./ookweg')",
    "const b = require('../../pay/poort');"
  ].join('\n');
  const r = M.requiresVan(bron);
  assert.deepEqual(r.sort(), ['../../pay/poort', './sectoren']);
});

test('2. de klok en node-modules zijn geen capability', () => {
  /* Zonder deze aftrek krijgt elke wereld een bereik van 1 doordat hij de klok
     leest, en dan lijkt er samenhang waar er geen is. */
  const r = M.analyse([
    mod(SIM + 'a.js', ['../lib/klok', 'node:fs', 'crypto']),
    mod('server/kern/pay/poort.js', [])
  ]);
  assert.equal(r.geraakteKernmodules, 0, 'de klok en node tellen niet als bereik');
  assert.equal(r.requiresTotaal, 3, 'maar ze zijn wel geteld als require');
});

test('3. een aanroep naar de ANDERE wereld is geen bereik, maar wordt geteld', () => {
  const r = M.analyse([
    mod(SIM + 'economie.js', ['../../hospitality-universe/world-model']),
    mod('server/kern/hospitality-universe/world-model.js', []),
    mod('server/kern/pay/poort.js', [])
  ]);
  assert.equal(r.geraakteKernmodules, 0, 'de andere wereld is geen RTG-kern');
  assert.equal(r.kruisWereldAanroepen, 1, 'maar hij telt wel als kruis-wereldaanroep');
  assert.equal(r.kruisWereld[0].wereld, 'hospitality');
});

test('4. het onderwerp van een module wordt afgeleid, niet geraden', () => {
  assert.equal(M.onderwerpVan('server/kern/magnaat-economie.js'), 'economie',
    'het magnaat-voorvoegsel hoort eraf, anders vindt de dubbeling niets');
  assert.equal(M.onderwerpVan('server/kern/bank/index.js'), 'bank',
    'een index.js draagt de naam van zijn map');
  assert.equal(M.onderwerpVan(SIM + 'bank-acties.js'), 'bank',
    'en -acties is versiering');
});

test('5. gedeeld ONDERWERP is niet gedeelde VORM', () => {
  /* De les van Cercle en Entourage, hier in het klein: twee modules die
     hetzelfde heten hoeven niets te delen. De meter hoort het paar te MELDEN
     (het is een kandidaat) en het niet als gelijk te TELLEN. */
  const r = M.analyse([
    mod(SIM + 'bank.js', [], [['id', 'speler', 'rente', 'termijn', 'onderpand']]),
    mod('server/kern/bank/index.js', [], [['id', 'iban', 'saldo', 'tenaamstelling', 'bic']])
  ]);
  assert.equal(r.gedeeldeOnderwerpen, 1, 'het onderwerp "bank" komt aan beide kanten voor');
  assert.equal(r.kandidaatparen, 1, 'dus is er een kandidaatpaar');
  assert.equal(r.parenMetGedeeldeVorm, 0, 'maar ze delen alleen `id`, en dat is geen vorm');
  assert.equal(r.paren[0].meetbaar, true, 'beide hebben vormen, dus de uitspraak is te doen');
});

test('6. DE TEGENPROEF: roept de simulatielaag RTG WEL aan, dan ziet de meter dat', () => {
  /* Zonder deze toets zou "0% bereik" ook groen blijven bij een meter die
     nooit iets vindt -- en dat is precies de conclusie die MAGNAATLAB.md draagt.
     LAT-regel 9: een toets die niet kan zakken is slechter dan geen toets. */
  const r = M.analyse([
    mod(SIM + 'economie.js', ['../../../pay/poort', '../../../waarde/policy']),
    mod('server/kern/pay/poort.js', []),
    mod('server/kern/waarde/policy.js', [])
  ]);
  assert.equal(r.geraakteKernmodules, 2, 'twee kernmodules geraakt');
  assert.equal(r.geraakteKernDomeinen, 2, 'in twee domeinen (kern/pay en kern/waarde)');
  assert.ok(r.bereikPct > 0, 'en het percentage is dan niet nul');
  assert.ok(r.bereik.some(b => /pay\/poort$/.test(b.doel)), 'de betaalpoort staat er met naam bij');
});

test('7. dezelfde vorm bij hetzelfde onderwerp wordt WEL als dubbeling geteld', () => {
  /* De tegenhanger van toets 5. Als er ooit echt een tweede uitvoering komt,
     hoort de meter hem aan te wijzen in plaats van hem weg te middelen. */
  const vorm = [['id', 'bedrag', 'valuta', 'status', 'tegenpartij', 'grond']];
  const r = M.analyse([
    mod(SIM + 'betaling.js', [], vorm),
    mod('server/kern/pay/betaling.js', [], [vorm[0].slice()])
  ]);
  assert.equal(r.parenMetGedeeldeVorm, 1, 'identieke vormen bij hetzelfde onderwerp zijn een dubbeling');
  assert.equal(r.paren[0].vormgelijkenis, 1);
});

test('8. de echte meting draait, en klopt met wat er is vastgelegd', () => {
  const r = M.meet();
  assert.ok(r.simulatiemodules >= 40, 'de simulatielaag is gevonden (' + r.simulatiemodules + ')');
  assert.ok(r.kernmodules >= 500, 'en de kern ook (' + r.kernmodules + ')');
  assert.ok(r.requiresTotaal >= 50,
    'er zijn requires gelezen (' + r.requiresTotaal + ') -- nul betekent dat de wringer ze opat');

  const pad = path.join(WORTEL, 'MAGNAATLAB.json');
  assert.ok(fs.existsSync(pad), 'MAGNAATLAB.json bestaat -- draai: npm run magnaatlab:vast');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  for (const sleutel of ['simulatiemodules', 'kernmodules', 'kernDomeinen', 'requiresTotaal',
    'geraakteKernDomeinen', 'bereikPct', 'kruisWereldAanroepen', 'parenMetGedeeldeVorm']) {
    assert.equal(r[sleutel], vast[sleutel],
      'MAGNAATLAB.json loopt achter op "' + sleutel + '" (' + vast[sleutel] + ' vastgelegd, ' +
      r[sleutel] + ' gemeten) -- draai: npm run magnaatlab:vast');
  }
});

test('9. de uitkomst die MAGNAATLAB.md par. 2 draagt, staat er ook echt', () => {
  /* LAT-regel 6: een belofte in tekst is een belofte in code. Kantelt een van
     deze drie, dan hoort dit te zakken en niet het document stil onwaar te
     worden. */
  const r = M.meet();
  assert.ok(r.bereikPct <= 1,
    'MAGNAATLAB.md par. 2 zegt dat de simulatielaag vrijwel geen RTG-domein raakt; ' +
    'gemeten: ' + r.bereikPct + '%');
  assert.equal(r.modulesDiePratenNaarBuiten, 0,
    'par. 2 zegt dat de ontsnapping via het netwerk niet wordt gebruikt; ' +
    'gemeten: ' + r.modulesDiePratenNaarBuiten + ' modules');
  assert.equal(r.parenMetGedeeldeVorm, 0,
    'par. 2 zegt dat er GEEN tweede uitvoering van een RTG-kern in de simulatielaag zit ' +
    '(het probleem is afwezigheid, niet dubbeling); gemeten: ' + r.parenMetGedeeldeVorm);
  assert.ok(r.kruisWereldAanroepen > 0,
    'par. 2 zegt dat de twee synthetische werelden elkaar wel kennen; ' +
    'gemeten: ' + r.kruisWereldAanroepen);
});
