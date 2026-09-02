/* ============================================================================
   MUTATIECONTRACT -- DE KNELPUNTMOTOR.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. De route staat in server/routes/knelpunt.js, de motor in
   server/kern/knelpunt/.

   EEN ROUTE DIE MET OPZET NIETS BEWAART. Alles komt binnen in het lijf en gaat
   eruit als antwoord; er is geen opslagroute en die komt er ook niet. Zodra een
   uitkomst bewaard wordt, ontstaat er een dossier met wegen en blokkades per
   mens -- precies het bestand dat HDI.md par. 5.1 verbiedt. Dat is geen
   ontbrekende functie maar de grens zelf, en daarom staat hij hier en niet in
   een lijst met "nog te bouwen".
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP } = require('./mutatiecontracten-beschermzaak-op');

const CONTRACTEN = {
  'POST /api/knelpunt': {
    mutatieId: 'knelpunt.reken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-02: de handler roept kern/knelpunt/index.js aan en geeft ' +
      'het antwoord door. Die module raakt geen opslag aan -- hij krijgt alles als argument, heeft ' +
      'geen db, geen save() en geen ctx, en is om die reden ook zonder database te toetsen (zelfde ' +
      'vorm als kern/livinglab/graden.js). De route zelf schrijft evenmin.',
    bewijs: {
      gemeten: 'dubbeltik-ronde tegen een draaiende server: twee identieke oproepen gaven een ' +
        'byte-voor-byte identiek antwoord, en het opslagbestand veranderde niet van grootte na een ' +
        'derde oproep. Zonder inlog antwoordt de route 401.',
      op: OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
