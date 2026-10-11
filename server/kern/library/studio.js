'use strict';
const M = require('./model'), P = require('./policy');

function studioCommand(ctx) {
  const { w, data: d, action } = ctx;
  if (action !== 'structure.reorder') M.fail('UNKNOWN_ACTION', 'Onbekende studiohandeling.');
  M.fields(d, ['nodeIds']); P.editor(ctx);
  const nodeIds = M.strings(d.nodeIds, 1000), current = Object.keys(w.nodes).sort();
  if (nodeIds.length !== current.length || [...nodeIds].sort().some((id, i) => id !== current[i]))
    M.fail('INVALID_STRUCTURE', 'De volgorde moet elk inhoudsanker precies eenmaal bevatten.');
  w.structure = nodeIds;
  return { nodeIds: M.clone(nodeIds) };
}

function workspace(w) {
  return {
    id: w.id, title: w.title, description: w.description, type: w.type,
    originalLanguage: w.originalLanguage, lifecycle: w.lifecycle, revision: w.revision,
    nodes: w.structure.map(id => {
      const n = M.get(w.nodes, id), latest = n.revisions.at(-1);
      return { id: n.id, kind: n.kind, revisionCount: n.revisions.length,
        latest: latest ? M.clone(latest) : null };
    }),
    contributions: M.clone(Object.values(w.contributions)),
    editions: M.clone(Object.values(w.editions).map(e => ({ id: e.id, predecessorId: e.predecessorId,
      language: e.language, changeSummary: e.changeSummary, status: e.status, contentHash: e.contentHash,
      snapshotHash: e.snapshotHash, createdAt: e.createdAt, frozenAt: e.frozenAt, releasedAt: e.releasedAt,
      distribution: e.distribution, warnings: e.warnings }))),
    activeAgreementId: w.activeAgreementId
  };
}

module.exports = { command: studioCommand, workspace };
