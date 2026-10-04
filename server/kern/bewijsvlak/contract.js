'use strict';

const { bevries, kopie } = require('./canon');

const PHASES = Object.freeze(['availability', 'experience', 'booking', 'payment', 'fulfillment', 'outcome']);
const CLAIM_STATES = Object.freeze(['PROPOSED', 'PROVEN', 'REJECTED', 'REVOKED', 'EXPIRED', 'SUPERSEDED']);
const CAPABILITY_STATES = Object.freeze(['IMPLEMENTED', 'AVAILABLE', 'DEGRADED', 'BLOCKED', 'UNKNOWN']);
const DECISIONS = Object.freeze(['ALLOW', 'DENY', 'DEGRADE', 'ESCALATE']);

function eis(waar, melding) { if (!waar) throw new Error('bewijsvlak: ' + melding); }
function tekst(v, naam, patroon) {
  eis(typeof v === 'string' && v.length > 0 && v.length <= 180, naam + ' ontbreekt of is te lang');
  if (patroon) eis(patroon.test(v), naam + ' heeft een ongeldige vorm');
  return v;
}

function capabilityContract(invoer) {
  const c = kopie(invoer || {});
  tekst(c.id, 'capability id', /^[a-z][a-z0-9.-]+$/);
  eis(Number.isInteger(c.version) && c.version > 0, c.id + ': version ontbreekt');
  tekst(c.owner, c.id + ': owner');
  eis(PHASES.includes(c.phase), c.id + ': onbekende phase');
  eis(typeof c.implemented === 'boolean', c.id + ': implemented moet expliciet zijn');
  eis(c.idempotency && ['required', 'declared', 'forbidden'].includes(c.idempotency.mode), c.id + ': idempotency-contract ontbreekt');
  eis(c.risk && ['low', 'medium', 'high', 'critical'].includes(c.risk.tier), c.id + ': risk tier ontbreekt');
  eis(c.policy && c.policy.id && c.policy.version, c.id + ': versioned policy ontbreekt');
  eis(c.schemas && c.schemas.input && c.schemas.output && c.schemas.event, c.id + ': schema-contract ontbreekt');
  eis(c.interfaces && c.interfaces.appCore && c.interfaces.producerConsumer &&
    c.interfaces.policyEvaluator && c.interfaces.capabilityProvider && c.interfaces.aiAction,
  c.id + ': interface-contracten ontbreken');
  eis(c.evidence && Array.isArray(c.evidence.required), c.id + ': evidence requirements ontbreken');
  eis(c.slo && c.slo.profile, c.id + ': SLO-profiel ontbreekt');
  eis(c.compatibility && c.compatibility.client && c.compatibility.policy && c.compatibility.event,
    c.id + ': compatibility-contract ontbreekt');
  return bevries(c);
}

function claim(invoer) {
  const c = kopie(invoer || {});
  tekst(c.claimId, 'claimId', /^claim_[a-f0-9]{24}$/);
  tekst(c.issuer, 'issuer');
  tekst(c.predicate, 'predicate', /^[a-z][a-z0-9.-]+$/);
  eis(c.subjectRef && c.subjectRef.domain && c.subjectRef.type && c.subjectRef.id, 'subjectRef is onvolledig');
  eis(CLAIM_STATES.includes(c.state), 'onbekende claim state');
  eis(PHASES.includes(c.phase), 'onbekende claim phase');
  eis(c.chain && c.chain.chainId && c.chain.stepId, 'correlatieketen ontbreekt');
  eis(c.contract && c.contract.id && c.contract.version, 'claimcontract ontbreekt');
  eis(c.policy && c.policy.id && c.policy.version, 'claimpolicy ontbreekt');
  eis(Array.isArray(c.evidenceRefs), 'evidenceRefs ontbreekt');
  return bevries(c);
}

module.exports = { PHASES, CLAIM_STATES, CAPABILITY_STATES, DECISIONS,
  capabilityContract, claim, eis };
