'use strict';
const M = require('./model'), P = require('./policy');
const ACTIONS = ['edit', 'publish', 'translate', 'adapt', 'archive', 'education', 'commercial',
  'ai.private-summary', 'ai.external-inference', 'ai.embeddings', 'ai.training', 'ai.synthetic-voice'];
function active(g, at) { return g.status === 'active' && g.startsAt <= at && (!g.endsAt || g.endsAt > at); }
function covers(g, edition) {
  return g.scope.type === 'work' || g.scope.type === 'edition' && g.scope.id === edition.id ||
    g.scope.type === 'nodes' && edition.snapshot.content.every(n => g.scope.nodeIds.includes(n.nodeId)) ||
    g.scope.type === 'edition-nodes' && g.scope.id === edition.id && edition.snapshot.content.every(n => g.scope.nodeIds.includes(n.nodeId));
}
function applicable(g, edition, publisher, at) {
  return active(g, at) && g.grantee === publisher && g.actions.includes('publish') &&
    g.purpose === 'publication' && g.languages.includes(edition.language) &&
    (g.territories.includes('WORLD') || g.territories.includes(edition.territory)) && covers(g, edition);
}
function rights(ctx) {
  const { w, data: d, action, id, at, actor } = ctx;
  if (action === 'rights.grant') {
    M.fields(d, ['grantor', 'grantee', 'authorityBasis', 'scope', 'actions', 'purpose', 'languages',
      'territories', 'startsAt', 'endsAt', 'conditions', 'supersedes']);
    const grantor = P.party(ctx, d.grantor || actor), a = P.agreement(w);
    if (!a.rightsHolders.includes(grantor) || !a.parties.includes(d.grantee))
      M.fail('RIGHTS_AUTHORITY_REQUIRED', 'Deze afspraak ondersteunt deze rechtenverlening niet.', 403);
    M.fields(d.authorityBasis, ['kind', 'statement', 'evidenceRef']);
    if (d.authorityBasis.kind !== 'rights-holder-declaration')
      M.fail('UNSUPPORTED_AUTHORITY_BASIS', 'Deze fase ondersteunt alleen een expliciete rechtenverklaring.');
    const authorityBasis = { kind: d.authorityBasis.kind, statement: M.text(d.authorityBasis.statement, 2000),
      evidenceRef: M.text(d.authorityBasis.evidenceRef || '', 300, false), agreementId: a.id };
    M.fields(d.scope, ['type', 'id', 'nodeIds']);
    let scope;
    if (d.scope.type === 'work' && d.scope.id === w.id) scope = { type: 'work', id: w.id };
    else if (d.scope.type === 'edition') scope = { type: 'edition', id: M.get(w.editions, d.scope.id).id };
    else if (d.scope.type === 'nodes' || d.scope.type === 'edition-nodes') {
      scope = { type: 'nodes', nodeIds: M.strings(d.scope.nodeIds) };
      if (!scope.nodeIds.length) M.fail('INVALID_SCOPE', 'Selecteer inhoudsankers.');
      scope.nodeIds.forEach(n => M.get(w.nodes, n));
      if (d.scope.type === 'edition-nodes') scope = { ...scope, type: 'edition-nodes', id: M.get(w.editions, d.scope.id).id };
    } else M.fail('INVALID_SCOPE', 'De scope valt buiten dit werk.');
    const actions = M.strings(d.actions);
    if (!actions.length || actions.some(x => !ACTIONS.includes(x))) M.fail('UNSUPPORTED_RIGHT', 'Kies afzonderlijke ondersteunde rechten.');
    const purpose = M.text(d.purpose, 120), languages = M.strings(d.languages), territories = M.strings(d.territories);
    if (!languages.length || !territories.length || territories.some(x => !/^(WORLD|[A-Z]{2})$/.test(x)))
      M.fail('INVALID_SCOPE', 'Leg talen en territoria expliciet vast.');
    if (actions.some(x => x.startsWith('ai.')) && (!purpose.startsWith('ai.') || actions.some(x => x !== purpose)))
      M.fail('AI_PURPOSE_REQUIRED', 'Een AI-verlening heeft één afzonderlijk verwerkingsdoel.');
    const startsAt = M.date(d.startsAt), endsAt = M.date(d.endsAt);
    if (!startsAt || endsAt && endsAt <= startsAt) M.fail('INVALID_TERM', 'Ongeldige geldigheidsduur.');
    M.fields(d.conditions, ['attributionRequired']);
    if (typeof d.conditions.attributionRequired !== 'boolean') M.fail('UNSUPPORTED_CONDITIONS', 'Leg de ondersteunde voorwaarden expliciet vast.');
    if (d.supersedes) {
      const old = M.get(w.grants, d.supersedes);
      if (old.grantor !== grantor || old.status !== 'active') M.fail('AUTHORITY_DENIED', 'U kunt deze verlening niet vervangen.', 403);
      old.status = 'superseded'; old.supersededBy = id; old.endedAt = at;
    }
    w.grants[id] = { id, workId: w.id, grantor, grantee: d.grantee, authorityBasis, scope, actions, purpose,
      languages, territories, startsAt, endsAt, conditions: M.clone(d.conditions), supersedes: d.supersedes || null,
      status: 'active', createdBy: actor, createdAt: at, revokedAt: null };
    return { id };
  }
  if (action === 'rights.revoke') {
    M.fields(d, ['grantId', 'reason']); const g = M.get(w.grants, d.grantId); P.party(ctx, g.grantor);
    if (g.status !== 'active') M.fail('INVALID_STATE', 'Deze verlening is niet meer actief.', 409);
    g.status = 'revoked'; g.revokedAt = at; g.revokedBy = actor; g.revocationReason = M.text(d.reason, 2000);
    return { id: g.id };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende rechtenhandeling.');
}
function educationApplicable(g, edition, nodeIds, publisher, academyOrganization, academyContext, at) {
  return active(g, at) && g.grantee === publisher && g.actions.includes('education') &&
    g.purpose === `education.internal:${academyOrganization}:${academyContext}` && g.languages.includes(edition.language) &&
    (g.territories.includes('WORLD') || g.territories.includes(edition.territory)) && g.scope.type === 'edition-nodes' &&
    g.scope.id === edition.id && nodeIds.every(id => g.scope.nodeIds.includes(id)) && g.conditions.attributionRequired === true;
}
function missingEducation(w, edition, nodeIds, agreement, academyOrganization, academyContext, at) {
  return agreement.rightsHolders.filter(holder => !Object.values(w.grants).some(g => g.grantor === holder &&
    educationApplicable(g, edition, nodeIds, agreement.publisher, academyOrganization, academyContext, at)));
}
module.exports = { rights, applicable, active, educationApplicable, missingEducation, ACTIONS };
