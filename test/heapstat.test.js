/* ============================================================================
   HET OORDEEL VAN DE HEAPPROEF -- KAN HET ALLE DRIE ZEGGEN?

   De rekenkant van scripts/heapproef.js staat apart (scripts/lib/heapstat.js)
   zodat hij te beproeven is met reeksen waarvan we het antwoord al weten. Dat
   is hier geen luxe: het oude FASE F-getal was maandenlang groen en betekende
   niets, omdat niemand het ooit had zien AANSLAAN.

   Vier dingen worden hier vastgehouden:

     1. een reeks met een echt lek geeft LEK;
     2. een schone reeks geeft STABIEL;
     3. ruis die groter is dan de drempel geeft NIET_VAST_TE_STELLEN en NOOIT
        stilzwijgend STABIEL -- dat is de fout die de oude meter maakte;
     4. het oordeel is REPRODUCEERBAAR: dezelfde cijfers geven hetzelfde
        interval, want anders is een uitslag niet na te rekenen;
     5. een lek dat in BEIDE condities even hard groeit, wordt gezien. Dat is
        geen bedacht geval maar de uitkomst van de echte ijking van 9 september
        2026: een ingebouwd lek van 120 MB/min gaf verkeer +141 en stilte +133,
        verschil 8, en de eerste versie van dit oordeel zei daarop STABIEL.

   Draai los: node --test test/heapstat.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mediaan, mad, tempos, oordeel, munt,
  welchInterval, bootstrapInterval, verschilInterval, tWaarde } = require('../scripts/lib/heapstat');

/* Een reeks bouwen met een bekende helling en een bekende ruis. Vaste munt, dus
   de toets zelf gokt niet: een toets die soms zakt leert niemand iets. */
function reeks(n, midden, ruis, zaad) {
  const r = munt(zaad); const uit = [];
  for (let i = 0; i < n; i++) uit.push(midden + (r() - 0.5) * 2 * ruis);
  return uit;
}

test('een lek in het VERKEERSPAD heet LEK', () => {
  const uit = oordeel({ verkeer: reeks(8, 200, 15, 1), stilte: reeks(8, 5, 15, 2), drempel: 40 });
  assert.equal(uit.stand, 'LEK');
  assert.equal(uit.verkeerslek.stand, 'LEK');
  assert.equal(uit.grondlek.stand, 'STABIEL', 'in rust groeit hij hier niet');
  assert.ok(uit.verkeerslek.laag > 40, 'ook de ondergrens hoort boven de drempel te liggen');
});

/* DE TOETS DIE DE IJKING HEEFT AFGEDWONGEN. Een lek op een timer groeit met en
   zonder verkeer even hard; het VERSCHIL is dan bijna nul. Wie alleen dat
   verschil beoordeelt, verklaart een server met 133 MB/min groei stabiel --
   en juist de zwaarste lekken van dit huis (de periodieke snapshot, de
   write-behind-flush) zitten in de achtergrond. Dit zijn de echte cijfers van
   de ijkronde van 9 september 2026. */
test('een lek in de ACHTERGROND heet ook LEK, al is het verschil nul', () => {
  const uit = oordeel({ verkeer: [146, 136, 136, 148], stilte: [133, 133, 133, 133], drempel: 40 });
  assert.equal(uit.stand, 'LEK', 'een server die in rust 133 MB/min groeit, is niet stabiel');
  assert.equal(uit.grondlek.stand, 'LEK');
  assert.equal(uit.verkeerslek.stand, 'STABIEL',
    'het verzoekpad zelf voegt hier inderdaad niets toe -- en dat mag het oordeel niet redden');
});

test('een schone reeks heet STABIEL -- beide vragen moeten daarvoor stabiel zijn', () => {
  const uit = oordeel({ verkeer: reeks(8, 3, 4, 3), stilte: reeks(8, 2, 4, 4), drempel: 40 });
  assert.equal(uit.stand, 'STABIEL');
  assert.equal(uit.verkeerslek.stand, 'STABIEL');
  assert.equal(uit.grondlek.stand, 'STABIEL');
  assert.ok(uit.verkeerslek.hoog <= 40, 'ook de bovengrens hoort onder de drempel te liggen');
});

test('de strengste van de twee wint, en dat is een gesloten ladder', () => {
  const { strengste } = require('../scripts/lib/heapstat');
  assert.equal(strengste('STABIEL', 'LEK'), 'LEK');
  assert.equal(strengste('STABIEL', 'NIET_VAST_TE_STELLEN'), 'NIET_VAST_TE_STELLEN');
  assert.equal(strengste('NIET_VAST_TE_STELLEN', 'LEK'), 'LEK');
  assert.equal(strengste('STABIEL', 'STABIEL'), 'STABIEL');
});

/* DE BELANGRIJKSTE VAN DE VIER. Dit zijn de cijfers van de drie 100M-rondes van
   9 september 2026 (+638, +897, -55 tegen stiltes +131, 0, -115). Wat de oude
   meter daarvan maakte was een getal; wat er hoort te staan is dat hij het niet
   weet. Zou dit ooit STABIEL of LEK gaan zeggen, dan is de drempel of het
   interval stilletjes versoepeld. */
test('ruis groter dan de drempel heet NIET_VAST_TE_STELLEN', () => {
  const uit = oordeel({ verkeer: [638, 897, -55], stilte: [131, 0, -115], drempel: 40 });
  assert.equal(uit.stand, 'NIET_VAST_TE_STELLEN');
  assert.ok(uit.oplossing > 40,
    'het oplossend vermogen hoort slechter te zijn dan de drempel, was ' + uit.oplossing);
  assert.match(uit.reden, /verkeerslek .*grondlek /, 'de reden hoort beide vragen te noemen');
});

test('een lek dat precies op de drempel ligt is niet vast te stellen, niet stabiel', () => {
  const uit = oordeel({ verkeer: reeks(8, 40, 30, 5), stilte: reeks(8, 0, 30, 6), drempel: 40 });
  assert.equal(uit.stand, 'NIET_VAST_TE_STELLEN');
});

test('dezelfde cijfers geven hetzelfde oordeel -- een uitslag is na te rekenen', () => {
  const a = oordeel({ verkeer: [90, 120, 70, 110], stilte: [10, -5, 20, 0], drempel: 40 });
  const b = oordeel({ verkeer: [90, 120, 70, 110], stilte: [10, -5, 20, 0], drempel: 40 });
  assert.deepEqual(a, b);
});

test('een blok zonder geldige vloer levert geen tempo -- nul zou een meting verzinnen', () => {
  const per = tempos([{ soort: 'verkeer', begin: 100, eind: 190 },
    { soort: 'verkeer', begin: 200, eind: null },
    { soort: 'stilte', begin: 50, eind: 50 }], 1.5);
  assert.deepEqual(per.verkeer, [60]);
  assert.deepEqual(per.stilte, [0]);
});

test('zonder metingen is het antwoord NIET_VAST_TE_STELLEN en geen 0', () => {
  const uit = oordeel({ verkeer: [], stilte: [1, 2], drempel: 40 });
  assert.equal(uit.stand, 'NIET_VAST_TE_STELLEN');
});

test('de mediaan en de MAD laten zich niet meeslepen door een uitschieter', () => {
  assert.equal(mediaan([1, 2, 3, 4, 900]), 3);
  assert.equal(mad([1, 2, 3, 4, 900]), 1);
});

/* De reden dat er twee methodes zijn, als toets. Zou iemand de bootstrap alleen
   laten beslissen, dan komt bovenstaande "NIET_VAST_TE_STELLEN" terug als LEK
   -- en dat is precies de schijnzekerheid waar dit instrument tegen is. */
test('op weinig metingen is de bootstrap te smal, en de breedste wint', () => {
  const a = [638, 897, -55], b = [131, 0, -115];
  const bs = bootstrapInterval(a, b), w = welchInterval(a, b), samen = verschilInterval(a, b);
  assert.ok(bs.laag > 40, 'de bootstrap alleen zou hier LEK zeggen (ondergrens ' + bs.laag.toFixed(0) + ')');
  assert.ok(w.laag < 40, 'Welch hoort bij n=3 wel over de drempel heen te lopen');
  assert.ok(samen.laag <= bs.laag && samen.hoog >= bs.hoog, 'het gekozen interval hoort het breedste te zijn');
  assert.ok(samen.laag <= w.laag && samen.hoog >= w.hoog, 'het gekozen interval hoort het breedste te zijn');
});

test('de t-waarde groeit als de metingen op raken', () => {
  assert.ok(tWaarde(2) > tWaarde(10), 'weinig metingen horen een breder interval te geven');
  assert.ok(tWaarde(10) > tWaarde(60));
  assert.ok(Math.abs(tWaarde(1000) - 1.645) < 0.01, 'bij veel metingen hoort hij naar de normaalwaarde te gaan');
  assert.ok(Math.abs(tWaarde(5) - 2.015) < 0.001, 'de tabelwaarde zelf hoort exact terug te komen');
});
