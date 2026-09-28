/* Servergedreven Edge-contract. Dit is nog geen visuele Edge: uitsluitend de
   semantische acties die een latere interface mag tekenen. Labels zijn
   vertaalsleutels, zodat de server geen nieuwe eentalige UI-kopie introduceert. */
'use strict';

const VERSION = 1;

const DEFINITIONS = Object.freeze({
  VONK_ROOT: [
    ['discover', 'connection.edge.discover', 'connection.discover'],
    ['matches', 'connection.edge.matches', 'connection.match.read'],
    ['profile', 'connection.edge.profile', 'connection.profile.manage']
  ],
  VONK_DISCOVERY: [
    ['not_now', 'connection.edge.not_now', 'connection.match.choose', 'pass'],
    ['open', 'connection.edge.open', 'connection.match.choose', 'like'],
    ['more', 'connection.edge.more', 'connection.safety.block']
  ],
  VONK_MATCH: [
    ['chat', 'connection.edge.chat', 'connection.message'],
    ['meet', 'connection.edge.meet', ['connection.meet.plan', 'connection.meet.choose']],
    ['voice', 'connection.edge.voice', 'connection.voice'],
    ['video', 'connection.edge.video', 'connection.video'],
    ['more', 'connection.edge.more', 'connection.safety.block']
  ],
  VONK_DATE_ACTIVE: [
    ['date', 'connection.edge.date', 'connection.meet.plan'],
    ['safety', 'connection.edge.safety', 'connection.safety.block'],
    ['route', 'connection.edge.route', 'connection.route']
  ],
  RENDEZVOUS_ROOT: [
    ['today', 'connection.edge.today', 'connection.discover'],
    ['society', 'connection.edge.society', 'connection.table.read'],
    ['concierge', 'connection.edge.concierge', 'connection.concierge.request']
  ],
  RENDEZVOUS_INTRODUCTION: [
    ['not_now', 'connection.edge.not_now', ['connection.match.choose', 'connection.introduction.answer'], 'decline'],
    ['open_to_introduction', 'connection.edge.open_to_introduction', ['connection.match.choose', 'connection.introduction.answer'], 'accept'],
    ['conversation', 'connection.edge.conversation', 'connection.message'],
    ['voice', 'connection.edge.voice', 'connection.voice'],
    ['video', 'connection.edge.video', 'connection.video'],
    ['safety', 'connection.edge.safety', 'connection.safety.block']
  ],
  RENDEZVOUS_ARRANGE: [
    ['conversation', 'connection.edge.conversation', 'connection.message'],
    ['voice', 'connection.edge.voice', 'connection.voice'],
    ['video', 'connection.edge.video', 'connection.video'],
    ['arrange', 'connection.edge.arrange', 'connection.meet.plan'],
    ['approve', 'connection.edge.approve', 'connection.meet.accept'],
    ['together', 'connection.edge.together', 'connection.relationship.declare'],
    ['safety', 'connection.edge.safety', 'connection.safety.block']
  ],
  RENDEZVOUS_TABLE: [
    ['table', 'connection.edge.table', ['connection.table.read', 'connection.table.accept']]
  ],
  RENDEZVOUS_ENCOUNTER: [
    ['confirm_encounter', 'connection.edge.confirm_encounter', 'connection.encounter.confirm']
  ],
  RENDEZVOUS_TOGETHER: [
    ['together', 'connection.edge.together', 'connection.relationship.declare'],
    ['safety', 'connection.edge.safety', 'connection.safety.block']
  ]
});

function action(def, beschikbaar) {
  const [id, labelKey, vereisten, intent] = def;
  const capability = (Array.isArray(vereisten) ? vereisten : [vereisten]).find(c => beschikbaar.has(c));
  return capability ? { id, labelKey, capability, ...(intent ? { intent } : {}) } : null;
}

function edgeProject(surface, availableCapabilities) {
  const beschikbaar = new Set(availableCapabilities || []);
  return (DEFINITIONS[surface] || []).map(d => action(d, beschikbaar)).filter(Boolean);
}

module.exports = { VERSION, DEFINITIONS, project: edgeProject };
