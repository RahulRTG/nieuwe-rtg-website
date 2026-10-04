/* Een conceptverklaring voor bronretentie: per rol een binding aan het
   contract, de locator, de inhoud en de verificatie, alleen als digests.
   Afgesplitst uit ./v3-source-retention.js, dat over de omvanggrens ging. */
'use strict';

const { bevries } = require('./canon');
const { fout, contract, digest, tijd } = require('./v3-source-retention-contracts');

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

module.exports = { maakDraft };
