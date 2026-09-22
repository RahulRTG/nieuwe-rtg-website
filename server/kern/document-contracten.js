/* Betekenis vóór projectie. Alleen de persoonlijke bestandenkluis valt onder v1. */
'use strict';
const { createHash } = require('node:crypto');
const CONTRACTEN = Object.freeze(Object.fromEntries([
  ['document.trash', 'active', 'trashed'], ['document.restore', 'trashed', 'active']
].map(([id, voor, na]) => [id, Object.freeze({
  id, version: 1, actor: 'authenticated-owner', resource: 'personal-vault-file',
  input: ['id', 'operationId', 'expectedVersion'], before: voor, after: na,
  risk: 'R1; R2 when shared', authority: 'owner; Rahul additionally requires server-held human approval',
  invariant: 'No blob, content version or sharing permission is removed or added.',
  persistence: 'State and operation receipt commit in the same collection transaction.',
  recovery: 'Retry the same operationId and input; never infer a heavier effect from current state.',
  failure: 'No confirmed success without a committed receipt; stale state is a conflict.'
})])));

// The revision prevents ABA (trash -> restore -> active with otherwise identical metadata).
function versie(it) {
  const velden = ['id', 'naam', 'map', 'mime', 'bytes', 'ref', 'versies', 'gedeeldMet',
    'ster', 'weg', 'wegOp', 'op', 'gewijzigd', 'door', 'documentRevision'];
  return createHash('sha256').update(JSON.stringify(velden.map(k => it[k] ?? null))).digest('hex');
}
const staat = it => ({ id: it.id, state: it.weg ? 'trashed' : 'active', version: versie(it) });
const fout = (status, code, error) => ({ status, code, error, messageId: 'document.' + code });
module.exports = { CONTRACTEN, versie, staat, fout };
