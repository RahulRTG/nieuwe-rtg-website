/* Source retention is not the source itself. It is a versioned, authority-bound
   statement that the owning domain can locate and re-verify an immutable
   source. Only digests cross into Trust: never paths, URLs or business IDs.
   A runtime Evidence export is intentionally not a retention contract. */
'use strict';

const { hash, kopie, bevries } = require('./canon');
const contracts = require('./v3-source-retention-contracts');
const { ROLES, RESULTS, MEDIA, IMMUTABILITY, CONTRACTS, fout, contract,
  contractRef, authorityDigest, ownerAuthorityDigest, roleDigest, normaliseerRequirement } = contracts;
const { inspectSourceRetention } = require('./v3-source-retention-inspect');
const HEX = /^[a-f0-9]{64}$/;
function digest(value, name) {
  const result = String(value || '').toLowerCase();
  if (!HEX.test(result)) throw fout('SOURCE_RETENTION_INVALID', name + ' moet een SHA-256 digest zijn');
  return result;
}
function tijd(value, name) {
  const result = String(value || '');
  if (!result || !Number.isFinite(Date.parse(result)))
    throw fout('SOURCE_RETENTION_INVALID', name + ' moet een geldige tijd zijn');
  return result;
}

function maakDraft(input) {
  const i = input || {}, found = contract(i.contractRef), digests = i.digests || {};
  const roles = Object.keys(digests).map(x => String(x).toUpperCase()).sort();
  if (!roles.length || roles.some(role => !found.roles.includes(role)))
    throw fout('SOURCE_RETENTION_ROLE_DENIED', 'rol valt buiten het retentioncontract');
  const locatorDigest = digest(i.locatorDigest, 'locatorDigest');
  const retentionReceiptDigest = digest(i.retentionReceiptDigest, 'retentionReceiptDigest');
  const retainedFrom = tijd(i.retainedFrom, 'retainedFrom');
  const retainedUntil = i.retainedUntil ? tijd(i.retainedUntil, 'retainedUntil') : null;
  const verifiedAt = tijd(i.verifiedAt || retainedFrom, 'verifiedAt');
  const bindings = roles.map(role => {
    const contentDigest = digest(digests[role], role + '.contentDigest');
    const observed = i.observedDigests && i.observedDigests[role];
    return { role, contractRef: { id: found.id, version: found.version,
      digest: found.contractDigest }, locatorDigest, contentDigest, retentionReceiptDigest,
    retainedFrom, retainedUntil, verification: { available: i.available !== false,
      observedContentDigest: observed == null && i.available !== false ? contentDigest : observed,
      verifiedAt } };
  });
  return bevries({ schemaVersion: 1, bindings });
}

function normaliseer(input) {
  if (input == null) return null;
  const i = kopie(input || {});
  if (i.schemaVersion !== 1 || !Array.isArray(i.bindings) || !i.bindings.length)
    throw fout('SOURCE_RETENTION_INVALID', 'schema of bindings ontbreekt');
  const seen = new Set();
  const bindings = i.bindings.map(raw => {
    const role = String(raw.role || '').toUpperCase(), found = contract(raw.contractRef);
    if (!ROLES.includes(role) || !found.roles.includes(role) || seen.has(role))
      throw fout('SOURCE_RETENTION_ROLE_DENIED', 'ongeldige of dubbele retentionrol');
    seen.add(role);
    if (!MEDIA.includes(found.medium) || !IMMUTABILITY.includes(found.immutability))
      throw fout('SOURCE_RETENTION_CONTRACT_MISMATCH', 'contract gebruikt een onbekend medium');
    const retainedFrom = tijd(raw.retainedFrom, 'retainedFrom');
    const retainedUntil = raw.retainedUntil ? tijd(raw.retainedUntil, 'retainedUntil') : null;
    if (retainedUntil && Date.parse(retainedUntil) <= Date.parse(retainedFrom))
      throw fout('SOURCE_RETENTION_INVALID', 'retentionvenster is niet positief');
    const authorityRefDigest = ownerAuthorityDigest(found);
    const body = { schemaVersion: 1, role,
      owner: { domain: found.ownerDomain, adapterRef: { id: found.adapter.id,
        version: found.adapter.version, digest: hash(found.adapter) }, authorityRefDigest },
      locatorDigest: digest(raw.locatorDigest, 'locatorDigest'),
      contentDigest: digest(raw.contentDigest, 'contentDigest'),
      retentionReceiptDigest: digest(raw.retentionReceiptDigest, 'retentionReceiptDigest'),
      medium: found.medium, immutability: found.immutability,
      retainedFrom, retainedUntil, contractRef: contractRef(raw.contractRef) };
    body.bindingDigest = hash(body);
    body.bindingId = 'source_binding_' + body.bindingDigest.slice(0, 32);
    const verification = raw.verification || {}, verifiedAt = tijd(verification.verifiedAt, 'verifiedAt');
    const available = verification.available !== false;
    const observed = verification.observedContentDigest == null ? null
      : digest(verification.observedContentDigest, 'observedContentDigest');
    let result = !available ? 'UNAVAILABLE' : observed !== body.contentDigest ? 'MISMATCH'
      : Date.parse(verifiedAt) < Date.parse(retainedFrom) ||
        (retainedUntil && Date.parse(verifiedAt) >= Date.parse(retainedUntil)) ? 'EXPIRED' : 'MATCH';
    if (!RESULTS.includes(result)) result = 'UNAVAILABLE';
    const verifyBody = { schemaVersion: 1, bindingDigest: body.bindingDigest, result,
      observedContentDigest: observed, verifiedAt, authorityRefDigest };
    verifyBody.receiptDigest = hash({ ...verifyBody,
      retentionReceiptDigest: body.retentionReceiptDigest, contractRef: body.contractRef });
    body.verification = bevries(verifyBody);
    return bevries(body);
  }).sort((a, b) => a.role.localeCompare(b.role));
  const output = { schemaVersion: 1, bindings };
  output.attestationDigest = hash(output);
  return bevries(output);
}

module.exports = { ROLES, RESULTS, MEDIA, IMMUTABILITY, CONTRACTS,
  contractRef, authorityDigest, ownerAuthorityDigest, roleDigest, maakDraft, normaliseer,
  normaliseerRequirement, inspect: inspectSourceRetention };
