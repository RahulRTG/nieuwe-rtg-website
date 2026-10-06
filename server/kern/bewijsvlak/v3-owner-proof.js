/* One-use proof that a DOMAIN/TECHNICAL fact came from the module that owns
   the transition. A second boundary can mint tokens too, but those tokens are
   useless to the verifier held by the active Trust composition. */
'use strict';

const { hash, kopie } = require('./canon');

function fout(code, message) {
  const error = new Error('bewijsvlak v3 owner-proof: ' + message);
  error.code = code;
  return error;
}

function maakOwnerBoundary(ownerId) {
  const owner = String(ownerId || '').trim();
  if (!owner) throw fout('OWNER_PROOF_CONFIG_INVALID', 'owner ontbreekt');
  const marked = new WeakMap(), issued = new WeakSet(), proofs = new WeakMap();

  function mark(source, metadata) {
    if (!source || (typeof source !== 'object' && typeof source !== 'function'))
      throw fout('OWNER_SOURCE_INVALID', 'alleen het echte domeinevent kan worden gemarkeerd');
    const m = metadata || {}, purpose = String(m.purpose || ''), factType = String(m.factType || '');
    const eventRef = String(m.eventRef || ''), subjectRef = m.subjectRef, assertion = m.assertion;
    if (!purpose || !factType || !eventRef || !subjectRef || typeof subjectRef !== 'object' ||
      !assertion || typeof assertion !== 'object')
      throw fout('OWNER_SOURCE_INVALID', 'purpose, fact, eventref, subject en assertion zijn verplicht');
    const eventRefDigest = hash(eventRef), subjectRefDigest = hash(subjectRef),
      assertionDigest = hash(kopie(assertion));
    const retainedFrom = String(m.retainedFrom || assertion.at || assertion.eventAt || new Date().toISOString());
    if (!Number.isFinite(Date.parse(retainedFrom)))
      throw fout('OWNER_SOURCE_INVALID', 'retentiontijd is ongeldig');
    const locatorDigest = hash({ owner, purpose, factType, eventRefDigest, subjectRefDigest });
    const retentionReceiptDigest = hash({ owner, purpose, factType, eventRefDigest,
      subjectRefDigest, assertionDigest, retainedFrom, adapterVersion: 'owner-proof-v1' });
    marked.set(source, Object.freeze({ owner, purpose, factType, eventRefDigest, subjectRefDigest,
      assertionDigest, adapterVersion: 'owner-proof-v1', locatorDigest,
      retentionReceiptDigest, retainedFrom, verifiedAt: retainedFrom }));
    return source;
  }

  function issue(source) {
    const receipt = source && marked.get(source);
    if (!receipt) throw fout('OWNER_PROOF_REQUIRED', 'het event kwam niet uit de domeineigenaar');
    if (issued.has(source)) throw fout('OWNER_PROOF_REPLAY', 'voor dit domeinevent is al bewijs uitgegeven');
    issued.add(source);
    const token = Object.freeze(Object.create(null));
    proofs.set(token, receipt);
    return token;
  }

  function verifyOwnerProof(token, expected) {
    const receipt = token && proofs.get(token), e = expected || {};
    if (!token) throw fout('OWNER_PROOF_REQUIRED', 'domeineigenaarbewijs ontbreekt');
    if (!receipt) throw fout('OWNER_PROOF_INVALID', 'domeineigenaarbewijs is ongeldig of al gebruikt');
    proofs.delete(token); // mismatch brandt het token eveneens op
    const assertionDigest = e.assertion && typeof e.assertion === 'object' ? hash(e.assertion) : '';
    const subjectRefDigest = e.subjectRef && typeof e.subjectRef === 'object' ? hash(e.subjectRef) : '';
    const eventRefDigest = e.eventRef ? hash(String(e.eventRef)) : '';
    if (receipt.owner !== String(e.owner || '') || receipt.purpose !== String(e.purpose || '') ||
      receipt.factType !== String(e.factType || '') || !assertionDigest || !subjectRefDigest ||
      !eventRefDigest || receipt.assertionDigest !== assertionDigest ||
      receipt.subjectRefDigest !== subjectRefDigest || receipt.eventRefDigest !== eventRefDigest)
      throw fout('OWNER_PROOF_INVALID', 'bewijs hoort bij een andere owner, fact, subject, event of assertion');
    return receipt;
  }

  return Object.freeze({ mark, issue, verify: verifyOwnerProof });
}

module.exports = { maakOwnerBoundary };
