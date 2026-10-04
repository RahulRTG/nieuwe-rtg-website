'use strict';
const { fail, text, date, get, version, snapshot, clone, activeKnowledge } = require('./model');
const protocol = require('../loop-fabric/protocol');

function sharing(value, at) {
  if (value == null) return { visibility:'community', purpose:'world-memory', recipients:[],
    consent:{basis:'voluntary-contribution',grantedAt:at} };
  protocol.fields(value,['visibility','purpose','recipients','consent','returnUpdates']);
  if (!['private','stewards','workspace','community'].includes(value.visibility)) fail('Kies een geldige zichtbaarheid.');
  const recipients = Array.isArray(value.recipients) ? value.recipients.map(r=>{
    protocol.fields(r,['domain','id']);
    return {domain:text(r.domain,60,true),id:text(r.id,100,true)};
  }) : [];
  if (recipients.length > 12) fail('Te veel ontvangers.');
  if (value.visibility === 'workspace' && !recipients.some(r=>r.domain === 'workos'))
    fail('Kies de WorkOS-werkruimte waarvoor deze bijdrage bedoeld is.');
  if (value.consent !== true) fail('Delen buiten uw persoonlijke context vraagt een expliciete keuze.',400,'CONSENT_REQUIRED');
  return {visibility:value.visibility,purpose:text(value.purpose,120,true),recipients,
    returnUpdates:value.returnUpdates===true,consent:{basis:'explicit',grantedAt:at}};
}

module.exports = function contributions({state,key,data:p,action,at,id}) {
  if (action === 'contribution.create') {
    const place = get(state,'places',p.placeId);
    if (place.status !== 'published') fail('Deze plek is niet meer gedeeld.',409);
    const plan = p.planId ? get(state,'plans',p.planId) : null;
    if (plan && (plan.owner !== key || plan.placeId !== place.id || plan.status !== 'completed' || !plan.acknowledgedAt))
      fail('Een ervaringsbijdrage vraagt uw eigen bevestigde deelname op deze plek.',403,'PARTICIPATION_REQUIRED');
    if (!['knowledge','condition','correction','story','observation'].includes(p.kind)) fail('Kies een soort bijdrage.');
    const observedAt = date(p.observedAt), validUntil = date(p.validUntil,false);
    if (observedAt > at || (validUntil && validUntil <= observedAt)) fail('Controleer de waarneming en geldigheid.');
    if (p.kind === 'condition' && (!validUntil || validUntil <= at)) fail('Een actuele conditie heeft een toekomstige vervaltijd nodig.');
    const row = {id,owner:key,placeId:place.id,planId:plan ? plan.id : null,
      blueprintId:plan ? plan.blueprintId : null, revision:1,status:'pending',
      placeVersion:place.revision,planVersion:plan ? plan.revision : null,
      blueprintVersion:plan ? plan.blueprintVersion : null,
      kind:p.kind,title:text(p.title,120,true),text:text(p.text,2400,true),
      observedAt,validUntil,createdAt:at,updatedAt:at,
      basis:plan ? 'participant_and_organizer' : 'member_observation',
      recordedAt:at,sharing:sharing(p.sharing,at),contests:[],
      supersedes:p.supersedes || null,
      verificationOf:p.verificationOf ? protocol.objectRef(p.verificationOf) : null,
      assessment:p.assessment || null};
    if (row.assessment && !['improved','not-improved','mixed','unmeasurable'].includes(row.assessment))
      fail('Kies een geldige verificatie-uitkomst.');
    if ((row.verificationOf && !row.assessment) || (!row.verificationOf && row.assessment))
      fail('Een verificatie vraagt zowel een bronwijziging als een uitkomst.');
    if (row.supersedes) {
      const old = get(state,'contributions',row.supersedes);
      if (old.placeId !== place.id || old.status !== 'accepted') fail('Kies een geldige eerdere bijdrage.',409);
    }
    state.contributions[id] = row; return row;
  }
  const row = get(state,'contributions',p.id); version(row,p.revision);
  if (action === 'contribution.withdraw') {
    row.status = 'withdrawn'; row.reason = text(p.reason,500,true);
    row.withdrawnAt = at; return row;
  }
  if (action === 'contribution.contest') {
    const reason = text(p.reason,800,true);
    row.contests = (row.contests || []).concat({id,assertedBy:key,reason,at,status:'open'}).slice(-50);
    return row;
  }
  if (action === 'contribution.review') {
    if (!['accepted','rejected'].includes(p.decision)) fail('Kies goedkeuren of afwijzen.');
    if (get(state,'places',row.placeId).status !== 'published') fail('De plek is ingetrokken.',409);
    if (p.decision === 'accepted' && row.validUntil && row.validUntil <= at) fail('Deze waarneming is verlopen.',409,'EXPIRED');
    if (p.decision === 'accepted' && row.planId) {
      const plan = get(state,'plans',row.planId);
      if (!plan.acknowledgedAt || plan.participation.revokedAt)
        fail('De deelnameverklaring is ingetrokken. Deze bijdrage kan zo niet worden goedgekeurd.',409,'PARTICIPATION_REVOKED');
    }
    row.review = {by:key,at,reason:text(p.reason,800,true)};
    row.status = p.decision;
    if (row.status === 'accepted' && row.supersedes) {
      const old = get(state,'contributions',row.supersedes);
      if (old.status !== 'accepted') fail('De oorspronkelijke bijdrage is al veranderd.',409,'SOURCE_CHANGED');
      old.status = 'superseded'; old.revision++; old.updatedAt = at; old.supersededBy = row.id;
    }
    return row;
  }
  const b = get(state,'blueprints',row.blueprintId);
  version(b,p.blueprintRevision);
  if (b.status !== 'published' || get(state,'places',row.placeId).status !== 'published' || !activeKnowledge(row,at,state))
    fail('De verbetering is niet meer actueel.',409);
  const value = clone(snapshot(b)); b.version++; b.revision++; b.updatedAt = at;
  value.version = b.version; value.at = at; value.author = key;
  value.improvements = (value.improvements || []).concat({id:row.id,revision:row.revision});
  b.versions.push(value); row.adoptedVersion = b.version;
  return row;
};
