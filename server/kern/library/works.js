'use strict';
const M = require('./model'), P = require('./policy');
module.exports = function works(ctx) {
  const { s, w, data: d, action, id, at, actor } = ctx;
  if (action === 'work.create') {
    M.fields(d, ['title', 'description', 'type', 'language', 'responsible', 'governanceRef']);
    const responsible = P.party(ctx, d.responsible || actor);
    const row = { id, title: M.text(d.title, 300), description: M.text(d.description || '', 4000, false),
      type: M.text(d.type, 80), originalLanguage: M.text(d.language, 40), responsible,
      governanceRef: M.text(d.governanceRef || '', 300, false), lifecycle: 'active', revision: 0,
      createdAt: at, updatedAt: at, createdBy: actor, updatedBy: actor,
      nodes: {}, contributions: {}, agreements: {}, grants: {}, editions: {}, releases: {},
      activeAgreementId: null };
    s.works[id] = row; ctx.w = row;
    return { id };
  }
  if (action === 'revision.add') {
    M.fields(d, ['nodeId', 'kind', 'title', 'content', 'changeSummary']); P.editor(ctx);
    const node = d.nodeId ? M.get(w.nodes, d.nodeId) : { id, kind: M.text(d.kind, 80), createdAt: at, revisions: [] };
    if (d.nodeId && d.kind && d.kind !== node.kind) M.fail('NODE_KIND_CHANGED', 'Een inhoudsanker behoudt zijn soort.');
    if (node.revisions.length >= 1000 || Object.keys(w.nodes).length >= 1000 && !d.nodeId)
      M.fail('CAPACITY', 'Dit werk vraagt een grotere opslaginrichting.', 503);
    const revision = { id: id + '_revision', number: node.revisions.length + 1, nodeId: node.id,
      title: M.text(d.title, 300), content: M.text(d.content, 50000),
      changeSummary: M.text(d.changeSummary, 1000), createdAt: at, createdBy: actor };
    revision.hash = M.hash(revision); node.revisions.push(revision); w.nodes[node.id] = node;
    return { id: revision.id, nodeId: node.id, hash: revision.hash };
  }
  M.fail('UNKNOWN_ACTION', 'Onbekende werkhandeling.');
};
