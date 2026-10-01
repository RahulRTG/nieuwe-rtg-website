'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPlane } = require('../server/kern/bewijsvlak');
const runtime = require('../server/kern/bewijsvlak/runtime');
const moneyHook = require('../server/kern/bewijsvlak/v3-money-hook');
const externalHook = require('../server/kern/bewijsvlak/v3-external-hook');
const authorityHook = require('../server/kern/bewijsvlak/v3-authority-hook');
const Consent = require('../server/kern/connection-consent');

const at = '2026-09-30T10:00:00.000Z';
const subject = { domain: 'money', type: 'payment', id: 'PAY-1' };

function basis(factType, truthClass, scope, value, extra) {
  return { factType, truthClass, subjectRef: subject, protocol: factType.includes('settled') ? 'SETTLEMENT' : 'CONFIRMATION',
    source: { type: truthClass === 'EXTERNAL' ? 'stripe-webhook' : 'rtg-ledger', ref: truthClass === 'EXTERNAL' ? 'stripe' : 'pay' },
    authority: { id: truthClass === 'EXTERNAL' ? 'stripe' : 'rtg:pay', scopes: [scope],
      basis: truthClass === 'EXTERNAL' ? 'verified-webhook' : 'domain-owner', validFrom: at },
    observedAt: at, effectiveFrom: at, causality: { correlationId: 'chain-pay-1' },
    operation: { domain: 'money', capability: 'payment.authorize', name: factType, attempt: 1,
      provider: truthClass === 'EXTERNAL' ? 'stripe' : null }, value, ...(extra || {}) };
}

test('V3 leidt een reproduceerbare reconciled claim af uit drie bevoegde waarheden', () => {
  const plane = maakPlane({ state: {}, nu: () => at }), v3 = plane.v3;
  const ledger = v3.record(basis('payment.ledger.posted', 'DOMAIN', 'payment.ledger', { cents: 1000 }));
  const provider = v3.record(basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 1000 }));
  const match = v3.record(basis('payment.reconciliation.matched', 'DOMAIN', 'payment.reconcile', { matched: true }));
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [provider.evidenceId, ledger.evidenceId, match.evidenceId], effectiveAt: at, derivedAt: at });
  assert.equal(claim.finality, 'RECONCILED');
  assert.equal(claim.completeness.missing.length, 0);
  assert.equal(v3.reproduce(claim.claimId).ok, true);
  assert.match(claim.requirementProfile.digest, /^[a-f0-9]{64}$/);
  assert.match(claim.resolver.artifactDigest, /^[a-f0-9]{64}$/);
});

test('afwezig of onbevoegd providerbewijs wordt nooit betaalwaarheid', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const ledger = v3.record(basis('payment.ledger.posted', 'DOMAIN', 'payment.ledger', { cents: 1000 }));
  const vals = v3.record(basis('payment.provider.settled', 'EXTERNAL', 'wrong.scope', { cents: 1000 }));
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [ledger.evidenceId, vals.evidenceId], effectiveAt: at });
  assert.equal(claim.finality, 'SOURCE_ATTESTED');
  assert.ok(claim.completeness.missing.some(x => x.requirementId === 'provider-settlement'));
  assert.deepEqual(claim.completeness.unauthorized, [vals.evidenceId]);
});

test('authority is temporeel: verlopen bevoegdheid telt na intrekking niet meer', () => {
  const later = '2026-09-30T10:02:00.000Z', v3 = maakPlane({ state: {}, nu: () => later }).v3;
  const provider = v3.record(basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 1000 },
    { authority: { id: 'stripe', scopes: ['payment.settlement'], basis: 'verified-webhook', validFrom: at,
      validUntil: '2026-09-30T10:01:00.000Z' } }));
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [provider.evidenceId], effectiveAt: later });
  assert.equal(claim.finality, 'UNKNOWN');
  assert.ok(claim.completeness.unauthorized.includes(provider.evidenceId));
});

test('UNKNOWN blokkeert een blinde retry en produceert wel immutable decision evidence', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3,
    subjectRef: subject, evidenceRefs: [], effectiveAt: at });
  assert.equal(claim.finality, 'UNKNOWN');
  assert.throws(() => v3.decide({ subjectRef: subject, claimRefs: [claim.claimId], action: 'payment.retry',
    outcome: 'RETRY', consequential: true }), /onzeker bewijs/);
  const result = v3.decide({ subjectRef: subject, claimRefs: [claim.claimId], action: 'payment.retry',
    outcome: 'DO_NOT_RETRY', consequential: true, policy: { id: 'money-v3', version: 3 } });
  assert.equal(result.decision.outcome, 'DO_NOT_RETRY');
  assert.equal(result.decisionEvidence.factType, 'decision.recorded');
  assert.equal(result.decisionEvidence.subjectRef.id, result.decision.decisionId,
    'besluitbewijs bewijst het besluit en niet de betaling');
});

test('finality loopt niet stil terug en correctie herschrijft geschiedenis niet', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const facts = [
    v3.record(basis('payment.ledger.posted', 'DOMAIN', 'payment.ledger', { cents: 1000 })),
    v3.record(basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 1000 })),
    v3.record(basis('payment.reconciliation.matched', 'DOMAIN', 'payment.reconcile', { matched: true }))
  ];
  const settled = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: facts.map(x => x.evidenceId), effectiveAt: at });
  assert.throws(() => v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [facts[0].evidenceId], effectiveAt: at, previousClaimId: settled.claimId }), /niet stil teruglopen/);
  const reversed = v3.record(basis('payment.reversed', 'EXTERNAL', 'payment.settlement', { reversed: true }));
  const correction = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [...facts.map(x => x.evidenceId), reversed.evidenceId], effectiveAt: at, previousClaimId: settled.claimId });
  assert.equal(correction.finality, 'REVERSED');
  assert.equal(v3.claim(settled.claimId).finality, 'RECONCILED');
});

test('conflicterend bewijs wordt DISPUTED en opent geen succespad', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const a = v3.record(basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 1000 }));
  const b = v3.record(basis('payment.provider.settled', 'EXTERNAL', 'payment.settlement', { cents: 2000 },
    { source: { type: 'stripe-lookup', ref: 'stripe' } }));
  const claim = v3.derive({ profileId: 'money.settlement', profileVersion: 3, subjectRef: subject,
    evidenceRefs: [a.evidenceId, b.evidenceId], effectiveAt: at });
  assert.equal(claim.finality, 'DISPUTED');
  assert.equal(v3.snapshot().counts.conflicts, 1);
});

test('money-pilot vertaalt onzekere uitkomst naar DO_NOT_RETRY plus reconciliation', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const domain = v3.pilots.moneyEvidence({ factType: 'payment.ledger.posted', truthClass: 'DOMAIN',
    scope: 'payment.ledger', protocol: 'COMMITMENT', subjectRef: subject, value: { cents: 1000 }, correlationId: 'chain-pilot' });
  const result = v3.pilots.assessMoney({ subjectRef: subject, evidenceRefs: [domain.evidenceId],
    correlationId: 'chain-pilot' });
  assert.equal(result.claim.finality, 'SOURCE_ATTESTED');
  assert.equal(result.decision.decision.outcome, 'DO_NOT_RETRY');
  assert.equal(result.reconciliation.state, 'REQUESTED');
});

test('authority revocation vereist zowel domeinfeit als propagatiebewijs', () => {
  const v3 = maakPlane({ state: {}, nu: () => at }).v3;
  const s = { domain: 'authority', type: 'consent', id: 'CONSENT-1' };
  const revoked = v3.pilots.authorityEvidence({ factType: 'authority.revoked', truthClass: 'DOMAIN',
    scope: 'authority.revoke', subjectRef: s, value: { state: 'REVOKED' }, correlationId: 'chain-consent' });
  const first = v3.derive({ profileId: 'authority.revocation', profileVersion: 3, subjectRef: s,
    evidenceRefs: [revoked.evidenceId], effectiveAt: at });
  assert.equal(first.finality, 'SOURCE_ATTESTED');
  const propagated = v3.pilots.authorityEvidence({ factType: 'authority.revocation.propagated', truthClass: 'TECHNICAL',
    scope: 'authority.propagate', subjectRef: s, value: { consumers: 'all' }, correlationId: 'chain-consent' });
  const complete = v3.derive({ profileId: 'authority.revocation', profileVersion: 3, subjectRef: s,
    evidenceRefs: [revoked.evidenceId, propagated.evidenceId], effectiveAt: at, previousClaimId: first.claimId });
  assert.equal(complete.finality, 'CROSS_VERIFIED');
});

test('Money Integrity-pilot hangt aan de echte betaalwaarheidgrens', () => {
  const state = {}; runtime.configure({ state, mode: 'shadow', nu: () => at });
  const result = moneyHook.confirmed({ id: 'BW-PILOT-1', bijgewerktAt: at, status: 'BEVESTIGD',
    provider: 'stripe', providerStatus: 'succeeded', providerId: 'cs_1', providerPaymentId: 'pi_1',
    centen: 1250, valuta: 'eur' }, 'evt_1');
  assert.equal(result.claim.finality, 'SOURCE_ATTESTED',
    'een provider-event en domeinboeking zijn nog geen onafhankelijke reconciliatie');
  assert.equal(result.decision.decision.outcome, 'DO_NOT_RETRY');
  assert.equal(result.reconciliation.state, 'REQUESTED');
  assert.ok(result.claim.completeness.missing.some(x => x.requirementId === 'reconciliation-match'));
  assert.equal(runtime.current().v3.reproduce(result.claim.claimId).ok, true);
  assert.equal(JSON.stringify(state).includes('pi_1'), false, 'V3 bewaart alleen digests en refs, geen providerpayload');
});

test('External Dependency-pilot noemt bevestiging zonder outcome nog niet fulfilled', () => {
  const state = {}; runtime.configure({ state, mode: 'shadow', nu: () => at });
  const ref = 'vonk:M1:reservation';
  const committed = externalHook.reservation('commitment', { reservationRef: ref, provider: 'SUP-1', at,
    value: { date: '2026-10-01' } });
  const confirmed = externalHook.reservation('confirmed', { reservationRef: ref, provider: 'SUP-1', at,
    value: { providerReservationRef: 'R-1' } });
  const claim = externalHook.assess(ref, [committed.evidenceId, confirmed.evidenceId], at);
  assert.equal(claim.finality, 'SOURCE_ATTESTED');
  assert.ok(claim.completeness.missing.some(x => x.requirementId === 'operational-outcome'));
});

test('Authority-pilot sluit revoke en propagatie via de echte consentprimitive', () => {
  const state = {}; runtime.configure({ state, mode: 'shadow', nu: () => at });
  const binding = { actor: 'A', counterpart: 'B', purpose: 'vonk.communication',
    capability: 'connection.voice', scope: 'MATCH-1', version: 1 };
  const ledger = {};
  Consent.revoke(ledger, binding, { at });
  const result = authorityHook.propagated(binding, at, { activeSessionsClosed: 1, storageRevision: 1 });
  assert.equal(result.claim.finality, 'CROSS_VERIFIED');
  assert.equal(JSON.stringify(state).includes('counterpart'), false, 'actoridentiteiten blijven buiten het bewijsvlak');
});
