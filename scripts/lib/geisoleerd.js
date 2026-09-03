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
  /* ERBIJ OP 3 SEPTEMBER 2026 (TAKEN.md 4.72). Hij hernoemt `req.envelop` in
     server/opzet/envelop.js om te bewijzen dat de meter zakt zodra de canonieke
     vorm weg is, en hij zet req.boardroomKey terug in de boardroom-poort. Beide
     staan in een finally weer goed -- maar precies daar gaat 4.77 over: een
     andere toets die op dat moment een server start, leest het kapotte bestand.
     Deze regel is niet met de hand gevonden maar door test/bronmutanten.test.js,
     die er onmiddellijk over viel toen de toets erbij kwam. */
  'actorvormen.test.js',
  /* DEZE TWEE ZIJN GEVONDEN DOOR DE ZEEF ZELF, op 3 september 2026, toen die
     leerde kijken naar een schrijf op een pad uit een VARIABELE (TAKEN.md 4.77).
     Ze stonden hier niet en muteerden wel echte bron:

       capabilities.test.js       zet server/kern/zz-capmeting-proef.js neer
       gezagshandelingen.test.js  muteert kern/frictie/bodem.js

     Allebei zetten ze het netjes terug in een finally, en allebei zijn ze
     daarmee precies het geval waar deze lijst voor bestaat: terwijl dat halve
     seconde duurt, start een andere toets een server. */
  'capabilities.test.js',
  'gezagshandelingen.test.js',
  /* En de vierde, gevonden door dezelfde zeef een dag later (TAKEN.md 4.71):
     envelopvelden.test.js hernoemt de tenant-regel in server/opzet/envelop.js om
     te bewijzen dat de meter een weggevallen drager ziet. */
  'envelopvelden.test.js',
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
