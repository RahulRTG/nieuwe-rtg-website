'use strict';
const M = require('./model'), P = require('./policy'), R = require('./rights');
function intact(e) {
  if (M.hash(e.snapshot.content) !== e.contentHash || M.hash(e.snapshot) !== e.snapshotHash)
    M.fail('INTEGRITY_FAILURE', 'De editie komt niet overeen met haar vastgelegde inhoud.', 503);
}
module.exports = function editions(ctx) {
  const { w, data: d, action, id, at, actor } = ctx;
  if (action === 'edition.create') {
    M.fields(d, ['predecessorId', 'language', 'territory', 'changeSummary']); P.editor(ctx);
    if (d.predecessorId) {
      const old = M.get(w.editions, d.predecessorId);
      if (old.status === 'draft') M.fail('INVALID_PREDECESSOR', 'De voorganger moet vastgelegd zijn.', 409);
    }
    const content = Object.values(w.nodes).sort((a, b) => a.id.localeCompare(b.id))
      .map(n => ({ nodeId: n.id, kind: n.kind, revision: M.clone(n.revisions.at(-1)) }));
    if (!content.length) M.fail('CONTENT_REQUIRED', 'Een editie heeft inhoud nodig.', 409);
    if (!/^(WORLD|[A-Z]{2})$/.test(d.territory || '')) M.fail('INVALID_SCOPE', 'Kies een publicatieterritorium.');
    w.editions[id] = { id, workId: w.id, predecessorId: d.predecessorId || null,
      language: M.text(d.language, 40), territory: d.territory, changeSummary: M.text(d.changeSummary, 2000),
      createdAt: at, createdBy: actor, frozenAt: null, releasedAt: null, status: 'draft',
      snapshot: { content }, contentHash: M.hash(content), snapshotHash: null,
      distribution: { status: 'not-released', changedAt: at }, warnings: [], releaseId: null, consents: {}, consentHistory: [] };
    return { id, contentHash: w.editions[id].contentHash };
  }
  if (action === 'edition.freeze') {
    M.fields(d, ['editionId']); const a = P.publisher(ctx), e = M.get(w.editions, d.editionId);
    if (e.status !== 'draft') M.fail('EDITION_IMMUTABLE', 'Deze editie is al vastgelegd.', 409);
    if (M.hash(e.snapshot.content) !== e.contentHash) M.fail('INTEGRITY_FAILURE', 'De concepteditie is beschadigd.', 503);
    const contributions = Object.values(w.contributions).filter(c => c.status === 'accepted');
    if (contributions.some(c => !a.parties.includes(c.actorRef)))
      M.fail('CONTRIBUTOR_AGREEMENT_REQUIRED', 'Een geaccepteerde bijdrager ontbreekt in de afspraak.', 409);
    e.snapshot = { ...e.snapshot, agreement: M.clone(a), contributions: M.clone(contributions),
      rights: M.clone(Object.values(w.grants).filter(g => R.applicable(g, e, a.publisher, at))),
      work: { id: w.id, title: w.title, type: w.type, originalLanguage: w.originalLanguage },
      edition: { id: e.id, predecessorId: e.predecessorId, language: e.language,
        territory: e.territory, changeSummary: e.changeSummary },
      policy: M.POLICY };
    e.snapshotHash = M.hash(e.snapshot); e.status = 'frozen'; e.frozenAt = at;
    return { id: e.id, contentHash: e.contentHash, snapshotHash: e.snapshotHash };
  }
  if (action === 'edition.withdraw') {
    M.fields(d, ['editionId', 'reason']); P.publisher(ctx); const e = M.get(w.editions, d.editionId);
    if (e.status !== 'released') M.fail('INVALID_STATE', 'Deze editie is niet vrijgegeven.', 409);
    intact(e); e.distribution = { status: 'withdrawn', changedAt: at, changedBy: actor, reason: M.text(d.reason, 2000) };
    return { id: e.id };
  }
  if (action === 'edition.warn') {
    M.fields(d, ['editionId', 'reason']); P.publisher(ctx); const e = M.get(w.editions, d.editionId);
    if (e.status === 'draft') M.fail('INVALID_STATE', 'Deze editie is nog niet vastgelegd.', 409);
    intact(e); e.warnings.push({ id, reason: M.text(d.reason, 2000), createdAt: at, createdBy: actor }); return { id: e.id };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende editiehandeling.');
};
module.exports.intact = intact;
