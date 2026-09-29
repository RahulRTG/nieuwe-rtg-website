/* ============================================================================
   MUTATIECONTRACTEN -- DE PERSONEELSLUS (PERSONEEL.md).

   Deel van server/lib/mutatiecontracten.js (via ./mutatiecontracten-staffgemoed.js);
   zie de kop daar voor de vorm, en die
   van ./mutatiecontracten-leest.js voor waarom NOT_APPLICABLE twee lijnen bewijs
   eist. Twee routes in een bestand, want het hoofdbestand zit aan de 10 kB-grens:

   - welke entiteit RTG IS (besluit B1, PERSONEEL.md par. 12);
   - de ochtendkaart (par. 4, kern/ochtendkaart.js): een POST omdat dit huis geen
     GET met een sessie kent, niet omdat hij iets verandert.
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
  },
  'POST /api/staff/ochtend': {
    mutatieId: 'staff.ochtend.lezen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED',
      let: 'supplierAuth is de bewakerslaag die de router ziet; de eis van een persoonlijke login ' +
        '(req.actor.staffId) staat in de handler. Code en persoon komen uit de SESSIE en nooit uit ' +
        'het lichaam, dus een medewerker leest uitsluitend zijn eigen kaart.' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-28: routes/staff/ochtend.js roept alleen kern.ochtendkaart aan, en ' +
      'kern/ochtendkaart.js leest scheduleFor, de verzuimregel (kern/payroll/inplanbaar.js), groothandelOrders, reserveringen en de ' +
      'klok -- geen save(), geen toewijzing aan db.data, geen logActivity.',
    bewijs: { gemeten: 'tegen een draaiende server (test/ochtendkaart.test.js toets 6): twee oproepen ' +
      'achter elkaar gaven een identiek antwoord; een zaak-inlog zonder persoon kreeg 403 en geen sessie 401',
      op: '2026-09-28' },
    afgetekend: { door: 'Claude Code, handler geschreven en nagelezen, dubbeltik gemeten; niet door een mens nagelezen',
      op: '2026-09-28' }
  }
};

module.exports = { CONTRACTEN };
