'use strict';
// Leesweg en mutatie zijn gescheiden: bewaren gebruikt de bestaande broker.
module.exports.CONTRACTEN = {
  'POST /api/experience/network': {
    mutatieId: 'experience.network.read', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { op: '2026-09-30', gemeten: 'test/experience-network.test.js controleert dat samenstellen ' +
      'geen opslag schrijft; test/experience-network-http.test.js controleert sessie, gast en context.' },
    nagekeken: 'server/kern/experience/network.js en network-offers.js lezen domeinprojecties. ' +
      'compose en handoff veranderen geen domeinobject, versturen niets en boeken niets. ' +
      'network.plan.save heeft een afzonderlijke handler achter de bestaande Action Broker.',
    afgetekend: { door: 'Codex, gebouwd en met bronlezing en geautomatiseerde proeven gecontroleerd; geen menselijke UX-goedkeuring', op: '2026-09-30' }
  }
};
