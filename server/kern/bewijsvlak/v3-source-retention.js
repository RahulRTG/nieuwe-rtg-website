/* Source retention is not the source itself. It is a versioned, authority-bound
   statement that the owning domain can locate and re-verify an immutable
   source. Only digests cross into Trust: never paths, URLs or business IDs.
   A runtime Evidence export is intentionally not a retention contract. */
'use strict';

const { hash, kopie, bevries } = require('./canon');
const contracts = require('./v3-source-retention-contracts');
const { ROLES, RESULTS, MEDIA, IMMUTABILITY, CONTRACTS, fout, contract,
  contractRef, authorityDigest, ownerAuthorityDigest, roleDigest, normaliseerRequirement,
  HEX, digest, tijd } = contracts;

// Een conceptverklaring opstellen: ./v3-source-retention-draft.js.
const { maakDraft } = require('./v3-source-retention-draft');

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

function inspect(evidence, requirement, at) {
  const req = requirement && requirement.retention;
  if (!req) return bevries({ ok: true, critical: false, statuses: [], debt: [], conflicts: [] });
  const sourceRetention = evidence && evidence.sourceRetention, bindings = sourceRetention && sourceRetention.bindings;
  const attestationValid = !!sourceRetention && sourceRetention.attestationDigest ===
    hash({ schemaVersion: sourceRetention.schemaVersion, bindings });
  const statuses = [], debt = [], conflicts = [], acceptedContracts = new Set(req.contracts.map(c => c.digest));
  for (const role of req.roles) {
    const expected = roleDigest(evidence, role), binding = Array.isArray(bindings)
      ? bindings.find(item => item.role === role) : null;
    let status = 'MISSING', reasons = [];
    if (!expected) reasons.push('SOURCE_DIGEST_MISSING');
    else if (!binding) reasons.push('BINDING_MISSING');
    else {
      const verification = binding.verification || {}, owner = binding.owner || {};
      let declared;
      try { declared = contract(binding.contractRef); } catch { reasons.push('CONTRACT_DENIED'); }
      if (!attestationValid) reasons.push('ATTESTATION_TAMPERED');
      if (!acceptedContracts.has(binding.contractRef && binding.contractRef.digest)) reasons.push('CONTRACT_DENIED');
      if (!declared || owner.domain !== declared.ownerDomain || binding.medium !== declared.medium ||
        binding.immutability !== declared.immutability || !declared.roles.includes(role) ||
        !owner.adapterRef || owner.adapterRef.id !== declared.adapter.id ||
        owner.adapterRef.version !== declared.adapter.version || owner.adapterRef.digest !== hash(declared.adapter))
        reasons.push('CONTRACT_MISMATCH');
      if (declared && owner.authorityRefDigest !== ownerAuthorityDigest(declared)) reasons.push('AUTHORITY_MISMATCH');
      if (binding.contentDigest !== expected) reasons.push('CONTENT_MISMATCH');
      if (binding.bindingDigest !== hash((({ bindingId, bindingDigest, verification, ...rest }) => rest)(binding)))
        reasons.push('BINDING_TAMPERED');
      if (binding.bindingId !== 'source_binding_' + String(binding.bindingDigest || '').slice(0, 32))
        reasons.push('BINDING_TAMPERED');
      if (verification.bindingDigest !== binding.bindingDigest ||
        verification.authorityRefDigest !== owner.authorityRefDigest ||
        (verification.result === 'MATCH' && verification.observedContentDigest !== binding.contentDigest))
        reasons.push('VERIFIER_MISMATCH');
      const receipt = hash({ schemaVersion: verification.schemaVersion,
        bindingDigest: verification.bindingDigest, result: verification.result,
        observedContentDigest: verification.observedContentDigest, verifiedAt: verification.verifiedAt,
        authorityRefDigest: verification.authorityRefDigest,
        retentionReceiptDigest: binding.retentionReceiptDigest, contractRef: binding.contractRef });
      if (verification.receiptDigest !== receipt) reasons.push('VERIFIER_TAMPERED');
      if (reasons.length) status = 'MISMATCH';
      else if (verification.result !== 'MATCH') status = RESULTS.includes(verification.result)
        ? verification.result : 'UNAVAILABLE';
      else if (binding.retainedUntil && Date.parse(at) >= Date.parse(binding.retainedUntil)) status = 'EXPIRED';
      else if (Date.parse(at) < Date.parse(binding.retainedFrom)) status = 'EXPIRED';
      else if (req.maxVerificationAgeMs != null &&
        Date.parse(at) - Date.parse(verification.verifiedAt) > req.maxVerificationAgeMs) status = 'EXPIRED';
      else status = 'MATCH';
    }
    const item = { role, status, reasonCodes: reasons.sort(),
      bindingId: binding && binding.bindingId || null };
    statuses.push(item);
    if (status !== 'MATCH') debt.push({ type: 'SOURCE_RETENTION_DEBT', role, status,
      reasonCodes: item.reasonCodes, bindingId: item.bindingId });
    if (status === 'MISMATCH') conflicts.push({ role, bindingId: item.bindingId,
      expectedDigest: expected, observedDigest: binding && binding.contentDigest || null });
  }
  return bevries({ ok: statuses.every(item => item.status === 'MATCH'), critical: req.critical,
    statuses, debt, conflicts });
}

module.exports = { ROLES, RESULTS, MEDIA, IMMUTABILITY, CONTRACTS,
  contractRef, authorityDigest, ownerAuthorityDigest, roleDigest, maakDraft, normaliseer,
  normaliseerRequirement, inspect };
