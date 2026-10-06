'use strict';
const { fail, text, date, list, get, version, snapshot, activeKnowledge, selectKnowledge } = require('./model');
module.exports = function plans({state,key,data:p,action,at,id,sources}) {
  if (action === 'plan.create') {
    const b = get(state,'blueprints',p.id); version(b,p.revision);
    liveSource(b);
    const row = { id, owner:key, organizer:b.organizer, blueprintId:b.id, blueprintVersion:b.version,
      placeId:b.placeId, revision:1, status:'planning', title:snapshot(b).title,
      date:null, notes:'', preparation:[], consentImpact:p.consentImpact === true,
      knowledge: selectKnowledge(state,b.placeId,p.knowledgeIds,at,key),
      createdAt:at, updatedAt:at };
    state.plans[id] = row; return row;
  }
  const row = get(state,'plans',p.id); version(row,p.revision);
  const b = get(state,'blueprints',row.blueprintId);
  if (action === 'plan.connect') {
    const sourceId = text(p.sourceId,240,true);
    const options = sources.context ? sources.context(key).items : [];
    const source = options.find(x=>x.id === sourceId);
    if (!source && p.remove !== true) fail('Dit brononderdeel is niet voor u beschikbaar.',404,'SOURCE_NOT_AVAILABLE');
    row.connections = (row.connections || []).filter(x=>x.id !== sourceId);
    if (p.remove !== true) {
      if (row.connections.length >= 30) fail('Dit plan heeft al dertig verbonden onderdelen.');
      row.connections.push({id:sourceId,version:source.version,connectedAt:at});
    }
    return row;
  }
  if (action === 'plan.revokeEvidence') {
    row.participation.revokedAt = at; row.participation.revokeReason = text(p.reason,800,true);
    row.acknowledgedAt = null; return row;
  }
  if (action === 'plan.consent') { row.consentImpact = p.enabled === true; return row; }
  if (action === 'plan.cancel') {
    row.status = 'cancelled'; row.reason = text(p.reason,500,true); row.cancelledAt = at; return row;
  }
  if (action === 'plan.issue') {
    row.resumeState = row.status; row.status = 'waiting';
    row.issue = { reason:text(p.reason,800,true), owner:row.organizer, at }; return row;
  }
  if (action === 'plan.resolve') {
    row.resolution = {text:text(p.reason,800,true),at,by:key};
    // Een verstoring vraagt altijd een nieuw besluit; nooit stil terug naar uitvoeren.
    row.status = 'requested'; return row;
  }
  if (action === 'plan.acknowledge') {
    row.acknowledgedAt = at; row.consentImpact = p.consentImpact === true; return row;
  }
  if (action === 'plan.complete') {
    if (Date.parse(at) < Date.parse(row.startedAt)) fail('De uitvoering is nog niet begonnen.',409);
    row.status = 'completed';
    row.participation = {id,at,by:key,basis:'organizer_attestation',statement:text(p.statement,800,true),
      startedAt:row.startedAt,blueprintVersion:row.acceptedVersion};
    return row;
  }
  liveSource(b);
  if (action === 'plan.update') {
    row.title = text(p.title,120,true); row.date = date(p.date);
    if (row.date <= at) fail('Kies een toekomstig moment.');
    row.notes = text(p.notes,1200);
    row.preparation = list(p.preparation,12,v => text(v,500,true));
    row.blueprintVersion = b.version;
    row.status = 'planning'; delete row.acceptedVersion;
    row.knowledge = selectKnowledge(state,row.placeId,p.knowledgeIds,at,key);
  }
  if (action === 'plan.request') {
    if (!row.date || row.date <= at) fail('Kies eerst een toekomstig moment.',409);
    if (row.owner === row.organizer) fail('De organisator kan de eigen deelname niet onafhankelijk bevestigen.',409);
    if (b.version !== row.blueprintVersion) fail('De ervaring is gewijzigd. Werk eerst uw plan bij.',409,'SOURCE_CHANGED');
    row.status = 'requested'; row.requestedAt = at;
  }
  if (action === 'plan.decide') {
    if (!['accepted','declined'].includes(p.decision)) fail('Kies accepteren of afwijzen.');
    if (b.version !== row.blueprintVersion) fail('De blueprint is gewijzigd; laat het lid het plan bijwerken.',409,'SOURCE_CHANGED');
    if (p.decision === 'accepted' && snapshot(b).requirements.length && p.requirementsChecked !== true)
      fail('Controleer eerst alle vereisten. Een eigen verklaring verleent geen bevoegdheid.',409,'REQUIREMENTS_UNCHECKED');
    row.decision = {by:key,at,reason:text(p.reason,800,true),
      requirementsChecked:p.requirementsChecked === true,basis:'organizer_review'};
    row.status = p.decision;
    if (row.status === 'accepted') row.acceptedVersion = b.version;
  }
  if (action === 'plan.start') {
    if (b.version !== row.acceptedVersion) fail('De ervaring is gewijzigd. Vraag opnieuw akkoord.',409,'SOURCE_CHANGED');
    if (!row.date || row.date > at) fail('Het geplande moment is nog niet aangebroken.',409,'TOO_EARLY');
    if (row.knowledge.some(r=>!state.contributions[r.id] || !activeKnowledge(state.contributions[r.id],at,state)
      || state.contributions[r.id].revision !== r.revision))
      fail('Gebruikte kennis is gewijzigd. Werk het plan bij en controleer de uitvoering opnieuw.',409,'KNOWLEDGE_CHANGED');
    row.status = 'active'; row.startedAt = at;
  }
  return row;
  function liveSource(b) {
    if (b.status !== 'published' || get(state,'places',b.placeId).status !== 'published')
      fail('Deze ervaring of plek is ingetrokken.',409,'SOURCE_WITHDRAWN');
  }
};
