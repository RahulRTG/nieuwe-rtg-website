'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPlane } = require('../server/kern/bewijsvlak');
const v3Contract = require('../server/kern/bewijsvlak/v3-contract');
const { hash } = require('../server/kern/bewijsvlak/canon');
const runtime = require('../server/kern/bewijsvlak/runtime');
const moneyHook = require('../server/kern/bewijsvlak/v3-money-hook');
const externalHook = require('../server/kern/bewijsvlak/v3-external-hook');
const authorityHook = require('../server/kern/bewijsvlak/v3-authority-hook');
const { maakCoordinator } = require('../server/kern/bewijsvlak/v3-transaction');
const { maakLedger } = require('../server/kern/bewijsvlak/ledger');
const { alsAanbieder } = require('../server/kern/dienstidentiteit');
const { maakProviderBoundary } = require('../server/kern/bewijsvlak/v3-ingress');
const { maakOwnerBoundary } = require('../server/kern/bewijsvlak/v3-owner-proof');
const verzoekcontext = require('../server/db/verzoekcontext');
const Consent = require('../server/kern/connection-consent');

const at = '2026-09-30T10:00:00.000Z';
const subject = { domain: 'money', type: 'payment', id: 'PAY-1' };

function payment(id, provider) {
  return { id: id || subject.id, bijgewerktAt: at, status: 'BEVESTIGD',
    provider: provider || 'stripe', providerStatus: 'succeeded', centen: 1000, valuta: 'eur',
    gebeurtenissen: [{ nr: 1, at, soort: 'STATUS', status: 'BEVESTIGD', zegel: 'seal-' + (id || subject.id) }] };
}

function basis(factType, truthClass, scope, value, extra) {
  return { factType, truthClass, subjectRef: subject,
    protocol: factType.includes('settled') ? 'SETTLEMENT' : 'CONFIRMATION',
    source: { type: truthClass === 'EXTERNAL' ? 'verified-payment-provider' : 'rtg-payment-truth',
      ref: truthClass === 'EXTERNAL' ? 'stripe' : 'betaalwaarheid' },
    authority: { id: truthClass === 'EXTERNAL' ? 'provider:stripe' : 'rtg:payment', scopes: [scope],
      basis: truthClass === 'EXTERNAL' ? 'verified-provider-channel' : 'domain-ownership', validFrom: at },
    observedAt: at, effectiveFrom: at, causality: { correlationId: 'chain-pay-1' },
    operation: { domain: 'money', capability: 'payment.authorize', name: factType, attempt: 1,
      provider: truthClass === 'EXTERNAL' ? 'stripe' : null }, value, ...(extra || {}) };
}

let ingress = null, ownerIngress = null, hospitalityOwner = null;
function testPlane(options) {
  ingress = maakProviderBoundary();
  ownerIngress = maakOwnerBoundary('payment-truth');
  hospitalityOwner = maakOwnerBoundary('hospitality-domain');
  return maakPlane({ ...(options || {}), verifyProviderProof: ingress.verify,
    verifyMoneyOwnerProof: ownerIngress.verify,
    verifyExternalOwnerProof: hospitalityOwner.verify });
}
function configureRuntime(options) {
  ingress = maakProviderBoundary();
  ownerIngress = maakOwnerBoundary('payment-truth');
  hospitalityOwner = maakOwnerBoundary('hospitality-domain');
  return runtime.configure({ ...(options || {}), verifyProviderProof: ingress.verify,
    verifyMoneyOwnerProof: ownerIngress.verify,
    verifyExternalOwnerProof: hospitalityOwner.verify });
}
function assertionFor(p, extra) {
  return { provider: String(p.provider || '').toLowerCase(), paymentRef: String(p.id),
    providerObjectId: String(p.providerId || p.id), providerPaymentId: String(p.providerPaymentId || ''),
    status: String(p.providerStatus || '').toLowerCase(), amountCents: Math.round(Number(p.centen)),
    currency: String(p.valuta || '').toLowerCase(), ...(extra || {}) };
}
function proof(provider, eventRef, purpose, assertion) {
  const source = {};
  const base = { provider: String(provider).toLowerCase(), purpose,
    eventRefDigest: hash(eventRef), assertionDigest: hash(assertion), verifiedAt: at,
    verifier: 'test-verifier' };
  const receiptDigest = hash(base);
  ingress.mark(source, { provider, eventRef, purpose, assertion, verifiedAt: at, verifier: 'test-verifier',
    retention: { contractRef: { id: purpose === 'money' ? 'money.provider-source' :
      'hospitality.provider-source', version: 1 },
    locatorDigest: hash({ testSource: provider, eventRef, purpose }),
    retentionReceiptDigest: hash({ receiptDigest, retained: true }), retainedFrom: at, verifiedAt: at } });
  return ingress.issue(source);
}
function moneyOwner(p, factType, purpose, boundary) {
  const owner = boundary || ownerIngress;
  const eventRef = p.gebeurtenissen[p.gebeurtenissen.length - 1].zegel;
  const assertion = { subjectRef: { domain: 'money', type: 'payment', id: String(p.id) }, factType,
    status: String(p.status), provider: String(p.provider || '').toLowerCase(),
    providerStatus: String(p.providerStatus || '').toLowerCase(), amountCents: Math.round(Number(p.centen)),
    currency: String(p.valuta || '').toLowerCase(), eventSeal: eventRef, eventNumber: 1, eventAt: at };
  const source = {};
  owner.mark(source, { purpose, factType, eventRef, subjectRef: assertion.subjectRef, assertion });
  return { proof: owner.issue(source), assertion, eventRef };
}
function domain(value, id) {
  const p = payment(id);
  return moneyHook.ownerEvidence(p, 'payment.ledger.posted', value,
    moneyOwner(p, 'payment.ledger.posted', 'money-domain'));
}
function settled(value, event, id) {
  const p = payment(id), a = assertionFor(p);
  return moneyHook.providerSettled(p, event || 'evt-settled', value,
    proof(p.provider, event || 'evt-settled', 'money', a), a);
}
function matched(value, id) {
  const p = payment(id);
  return moneyHook.ownerEvidence(p, 'payment.reconciliation.matched', value,
    moneyOwner(p, 'payment.reconciliation.matched', 'money-domain'));
}

test('V3 leidt een reproduceerbare reconciled claim af uit drie bevoegde waarheden', () => {
  const plane = testPlane({ state: {}, nu: () => at }), v3 = plane.v3;
  const ledger = domain({ cents: 1000 });
  const providerFact = settled({ cents: 1000 }, 'evt-1');
  const match = matched({ matched: true });
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [providerFact.evidenceId, ledger.evidenceId, match.evidenceId], effectiveAt: at, derivedAt: at });
  assert.equal(claim.finality, 'RECONCILED');
  assert.equal(claim.completeness.missing.length, 0);
  assert.equal(v3.reproduce(claim.claimId).ok, true);
  assert.match(claim.requirementProfile.digest, /^[a-f0-9]{64}$/);
  assert.match(claim.resolver.artifactDigest, /^[a-f0-9]{64}$/);
});

test('afwezig providerbewijs wordt nooit betaalwaarheid', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const ledger = domain({ cents: 1000 });
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [ledger.evidenceId], effectiveAt: at });
  assert.equal(claim.finality, 'SOURCE_ATTESTED');
  assert.ok(claim.completeness.missing.some(x => x.requirementId === 'provider-settlement'));
  assert.deepEqual(claim.completeness.unauthorized, []);
});

test('publieke pilots bestaan niet en callerstrings kunnen geen providerbewijs maken', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  assert.equal(v3.pilots, undefined);
  assert.equal(runtime.pilot, undefined);
  assert.throws(() => v3.record(basis('payment.provider.settled', 'EXTERNAL',
    'payment.settlement', { cents: 1000 })), e => e.code === 'AUTHORITY_PROOF_REQUIRED');
  assert.throws(() => moneyHook.providerSettled(payment(), 'evt-forged', { cents: 1000 }),
    e => e.code === 'INGRESS_PROOF_REQUIRED');
  assert.throws(() => alsAanbieder('stripe', () => moneyHook.providerSettled(payment(),
    'evt-context-forged', { cents: 1000 })), e => e.code === 'INGRESS_PROOF_REQUIRED');
  assert.throws(() => moneyHook.ownerEvidence(payment(), 'payment.ledger.posted', { cents: 1000 }),
    e => ['OWNER_ASSERTION_MISMATCH', 'OWNER_PROOF_REQUIRED'].includes(e.code));
  const p = payment('PAY-ROGUE'), rogue = maakOwnerBoundary('payment-truth');
  assert.throws(() => moneyHook.ownerEvidence(p, 'payment.ledger.posted', { cents: 1000 },
    moneyOwner(p, 'payment.ledger.posted', 'money-domain', rogue)), e => e.code === 'OWNER_PROOF_INVALID');
  const forgedAuthority = authorityHook.transition({ binding: { actor: 'victim', counterpart: 'attacker',
    purpose: 'vonk.communication', capability: 'connection.voice', scope: 'MATCH-FORGED', version: 1 },
  state: 'ACTIVE', at, revision: 1, eventRef: 'caller-string' });
  assert.equal(forgedAuthority.ok, false);
  assert.ok(['OWNER_PROOF_REQUIRED', 'OWNER_PROOF_INVALID'].includes(forgedAuthority.code));
  assert.equal(v3.snapshot().counts.evidence, 0);
  assert.equal(v3.snapshot().health.status, 'HEALTHY', 'een geweigerde aanval is geen opslagstoring');
});

test('providerreceipt bindt exact event en betaling en is na mismatch of gebruik ongeldig', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const a = payment('PAY-A'), assertionA = assertionFor(a);
  const token = proof('stripe', 'evt-a', 'money', assertionA);
  const b = payment('PAY-B'), assertionB = assertionFor(b);
  assert.throws(() => moneyHook.providerSettled(b, 'evt-a', { cents: 1000 }, token, assertionB),
    e => ['INGRESS_ASSERTION_MISMATCH', 'INGRESS_PROOF_INVALID'].includes(e.code));
  assert.throws(() => moneyHook.providerSettled(a, 'evt-a', { cents: 1000 }, token, assertionA),
    e => e.code === 'INGRESS_PROOF_INVALID', 'een mismatched token is direct opgebrand');

  const valid = proof('stripe', 'evt-a-valid', 'money', assertionA);
  const fact = moneyHook.providerSettled(a, 'caller-mag-dit-niet-hernoemen', { cents: 1000 }, valid, assertionA);
  assert.match(fact.source.eventRefDigest, /^[a-f0-9]{64}$/);
  assert.match(fact.source.assertionDigest, /^[a-f0-9]{64}$/);
  assert.match(fact.source.receiptDigest, /^[a-f0-9]{64}$/);
  assert.equal(fact.causality.causationId, 'provider_event_' + fact.source.eventRefDigest);
  assert.throws(() => moneyHook.providerSettled(a, 'evt-replay', { cents: 1000 }, valid, assertionA),
    e => e.code === 'INGRESS_PROOF_INVALID');
  assert.equal(v3.snapshot().counts.evidence, 1);
});

test('money owner-proof is exact subject/value/event-gebonden en mismatch of replay attesteert niets', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const a = payment('PAY-OWNER-A'), b = payment('PAY-OWNER-B');
  const token = moneyOwner(a, 'payment.ledger.posted', 'money-domain');
  assert.throws(() => moneyHook.ownerEvidence(b, 'payment.ledger.posted', { cents: 1000 }, token),
    e => e.code === 'OWNER_PROOF_INVALID');
  assert.throws(() => moneyHook.ownerEvidence(a, 'payment.ledger.posted', { cents: 1000 }, token),
    e => e.code === 'OWNER_PROOF_INVALID', 'cross-subject mismatch brandt het token op');

  const changed = moneyOwner(a, 'payment.ledger.posted', 'money-domain');
  a.centen = 2000;
  assert.throws(() => moneyHook.ownerEvidence(a, 'payment.ledger.posted', { cents: 2000 }, changed),
    e => e.code === 'OWNER_PROOF_INVALID');
  assert.equal(v3.snapshot().counts.evidence, 0);
});

test('een vooraf opgeslagen record met uitsluitend correcte callerstrings blijft onbevoegd', () => {
  const raw = basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 1000 });
  const unsigned = v3Contract.evidence(raw, () => at);
  const state = { v3: { evidence: { [unsigned.evidenceId]: unsigned } } };
  const v3 = testPlane({ state, nu: () => at }).v3;
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [unsigned.evidenceId], effectiveAt: at });
  assert.equal(claim.finality, 'UNKNOWN');
  assert.deepEqual(claim.completeness.unauthorized, [unsigned.evidenceId]);
});

test('V3-capaciteit bewaart immutable historie, laat replay toe en blokkeert na bewijsuitval', () => {
  const state = {}, v3 = testPlane({ state, nu: () => at,
    v3StoreLimits: { evidence: 1, claims: 1, decisions: 1, conflicts: 1, reconciliations: 1 } }).v3;
  const eerste = domain({ cents: 1000 });
  assert.equal(domain({ cents: 1000 }).evidenceId, eerste.evidenceId,
    'exact dezelfde immutable waarneming is een replay');
  assert.throws(() => domain({ cents: 2000 }), e =>
    e.code === 'EVIDENCE_CAPACITY_REACHED' && !!e.incidentId);
  assert.equal(v3.snapshot().counts.evidence, 1);
  assert.equal(v3.snapshot().health.acceptingWrites, false);
  assert.equal(v3.evidence(eerste.evidenceId).valueDigest, eerste.valueDigest);
});

test('UNKNOWN blokkeert een blinde retry en produceert wel immutable decision evidence', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3,
    subjectRef: subject, evidenceRefs: [], effectiveAt: at });
  assert.equal(claim.finality, 'UNKNOWN');
  assert.throws(() => v3.decide({ subjectRef: subject, claimRefs: [claim.claimId], action: 'payment.retry',
    outcome: 'RETRY', consequential: true }), /onzeker bewijs/);
  assert.equal(v3.snapshot().health.status, 'HEALTHY', 'een policyweigering is geen infrastructuurincident');
  const result = v3.decide({ subjectRef: subject, claimRefs: [claim.claimId], action: 'payment.retry',
    outcome: 'DO_NOT_RETRY', consequential: true, policy: { id: 'money-v3', version: 3 } });
  assert.equal(result.decision.outcome, 'DO_NOT_RETRY');
  assert.equal(result.decisionEvidence.factType, 'decision.recorded');
  assert.equal(result.decisionEvidence.subjectRef.id, result.decision.decisionId);
});

test('canonical head en transition matrix blokkeren downgrade, stale fork en terminale heropening', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const facts = [domain({ cents: 1000 }), settled({ cents: 1000 }, 'evt-settle'), matched({ matched: true })];
  const reconciled = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: facts.map(x => x.evidenceId), effectiveAt: at });
  assert.throws(() => v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [facts[0].evidenceId], effectiveAt: at }), e => e.code === 'FINALITY_TRANSITION_DENIED');
  const reversedPayment = payment(), reversedAssertion = assertionFor(reversedPayment);
  const reversedFact = moneyHook.providerReversed(reversedPayment, 'evt-reverse', { reversed: true },
    proof('stripe', 'evt-reverse', 'money', reversedAssertion), reversedAssertion);
  const reversed = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [...facts.map(x => x.evidenceId), reversedFact.evidenceId], effectiveAt: at });
  assert.equal(reversed.finality, 'REVERSED');
  assert.throws(() => v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: facts.map(x => x.evidenceId), effectiveAt: at }), e => e.code === 'FINALITY_TRANSITION_DENIED');
  assert.throws(() => v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: facts.map(x => x.evidenceId), effectiveAt: at, previousClaimId: reconciled.claimId }),
    e => e.code === 'CLAIM_STALE_REVISION');
  assert.equal(v3.claim(reconciled.claimId).finality, 'RECONCILED');
  assert.equal(v3.snapshot().claimDebt.some(x => x.claimId === reversed.claimId), false,
    'een terminale correctie is geen ontbrekend bewijs');
});

test('conflicterend bevoegd providerbewijs wordt DISPUTED en opent geen succespad', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const a = settled({ cents: 1000, event: 'a' }, 'evt-a');
  const b = settled({ cents: 2000, event: 'b' }, 'evt-b');
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [a.evidenceId, b.evidenceId], effectiveAt: at });
  assert.equal(claim.finality, 'DISPUTED');
  assert.equal(v3.snapshot().counts.conflicts, 1);
});

test('money-adapter vertaalt onzekere uitkomst naar DO_NOT_RETRY plus reconciliation', () => {
  const v3 = testPlane({ state: {}, nu: () => at }).v3;
  const p = payment(), assertion = assertionFor(p);
  const result = moneyHook.confirmed(p, 'evt-confirmed',
    proof('stripe', 'evt-confirmed', 'money', assertion), assertion,
    moneyOwner(p, 'payment.ledger.posted', 'money-domain'));
  assert.equal(result.claim.finality, 'SOURCE_ATTESTED');
  assert.equal(result.decision.decision.outcome, 'DO_NOT_RETRY');
  assert.equal(result.reconciliation.state, 'REQUESTED');
  assert.equal(result.ingress.ok, true);
  assert.equal(v3.reproduce(result.claim.claimId).ok, true);
});

test('money confirmation commit provider, domein, claim, besluit en reconciliatie met één save', () => {
  const state = {}; let saves = 0;
  const v3 = testPlane({ state, nu: () => at, save() { saves++; } }).v3;
  const p = payment(), assertion = assertionFor(p);
  const result = moneyHook.confirmed(p, 'evt-one-commit',
    proof('stripe', 'evt-one-commit', 'money', assertion), assertion,
    moneyOwner(p, 'payment.ledger.posted', 'money-domain'));
  assert.equal(result.ok, true);
  assert.equal(saves, 1);
  assert.equal(v3.snapshot().counts.evidence, 3,
    'provider + domein + decision-evidence staan in dezelfde commit');
  assert.equal(v3.snapshot().counts.claims, 1);
  assert.equal(v3.snapshot().counts.decisions, 1);
  assert.equal(v3.snapshot().counts.reconciliations, 1);
});

test('authority revocation vereist domeinfeit plus propagatie en expiry is nooit grant', () => {
  const state = {}; configureRuntime({ state, mode: 'shadow', nu: () => at });
  const binding = { actor: 'A', counterpart: 'B', purpose: 'vonk.communication',
    capability: 'connection.voice', scope: 'MATCH-1', version: 1 };
  const consent = {};
  Consent.expire(consent, binding, { at });
  const expiredFacts = runtime.current().v3.store.list('evidence');
  assert.equal(expiredFacts.length, 1);
  assert.equal(expiredFacts[0].factType, 'authority.expired');
  assert.equal(expiredFacts.some(x => x.factType === 'authority.granted'), false);

  Consent.revoke(consent, binding, { at });
  const result = Consent.propagated(consent, binding, at, { activeSessionsClosed: 1, storageRevision: 2 });
  assert.equal(result.claim.finality, 'CROSS_VERIFIED');
  assert.equal(JSON.stringify(state).includes('counterpart'), false,
    'actoridentiteiten blijven buiten het bewijsvlak');
});

test('authority owner-proof kan niet naar een ander subject worden verplaatst of hergebruikt', () => {
  const auth = maakOwnerBoundary('connection-consent'), state = {};
  runtime.configure({ state, mode: 'shadow', nu: () => at, verifyAuthorityOwnerProof: auth.verify });
  const a = { actor: 'A', counterpart: 'B', purpose: 'vonk.communication',
    capability: 'connection.voice', scope: 'MATCH-A', version: 1 };
  const b = { ...a, actor: 'C', counterpart: 'D', scope: 'MATCH-B' };
  const subjectA = authorityHook.subject(a), eventRef = 'consent-A:r1';
  const assertionA = { subjectRef: subjectA, state: 'ACTIVE', at, revision: 1,
    purpose: a.purpose, capability: a.capability, scope: a.scope, version: a.version };
  const source = {};
  auth.mark(source, { purpose: 'authority-transition', factType: 'authority.granted',
    eventRef, subjectRef: subjectA, assertion: assertionA });
  const token = auth.issue(source);
  const mismatch = authorityHook.transition({ binding: b, state: 'ACTIVE', at, revision: 1,
    eventRef, ownerProof: token });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'OWNER_PROOF_INVALID');
  const replay = authorityHook.transition({ binding: a, state: 'ACTIVE', at, revision: 1,
    eventRef, ownerProof: token });
  assert.equal(replay.ok, false);
  assert.equal(replay.code, 'OWNER_PROOF_INVALID');
  assert.equal(runtime.current().v3.snapshot().counts.evidence, 0);
});

test('providerbevestiging zonder geverifieerde ingress wordt niet als external evidence opgeslagen', () => {
  const state = {}; configureRuntime({ state, mode: 'shadow', nu: () => at });
  const ref = 'vonk:M1:reservation';
  const subjectRef = { domain: 'hospitality', type: 'reservation', id: ref };
  const commitmentValue = { providerReservationRef: 'R-0', supplierRef: 'stripe',
    date: '2026-10-01', time: '19:30', people: 2, requestedAt: at };
  const ownerAssertion = { subjectRef, factType: 'external.commitment.recorded',
    providerReservationRef: 'R-0', provider: 'stripe', state: 'REQUEST_PERSISTED',
    requestedAt: at, valueDigest: hash(commitmentValue) };
  const ownerSource = {}, ownerEventRef = 'reservation-request-v1:R-0:stripe:' + at;
  hospitalityOwner.mark(ownerSource, { purpose: 'external-domain',
    factType: 'external.commitment.recorded', eventRef: ownerEventRef, subjectRef,
    assertion: ownerAssertion, retainedFrom: at });
  const committed = externalHook.reservation('commitment', { reservationRef: ref,
    provider: 'stripe', at, value: commitmentValue, ownerAssertion, ownerEventRef,
    ownerProof: hospitalityOwner.issue(ownerSource) });
  const denied = externalHook.reservation('confirmed', { reservationRef: ref,
    provider: 'stripe', providerEventId: 'evt-res-0', at, value: { providerReservationRef: 'R-0' } });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'INGRESS_PROOF_REQUIRED');
  const assertion = { provider: 'stripe', reservationRef: ref,
    providerReservationRef: 'R-1', status: 'confirmed' };
  const confirmed = externalHook.reservation('confirmed', { reservationRef: ref,
    provider: 'stripe', providerEventId: 'evt-res-1', providerAssertion: assertion,
    providerProof: proof('stripe', 'evt-res-1', 'external', assertion), at,
    value: { providerReservationRef: 'R-1', status: 'confirmed' } });
  const claim = externalHook.assess(ref, [committed.evidenceId, confirmed.evidenceId], at);
  assert.equal(claim.finality, 'SOURCE_ATTESTED');
  assert.ok(claim.completeness.missing.some(x => x.requirementId === 'operational-outcome'));
});

test('hospitality-proof is in V3 exact reservation/status-gebonden en mismatch brandt hem op', () => {
  testPlane({ state: {}, nu: () => at });
  const ref = 'vonk:M2:reservation';
  const assertionA = { provider: 'stripe', reservationRef: ref,
    providerReservationRef: 'R-A', status: 'confirmed' };
  const token = proof('stripe', 'evt-hospitality-a', 'external', assertionA);
  const assertionB = { ...assertionA, providerReservationRef: 'R-B' };
  const mismatch = externalHook.reservation('confirmed', { reservationRef: ref,
    provider: 'stripe', providerProof: token, providerAssertion: assertionB, at,
    value: { providerReservationRef: 'R-B', status: 'confirmed' } });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, 'INGRESS_PROOF_INVALID');
  const replay = externalHook.reservation('confirmed', { reservationRef: ref,
    provider: 'stripe', providerProof: token, providerAssertion: assertionA, at,
    value: { providerReservationRef: 'R-A', status: 'confirmed' } });
  assert.equal(replay.ok, false);
  assert.equal(replay.code, 'INGRESS_PROOF_INVALID');
});

test('ledger-capaciteit na staged store-write laat geen half V3-record achter', () => {
  const state = {}, plane = testPlane({ state, nu: () => at,
    ledgerLimits: { records: 1, evidence: 10 } });
  const first = domain({ cents: 1000 }, 'PAY-CAP-1');
  const before = plane.v3.snapshot().counts.evidence;
  assert.throws(() => domain({ cents: 2000 }, 'PAY-CAP-2'), e =>
    e.code === 'EVIDENCE_CAPACITY_REACHED' && !!e.incidentId);
  assert.equal(plane.v3.snapshot().counts.evidence, before);
  assert.equal(state.ledger.length, 1);
  assert.equal(plane.v3.evidence(first.evidenceId).evidenceId, first.evidenceId);
});

test('save met onbekende uitkomst rolt RAM terug en blokkeert vervolg met zichtbare schuld', () => {
  const state = {};
  let saves = 0;
  const plane = testPlane({ state, nu: () => at, save() { saves++; throw new Error('disk timeout'); } });
  assert.throws(() => domain({ cents: 1000 }, 'PAY-SAVE-1'), e =>
    e.code === 'EVIDENCE_PERSIST_OUTCOME_UNKNOWN' && !!e.incidentId);
  assert.equal(saves, 1);
  assert.equal(Object.keys(state.v3.evidence).length, 0);
  assert.equal(state.ledger.length, 0);
  const snap = plane.v3.snapshot();
  assert.equal(snap.health.acceptingWrites, false);
  assert.equal(snap.writeDebt.length, 1);
  assert.throws(() => domain({ cents: 1000 }, 'PAY-SAVE-2'), e =>
    e.code === 'EVIDENCE_WRITES_BLOCKED' && e.incidentId === snap.writeDebt[0].incidentId);
});

test('consequential authority-hook verbergt een persistentie-incident niet', () => {
  const state = {};
  configureRuntime({ state, mode: 'shadow', nu: () => at, save() { throw new Error('storage timeout'); } });
  const binding = { actor: 'A', counterpart: 'B', purpose: 'vonk.communication',
    capability: 'connection.video', scope: 'MATCH-2', version: 1 };
  assert.throws(() => Consent.grant({}, binding, { at }), e =>
    e.code === 'EVIDENCE_PERSIST_OUTCOME_UNKNOWN' && !!e.incidentId);
  const health = runtime.current().v3.snapshot().health;
  assert.equal(health.status, 'UNHEALTHY');
  assert.equal(health.acceptingWrites, false);
});

test('rollbackfout zet de coordinator CORRUPT en blokkeert alle vervolgwrites', () => {
  const root = {};
  const tx = maakCoordinator({ root, nu: () => at, save() { throw new Error('unknown disk outcome'); } });
  assert.throws(() => tx.atomic('rollback.failure', () => {
    tx.stage({ key: 'broken', apply() { root.changed = true; },
      rollback() { throw Object.assign(new Error('rollback failed'), { code: 'ROLLBACK_FAILED' }); } });
  }), e => e.code === 'EVIDENCE_PERSIST_OUTCOME_UNKNOWN' &&
    e.rollbackErrors.includes('ROLLBACK_FAILED') && !!e.incidentId);
  assert.equal(tx.snapshot().status, 'CORRUPT');
  assert.equal(tx.snapshot().acceptingWrites, false);
  assert.throws(() => tx.atomic('must.stay.closed', () => true), e =>
    e.code === 'EVIDENCE_WRITES_BLOCKED' && !!e.incidentId);
});

test('decision, decision-evidence en twee ledgerregels committen alles of niets', () => {
  const state = {};
  let saves = 0;
  const plane = testPlane({ state, nu: () => at, save() { saves++; },
    ledgerLimits: { records: 2, evidence: 10 } });
  const claim = plane.v3.derive({ profileId: 'money.settlement', profileVersion: 3,
    subjectRef: subject, evidenceRefs: [], effectiveAt: at });
  saves = 0;
  assert.throws(() => plane.v3.decide({ subjectRef: subject, claimRefs: [claim.claimId],
    action: 'payment.retry', outcome: 'DO_NOT_RETRY', consequential: true,
    policy: { id: 'money-v3', version: 3 } }), e => e.code === 'EVIDENCE_CAPACITY_REACHED');
  assert.equal(saves, 0, 'preflight faalt vóór save');
  assert.equal(Object.keys(state.v3.decisions).length, 0);
  assert.equal(Object.keys(state.v3.evidence).length, 0);
  assert.equal(state.ledger.length, 1);

  const goodState = {};
  let goodSaves = 0;
  const good = testPlane({ state: goodState, nu: () => at, save() { goodSaves++; } });
  const goodClaim = good.v3.derive({ profileId: 'money.settlement', profileVersion: 3,
    subjectRef: subject, evidenceRefs: [], effectiveAt: at });
  goodSaves = 0;
  good.v3.decide({ subjectRef: subject, claimRefs: [goodClaim.claimId], action: 'payment.retry',
    outcome: 'DO_NOT_RETRY', consequential: true, policy: { id: 'money-v3', version: 3 } });
  assert.equal(goodSaves, 1);
  assert.equal(goodState.ledger.length, 3, 'claim plus precies twee decision-ledgerregels');
  assert.equal(good.ledger.verify().ok, true);
});

test('twee ledger-appends op dezelfde boundary blijven uniek en vormen één geldige keten', () => {
  const root = { ledger: [], blobs: {} };
  let saves = 0;
  const transaction = maakCoordinator({ root, save() { saves++; }, nu: () => at });
  const ledger = maakLedger({ regels: root.ledger, blobs: root.blobs, transaction,
    save() { saves++; }, nu: () => at });
  transaction.atomic('ledger.double', () => {
    ledger.append({ boundary: 'trust:v3:test', kind: 'first' });
    ledger.append({ boundary: 'trust:v3:test', kind: 'second' });
  });
  assert.equal(saves, 1);
  assert.equal(root.ledger.length, 2);
  assert.notEqual(root.ledger[0].evidenceRecordId, root.ledger[1].evidenceRecordId);
  assert.equal(root.ledger[1].previousHash, root.ledger[0].hash);
  assert.equal(ledger.verify('trust:v3:test').ok, true);
});

test('V3-transactie weigert thenables vóór een commit', async () => {
  const root = {};
  const transaction = maakCoordinator({ root, save() { throw new Error('mag niet'); }, nu: () => at });
  assert.throws(() => transaction.atomic('async.invalid', () => Promise.resolve(true)),
    e => e.code === 'V3_TRANSACTION_ASYNC');
  assert.equal(transaction.snapshot().status, 'HEALTHY');
});

test('dynamische stateFor bindt Trust aan dezelfde PostgreSQL request-COW als businessdata', () => {
  let raw = { trustEvidence: {}, business: { count: 0 } };
  const db = {};
  Object.defineProperty(db, 'data', { get() { return verzoekcontext.dataVoor(raw); } });
  const save = () => verzoekcontext.noteerSave();
  configureRuntime({ stateFor: () => runtime.trustStaat(db.data), save, mode: 'shadow', nu: () => at });

  const failed = verzoekcontext.nieuw({ method: 'POST' });
  verzoekcontext.voer(failed, () => {
    db.data.business.count = 1; save();
    domain({ cents: 1000 }, 'PAY-PG-ROLLBACK');
    assert.equal(runtime.current().v3.snapshot().counts.evidence, 1);
    const concurrent = verzoekcontext.nieuw({ method: 'GET' });
    verzoekcontext.voer(concurrent, () => {
      assert.equal(db.data.business.count, 0);
      assert.equal(runtime.current().v3.snapshot().counts.evidence, 0,
        'een andere request ziet staged Trust niet');
    });
    verzoekcontext.sluit(concurrent);
  });
  verzoekcontext.sluit(failed);
  assert.equal(raw.business.count, 0);
  assert.equal(runtime.current().v3.snapshot().counts.evidence, 0);

  const success = verzoekcontext.nieuw({ method: 'POST' });
  verzoekcontext.voer(success, () => {
    db.data.business.count = 1; save();
    domain({ cents: 1000 }, 'PAY-PG-COMMIT');
    const changes = verzoekcontext.wijzigingen(success);
    assert.deepEqual(changes.map(x => x.sleutel), ['business', 'trustEvidence']);
    for (const change of changes) {
      if (change.waardeBestaat) raw[change.sleutel] = JSON.parse(change.waardeJson);
      else delete raw[change.sleutel];
    }
  });
  verzoekcontext.sluit(success);
  assert.equal(raw.business.count, 1);
  assert.equal(runtime.current().v3.snapshot().counts.evidence, 1);
});
