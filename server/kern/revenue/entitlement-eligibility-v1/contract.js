/* Het getypepte koppelvlak tussen catalogus, Payment Truth, RTG Pay en een
   transactiespecifieke reconciliation. Bestaande ruwe bronvormen voldoen hier
   nog niet aan; een toekomstige serveradapter moet de velden exact binden. */
'use strict';

const ADAPTER_ID = 'rtg.revenue.product-payment-binding';
const ADAPTER_VERSION = '1.0.0';

const BASISVELDEN = Object.freeze([
  'schemaVersion', 'adapterId', 'adapterVersion',
  'scope.kind', 'scope.accountRef',
  'product.productId', 'product.productVersion', 'product.offerId', 'product.offerVersion',
  'payment.paymentTruthRef', 'payment.accountRef',
  'payment.productId', 'payment.productVersion', 'payment.offerId', 'payment.offerVersion',
  'payment.status', 'payment.amountCenten', 'payment.currency', 'payment.refundedCenten',
  'payment.reversalState', 'payment.settledAt',
  'ledger.ledgerRef', 'ledger.paymentTruthRef', 'ledger.accountRef',
  'ledger.productId', 'ledger.productVersion', 'ledger.offerId', 'ledger.offerVersion',
  'ledger.status', 'ledger.amountCenten', 'ledger.currency', 'ledger.reversalState',
  'reconciliation.reconciliationRef', 'reconciliation.paymentTruthRef',
  'reconciliation.ledgerRef', 'reconciliation.accountRef',
  'reconciliation.productId', 'reconciliation.productVersion',
  'reconciliation.offerId', 'reconciliation.offerVersion',
  'reconciliation.status', 'reconciliation.amountCenten', 'reconciliation.currency',
  'reconciliation.uncertainty', 'reconciliation.reconciledAt',
  'provenance.adapter', 'provenance.paymentTruth', 'provenance.ledger',
  'provenance.reconciliation'
]);

const TENANTVELDEN = Object.freeze([
  'scope.tenantRef', 'payment.tenantRef', 'ledger.tenantRef', 'reconciliation.tenantRef'
]);

function tekst(v) { return String(v == null ? '' : v).trim(); }

function haal(obj, pad) {
  let huidig = obj;
  for (const deel of pad.split('.')) {
    if (!huidig || !Object.prototype.hasOwnProperty.call(huidig, deel)) return undefined;
    huidig = huidig[deel];
  }
  return huidig;
}

function ontbreekt(v) {
  return v === undefined || v === null || (typeof v === 'string' && !tekst(v));
}

function provenanceKlopt(lijst) {
  return Array.isArray(lijst) && lijst.length > 0 && lijst.every(p => p &&
    tekst(p.file) && tekst(p.symbol) && tekst(p.sourceRef));
}

function veldenVoor(scopeKind) {
  return Object.freeze([...BASISVELDEN, ...(scopeKind === 'TENANT' ? TENANTVELDEN : [])]);
}

function inspecteer(snapshot, verwacht) {
  const s = snapshot || {};
  const scopeKind = tekst(haal(s, 'scope.kind')) || tekst(verwacht && verwacht.scopeKind);
  const missingFields = veldenVoor(scopeKind).filter(pad => ontbreekt(haal(s, pad)));
  for (const pad of ['provenance.adapter', 'provenance.paymentTruth',
    'provenance.ledger', 'provenance.reconciliation']) {
    const i = missingFields.indexOf(pad);
    if (i < 0 && !provenanceKlopt(haal(s, pad))) missingFields.push(pad);
  }
  if (missingFields.length) return { ok: false, code: 'BINDING_CONTRACT_INCOMPLETE',
    missingFields: [...new Set(missingFields)].sort(), mismatches: [] };

  const e = verwacht || {}, mismatches = [];
  const gelijk = (pad, waarde) => {
    const gezien = haal(s, pad);
    if (gezien !== waarde) mismatches.push({ field: pad, expected: waarde, actual: gezien });
  };
  gelijk('schemaVersion', 1); gelijk('adapterId', ADAPTER_ID); gelijk('adapterVersion', ADAPTER_VERSION);
  gelijk('scope.kind', e.scopeKind); gelijk('scope.accountRef', e.accountRef);
  if (e.scopeKind === 'TENANT') gelijk('scope.tenantRef', e.tenantRef);
  for (const veld of ['productId', 'productVersion', 'offerId', 'offerVersion']) {
    gelijk('product.' + veld, e[veld]);
    gelijk('payment.' + veld, e[veld]);
    gelijk('ledger.' + veld, e[veld]);
    gelijk('reconciliation.' + veld, e[veld]);
  }
  for (const bron of ['payment', 'ledger', 'reconciliation']) {
    gelijk(bron + '.accountRef', e.accountRef);
    if (e.scopeKind === 'TENANT') gelijk(bron + '.tenantRef', e.tenantRef);
    gelijk(bron + '.amountCenten', e.amountCenten);
    gelijk(bron + '.currency', e.currency);
  }
  gelijk('ledger.paymentTruthRef', s.payment.paymentTruthRef);
  gelijk('reconciliation.paymentTruthRef', s.payment.paymentTruthRef);
  gelijk('reconciliation.ledgerRef', s.ledger.ledgerRef);
  if (!Number.isSafeInteger(s.payment.refundedCenten) || s.payment.refundedCenten < 0 ||
      s.payment.refundedCenten > s.payment.amountCenten)
    mismatches.push({ field: 'payment.refundedCenten',
      expected: 'integer between 0 and payment.amountCenten', actual: s.payment.refundedCenten });
  return mismatches.length ? { ok: false, code: 'BINDING_CONTRACT_MISMATCH',
    missingFields: [], mismatches } : { ok: true, missingFields: [], mismatches: [] };
}

function stand(snapshot) {
  const s = snapshot;
  if (s.payment.status === 'TERUGBETALING_WACHT') return ['PAYMENT_REFUND_PENDING',
    'Payment Truth meldt dat een terugbetaling onderweg of nog onzeker is.'];
  if (s.payment.refundedCenten > 0 ||
      ['GEDEELTELIJK_TERUGBETAALD', 'TERUGBETAALD'].includes(s.payment.status))
    return ['PAYMENT_REFUNDED', 'Payment Truth meldt een gehele of gedeeltelijke terugbetaling.'];
  if (s.payment.reversalState !== 'NONE') return ['PAYMENT_REVERSED',
    'Payment Truth meldt een reversal of een onzekere terugdraaiing.'];
  if (s.payment.status !== 'BEVESTIGD') return ['PAYMENT_NOT_SETTLED',
    'Payment Truth staat niet op BEVESTIGD.'];
  if (s.ledger.status !== 'POSTED') return ['LEDGER_NOT_POSTED',
    'RTG Pay bevestigt geen geboekte grootboekregel.'];
  if (s.ledger.reversalState !== 'NONE') return ['LEDGER_REVERSED',
    'De RTG Pay-boeking is teruggedraaid of de tegenboeking is onzeker.'];
  if (s.reconciliation.status !== 'MATCHED' || s.reconciliation.uncertainty !== 'NONE')
    return ['RECONCILIATION_UNCERTAIN',
      'Er bestaat geen zekere transactiespecifieke afstemming tussen betaling en grootboek.'];
  return null;
}

module.exports = { ADAPTER_ID, ADAPTER_VERSION, BASISVELDEN, TENANTVELDEN,
  veldenVoor, inspecteer, stand };
