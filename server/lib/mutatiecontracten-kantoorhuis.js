/* ============================================================================
   MUTATIECONTRACT -- WELKE ENTITEIT IS RTG (besluit B1, PERSONEEL.md par. 12).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand, want ./mutatiecontracten-beleidsmotor.js zat aan de 10 kB-grens.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/beleidsmotor/huis/zet': {
    mutatieId: 'office.beleidsmotor.huis.zet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'tegen een draaiende server (test/kantoorhuis.test.js): 403 voor de gedeelde code en voor ' +
      'een vertrouweling met een boardroomsleutel, 404 op een entiteit die niet bestaat, 200 voor de eigenaar; ' +
      'dezelfde aanwijzing twee keer laat `sinds` en `door` staan (ongewijzigd). Een toestandscontrole en geen ' +
      'duplicaatlaag: wat vaststaat is dat een tweede identieke aanwijzing niets verandert.', op: '2026-09-27' },
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten; niet door een mens nagelezen',
      op: '2026-09-27' }
  }
};

module.exports = { CONTRACTEN };
