/* De twee Edge-ingangen zijn POST-lezers: hun body benoemt alleen de huidige
   Connection-context. De server leidt productstate, capabilities, acties en
   revision opnieuw af; geen van beide handlers verandert domeintoestand. */
'use strict';

const afgetekend = {
  door: 'Codex, handlers en volledige aanroepketen met de hand nagelezen',
  op: '2026-09-22'
};

const leescontract = (mutatieId, bestand, keten) => ({
  mutatieId,
  herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'de Connection Product State-integratietests vragen dezelfde Edge-context herhaald op en bewijzen dat alleen de actuele serverprojectie wordt teruggegeven',
    op: '2026-09-22'
  },
  nagekeken: 'met de hand, 2026-09-22: ' + bestand + ' roept uitsluitend ' + keten +
    ' aan; die keten leest bestaande domeintoestand en bouwt een projection/revision zonder save(), toewijzing aan opslag of externe bijwerking',
  afgetekend
});

const CONTRACTEN = {
  'POST /api/vonk/edge': leescontract(
    'vonk.edge',
    'server/routes/vonk.js',
    'server/kern/vonk/state.js en server/kern/connection-product-state.js'
  ),
  'POST /api/member/rendezvous/edge': leescontract(
    'member.rendezvous.edge',
    'server/routes/member/rendezvous.js',
    'server/kern/rendezvous-state.js en server/kern/connection-product-state.js'
  )
};

module.exports = { CONTRACTEN };
