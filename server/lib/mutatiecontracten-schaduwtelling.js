/* ============================================================================
   MUTATIECONTRACT -- DE LEESWEG NAAR DE SCHADUWTELLING.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Een eigen bestand voor een enkele route omdat het bewijs hier van een
   ANDERE soort is dan in ./mutatiecontracten-leest.js: daar sluiten een gemeten
   kale ronde en scripts/schrijfanalyse.js elkaars gat, hier is de handler zo
   klein dat hij in zijn geheel te lezen is en is er nog geen proefronde die hem
   heeft aangeraakt. Dat verschil hoort zichtbaar te blijven en niet te worden
   ondergebracht bij een bewijsvorm die het niet is.

   WAT DE ROUTE DOET: `stand()` uit kern/stuur/schaduwtelling.js teruggeven. Die
   functie leest een Map en bouwt er een object uit; zij schrijft nergens, ook
   niet in de Map zelf. De enige plek waar die Map GROEIT is `noteer()`, en die
   wordt uitsluitend aangeroepen vanuit kern/stuur/lusstap.js -- niet vanaf deze
   route.

   WAAROM DAT NIET GENOEG IS OM `PROTECTED` TE HETEN: de vraag daar is of een
   TWEEDE aanroep hetzelfde doet, en dat is bij een route die niets verandert een
   verkeerde vraag. NOT_APPLICABLE is de juiste stand, en die eist bewijs dat er
   niets verandert plus een tweede lijn die afdekt wat de opslagmeter niet ziet
   (een bestand, een externe dienst, een teller daarbuiten). Die tweede lijn is
   hier de LEZING van een handler van twee regels -- en het register zegt erbij
   dat het een lezing is en geen meting.

   DE TOEGANGSKLASSE IS `AUTHENTICATED` EN NIET `CAPABILITY_GATED`. Hier stond
   die tweede, en dat las zwaarder dan het klopte: die klasse EIST de naam van
   een bevoegdheid uit kern/bevoegdheid/lijst.js, zodat het contract en de
   rechtenlijst over hetzelfde ding praten. `boardroomAuth` vraagt geen
   bevoegdheid maar een deur, en dat is nageteld en niet aangenomen: van de 101
   routes achter die bewaker hebben er 50 een afgeleid contract, en die zeggen
   alle 50 `AUTHENTICATED`. Een zwaardere klasse opschrijven dan er staat, maakt
   van het register een verlanglijst -- en de toets die dit ving, ving het op de
   ontbrekende NAAM.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/stuur/herkomstschaduw': {
    mutatieId: 'stuur.herkomstschaduw.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'niet gemeten: deze route is nieuw en heeft nog geen proefronde gehad. Dat staat ' +
        'hier als afwezigheid en niet als een nul -- IDEMPROEF.json neemt hem mee zodra ' +
        '`npm run idemproef` weer draait.',
      op: '2026-09-09'
    },
    nagekeken: 'Claude (Opus 5), 2026-09-09: de handler is twee regels en geeft `stand()` uit ' +
      'kern/stuur/schaduwtelling.js terug. Die functie leest een Map en bouwt een object; de Map ' +
      'groeit alleen in `noteer()`, dat uitsluitend vanuit kern/stuur/lusstap.js wordt aangeroepen ' +
      'en niet vanaf deze route. Er is geen bestand, geen externe aanroep en geen teller buiten de ' +
      'gemeten collecties. Dit is een LEZING van de handler en geen meting -- wie er zijn naam ' +
      'onder wil zetten, vervangt deze regel.',
    afgetekend: {
      door: 'Claude (Opus 5), op grond van een volledige lezing van de handler; niet door een mens nagelezen',
      op: '2026-09-09'
    }
  }
};

module.exports = { CONTRACTEN };
