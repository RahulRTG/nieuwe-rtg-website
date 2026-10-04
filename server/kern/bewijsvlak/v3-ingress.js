/* Opaque provider evidence is created at the adapter that actually verifies a
   provider response. The marker stays lexical to that adapter: knowing a
   provider name, or entering an `aanbieder:*` request context, can never mint
   evidence. Trust receives only the matching one-use verifier. */
'use strict';

const { hash, kopie } = require('./canon');
const { contractRef } = require('./v3-source-retention');
const HEX = /^[a-f0-9]{64}$/;

function fout(code, message) {
  const error = new Error('bewijsvlak v3 ingress: ' + message);
  error.code = code;
  return error;
}
function retentionBasis(input) {
  if (!input) return null;
  const i = kopie(input), locatorDigest = String(i.locatorDigest || '').toLowerCase();
  const retentionReceiptDigest = String(i.retentionReceiptDigest || '').toLowerCase();
  const retainedFrom = String(i.retainedFrom || ''), retainedUntil = i.retainedUntil
    ? String(i.retainedUntil) : null, verifiedAt = String(i.verifiedAt || retainedFrom);
  if (!HEX.test(locatorDigest) || !HEX.test(retentionReceiptDigest) ||
    !Number.isFinite(Date.parse(retainedFrom)) || !Number.isFinite(Date.parse(verifiedAt)) ||
    (retainedUntil && (!Number.isFinite(Date.parse(retainedUntil)) ||
      Date.parse(retainedUntil) <= Date.parse(retainedFrom))))
    throw fout('INGRESS_RETENTION_INVALID', 'retentionbasis bevat geen geldige digests of tijden');
  return Object.freeze({ contractRef: contractRef(i.contractRef), locatorDigest,
    retentionReceiptDigest, retainedFrom, retainedUntil, verifiedAt,
    available: i.available !== false });
}

function maakProviderBoundary() {
  const verified = new WeakMap(), issued = new WeakSet(), proofs = new WeakMap();

  function mark(value, metadata) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function'))
      throw fout('INGRESS_SOURCE_INVALID', 'alleen het geverifieerde providerobject kan worden gemarkeerd');
    const m = metadata || {}, provider = String(m.provider || '').toLowerCase();
    const purpose = String(m.purpose || ''), eventRef = String(m.eventRef || '');
    const assertion = m.assertion && typeof m.assertion === 'object' ? kopie(m.assertion) : null;
    if (!provider || !purpose || !eventRef || !assertion)
      throw fout('INGRESS_SOURCE_INVALID', 'provider, purpose, eventreferentie en assertion zijn verplicht');
    const base = { provider, purpose,
      eventRefDigest: hash(eventRef), assertionDigest: hash(assertion),
      verifiedAt: String(m.verifiedAt || new Date().toISOString()),
      verifier: String(m.verifier || 'provider-adapter') };
    verified.set(value, Object.freeze({ ...base, receiptDigest: hash(base),
      retention: retentionBasis(m.retention) }));
    return value;
  }

  function issue(value) {
    const source = value && verified.get(value);
    if (!source) throw fout('INGRESS_PROOF_REQUIRED',
      'het object kwam niet uit een geverifieerde provideradapter');
    if (issued.has(value)) throw fout('INGRESS_PROOF_REPLAY',
      'voor dit providerobject is al een eenmalig bewijs uitgegeven');
    issued.add(value);
    const token = Object.freeze(Object.create(null));
    proofs.set(token, source);
    return token;
  }

  function verify(token, expected) {
    const proof = token && proofs.get(token), e = expected || {};
    if (!token) throw fout('INGRESS_PROOF_REQUIRED', 'providerbewijs ontbreekt');
    if (!proof) throw fout('INGRESS_PROOF_INVALID', 'providerbewijs is ongeldig of al gebruikt');
    proofs.delete(token);
    const provider = String(e.provider || '').toLowerCase(), purpose = String(e.purpose || '');
    const assertionDigest = e.assertion && typeof e.assertion === 'object' ? hash(e.assertion) : '';
    if ((provider && proof.provider !== provider) || (purpose && proof.purpose !== purpose) ||
      !assertionDigest || proof.assertionDigest !== assertionDigest)
      throw fout('INGRESS_PROOF_INVALID',
        'providerbewijs hoort bij een andere provider, purpose of assertion');
    return proof;
  }

  return Object.freeze({ mark, issue, verify });
}

module.exports = { maakProviderBoundary };
