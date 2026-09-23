/* ============================================================================
   MUTATIECONTRACT -- DE STAND VAN DE BELEIDSMOTOR (AUTHORITY.md fase 1).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand, want ./mutatiecontracten-leest.js zat aan de 10 kB-grens. De
   vorm is die van POST /api/office/mensdeur daar: de stand van een
   schaduwmeting, en de meting zelf schrijft via een andere ingang (res.finish).
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/beleidsmotor': {
    mutatieId: 'office.beleidsmotor',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/beleidsmotor.test.js toets 2 en 4): 403 op een ' +
      'gedeelde kantoorsessie, 401 zonder sessie, 200 voor de eigenaar; twee keer lezen geeft dezelfde vorm', op: '2026-09-23' },
    nagekeken: 'met de hand, 2026-09-23: server/routes/office/beleidsmotor.js roept alleen ' +
      'kern.beleidsmotor.stand() aan, en die leest via eigen.kijk() plus een projectie van de RAM-buffer -- ' +
      'geen save(), geen toewijzing. De tellers zelf lopen via bewaak()/meelezer() op res.finish; ' +
      'ook dit verzoek telt daar mee als een waarneming van de boardroomdeur, en dat is die andere ingang',
    afgetekend: { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-23' }
  },
};

module.exports = { CONTRACTEN };
