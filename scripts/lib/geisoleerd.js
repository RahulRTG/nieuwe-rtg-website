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
   scripts/draai.js precies zo misgegaan (dat script is op 1 september 2026
   opgeruimd; de fout blijft de reden). Een lijst met twee lezers hoort in een
   bestand dat niets doet als je het opent.
   ========================================================================== */
const GEISOLEERD = [
  'boot-smoke.test.js',
  'grens-sweep.test.js',
  'klok.test.js',
  'zaakdoos.test.js',
  'vloot.test.js',
  'keuring.test.js',
  'meterijk.test.js',
  'gezag.test.js',
  'envelop.test.js',
  /* ERBIJ OP 22 AUGUSTUS 2026, en met een eerlijke slag om de arm. Deze toets
     slaagt drie van de drie keer alleen en zakte in CI binnen een scherf van 272
     bestanden op 'de zaak laat achteraf betalen' -- een betaalinstelling van een
     leverancier die hij leest nadat een ander hem heeft gezet. WELKE toets dat
     doet heb ik niet aangewezen; wat vaststaat is dat hij alleen wel en samen
     niet werkt. Isoleren is hier het juiste gereedschap en geen doekje: de rest
     van de suite wordt er niet trager van, en een toets die van zijn buren
     afhangt meet niet wat hij beweert. Wie de echte botsing vindt, haalt hem
     hier weg. */
  'lidfactuur.test.js'
];

function isGeisoleerd(naam) {
  const n = String(naam || '');
  for (const item of GEISOLEERD) if (item === n) return true;
  return false;
}

module.exports = { GEISOLEERD, isGeisoleerd };
