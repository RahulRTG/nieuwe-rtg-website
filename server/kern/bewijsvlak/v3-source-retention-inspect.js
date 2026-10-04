'use strict';

const { hash, bevries } = require('./canon');
const { RESULTS, contract, ownerAuthorityDigest, roleDigest } =
  require('./v3-source-retention-contracts');

/* Inspectie is bewust gescheiden van attestatiebouw: een producer kan hiermee
   geen eigen broncontract creëren of versoepelen. */
function inspectSourceRetention(evidence, requirement, at) {
  const req = requirement && requirement.retention;
  if (!req) return bevries({ ok: true, critical: false, statuses: [], debt: [], conflicts: [] });
  const sourceRetention = evidence && evidence.sourceRetention;
  const bindings = sourceRetention && sourceRetention.bindings;
  const attestationValid = !!sourceRetention && sourceRetention.attestationDigest ===
    hash({ schemaVersion: sourceRetention.schemaVersion, bindings });
  const statuses = [], debt = [], conflicts = [];
  const acceptedContracts = new Set(req.contracts.map(c => c.digest));
  for (const role of req.roles) {
    const expected = roleDigest(evidence, role);
    const binding = Array.isArray(bindings) ? bindings.find(item => item.role === role) : null;
    let status = 'MISSING', reasons = [];
    if (!expected) reasons.push('SOURCE_DIGEST_MISSING');
    else if (!binding) reasons.push('BINDING_MISSING');
    else {
      const verification = binding.verification || {}, owner = binding.owner || {};
      let declared;
      try { declared = contract(binding.contractRef); } catch { reasons.push('CONTRACT_DENIED'); }
      if (!attestationValid) reasons.push('ATTESTATION_TAMPERED');
      if (!acceptedContracts.has(binding.contractRef && binding.contractRef.digest))
        reasons.push('CONTRACT_DENIED');
      if (!declared || owner.domain !== declared.ownerDomain || binding.medium !== declared.medium ||
        binding.immutability !== declared.immutability || !declared.roles.includes(role) ||
        !owner.adapterRef || owner.adapterRef.id !== declared.adapter.id ||
        owner.adapterRef.version !== declared.adapter.version || owner.adapterRef.digest !== hash(declared.adapter))
        reasons.push('CONTRACT_MISMATCH');
      if (declared && owner.authorityRefDigest !== ownerAuthorityDigest(declared))
        reasons.push('AUTHORITY_MISMATCH');
      if (binding.contentDigest !== expected) reasons.push('CONTENT_MISMATCH');
      const body = (({ bindingId, bindingDigest, verification: ignored, ...rest }) => rest)(binding);
      if (binding.bindingDigest !== hash(body)) reasons.push('BINDING_TAMPERED');
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

module.exports = { inspectSourceRetention };
