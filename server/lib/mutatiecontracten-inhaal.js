/* ============================================================================
   MUTATIECONTRACT -- de inhaalslag voor dienstverbanden (ARBEID.md par. 7a).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   TWEE ROUTES, EN DAT IS DE LES. Eerst was het er een: zonder `keuze` een
   voorstel, met `keuze` vastleggen. De idem-poort behandelde een tweede,
   woordelijk gelijke voorstelvraag binnen het venster als herhaling en gaf het
   OUDE voorstel terug -- met iemand erin die net een dienstverband had
   gekregen (test/concern-scherm.e2e.js vond het). Een route die leest en een
   route die schrijft vragen een tegengestelde herhaalregel, dus zijn het twee
   routes: TONEN en DOEN, zoals elke handeling op het concern-scherm.

   De bevestiging legt alleen vast voor wie IN het voorstel staat, en wie een
   lopend dienstverband bij de entiteit heeft staat er niet meer in. Een
   herhaalde keuze vindt dus niemand meer om vast te leggen: de stand na twee
   aanroepen is die na een, door een eigen afhandeling in de kern
   (kern/concern/aanname.js, dienstverbandInhaal) en niet door een sleutel.
   Het ANTWOORD verschilt wel: de tweede zegt "overgeslagen, staat niet in het
   voorstel". Dat is de stand die PROTECTED vraagt, niet hetzelfde antwoord.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5.5), op grond van de keten over HTTP, de browsertoets en de kerntoetsen; niet door een mens nagelezen',
  op: '2026-09-23'
};

const CONTRACTEN = {
  'POST /api/concern/vestiging/inhaal': {
    mutatieId: 'concern.vestiging.inhaal',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* De router ziet een ingelogd lid; de eigendomscontrole op de vestiging
       (mijnVestiging) zit in de route, zoals bij elke concern-route. */
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'test/aanname-dienstverband.test.js toets 10: zonder keuze komt er een voorstel en ' +
        'employmentVanPersoon blijft leeg; test/concern-scherm.e2e.js: het voorstel openen laat het aantal ' +
        'dienstverbanden van de entiteit op nul, pas de bevestiging maakt er een.',
      op: '2026-09-23'
    },
    nagekeken: 'Claude, 2026-09-23, door de handler te lezen: routes/concern/mensen.js roept ' +
      'dienstverbandInhaal aan met keuze undefined, en die keert terug VOOR employmentNieuw ' +
      '(kern/concern/aanname.js, `if (!Array.isArray(keuze)) return`) -- geen bestand, geen bericht, geen teller',
    afgetekend: AFGETEKEND
  },
  'POST /api/concern/vestiging/inhaal/bevestig': {
    mutatieId: 'concern.vestiging.inhaal.bevestig',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'scripts/adamproef.js schakel 18 (over HTTP, tegen een wegwerpserver): de eerste keuze ' +
        'gaf een dienstverband erbij, dezelfde keuze nog een keer gaf er geen tweede (het aantal ' +
        'dienstverbanden van de entiteit bleef op eerst + 1). test/aanname-dienstverband.test.js toets ' +
        '11 meet op de kern dat alleen wie in het voorstel staat een dienstverband krijgt.',
      op: '2026-09-23'
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
