'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const B = require('../server/kern/revenue/commercial-binding-v1');

function bron(sourceRef) {
  return [{ file: 'server/kern/revenue/commercial-binding-v1.js',
    symbol: 'maak', sourceRef }];
}

function binding(extra) {
  const b = { schemaVersion: 1, contractId: B.CONTRACT_ID,
    contractVersion: B.CONTRACT_VERSION,
    scope: { kind: 'TENANT', accountRef: 'account-a', tenantRef: 'tenant-a' },
    product: { productId: 'rtg.ai.extra-s', productVersion: 1,
      offerId: 'rtg.offer.ai.extra-s', offerVersion: 1 },
    amount: { centen: 200, currency: 'EUR' },
    paymentTruthRef: 'BW-EXACT-001', ledgerRef: 'PB-EXACT-001',
    provenance: bron('commercial:exact-001') };
  return Object.assign(b, extra || {});
}

function records(b) {
  return {
    paymentTruth: { id: b.paymentTruthRef, centen: b.amount.centen,
      valuta: b.amount.currency.toLowerCase(), context: { commercialBindingV1: b } },
    ledger: { id: b.ledgerRef, ref: b.paymentTruthRef, centen: b.amount.centen,
      currency: b.amount.currency, commercialBindingV1: JSON.parse(JSON.stringify(b)) }
  };
}

test('1. de getypepte commerciële binding is diep immutable en draagt alle identiteiten', () => {
  const uit = B.maak(binding());
  assert.equal(Object.isFrozen(uit), true);
  assert.equal(Object.isFrozen(uit.scope), true);
  assert.equal(Object.isFrozen(uit.product), true);
  assert.equal(Object.isFrozen(uit.amount), true);
  assert.equal(Object.isFrozen(uit.provenance[0]), true);
  assert.deepEqual(uit.scope, { kind: 'TENANT', accountRef: 'account-a', tenantRef: 'tenant-a' });
  assert.deepEqual(uit.product, { productId: 'rtg.ai.extra-s', productVersion: 1,
    offerId: 'rtg.offer.ai.extra-s', offerVersion: 1 });
  assert.deepEqual(uit.amount, { centen: 200, currency: 'EUR' });
  assert.equal(uit.paymentTruthRef, 'BW-EXACT-001');
  assert.equal(uit.ledgerRef, 'PB-EXACT-001');
});

test('2. ontbrekende, ongeldige en extra velden worden exact benoemd', () => {
  const incompleet = binding();
  delete incompleet.product.offerVersion;
  let oordeel = B.inspecteer(incompleet);
  assert.equal(oordeel.code, 'COMMERCIAL_BINDING_INCOMPLETE');
  assert.ok(oordeel.missingFields.includes('product.offerVersion'));

  oordeel = B.inspecteer(binding({ amount: { centen: 0, currency: 'eur', extra: true } }));
  assert.equal(oordeel.code, 'COMMERCIAL_BINDING_EXTRA_FIELDS');
  assert.ok(oordeel.invalidFields.includes('amount.centen'));
  assert.ok(oordeel.invalidFields.includes('amount.currency'));
  assert.ok(oordeel.extraFields.includes('amount.extra'));
});

test('3. ACCOUNT en TENANT zijn gescheiden en een tenant kan niet stil verdwijnen', () => {
  const account = binding({ scope: { kind: 'ACCOUNT', accountRef: 'account-a', tenantRef: null } });
  assert.equal(B.inspecteer(account).ok, true);
  assert.equal(B.inspecteer(binding({ scope: { kind: 'ACCOUNT', accountRef: 'account-a', tenantRef: 'tenant-a' } })).ok, false);
  assert.equal(B.inspecteer(binding({ scope: { kind: 'TENANT', accountRef: 'account-a', tenantRef: null } })).ok, false);
});

test('4. huidige ongebonden Payment Truth- en RTG Pay-records blijven fail-closed', () => {
  const uit = B.uitFinancieleRecords({
    paymentTruth: { id: 'BW-RAW-001', actor: 'pay:Gouden Ibis', centen: 200,
      valuta: 'eur', context: { userId: 'account-a' } },
    ledger: { id: 'PB-RAW-001', van: 'extern:oplaad', naar: 'lid:Gouden Ibis',
      centen: 200, soort: 'oplaad', ref: 'BW-RAW-001', at: 1 }
  });
  assert.equal(uit.ok, false);
  assert.equal(uit.code, 'COMMERCIAL_BINDING_NOT_STORED');
  assert.deepEqual(uit.missingFields, [
    'ledger.commercialBindingV1', 'ledger.currency',
    'paymentTruth.context.commercialBindingV1'
  ]);
  assert.equal(uit.eligibilityReady, false);
  assert.equal(uit.reconciliation, 'TRANSACTION_SPECIFIC_REQUIRED');
});

test('5. alleen twee identieke opgeslagen bindings en dezelfde financiële refs koppelen', () => {
  const b = binding(), uit = B.uitFinancieleRecords(records(b));
  assert.equal(uit.ok, true);
  assert.equal(uit.code, 'COMMERCIAL_BINDING_VERIFIED');
  assert.deepEqual(uit.binding, B.maak(b));
  assert.equal(uit.eligibilityReady, false);
  assert.equal(uit.reconciliation, 'TRANSACTION_SPECIFIC_REQUIRED');
});

test('6. account-, tenant-, product-, versie-, bedrag-, valuta- en refdrift sluiten', () => {
  const veranderingen = [
    r => { r.ledger.commercialBindingV1.scope.accountRef = 'account-b'; },
    r => { r.ledger.commercialBindingV1.scope.tenantRef = 'tenant-b'; },
    r => { r.ledger.commercialBindingV1.product.productId = 'ander-product'; },
    r => { r.ledger.commercialBindingV1.product.productVersion = 2; },
    r => { r.ledger.commercialBindingV1.product.offerVersion = 2; },
    r => { r.paymentTruth.centen += 1; },
    r => { r.ledger.currency = 'USD'; },
    r => { r.ledger.ref = 'BW-ANDERS'; }
  ];
  for (const verander of veranderingen) {
    const r = records(binding()); verander(r);
    const uit = B.uitFinancieleRecords(r);
    assert.equal(uit.ok, false);
    assert.equal(uit.code, 'COMMERCIAL_BINDING_MISMATCH');
    assert.ok(uit.mismatches.length > 0);
  }
});

test('7. reconciliation wordt niet in de binding verzonnen of als gereed gemeld', () => {
  const uit = B.uitFinancieleRecords(records(binding()));
  assert.equal(Object.prototype.hasOwnProperty.call(uit.binding, 'reconciliationRef'), false);
  assert.equal(uit.reconciliation, 'TRANSACTION_SPECIFIC_REQUIRED');
  assert.equal(uit.eligibilityReady, false);
});

test('8. de adapter heeft geen route, opslag, aankoop, grant of financiële mutatie', () => {
  assert.deepEqual(Object.keys(B).sort(), [
    'CONTRACT_ID', 'CONTRACT_VERSION', 'LEDGER_FIELD', 'PAYMENT_FIELD',
    'inspecteer', 'maak', 'uitFinancieleRecords', 'zelfde'
  ]);
  const bestand = path.join(__dirname, '../server/kern/revenue/commercial-binding-v1.js');
  const code = fs.readFileSync(bestand, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(code, /\bdb\b|db\.data|eigencollectie|\bsave\s*\(/);
  assert.doesNotMatch(code, /\bapp\.(get|post|put|delete)\b|req\.session/);
  assert.doesNotMatch(code, /grant|activeer|koop|abonnement|refund/i);
});
