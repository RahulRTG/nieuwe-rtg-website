const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakEconomicRuntime } = require('../server/kern/economie/runtime');

function wereld() {
  let now = 1_787_990_400_000;
  const db = { data: {} };
  const runtime = maakEconomicRuntime({ db, save: () => {}, crypto, nu: () => ++now });
  return { db, runtime };
}

function golden(overrides) {
  return Object.assign({
    idempotencyKey: 'invoice:INV-100:capture:PAY-100',
    sourceRef: 'invoice:INV-100', principalRef: 'account:member-100', actingRef: 'account:member-100',
    purpose: 'MEMBERSHIP.CONTRIBUTION',
    requestedValue: { amountMinor: 10000, currency: 'EUR' },
    legalContext: { entityRef: 'entity:rtg-nl', settlementEntityRef: 'entity:rtg-settlement', jurisdiction: 'NL' },
    economicContext: { experienceWorld: 'LivingOS', domain: 'membership', capability: 'membership.pay' },
    pricingSnapshot: { priceId: 'price:membership-v1', grossMinor: 12100 },
    taxSnapshot: { policyId: 'tax:nl-vat', version: 'v1', vatMinor: 2100 },
    policyDecision: { decisionId: 'decision:allocation-v1-INV-100', policyId: 'policy:social-allocation',
      version: 'v1-2026', inputHash: 'sha256:input', decision: 'ALLOW', reasonCodes: ['MEMBERSHIP_REVENUE'] },
    authorizationContext: { authorityRef: 'authority:membership-contract-v1' },
    allocations: [
      { component: 'platform', beneficiaryRef: 'entity:rtg-platform', amountMinor: 7000,
        currency: 'EUR', mode: 'INTERNAL', ledgerAccount: 'revenue:rtg-platform' },
      { component: 'local-fund', beneficiaryRef: 'entity:local-fund', amountMinor: 2000,
        currency: 'EUR', mode: 'EXTERNAL' },
      { component: 'foundation', beneficiaryRef: 'entity:rtfoundation', amountMinor: 1000,
        currency: 'EUR', mode: 'EXTERNAL' }
    ],
    captureEvidence: { sourceRef: 'provider:stripe', externalRef: 'payment:pi-100',
      authenticity: 'PROVIDER_ASSERTED', payload: { amountMinor: 10000, currency: 'EUR' } }
  }, overrides || {});
}

async function leg(runtime, intentId, component, n) {
  const claim = runtime.claimVoor(intentId, component);
  const p = await runtime.planSettlement({ intentId, claimId: claim.id,
    destinationRef: 'destination:' + component, rail: 'SEPA', idempotencyKey: 'settlement:' + component + ':' + n });
  assert.equal(p.ok, true);
  await runtime.markSettlementSubmitted({ settlementId: p.settlement.id, operationId: 'BO-' + n, providerRef: 'payout:' + n });
  await runtime.markSettlementConfirmed({ settlementId: p.settlement.id, operationId: 'BO-' + n,
    providerRef: 'payout:' + n, sourceRef: 'provider:stripe' });
  return p.settlement.id;
}

test('Economic Runtime: een 70/20/10-intent maakt claims en twee sluitende ledger bundles', async () => {
  const { db, runtime } = wereld();
  const r = await runtime.registreerVerdeling(golden());
  assert.equal(r.ok, true);
  assert.equal(r.intent.state.authorization, 'AUTHORIZED');
  assert.equal(r.intent.state.financial, 'CAPTURED');
  assert.equal(r.intent.state.lifecycle, 'OPEN');
  assert.equal(runtime.claimVoor(r.intent.id, 'platform').status, 'SATISFIED');
  assert.equal(runtime.claimVoor(r.intent.id, 'local-fund').status, 'HELD');
  assert.equal(runtime.claimVoor(r.intent.id, 'foundation').status, 'HELD');

  const txs = Object.values(db.data.economischeRuntime.ledgerTransactions);
  assert.equal(txs.length, 3, 'capture, allocation en interne platform-erkenning');
  for (const tx of txs) assert.equal(tx.postings.reduce((s, p) => s + p.amountMinor, 0), 0);
  assert.equal(runtime.integriteit(r.intent.id).ok, true);
});

test('Economic Runtime: idempotency replayt exact dezelfde intent en weigert key-hergebruik', async () => {
  const { db, runtime } = wereld();
  const een = await runtime.registreerVerdeling(golden());
  const twee = await runtime.registreerVerdeling(golden());
  assert.equal(twee.replay, true);
  assert.equal(twee.intent.id, een.intent.id);
  assert.equal(Object.keys(db.data.economischeRuntime.intents).length, 1);
  const conflict = await runtime.registreerVerdeling(golden({ purpose: 'OTHER.PURPOSE' }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
});

test('Economic Runtime: intent wordt pas PROVEN na beide externe settlements en bankmatches', async () => {
  const { runtime } = wereld();
  const r = await runtime.registreerVerdeling(golden());
  const local = await leg(runtime, r.intent.id, 'local-fund', 'L');
  assert.equal(runtime.proof(r.intent.id).status, 'NOT_RECONCILED');
  const foundation = await leg(runtime, r.intent.id, 'foundation', 'F');

  let match = await runtime.reconcileSettlement({ settlementId: local, externalEntryRef: 'bank:entry-L',
    amountMinor: 2000, currency: 'EUR', sourceRef: 'bank:open-banking', authenticity: 'DIRECT_API',
    relatedSettlementRef: 'payout:L' });
  assert.equal(match.matched, true);
  assert.equal(runtime.proof(r.intent.id).intent.state.reconciliation, 'PARTIAL_MATCH');
  match = await runtime.reconcileSettlement({ settlementId: foundation, externalEntryRef: 'bank:entry-F',
    amountMinor: 1000, currency: 'EUR', sourceRef: 'bank:open-banking', authenticity: 'CRYPTOGRAPHIC',
    relatedSettlementRef: 'payout:F' });
  assert.equal(match.matched, true);
  const p = runtime.proof(r.intent.id);
  assert.equal(p.status, 'PROVEN');
  assert.equal(p.intent.state.lifecycle, 'COMPLETED');
  assert.equal(p.integrity.ok, true);
});

test('Economic Runtime: verkeerde bankregel opent een case en liegt niet met groen', async () => {
  const { runtime } = wereld();
  const r = await runtime.registreerVerdeling(golden());
  const local = await leg(runtime, r.intent.id, 'local-fund', 'BAD');
  const uit = await runtime.reconcileSettlement({ settlementId: local, externalEntryRef: 'bank:wrong',
    amountMinor: 1999, currency: 'EUR', sourceRef: 'bank:open-banking', authenticity: 'DIRECT_API',
    relatedSettlementRef: 'payout:BAD' });
  assert.equal(uit.matched, false);
  assert.equal(uit.exception.kind, 'RECONCILIATION_MISMATCH');
  assert.equal(runtime.proof(r.intent.id).status, 'DISPUTED');
  assert.equal(runtime.openCases(r.intent.id).length, 1);
});

test('Economic Runtime: mislukte rail blijft claimbaar en herstelt met een nieuwe poging', async () => {
  const { runtime } = wereld();
  const r = await runtime.registreerVerdeling(golden());
  const claim = runtime.claimVoor(r.intent.id, 'foundation');
  const p1 = await runtime.planSettlement({ intentId: r.intent.id, claimId: claim.id,
    destinationRef: 'destination:foundation', rail: 'SEPA', idempotencyKey: 'settlement:foundation:first' });
  const mis = await runtime.markSettlementFailed({ settlementId: p1.settlement.id,
    operationId: 'BO-FAIL', reason: 'bank unavailable', retryable: true });
  assert.equal(runtime.intent(r.intent.id).state.lifecycle, 'ATTENTION_REQUIRED');
  assert.equal(runtime.claimVoor(r.intent.id, 'foundation').status, 'PAYABLE');

  const p2 = await runtime.planSettlement({ intentId: r.intent.id, claimId: claim.id,
    destinationRef: 'destination:foundation', rail: 'SEPA', idempotencyKey: 'settlement:foundation:retry',
    recoveryCaseId: mis.case.id });
  await runtime.markSettlementConfirmed({ settlementId: p2.settlement.id, operationId: 'BO-OK',
    providerRef: 'payout:retry', sourceRef: 'provider:stripe' });
  await runtime.reconcileSettlement({ settlementId: p2.settlement.id, externalEntryRef: 'bank:retry',
    amountMinor: 1000, currency: 'EUR', sourceRef: 'bank:open-banking', authenticity: 'DIRECT_API',
    relatedSettlementRef: 'payout:retry' });
  assert.equal(runtime.openCases(r.intent.id).length, 0);
  assert.equal(runtime.intent(r.intent.id).state.recovery, 'COMPLETE');
});

test('Economic Runtime: privacy, valuta, balans en integriteit zijn fail-closed', async () => {
  const { db, runtime } = wereld();
  let r = await runtime.registreerVerdeling(golden({ principalRef: 'Rahul Imran' }));
  assert.equal(r.code, 'INVALID_REFERENCE');
  const scheef = golden(); scheef.allocations[0].amountMinor = 6999;
  r = await runtime.registreerVerdeling(scheef);
  assert.equal(r.code, 'UNBALANCED_ALLOCATION');

  r = await runtime.registreerVerdeling(golden());
  const tx = Object.values(db.data.economischeRuntime.ledgerTransactions)[0];
  tx.postings[0].amountMinor += 1;
  const i = runtime.integriteit(r.intent.id);
  assert.equal(i.ok, false);
  assert.match(i.errors.join(' '), /ledger/);
  assert.equal(runtime.proof(r.intent.id).status, 'FAILED');
});
