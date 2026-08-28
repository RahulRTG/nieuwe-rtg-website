/* EEN LEGE AANVRAGER IS GEEN VRIJBRIEF.

   De bankmodules hielden bezit tegen de aanvrager met deze vorm:

       if (!m || (codenaam && m.codenaam !== String(codenaam).trim())) ...

   Lees de voorwaarde: bij een LEGE codenaam valt de eigendomscontrole weg en
   gaat de deur open. Dat was bewust -- het kantoor roept dezelfde functies aan
   zonder codenaam en mag wel overal bij -- maar het betekende dat de grendel op
   andermans geld hing aan de vraag of een variabele in een ANDER bestand
   toevallig gevuld was (liveCodename in server/kern/live.js, die null geeft bij
   een sessie zonder account en zonder bekende tier).

   Vandaag produceert de leden-inlog dat niet, dus vandaag was er geen gat. Maar
   "er is vandaag geen weg naartoe" is geen eigenschap van deze regel; het is een
   uitspraak over een ander bestand. Dat is LAT.md regel 8, en dit bestand toetst
   de reparatie: server/kern/bank/eigendom.js maakt de twee aanvragers expliciet
   (een codenaam, of de sentinel KANTOOR) en laat al het andere DICHTvallen.

   Dit is bewust een unit-toets en geen servertoets. De hele vraag is wat er
   gebeurt bij een aanvrager die de HTTP-laag vandaag niet kan produceren; via de
   server zou ik hem niet eens kunnen aanbieden, en dan zou de toets bewijzen dat
   de weg dicht is in plaats van dat de grendel deugt.

   Draai los: node --experimental-sqlite --test test/bank-eigendom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { KANTOOR, magBij } = require('../server/kern/bank/eigendom');

const rekeningVanA = { iban: 'NL01RTGB0000000001', codenaam: 'Zilveren Valk A1' };

test('1. de eigenaar mag erbij, en niemand anders', () => {
  assert.equal(magBij(rekeningVanA, 'Zilveren Valk A1'), true, 'de eigenaar zelf');
  assert.equal(magBij(rekeningVanA, 'Gouden Ibis B2'), false, 'een ander lid niet');
  assert.equal(magBij(rekeningVanA, 'zilveren valk a1'), false,
    'en niet hoofdletterongevoelig -- een codenaam is een sleutel, geen zoekterm');
  // witruimte om de codenaam heen mag wel: die komt uit een sessieveld
  assert.equal(magBij(rekeningVanA, '  Zilveren Valk A1  '), true);
});

test('2. DE REPARATIE: een lege aanvrager valt dicht in plaats van open', () => {
  /* Dit is het geval dat vroeger de kluis opende. Elk van deze waarden zorgde
     ervoor dat `codenaam && ...` als geheel onwaar werd, waardoor de controle
     werd overgeslagen en de aanvrager bij ELKE rekening kon. */
  for (const leeg of ['', '   ', null, undefined, 0, false, NaN]) {
    assert.equal(magBij(rekeningVanA, leeg), false,
      'een lege aanvrager (' + JSON.stringify(leeg) + ') hoort GEEN toegang te geven');
  }
});

test('3. het kantoor maakt zich kenbaar en komt er wel in', () => {
  assert.equal(magBij(rekeningVanA, KANTOOR), true, 'de sentinel is de kantoorweg');
  /* En hij is niet per ongeluk te typen: wie KANTOOR wil zijn moet de constante
     importeren, niet een tekst raden. */
  assert.equal(magBij(rekeningVanA, 'kantoor'), false);
  assert.equal(magBij(rekeningVanA, 'KANTOOR'), false);
  assert.equal(magBij(rekeningVanA, 'rtg-kantoor'), false, 'zonder de spatie is het de sentinel niet');
});

test('4. bezit dat niet bestaat geeft nooit toegang, ook niet aan het kantoor', () => {
  for (const geen of [undefined, null, false, 0, '']) {
    assert.equal(magBij(geen, 'Zilveren Valk A1'), false);
    assert.equal(magBij(geen, KANTOOR), false, 'ook het kantoor kan niet bij wat er niet is');
  }
});

test('5. bezit zonder codenaam is van niemand -- behalve voor het kantoor', () => {
  /* Een rij waarvan het eigenaarsveld leeg of weg is, mag niet ineens van
     IEDEREEN zijn. Dat is dezelfde fout een niveau lager: leegte die als
     toestemming wordt gelezen. */
  for (const wees of [{ iban: 'X' }, { iban: 'X', codenaam: '' }, { iban: 'X', codenaam: '   ' }, { iban: 'X', codenaam: null }]) {
    assert.equal(magBij(wees, 'Zilveren Valk A1'), false, 'een lid komt niet bij eigenaarloos bezit');
    assert.equal(magBij(wees, ''), false, 'en leeg-op-leeg is al helemaal geen match');
    assert.equal(magBij(wees, KANTOOR), true, 'het kantoor wel: dat is de hele reden dat de sentinel bestaat');
  }
});
