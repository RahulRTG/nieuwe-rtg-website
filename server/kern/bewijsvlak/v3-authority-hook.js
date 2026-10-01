'use strict';

const { hash } = require('./canon');
const runtime = require('./runtime');

const subject = binding => ({ domain: 'authority', type: 'consent', id: 'consent_' + hash(binding).slice(0, 24) });
const chain = binding => 'authority_' + hash(binding).slice(0, 24);

function record(binding, state, at) {
  try {
    const v3 = runtime.current().v3, revoked = state === 'REVOKED';
    return v3.pilots.authorityEvidence({ subjectRef: subject(binding), correlationId: chain(binding), at,
      factType: revoked ? 'authority.revoked' : 'authority.granted', truthClass: 'DOMAIN',
      scope: revoked ? 'authority.revoke' : 'authority.grant', protocol: 'AUTHORITY',
      value: { state, purpose: binding.purpose, capability: binding.capability, scope: binding.scope,
        version: binding.version } });
  } catch (e) { return null; }
}

function propagated(binding, at, result) {
  try {
    const v3 = runtime.current().v3, s = subject(binding);
    const facts = v3.store.list('evidence').filter(e => e.subjectRef.domain === s.domain &&
      e.subjectRef.type === s.type && e.subjectRef.id === s.id && e.factType === 'authority.revoked');
    const evidence = v3.pilots.authorityEvidence({ subjectRef: s, correlationId: chain(binding), at,
      factType: 'authority.revocation.propagated', truthClass: 'TECHNICAL', scope: 'authority.propagate',
      protocol: 'EXECUTION', value: result || { activeSessionsClosed: 0 } });
    if (!facts.length) return { evidence };
    const latest = facts.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    return { evidence, claim: v3.derive({ profileId: 'authority.revocation', profileVersion: 3,
      subjectRef: s, evidenceRefs: [latest.evidenceId, evidence.evidenceId], effectiveAt: at }) };
  } catch (e) { return null; }
}

module.exports = { subject, record, propagated };
