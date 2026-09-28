/* ============================================================================
   MUTATIECONTRACT -- DE OCHTENDKAART (PERSONEEL.md par. 4, kern/ochtendkaart.js).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm, en die
   van ./mutatiecontracten-leest.js voor waarom NOT_APPLICABLE twee lijnen bewijs
   eist. Een POST omdat dit huis geen GET met een sessie kent, niet omdat hij iets
   verandert.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/staff/ochtend': {
    mutatieId: 'staff.ochtend.lezen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED',
      let: 'supplierAuth is de bewakerslaag die de router ziet; de eis van een persoonlijke login ' +
        '(req.actor.staffId) staat in de handler. Code en persoon komen uit de SESSIE en nooit uit ' +
        'het lichaam, dus een medewerker leest uitsluitend zijn eigen kaart.' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude, 2026-09-28: routes/staff/ochtend.js roept alleen kern.ochtendkaart aan, en ' +
      'kern/ochtendkaart.js leest scheduleFor, de verzuimlaag, groothandelOrders, reserveringen en de ' +
      'klok -- geen save(), geen toewijzing aan db.data, geen logActivity.',
    bewijs: { gemeten: 'tegen een draaiende server (test/ochtendkaart.test.js toets 6): twee oproepen ' +
      'achter elkaar gaven een identiek antwoord; een zaak-inlog zonder persoon kreeg 403 en geen sessie 401',
      op: '2026-09-28' },
    afgetekend: { door: 'Claude Code, handler geschreven en nagelezen, dubbeltik gemeten; niet door een mens nagelezen',
      op: '2026-09-28' }
  }
};

module.exports = { CONTRACTEN };
