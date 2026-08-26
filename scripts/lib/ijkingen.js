'use strict';

/* DE IJKINGEN: de toetsen die de BRON aanraken terwijl ze draaien.

   Deze zes doen iets wat geen andere toets doet: ze zetten met opzet een
   bestand in de boom (of veranderen er een) om te controleren dat een meter
   daar rood van wordt, en ruimen het daarna weer op. Zolang zo'n bestand
   bestaat, ziet elke scanner die op datzelfde moment door server/ of test/
   loopt iets wat er straks niet meer is -- en dan zakt een geldige build op
   een bestand van een seconde oud.

   Daarom draaien ze nooit tussen de rest door. scripts/test-runner.js houdt ze
   apart, een voor een, na de gewone bestanden; de CI geeft ze sinds
   27 augustus 2026 elk een EIGEN job, zodat ze ook niet meer achter een deel
   aan hoeven te sluiten (meterijk alleen duurde 18 van de 19 minuten van het
   langste deel).

   WAAROM DEZE LIJST HIER STAAT EN NIET IN DE RUNNER. Hij wordt nu op twee
   plekken gebruikt: de runner slaat ze over met --zonder-ijkingen, en de
   keten geeft ze elk een job. Twee lijsten die hetzelfde horen te zeggen lopen
   uiteen, en de manier waarop ze uiteenlopen is de ergste die er is: een
   ijking die uit de shards is gehaald en geen eigen job heeft gekregen, draait
   nergens meer en niemand ziet het. test/delen.test.js legt de matrix in
   .github/workflows/ci.yml daarom naast deze lijst. */

const IJKINGEN = [
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'keuring.test.js',
  'klok.test.js',
  'meterijk.test.js',
  'zaakdoos.test.js'
];

/* De naam zoals de CI-matrix hem draagt: zonder .test.js, want dat leest in een
   jobnaam prettiger ("De ijking: meterijk") en het is de enige vorm die in twee
   bestanden hetzelfde moet zijn. */
const kort = (naam) => naam.replace(/\.test\.js$/, '');

module.exports = { IJKINGEN, KORT: IJKINGEN.map(kort), kort };
