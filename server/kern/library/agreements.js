'use strict';
const M = require('./model'), P = require('./policy');
module.exports = function agreements(ctx) {
  const { w, data: d, action, id, actor, at } = ctx;
  if (action === 'contribution.invite') {
    M.fields(d, ['actorRef', 'role', 'scope', 'creditName', 'visibility', 'agreementId']); P.manager(ctx);
    if (!ctx.identities.exists(d.actorRef)) M.fail('PARTY_UNAVAILABLE', 'Deze partij is niet beschikbaar.', 404);
    const scope = M.strings(d.scope);
    if (!scope.length || scope.some(n => n !== 'work' && !Object.hasOwn(w.nodes, n))) M.fail('INVALID_SCOPE', 'Onbekende bijdragescope.');
    if (!['private', 'collaborators', 'public'].includes(d.visibility)) M.fail('INVALID_INPUT', 'Kies de zichtbaarheid.');
    if (d.agreementId) M.get(w.agreements, d.agreementId);
    w.contributions[id] = { id, actorRef: d.actorRef, role: M.text(d.role, 80), scope,
      creditName: M.text(d.creditName, 160), visibility: d.visibility, agreementId: d.agreementId || null,
      status: 'invited', invitedBy: actor, createdAt: at, acceptedAt: null, acceptedBy: null };
    return { id };
  }
  if (action === 'contribution.accept') {
    M.fields(d, ['contributionId']); const c = M.get(w.contributions, d.contributionId); P.party(ctx, c.actorRef);
    if (c.status !== 'invited') M.fail('INVALID_STATE', 'Deze bijdrage is al geaccepteerd.', 409);
    c.status = 'accepted'; c.acceptedAt = at; c.acceptedBy = actor; return { id: c.id };
  }
  if (action === 'agreement.propose') {
    M.fields(d, ['parties', 'governance', 'decisionRule', 'amendmentRule', 'departureRule', 'editors',
      'publisher', 'requiredApprovers', 'rightsHolders', 'resolvesConflict']); P.manager(ctx);
    const parties = M.strings(d.parties), editors = M.strings(d.editors), approvers = M.strings(d.requiredApprovers), holders = M.strings(d.rightsHolders);
    if (!parties.length || parties.some(p => !ctx.identities.exists(p)) ||
        [...editors, ...approvers, ...holders, d.publisher, w.responsible].some(p => !parties.includes(p)))
      M.fail('INVALID_PARTIES', 'Alle bevoegdheden horen bij bestaande partijen in de afspraak.');
    if (!approvers.length || !holders.length || d.decisionRule !== 'all-listed-approvers' ||
        d.amendmentRule !== 'all-current-and-proposed-parties' || d.departureRule !== 'successor-agreement')
      M.fail('GOVERNANCE_REQUIRED', 'Kies expliciete, ondersteunde besluitvorming en instemmingen.');
    const old = w.activeAgreementId && M.get(w.agreements, w.activeAgreementId);
    if (old?.conflict && !d.resolvesConflict) M.fail('BLOCKING_CONFLICT', 'Leg de voorgestelde conflictoplossing vast.', 409);
    const a = { id, version: Object.keys(w.agreements).length + 1, predecessor: old?.id || null,
      parties, governance: M.text(d.governance, 4000), decisionRule: d.decisionRule,
      amendmentRule: d.amendmentRule, departureRule: d.departureRule,
      editors, publisher: d.publisher, requiredApprovers: approvers, rightsHolders: holders,
      resolvesConflict: M.text(d.resolvesConflict || '', 2000, false),
      conflictId: old?.conflict?.id || null,
      acceptanceParties: [...new Set([...parties, ...(old?.parties || [])])],
      createdAt: at, createdBy: actor };
    a.termsHash = M.hash(a); a.acceptances = {}; a.status = 'proposed'; a.conflict = null;
    w.agreements[id] = a; return { id, termsHash: a.termsHash };
  }
  if (action === 'agreement.accept') {
    M.fields(d, ['agreementId', 'partyRef', 'termsHash']); const a = M.get(w.agreements, d.agreementId);
    const ref = P.party(ctx, d.partyRef || actor);
    if (a.status !== 'proposed' || a.predecessor !== w.activeAgreementId) M.fail('STALE_AGREEMENT', 'Deze afspraak kan niet meer worden aanvaard.', 409);
    const currentConflict = a.predecessor && w.agreements[a.predecessor].conflict;
    if ((currentConflict?.id || null) !== a.conflictId)
      M.fail('CONFLICT_CHANGED', 'Een nieuw conflict vraagt een nieuw gezamenlijk voorstel.', 409);
    if (!a.acceptanceParties.includes(ref)) M.fail('AUTHORITY_DENIED', 'U bent geen partij in deze afspraak.', 403);
    if (d.termsHash !== a.termsHash) M.fail('TERMS_CHANGED', 'Bevestig de exacte afspraak.', 409);
    a.acceptances[ref] = { actor, at, termsHash: a.termsHash };
    if (a.acceptanceParties.every(p => a.acceptances[p])) {
      if (a.predecessor) w.agreements[a.predecessor].status = 'superseded';
      a.status = 'accepted'; a.acceptedAt = at; w.activeAgreementId = a.id;
    }
    return { id: a.id, status: a.status };
  }
  if (action === 'agreement.conflict') {
    M.fields(d, ['agreementId', 'partyRef', 'reason']); const a = M.get(w.agreements, d.agreementId);
    const ref = P.party(ctx, d.partyRef || actor);
    if (a.status !== 'accepted' || !a.parties.includes(ref)) M.fail('AUTHORITY_DENIED', 'U bent geen actieve partij.', 403);
    if (a.conflict) M.fail('BLOCKING_CONFLICT', 'Behandel eerst het bestaande conflict.', 409);
    a.conflict = { id, actor, partyRef: ref, at, reason: M.text(d.reason, 2000) }; return { id: a.id };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende samenwerkingshandeling.');
};
