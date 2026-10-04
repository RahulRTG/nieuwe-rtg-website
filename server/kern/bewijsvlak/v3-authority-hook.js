'use strict';

const { hash } = require('./canon');

let adapter = null;
function install(value) {
  if (!value || typeof value.authorityEvidence !== 'function' || typeof value.verifyOwnerProof !== 'function')
    throw new Error('bewijsvlak v3: ongeldige authority-adapter');
  adapter = value;
}
function eis() {
  if (!adapter) require('./runtime').current(); // laad de private compositie bij los domeingebruik
  if (!adapter) throw new Error('bewijsvlak v3: authority-adapter is niet geïnstalleerd');
  return adapter;
}
function failure(error) {
  return Object.freeze({ ok: false, shadow: true,
    code: error && error.code || 'AUTHORITY_EVIDENCE_FAILED',
    incidentId: error && error.incidentId || null });
}
function afhandelen(error) { if (error && error.incidentId) throw error; return failure(error); }

const subject = binding => ({ domain: 'authority', type: 'consent', id: 'consent_' + hash(binding).slice(0, 24) });
const chain = binding => 'authority_' + hash(binding).slice(0, 24);

function authorityTransition(input) {
  try {
    const i = input || {}, binding = i.binding || {}, state = i.state, at = i.at;
    const facts = {
      ACTIVE: 'authority.granted',
      REVOKED: 'authority.revoked',
      EXPIRED: 'authority.expired'
    };
    const factType = facts[state];
    if (!factType) return failure(Object.assign(new Error('onbekende authority-toestand'),
      { code: 'AUTHORITY_STATE_UNKNOWN' }));
    const s = subject(binding);
    const assertion = { subjectRef: s, state, at, revision: i.revision,
      purpose: binding.purpose, capability: binding.capability,
      scope: binding.scope, version: binding.version };
    const receipt = eis().verifyOwnerProof(i.ownerProof, { owner: 'connection-consent',
      purpose: 'authority-transition', factType, subjectRef: s,
      eventRef: i.eventRef, assertion });
    return eis().authorityEvidence({ subjectRef: s, correlationId: chain(binding), at,
      factType, value: { state, purpose: binding.purpose, capability: binding.capability,
        scope: binding.scope, version: binding.version }, ownerReceipt: receipt });
  } catch (error) { return afhandelen(error); }
}

function propagated(input) {
  try {
    const i = input || {}, binding = i.binding || {}, at = i.at, result = i.result;
    const v3 = require('./runtime').current().v3, s = subject(binding);
    const facts = v3.store.list('evidence').filter(e => e.subjectRef.domain === s.domain &&
      e.subjectRef.type === s.type && e.subjectRef.id === s.id && e.factType === 'authority.revoked');
    const assertion = { subjectRef: s, state: 'REVOKED', at, revision: i.revision,
      value: result || { activeSessionsClosed: 0 } };
    const receipt = eis().verifyOwnerProof(i.ownerProof, { owner: 'connection-consent',
      purpose: 'authority-propagation', factType: 'authority.revocation.propagated',
      subjectRef: s, eventRef: i.eventRef, assertion });
    const evidence = eis().authorityEvidence({ subjectRef: s, correlationId: chain(binding), at,
      factType: 'authority.revocation.propagated', value: result || { activeSessionsClosed: 0 },
      ownerReceipt: receipt });
    if (!facts.length) return { evidence };
    const latest = facts.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    return { evidence, claim: v3.derive({ profileId: 'authority.revocation', profileVersion: 3,
      subjectRef: s, evidenceRefs: [latest.evidenceId, evidence.evidenceId], effectiveAt: at }) };
  } catch (error) { return afhandelen(error); }
}

module.exports = { install, subject, transition: authorityTransition, propagated };
