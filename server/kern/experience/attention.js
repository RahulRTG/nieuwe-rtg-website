/* Event is geen attention en attention is geen notificatie. Deze laag maakt
   uitsluitend betekenisvolle AttentionItems uit al gekwalificeerde signalen. */
'use strict';

const { hash } = require('./canon');
const { sleutel } = require('./objectrefs');

// De bron bepaalt wat is gezien, niet alleen titel/status. Ook een gewijzigde
// vluchttijd moet een oud akkoord ongeldig maken. Alleen presentatie telt niet
// mee; nieuwe domeinvelden blijven conservatief onderdeel van de revisie.
const PRESENTATIE = new Set(['ref', 'generatedAt', 'teken', 'app', 'link',
  'lifecycle', 'acknowledgedAt']);

module.exports = function maakAttention({ crypto, opslag }) {
  function severity(item) {
    if (item.sig === 'incident' || item.soort === 'achterstallig') return 'ACTION_REQUIRED';
    if (item.sig === 'aandacht' || item.soort === 'komt') return 'TIME_SENSITIVE';
    return null;
  }
  function reason(world, item) {
    if (item.sig === 'incident') return String(item.soort || 'INCIDENT').toUpperCase();
    if (world === 'travel') return 'TRAVEL_TIMING';
    if (world === 'work') return 'WORK_TODAY';
    if (world === 'foundation') return item.soort === 'achterstallig' ? 'DEADLINE_PASSED' : 'NEXT_STEP';
    return item.soort === 'verrekening' || item.soort === 'toezegging' ? 'MONEY_ATTENTION' : 'LIFE_TODAY';
  }
  function uit(key, world, context, items) {
    return (items || []).map(item => {
      const sev = severity(item);
      if (!sev) return null;
      const grond = { world, context: context && context.id, object: sleutel(item.ref), reason: reason(world, item) };
      const id = 'att_' + hash(crypto, grond).slice(0, 20);
      const bron = Object.fromEntries(Object.entries(item).filter(([veld]) => !PRESENTATIE.has(veld)));
      const revision = hash(crypto, { version: 1, grond, bron });
      const bewaard = opslag.attentionLees(key, id);
      const gezien = bewaard && bewaard.revision === revision ? bewaard : null;
      return {
        id, version: 1, revision, primaryWorld: world, visibleIn: [world],
        contextId: context && context.id, severity: sev, reason: grond.reason,
        objectRef: item.ref, title: item.titel || 'Vraagt aandacht',
        explanation: item.uitleg || item.status || '', expiresAt: item.expiresAt || null,
        lifecycle: gezien && gezien.lifecycle || 'PRESENTED',
        acknowledgedAt: gezien && gezien.acknowledgedAt || null,
        actions: [{ intent: 'attention.acknowledge', version: 1, label: 'Gezien' }]
      };
    }).filter(Boolean);
  }
  return { uit };
};
