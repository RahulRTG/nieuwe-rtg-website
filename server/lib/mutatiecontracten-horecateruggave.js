/* ============================================================================
   MUTATIECONTRACTEN -- DE TERUGGAVE NA EEN HORECACORRECTIE UITVOEREN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.
   Een route (routes/supplier/horeca/teruggave.js): de manager van de zaak
   betaalt een klaargezet teruggaverecht terug, per betaalwijze
   (kern/horeca/teruggave.js).
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/supplier/horeca/teruggave': {
    mutatieId: 'supplier.horeca.teruggave.uitvoeren',
    herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'test/horeca-teruggave.test.js tegen een echte server: een medewerker zonder managerrol krijgt ' +
        '403; zonder sleutel of reden 400; de manager voert een pin- en een bonteruggave een keer uit, dezelfde ' +
        'sleutel geeft dezelfde terugbetaling (herhaald) en een nieuwe sleutel op een opgebruikt recht 409. ' +
        'De kern: twee gelijktijdige aanroepen boeken samen een keer.',
      op: '2026-10-04'
    },
    afgetekend: {
      door: 'Claude (Opus 5), op grond van routes/supplier/horeca/teruggave.js, kern/horeca/teruggave.js en ' +
        'test/horeca-teruggave.test.js; niet door een mens nagelezen',
      op: '2026-10-04'
    }
  }
};

module.exports = { CONTRACTEN };
