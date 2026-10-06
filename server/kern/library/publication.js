'use strict';
const M = require('./model'), P = require('./policy'), R = require('./rights');
const { intact } = require('./editions');
function requirements(ctx, e) {
  const { w, at } = ctx;
  const a = P.agreement(w);
  if (!['frozen', 'released'].includes(e.status)) M.fail('EDITION_NOT_FROZEN', 'Leg de editie eerst vast.', 409);
  intact(e);
  if (e.snapshot.agreement.id !== a.id || e.snapshot.agreement.termsHash !== a.termsHash)
    M.fail('AGREEMENT_CHANGED', 'Deze editie hoort bij een andere afspraak. Maak een nieuwe editie.', 409);
  const missingRights = [], grants = [];
  for (const holder of a.rightsHolders) {
    const candidates = e.snapshot.rights.filter(old => {
      const current = w.grants[old.id];
      return old.grantor === holder && current && M.hash(old) === M.hash(current) && R.applicable(current, e, a.publisher, at) &&
        (!current.conditions.attributionRequired || e.snapshot.contributions.some(c =>
          c.actorRef === holder && c.visibility === 'public' && c.creditName));
    }).sort((x, y) => x.id.localeCompare(y.id));
    if (!candidates.length) missingRights.push(holder); else grants.push(candidates[0].id);
  }
  const consentDigest = M.hash({ editionId: e.id, snapshotHash: e.snapshotHash,
    agreementId: a.id, grantIds: grants, requiredApprovers: a.requiredApprovers, publisher: a.publisher, policy: M.POLICY });
  const missingApprovals = a.requiredApprovers.filter(p => !e.consents[p] ||
    e.consents[p].consentDigest !== consentDigest || e.consents[p].status !== 'accepted');
  return { editionId: e.id, snapshotHash: e.snapshotHash, consentDigest, requiredApprovers: a.requiredApprovers,
    missingApprovals, missingRights, grantIds: grants, ready: !missingRights.length && !missingApprovals.length,
    policy: M.POLICY, expectedRevision: w.revision };
}
function publication(ctx) {
  const { w, data: d, action, id, at, actor } = ctx;
  if (action === 'publication.consent') {
    M.fields(d, ['editionId', 'partyRef', 'consentDigest', 'snapshotHash']);
    const e = M.get(w.editions, d.editionId), r = requirements(ctx, e), ref = P.party(ctx, d.partyRef || actor);
    if (e.status !== 'frozen') M.fail('INVALID_STATE', 'Deze editie is al vrijgegeven.', 409);
    if (!r.requiredApprovers.includes(ref)) M.fail('AUTHORITY_DENIED', 'U bent geen vereiste instemmende partij.', 403);
    if (d.snapshotHash !== r.snapshotHash || d.consentDigest !== r.consentDigest)
      M.fail('CONSENT_STALE', 'Deze instemming hoort niet bij de actuele editie en rechten.', 409);
    if (r.missingRights.length) M.fail('RIGHTS_MISSING', 'Vereiste publicatierechten ontbreken.', 409);
    e.consents[ref] = { actor, partyRef: ref, at, snapshotHash: e.snapshotHash, consentDigest: r.consentDigest, status: 'accepted' };
    e.consentHistory.push({ id, ...M.clone(e.consents[ref]) });
    return { id: e.id, partyRef: ref };
  }
  if (action === 'publication.revoke-consent') {
    M.fields(d, ['editionId', 'partyRef', 'reason']); const e = M.get(w.editions, d.editionId), ref = P.party(ctx, d.partyRef || actor);
    const consent = M.get(e.consents, ref);
    consent.status = 'revoked'; consent.revokedAt = at; consent.revokedBy = actor; consent.reason = M.text(d.reason, 2000);
    e.consentHistory.push({ id, ...M.clone(consent) });
    return { id: e.id, partyRef: ref };
  }
  if (action === 'publication.confirm') {
    M.fields(d, ['editionId', 'consentDigest']); P.publisher(ctx);
    const e = M.get(w.editions, d.editionId), r = requirements(ctx, e);
    if (e.status !== 'frozen') M.fail('INVALID_STATE', 'Deze editie is al vrijgegeven.', 409);
    if (r.missingRights.length) M.fail('RIGHTS_MISSING', 'Vereiste publicatierechten ontbreken of zijn ingetrokken.', 409);
    if (d.consentDigest !== r.consentDigest) M.fail('CONSENT_STALE', 'Bekijk de actuele publicatievoorwaarden.', 409);
    if (r.missingApprovals.length) M.fail('APPROVALS_MISSING', 'Niet alle vereiste partijen hebben ingestemd.', 409);
    const release = { id, editionId: e.id, workId: w.id, publisher: w.agreements[w.activeAgreementId].publisher,
      decidedBy: actor, releasedAt: at, snapshotHash: e.snapshotHash, contentHash: e.contentHash,
      consentDigest: r.consentDigest, grantIds: r.grantIds, approvals: M.clone(e.consents), policy: M.POLICY };
    w.releases[id] = release; e.status = 'released'; e.releasedAt = at; e.releaseId = id;
    e.distribution = { status: 'released', changedAt: at };
    return { id, editionId: e.id, contentHash: e.contentHash, snapshotHash: e.snapshotHash };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende publicatiehandeling.');
}
module.exports = { publication, requirements };
