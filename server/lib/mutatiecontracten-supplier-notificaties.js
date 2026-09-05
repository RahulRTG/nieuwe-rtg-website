/* ============================================================================
   MUTATIECONTRACT -- DE EERSTE VULLING VAN DE LEVERANCIERSBEL.

   Het HTTP-huis gebruikt POST ook voor lezingen, waardoor iedere nieuwe route
   in het mutatiecontractregister komt. /supplier/notifications is zo'n lezer:
   hij kiest geen zaak uit de body, maar leest maximaal veertig meldingen uit de
   zaak die supplierAuth op het token heeft gezet. Markeren als gelezen woont
   op de bestaande, afzonderlijke /notifications/read-route.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/supplier/notifications': {
    mutatieId: 'supplier.notifications',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'test/supplier-notificaties.test.js roept de route tweemaal aan en vergelijkt het hele antwoord; ' +
        'de tenant- en gelezen-stand blijven gelijk',
      op: '2026-09-04'
    },
    nagekeken: 'handler gelezen in server/routes/supplier.js op 2026-09-04: hij maakt alleen een slice van ' +
      'db.data.supplierNotifications[req.supplier.code] en antwoordt met JSON; geen save(), toewijzing, bericht ' +
      'of externe aanroep. supplierAuth haalt req.supplier uit de geverifieerde sessie, niet uit de body.',
    afgetekend: {
      door: 'Codex, handler en tenantproef nagekeken; niet door de eigenaar per route nagelezen',
      op: '2026-09-04'
    }
  }
};

module.exports = { CONTRACTEN };
