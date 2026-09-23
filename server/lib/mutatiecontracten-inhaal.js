/* ============================================================================
   MUTATIECONTRACT -- de inhaalslag voor dienstverbanden (ARBEID.md par. 7a).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   Zonder `keuze` leest deze route alleen (een voorstel). Met `keuze` legt zij
   dienstverbanden vast, maar alleen voor wie IN het voorstel staat -- en wie een
   lopend dienstverband bij de entiteit heeft, staat er niet meer in. Een
   herhaalde keuze vindt dus niemand meer om vast te leggen: de stand na twee
   aanroepen is die na een, door een eigen afhandeling in de kern
   (kern/concern/aanname.js, dienstverbandInhaal) en niet door een sleutel.
   Het ANTWOORD verschilt wel: de tweede zegt "overgeslagen, staat niet in het
   voorstel". Dat is de stand die PROTECTED vraagt, niet hetzelfde antwoord.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/concern/vestiging/inhaal': {
    mutatieId: 'concern.vestiging.inhaal',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* De router ziet een ingelogd lid; de eigendomscontrole op de vestiging
       (mijnVestiging) zit in de route, zoals bij elke concern-route. */
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'scripts/adamproef.js schakel 18 (over HTTP, tegen een wegwerpserver): de eerste keuze ' +
        'gaf een dienstverband erbij, dezelfde keuze nog een keer gaf er geen tweede (het aantal ' +
        'dienstverbanden van de entiteit bleef op eerst + 1). test/aanname-dienstverband.test.js toets ' +
        '10 en 11 meten op de kern dat zonder keuze niets wordt vastgelegd en dat alleen wie in het ' +
        'voorstel staat een dienstverband krijgt.',
      op: '2026-09-23'
    },
    afgetekend: {
      door: 'Claude (Opus 5.5), op grond van de keten over HTTP en de kerntoetsen; niet door een mens nagelezen',
      op: '2026-09-23'
    }
  }
};

module.exports = { CONTRACTEN };
