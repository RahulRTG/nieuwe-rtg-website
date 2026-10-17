/* De payment-entitlementbeslissing blijft intern en read-only. Deze toets toont
   zowel het toekomstige exacte contract als waarom de huidige ruwe bronnen er
   niet zonder een echte serveradapter aan voldoen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const C = require('../server/kern/revenue/catalogus-v1');
const E = require('../server/kern/revenue/entitlement-eligibility-v1');

const ACCOUNT = 'account-a';
const TENANT = 'tenant-a';
const INSTEL = { inkoopCentenPer1000: 20 };

function catalogus(koopbaar) {
  const uit = JSON.parse(JSON.stringify(C.projecteerAiExtraS(INSTEL)));
  uit.products[0].availability = { catalogVisible: true, purchasable: koopbaar === true,
    reason: koopbaar === true ? null : 'Catalogusproef blijft gesloten.' };
  return uit;
}

function binding(context, extra) {
  return { verified: true, actorAccountRef: context.actorAccountRef,
    subjectAccountRef: context.subjectAccountRef, scopeKind: context.scopeKind,
    targetRef: context.targetRef, provenance: 'bestaande-account-tenantdeur',
    accountState: { active: true, revokedAt: null }, ...(extra || {}) };
}

function vraag(extra) {
  return { actorAccountRef: ACCOUNT, subjectAccountRef: ACCOUNT,
    scopeKind: 'TENANT', targetRef: TENANT, productId: C.PRODUCT_ID, ...(extra || {}) };
}

function bron(file, symbol, sourceRef) { return [{ file, symbol, sourceRef }]; }

function bewijs(wijzig) {
  const product = catalogus(true).products[0];
  const b = {
    schemaVersion: 1, adapterId: E.adapterContract.ADAPTER_ID,
    adapterVersion: E.adapterContract.ADAPTER_VERSION,
    scope: { kind: 'TENANT', accountRef: ACCOUNT, tenantRef: TENANT },
    product: { productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion },
    payment: { paymentTruthRef: 'BW-EXACT-001', accountRef: ACCOUNT, tenantRef: TENANT,
      productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion,
      status: 'BEVESTIGD', amountCenten: product.price.amountCenten,
      currency: product.price.currency, refundedCenten: 0, reversalState: 'NONE',
      settledAt: '2026-10-16T10:00:00.000Z' },
    ledger: { ledgerRef: 'PB-EXACT-001', paymentTruthRef: 'BW-EXACT-001',
      accountRef: ACCOUNT, tenantRef: TENANT, productId: product.productId,
      productVersion: product.productVersion, offerId: product.offerId,
      offerVersion: product.offerVersion, status: 'POSTED',
      amountCenten: product.price.amountCenten, currency: product.price.currency,
      reversalState: 'NONE' },
    reconciliation: { reconciliationRef: 'REC-EXACT-001', paymentTruthRef: 'BW-EXACT-001',
      ledgerRef: 'PB-EXACT-001', accountRef: ACCOUNT, tenantRef: TENANT,
      productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion,
      status: 'MATCHED', amountCenten: product.price.amountCenten,
      currency: product.price.currency, uncertainty: 'NONE',
      reconciledAt: '2026-10-16T10:05:00.000Z' },
    provenance: {
      adapter: bron('server/kern/revenue/payment-adapter.js', 'voorEntitlement', 'adapter:exact-1'),
      paymentTruth: bron('server/kern/betaalwaarheid/index.js', 'vanActor', 'BW-EXACT-001'),
      ledger: bron('server/kern/pay/kijken.js', 'boekingenVan', 'PB-EXACT-001'),
      reconciliation: bron('server/kern/pay/reconciliation.js', 'voorBoeking', 'REC-EXACT-001')
    }
  };
  if (wijzig) wijzig(b);
  return b;
}

function beslissing(opties) {
  const o = opties || {};
  return E.maakEntitlementEligibilityV1({
    bindingVoor: context => o.binding ? o.binding(context) : binding(context),
    catalogusVoor: () => o.catalogus || catalogus(true),
    bewijsVoor: o.geenAdapter ? undefined : () => o.bewijs || bewijs()
  });
}

test('1. de huidige catalogus blijft gesloten en leest daarom geen betaalbron', () => {
  let gelezen = 0;
  const d = E.maakEntitlementEligibilityV1({ bindingVoor: context => binding(context),
    bewijsVoor() { gelezen += 1; return bewijs(); } });
  const uit = d.beslis(vraag({ pricingSettings: INSTEL }));
  assert.equal(uit.decision.eligibility, 'DENIED');
  assert.equal(uit.decision.denial.code, 'PRODUCT_NOT_PURCHASABLE');
  assert.equal(gelezen, 0);
  assert.deepEqual(uit.effects, { eligibleOnly: true, granted: false,
    revoked: false, mutated: false, financial: false });
});

test('2. alleen een volledig exact gebonden, geboekte en gereconcilieerde betaling is eligible', () => {
  const uit = beslissing().beslis(vraag());
  assert.equal(uit.decision.eligibility, 'ELIGIBLE');
  assert.equal(uit.decision.denial, null);
  assert.equal(uit.decision.lifecycle.payment, 'BEVESTIGD');
  assert.equal(uit.decision.lifecycle.ledger, 'POSTED');
  assert.equal(uit.decision.lifecycle.reconciliation, 'MATCHED');
  assert.deepEqual(uit.decision.facts, {
    productId: C.PRODUCT_ID, productVersion: 1,
    offerId: C.OFFER_ID, offerVersion: 1,
    paymentTruthRef: 'BW-EXACT-001', ledgerRef: 'PB-EXACT-001',
    reconciliationRef: 'REC-EXACT-001', amountCenten: 200, currency: 'EUR'
  });
  assert.equal(uit.decision.source.provenance.paymentTruth[0].sourceRef, 'BW-EXACT-001');
  assert.equal(Object.isFrozen(uit), true);
});

test('3. ontbrekende adapter rapporteert alle exacte bindvelden en blijft dicht', () => {
  const uit = beslissing({ geenAdapter: true }).beslis(vraag());
  assert.equal(uit.decision.eligibility, 'DENIED');
  assert.equal(uit.decision.denial.code, 'PAYMENT_BINDING_ADAPTER_UNAVAILABLE');
  for (const veld of ['payment.productId', 'payment.accountRef', 'ledger.paymentTruthRef',
    'ledger.productId', 'reconciliation.paymentTruthRef', 'reconciliation.ledgerRef',
    'reconciliation.productId', 'reconciliation.accountRef', 'reconciliation.tenantRef'])
    assert.ok(uit.decision.denial.missingFields.includes(veld), veld);
});

test('4. refund, reversal en refund-onzekerheid ontzeggen met hun eigen reden', () => {
  const gevallen = [
    [b => { b.payment.status = 'TERUGBETAALD'; b.payment.refundedCenten = b.payment.amountCenten; },
      'PAYMENT_REFUNDED'],
    [b => { b.payment.reversalState = 'REVERSED'; }, 'PAYMENT_REVERSED'],
    [b => { b.payment.status = 'TERUGBETALING_WACHT'; }, 'PAYMENT_REFUND_PENDING'],
    [b => { b.ledger.reversalState = 'REVERSED'; }, 'LEDGER_REVERSED']
  ];
  for (const [maak, code] of gevallen) {
    const b = bewijs(maak), uit = beslissing({ bewijs: b }).beslis(vraag());
    assert.equal(uit.decision.eligibility, 'DENIED');
    assert.equal(uit.decision.denial.code, code);
    assert.equal(uit.effects.granted, false);
  }
});

test('5. niet-settled, niet-geboekt of onzekere reconciliation blijft dicht', () => {
  const gevallen = [
    [b => { b.payment.status = 'IN_BEHANDELING'; }, 'PAYMENT_NOT_SETTLED'],
    [b => { b.ledger.status = 'PENDING'; }, 'LEDGER_NOT_POSTED'],
    [b => { b.reconciliation.status = 'PENDING'; }, 'RECONCILIATION_UNCERTAIN'],
    [b => { b.reconciliation.uncertainty = 'UNKNOWN_PROVIDER_OUTCOME'; }, 'RECONCILIATION_UNCERTAIN']
  ];
  for (const [maak, code] of gevallen)
    assert.equal(beslissing({ bewijs: bewijs(maak) }).beslis(vraag()).decision.denial.code, code);
});

test('6. account-, tenant-, product-, bedrag- en refmismatches sluiten voor B2B2C', () => {
  const veranderingen = [
    b => { b.payment.accountRef = 'account-b'; },
    b => { b.ledger.tenantRef = 'tenant-b'; },
    b => { b.reconciliation.productId = 'ander-product'; },
    b => { b.payment.amountCenten += 1; },
    b => { b.payment.refundedCenten = -1; },
    b => { b.reconciliation.paymentTruthRef = 'BW-ANDERS'; },
    b => { b.reconciliation.ledgerRef = 'PB-ANDERS'; }
  ];
  for (const verander of veranderingen) {
    const uit = beslissing({ bewijs: bewijs(verander) }).beslis(vraag());
    assert.equal(uit.decision.denial.code, 'BINDING_CONTRACT_MISMATCH');
    assert.ok(uit.decision.denial.mismatches.length > 0);
    assert.equal(uit.decision.facts.paymentTruthRef, undefined);
  }
});

test('7. B2C gebruikt dezelfde keten zonder een verzonnen tenantref', () => {
  const b = bewijs(x => {
    x.scope.kind = 'ACCOUNT'; x.scope.tenantRef = null;
    x.payment.tenantRef = null; x.ledger.tenantRef = null; x.reconciliation.tenantRef = null;
  });
  const uit = beslissing({ bewijs: b }).beslis(vraag({ scopeKind: 'ACCOUNT', targetRef: ACCOUNT }));
  assert.equal(uit.decision.eligibility, 'ELIGIBLE');
});

test('8. de werkelijke ruwe bronvormen missen aantoonbaar de product- en reconciliationbinding', () => {
  const doos = {};
  const maak = require('../server/kern/betaalwaarheid/aanmaken')({
    doos: () => doos, hash: v => 'hash:' + v, idVan: () => 'BW-RAW-001',
    nuIso: () => '2026-10-16T10:00:00.000Z',
    gebeurtenis(r) { r.gebeurtenissen.push({ zegel: 'raw' }); }, save() {},
    STATUS: { AANGEMAAKT: 'AANGEMAAKT' }
  });
  const payment = maak({ actor: 'pay:Gouden Ibis', idem: 'raw', soort: 'pay-oplaad',
    bronRef: 'Gouden Ibis', centen: 900, valuta: 'eur', context: { userId: 'account-a' } });
  const boekingenVan = require('../server/kern/pay/kijken')({
    saldi: () => ({}), grootboek: () => [{ id: 'PB-RAW-001', van: 'extern:oplaad',
      naar: 'lid:Gouden Ibis', centen: 900, soort: 'oplaad', ref: payment.id, at: 1 }],
    keyVanCodenaam() {}, sseToCustomer() {}, schaduw: { aan: false, stand() {} }
  }).boekingenVan;
  const afstemming = require('../server/kern/pay/bewijs')({ d: () => ({ payAfstemming: { op: 1 } }),
    saldi: () => ({}), grootboek: () => [], saldoVan() {}, waarde: null, nu: () => 1
  }).bewijsbord().controles.find(x => x.id === 'afstemming');
  const raw = { payment, ledger: boekingenVan('lid:Gouden Ibis')[0], reconciliation: afstemming };
  const gekeurd = E.adapterContract.inspecteer(raw, { scopeKind: 'TENANT', accountRef: ACCOUNT,
    tenantRef: TENANT, productId: C.PRODUCT_ID, productVersion: 1,
    offerId: C.OFFER_ID, offerVersion: 1, amountCenten: 900, currency: 'EUR' });
  assert.equal(gekeurd.code, 'BINDING_CONTRACT_INCOMPLETE');
  for (const veld of ['product.productId', 'payment.paymentTruthRef', 'payment.productId',
    'ledger.ledgerRef', 'ledger.productId', 'reconciliation.reconciliationRef',
    'reconciliation.paymentTruthRef', 'reconciliation.ledgerRef',
    'reconciliation.productId', 'reconciliation.accountRef'])
    assert.ok(gekeurd.missingFields.includes(veld), veld);
});

test('9. de projectie bevat geen route, opslag, grant of financiële mutatie', () => {
  assert.deepEqual(Object.keys(beslissing()), ['beslis']);
  assert.deepEqual(Object.keys(E).filter(k => /grant|revoke|zet|koop|betaal|activeer/i.test(k)), []);
  for (const bestand of [
    path.join(__dirname, '../server/kern/revenue/entitlement-eligibility-v1.js'),
    path.join(__dirname, '../server/kern/revenue/entitlement-eligibility-v1/contract.js')
  ]) {
    const broncode = fs.readFileSync(bestand, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
    assert.doesNotMatch(broncode, /\bdb\b|db\.data|eigencollectie|\bsave\s*\(/);
    assert.doesNotMatch(broncode, /\bapp\.(get|post|put|delete)\b|req\.session/);
  }
});
