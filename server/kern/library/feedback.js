'use strict';
const M = require('./model'), P = require('./policy');
const KINDS = ['correction', 'clarity', 'translation', 'accessibility', 'source', 'other'];

function command(ctx) {
  const { w, data: d, action, id, actor, at } = ctx;
  if (action === 'feedback.create') {
    M.fields(d, ['editionId', 'nodeId', 'kind', 'message', 'evidenceRefs']);
    const edition = M.get(w.editions, d.editionId);
    if (edition.status !== 'released') M.fail('RELEASE_REQUIRED', 'Feedback hoort bij een vrijgegeven editie.', 409);
    const anchor = edition.snapshot.content.find(n => n.nodeId === d.nodeId);
    if (!anchor) M.fail('NOT_FOUND', 'Dit inhoudsanker staat niet in de editie.', 404);
    if (!KINDS.includes(d.kind)) M.fail('INVALID_INPUT', 'Kies een ondersteund feedbacktype.');
    w.feedback[id] = { id, workId: w.id, editionId: edition.id, nodeId: anchor.nodeId,
      revisionId: anchor.revision.id, revisionHash: anchor.revision.hash, kind: d.kind,
      message: M.text(d.message, 4000), evidenceRefs: M.strings(d.evidenceRefs || [], 20),
      status: 'open', createdBy: actor, createdAt: at, decision: null, resolution: null };
    return { id, editionId: edition.id, nodeId: anchor.nodeId, status: 'open' };
  }
  if (action === 'feedback.decide') {
    M.fields(d, ['feedbackId', 'decision', 'reason']); P.editor(ctx);
    const f = M.get(w.feedback, d.feedbackId);
    if (f.status !== 'open' && f.status !== 'needs-information')
      M.fail('INVALID_STATE', 'Deze feedback wacht niet meer op een besluit.', 409);
    if (!['accepted', 'rejected', 'needs-information'].includes(d.decision))
      M.fail('INVALID_INPUT', 'Kies een geldig besluit.');
    f.status = d.decision; f.decision = { status: d.decision, reason: M.text(d.reason, 2000), actor, at };
    return { id: f.id, status: f.status };
  }
  if (action === 'feedback.resolve') {
    M.fields(d, ['feedbackId', 'revisionId', 'summary']); P.editor(ctx);
    const f = M.get(w.feedback, d.feedbackId);
    if (f.status !== 'accepted') M.fail('FEEDBACK_NOT_ACCEPTED', 'Accepteer de feedback voordat u haar oplost.', 409);
    const node = M.get(w.nodes, f.nodeId), revision = node.revisions.find(x => x.id === d.revisionId);
    if (!revision) M.fail('NOT_FOUND', 'De oplossende revisie bestaat niet op dit inhoudsanker.', 404);
    const sourceIndex = node.revisions.findIndex(x => x.hash === f.revisionHash);
    const resolutionIndex = node.revisions.findIndex(x => x.id === revision.id);
    if (sourceIndex < 0 || resolutionIndex <= sourceIndex)
      M.fail('NEW_REVISION_REQUIRED', 'Een oplossing vereist een latere revisie dan de editie waarop de feedback is gegeven.', 409);
    f.status = 'resolved'; f.resolution = { revisionId: revision.id, revisionHash: revision.hash,
      summary: M.text(d.summary, 2000), actor, at };
    return { id: f.id, status: f.status, revisionId: revision.id };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende feedbackhandeling.');
}

function list(w, editionId) {
  const rows = Object.values(w.feedback).filter(f => !editionId || f.editionId === editionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return M.clone(rows);
}

module.exports = { command, list, KINDS };
