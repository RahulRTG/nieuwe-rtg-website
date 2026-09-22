/* Betekenis vóór projectie. Alleen de persoonlijke bestandenkluis valt onder v1. */
'use strict';
const { createHash } = require('node:crypto');
const afdruk = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function bevries(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(bevries); Object.freeze(value); }
  return value;
}
const POLICY = bevries({ id: 'documents.owner@1', version: 1,
  authority: 'authenticated member, revalidated at transaction execution; owned vault resource',
  denial: 'unknown owner/resource: 404; invalid or revoked session: 401',
  unavailable: '503 carries NOT_EVALUATED; an uncertain or unperformed check never attests ALLOW',
  guest: 'anonymous guest cannot mutate; registered free account can',
  rahul: 'same HTTP authority; server-held human confirmation required before dispatch' });
const policyDigest = afdruk(POLICY);
const CONTRACTEN = bevries(Object.fromEntries(require('./document-contracten-v1.json').capabilities
  .map(c => [c.id, { ...c, digest: afdruk(c) }])));

// The revision prevents ABA (trash -> restore -> active with otherwise identical metadata).
function versie(it) {
  const velden = ['id', 'naam', 'map', 'mime', 'bytes', 'ref', 'versies', 'gedeeldMet',
    'ster', 'weg', 'wegOp', 'op', 'gewijzigd', 'door', 'documentRevision'];
  return createHash('sha256').update(JSON.stringify(velden.map(k => it[k] ?? null))).digest('hex');
}
const staat = it => ({ id: it.id, state: it.weg ? 'trashed' : 'active', version: versie(it) });
const fout = (status, code, error) => ({ status, code, error, messageId: 'document.' + code, policy: { id: POLICY.id, digest: policyDigest, decision: status === 503 ? 'NOT_EVALUATED' : [401, 404].includes(status) ? 'DENY' : 'ALLOW' } });
module.exports = { CONTRACTEN, POLICY, policyDigest, afdruk, versie, staat, fout };
