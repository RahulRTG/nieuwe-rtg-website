/* DE SCHRIJFPROEF (scripts/schrijfproef.js) -- de indeling, niet de ronde.

   Deze toets draait GEEN meting: dat kost een server per route en hoort in
   `npm run schrijfproef`. Wat hier bewaakt wordt is de weegfunctie, en die is
   op 13 september een keer aantoonbaar fout geweest op een manier die niemand
   zag: elke 5xx las als WEIGERT ("de route vertelt de aanroeper de waarheid"),
   waardoor /api/supplier/oog/overzicht -- dat 503 geeft omdat zijn DIENST
   uitstaat, met of zonder verraad -- in het GUNSTIGE vak belandde. Een dode
   route las als een veilige.

   Dat is dezelfde faalvorm als de BLOCKED_BODY-fout in de crashproef diezelfde
   dag: een enkel negatief signaal gelezen als een uitspraak over de route. Beide
   keren viel hij de kant op die het vleiendst was, en dat is precies waarom hier
   een basismeting naast staat.

   MUTATIES DIE ZIJN GEDRAAID (LAT.md regel 2): de basismeting negeren, en 2xx
   zonder opslagverandering als SCHREEF_TOCH indelen -- allebei laten ze een
   bewering hieronder zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sp = require('../scripts/schrijfproef.js');

test('een 2xx over een onveranderde opslag is een VALS SUCCES', () => {
  const u = sp.weeg({ status: 200, opslagBewoog: false, basisStatus: 200 });
  assert.equal(u.stand, 'VALS_SUCCES');
  assert.match(u.reden, /niets is bewaard/);
});

/* DE KERN VAN DIT BESTAND. Zonder de basismeting is `WEIGERT` een leugen: hij
   zou ook gelden voor een route die sowieso al stuk was. */
test('een route die ZONDER verraad al faalt, bewijst niets -- en heet niet WEIGERT', () => {
  const uit = sp.weeg({ status: 503, opslagBewoog: false, basisStatus: 503 });
  assert.equal(uit.stand, 'ONBEREIKT', 'dit was oog/overzicht: dienst uit, geen oordeel');
  assert.notEqual(uit.stand, 'WEIGERT', 'een dode route hoort niet in het gunstige vak');
  assert.match(uit.reden, /ZONDER verraad/, 'en de reden noemt waarom er niets te wegen valt');
});

test('een route die WEL werkte en daarna weigert, is het goede geval', () => {
  const u = sp.weeg({ status: 503, opslagBewoog: false, basisStatus: 200 });
  assert.equal(u.stand, 'WEIGERT');
  assert.match(u.reden, /zonder verraad \(200\)/, 'met de basismeting in de reden');
});

test('schreef de opslag toch, dan is er niets bewezen -- geen stilzwijgend groen', () => {
  const u = sp.weeg({ status: 200, opslagBewoog: true, basisStatus: 200 });
  assert.equal(u.stand, 'SCHREEF_TOCH');
  assert.match(u.reden, /niets bewezen/);
});

test('een 4xx komt niet aan schrijven toe, en een dode verbinding ook niet', () => {
  assert.equal(sp.weeg({ status: 400, opslagBewoog: false, basisStatus: 200 }).stand, 'ONBEREIKT');
  assert.equal(sp.weeg({ status: 0, opslagBewoog: false, basisStatus: 200 }).stand, 'ONBEREIKT');
});

test('de vier standen zijn gesloten en dragen elk een uitleg', () => {
  assert.deepEqual(Object.keys(sp.STANDEN).sort(),
    ['ONBEREIKT', 'SCHREEF_TOCH', 'VALS_SUCCES', 'WEIGERT']);
  for (const [k, v] of Object.entries(sp.STANDEN))
    assert.ok(v && v.length > 30, k + ' hoort uit te leggen wat hij betekent');
});

/* DE CONTROLE VAN DE PROEF ZELF. Zonder haar is een ronde die overal
   VALS_SUCCES rapporteert niet te onderscheiden van een kapotte opstelling. */
test('het register draagt de uitslag van de controleroute', () => {
  const r = require('../SCHRIJFPROEF.json');
  assert.equal(r.controle.pad, sp.CONTROLE, 'de controle staat in het register');
  assert.equal(r.controle.stand, 'WEIGERT',
    'slaat de controle om, dan is er een regressie of een kapotte opstelling -- en dan hoort ' +
    'deze toets te zakken in plaats van de ronde stil te laten doorgaan');
  assert.match(r.grens, /GEEN oordeel over write-behind/,
    'het register zegt zelf wat het NIET beweert');
});
