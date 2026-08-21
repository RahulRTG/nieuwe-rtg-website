'use strict';
/* WELKE TOETSEN ALLEEN MOETEN DRAAIEN.

   Deze bestanden muteren bron of gedeelde staat: ze schrijven in de repository,
   ijken tegen een echte klok, of zetten iets neer waar een andere toets dan
   overheen valt. Draaien ze naast iets anders, dan zakt dat andere -- en op een
   plek die niets met de fout te maken heeft. Dat is de duurste soort rood die er
   is, want het wijst de verkeerde kant op.

   HIJ STAAT HIER EN NIET IN DE LOPER, en dat is met reden. scripts/test-runner.js
   is een script: wie het met require() opent om alleen deze lijst te lezen, start
   de hele suite. Dat is geen bedacht risico -- het is bij het bouwen van
   scripts/draai.js precies zo misgegaan. Een lijst met twee lezers hoort in een
   bestand dat niets doet als je het opent.
   ========================================================================== */
const GEISOLEERD = new Set([
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'klok.test.js',
  'zaakdoos.test.js',
  'keuring.test.js',
  'meterijk.test.js'
]);

module.exports = { GEISOLEERD };
