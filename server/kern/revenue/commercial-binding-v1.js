/* RTG COMMERCIAL BINDING V1.

   Dit is een pure, onveranderlijke waarde tussen catalogus, Payment Truth en
   RTG Pay. De waarde is GEEN betaalbewijs en verleent geen entitlement. De
   recordadapter accepteert alleen bronnen die dezelfde binding zelf dragen;
   oude, ongebonden records blijven daardoor bewust fail-closed.

   Transactiespecifieke reconciliation hoort niet in deze waarde. Die blijft
   een afzonderlijk verplicht bewijs in entitlement-eligibility-v1. */
'use strict';

const CONTRACT_ID = 'rtg.revenue.commercial-binding';
const CONTRACT_VERSION = '1.0.0';
const PAYMENT_FIELD = 'context.commercialBindingV1';
const LEDGER_FIELD = 'commercialBindingV1';

const HOOFDVELDEN = Object.freeze([
  'schemaVersion', 'contractId', 'contractVersion', 'scope', 'product',
  'amount', 'paymentTruthRef', 'ledgerRef', 'provenance'
]);
const DEELVELDEN = Object.freeze({
  scope: ['kind', 'accountRef', 'tenantRef'],
  product: ['productId', 'productVersion', 'offerId', 'offerVersion'],
  amount: ['centen', 'currency']
});

function tekst(v) { return typeof v === 'string' ? v.trim() : ''; }
function eigen(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
function vlak(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const p = Object.getPrototypeOf(o);
  return p === Object.prototype || p === null;
}
function extraVelden(o, toegestaan, pad) {
  if (!vlak(o)) return [];
  return Object.keys(o).filter(k => !toegestaan.includes(k)).map(k => (pad ? pad + '.' : '') + k);
}
function provenanceKlopt(lijst) {
  return Array.isArray(lijst) && lijst.length > 0 && lijst.every(p => vlak(p) &&
    Object.keys(p).length === 3 && tekst(p.file) && tekst(p.symbol) && tekst(p.sourceRef));
}
function diepVast(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  for (const deel of Object.values(v)) diepVast(deel);
  return Object.freeze(v);
}

function inspecteer(invoer) {
  const v = invoer || {}, missingFields = [], invalidFields = [], extraFields = [];
  if (!vlak(v)) return { ok: false, code: 'COMMERCIAL_BINDING_INVALID',
    missingFields: [], invalidFields: ['$'], extraFields: [] };
  extraFields.push(...extraVelden(v, HOOFDVELDEN, ''));
  for (const veld of HOOFDVELDEN) if (!eigen(v, veld)) missingFields.push(veld);
  for (const [deel, velden] of Object.entries(DEELVELDEN)) {
    if (!vlak(v[deel])) { if (eigen(v, deel)) invalidFields.push(deel); continue; }
    extraFields.push(...extraVelden(v[deel], velden, deel));
    for (const veld of velden) if (!eigen(v[deel], veld)) missingFields.push(deel + '.' + veld);
  }
  if (v.schemaVersion !== 1) invalidFields.push('schemaVersion');
  if (v.contractId !== CONTRACT_ID) invalidFields.push('contractId');
  if (v.contractVersion !== CONTRACT_VERSION) invalidFields.push('contractVersion');
  if (vlak(v.scope)) {
    if (!['ACCOUNT', 'TENANT'].includes(v.scope.kind)) invalidFields.push('scope.kind');
    if (!tekst(v.scope.accountRef)) invalidFields.push('scope.accountRef');
    if (v.scope.kind === 'ACCOUNT' && v.scope.tenantRef !== null) invalidFields.push('scope.tenantRef');
    if (v.scope.kind === 'TENANT' && !tekst(v.scope.tenantRef)) invalidFields.push('scope.tenantRef');
  }
  if (vlak(v.product)) {
    if (!tekst(v.product.productId)) invalidFields.push('product.productId');
    if (!Number.isSafeInteger(v.product.productVersion) || v.product.productVersion < 1)
      invalidFields.push('product.productVersion');
    if (!tekst(v.product.offerId)) invalidFields.push('product.offerId');
    if (!Number.isSafeInteger(v.product.offerVersion) || v.product.offerVersion < 1)
      invalidFields.push('product.offerVersion');
  }
  if (vlak(v.amount)) {
    if (!Number.isSafeInteger(v.amount.centen) || v.amount.centen <= 0) invalidFields.push('amount.centen');
    if (!/^[A-Z]{3}$/.test(tekst(v.amount.currency))) invalidFields.push('amount.currency');
  }
  if (!tekst(v.paymentTruthRef)) invalidFields.push('paymentTruthRef');
  if (!tekst(v.ledgerRef)) invalidFields.push('ledgerRef');
  if (!provenanceKlopt(v.provenance)) invalidFields.push('provenance');
  const uniek = lijst => [...new Set(lijst)].sort();
  const uit = { ok: !missingFields.length && !invalidFields.length && !extraFields.length,
    code: null, missingFields: uniek(missingFields), invalidFields: uniek(invalidFields),
    extraFields: uniek(extraFields) };
  if (!uit.ok) uit.code = missingFields.length ? 'COMMERCIAL_BINDING_INCOMPLETE'
    : extraFields.length ? 'COMMERCIAL_BINDING_EXTRA_FIELDS' : 'COMMERCIAL_BINDING_INVALID';
  return uit;
}

function kopie(v) {
  return { schemaVersion: v.schemaVersion, contractId: v.contractId,
    contractVersion: v.contractVersion,
    scope: { kind: v.scope.kind, accountRef: v.scope.accountRef, tenantRef: v.scope.tenantRef },
    product: { productId: v.product.productId, productVersion: v.product.productVersion,
      offerId: v.product.offerId, offerVersion: v.product.offerVersion },
    amount: { centen: v.amount.centen, currency: v.amount.currency },
    paymentTruthRef: v.paymentTruthRef, ledgerRef: v.ledgerRef,
    provenance: v.provenance.map(p => ({ file: p.file, symbol: p.symbol, sourceRef: p.sourceRef })) };
}

function maak(invoer) {
  const oordeel = inspecteer(invoer);
  if (!oordeel.ok) {
    const fout = new Error('De commerciële binding is onvolledig of ongeldig.');
    fout.code = oordeel.code; fout.details = oordeel;
    throw fout;
  }
  return diepVast(kopie(invoer));
}

function zelfde(a, b) {
  const x = inspecteer(a), y = inspecteer(b);
  if (!x.ok || !y.ok) return false;
  return JSON.stringify(kopie(a)) === JSON.stringify(kopie(b));
}

function uitFinancieleRecords({ paymentTruth, ledger } = {}) {
  const ontbreekt = [];
  const betaalBinding = paymentTruth && paymentTruth.context && paymentTruth.context.commercialBindingV1;
  const boekBinding = ledger && ledger.commercialBindingV1;
  if (!betaalBinding) ontbreekt.push('paymentTruth.' + PAYMENT_FIELD);
  if (!boekBinding) ontbreekt.push('ledger.' + LEDGER_FIELD);
  if (!paymentTruth || !tekst(paymentTruth.id)) ontbreekt.push('paymentTruth.id');
  if (!ledger || !tekst(ledger.id)) ontbreekt.push('ledger.id');
  if (!ledger || !eigen(ledger, 'currency')) ontbreekt.push('ledger.currency');
  if (ontbreekt.length) return diepVast({ ok: false, code: 'COMMERCIAL_BINDING_NOT_STORED',
    missingFields: [...new Set(ontbreekt)].sort(), invalidFields: [], mismatches: [],
    eligibilityReady: false, reconciliation: 'TRANSACTION_SPECIFIC_REQUIRED' });

  const bp = inspecteer(betaalBinding), bl = inspecteer(boekBinding);
  const invalidFields = [];
  if (!bp.ok) invalidFields.push(...bp.missingFields.map(x => 'paymentTruth.' + PAYMENT_FIELD + '.' + x),
    ...bp.invalidFields.map(x => 'paymentTruth.' + PAYMENT_FIELD + '.' + x),
    ...bp.extraFields.map(x => 'paymentTruth.' + PAYMENT_FIELD + '.' + x));
  if (!bl.ok) invalidFields.push(...bl.missingFields.map(x => 'ledger.' + LEDGER_FIELD + '.' + x),
    ...bl.invalidFields.map(x => 'ledger.' + LEDGER_FIELD + '.' + x),
    ...bl.extraFields.map(x => 'ledger.' + LEDGER_FIELD + '.' + x));
  if (invalidFields.length) return diepVast({ ok: false, code: 'COMMERCIAL_BINDING_INVALID',
    missingFields: [], invalidFields: [...new Set(invalidFields)].sort(), mismatches: [],
    eligibilityReady: false, reconciliation: 'TRANSACTION_SPECIFIC_REQUIRED' });

  const b = maak(betaalBinding), mismatches = [];
  const eis = (field, actual, expected) => { if (actual !== expected) mismatches.push({ field, actual, expected }); };
  if (!zelfde(b, boekBinding)) mismatches.push({ field: 'ledger.' + LEDGER_FIELD,
    actual: 'DIFFERENT_BINDING', expected: 'EXACT_PAYMENT_TRUTH_BINDING' });
  eis('paymentTruth.id', paymentTruth.id, b.paymentTruthRef);
  eis('paymentTruth.centen', paymentTruth.centen, b.amount.centen);
  eis('paymentTruth.valuta', String(paymentTruth.valuta || '').toUpperCase(), b.amount.currency);
  eis('ledger.id', ledger.id, b.ledgerRef);
  eis('ledger.ref', ledger.ref, b.paymentTruthRef);
  eis('ledger.centen', ledger.centen, b.amount.centen);
  eis('ledger.currency', String(ledger.currency || '').toUpperCase(), b.amount.currency);
  if (mismatches.length) return diepVast({ ok: false, code: 'COMMERCIAL_BINDING_MISMATCH',
    missingFields: [], invalidFields: [], mismatches, eligibilityReady: false,
    reconciliation: 'TRANSACTION_SPECIFIC_REQUIRED' });
  return diepVast({ ok: true, code: 'COMMERCIAL_BINDING_VERIFIED', binding: b,
    missingFields: [], invalidFields: [], mismatches: [], eligibilityReady: false,
    reconciliation: 'TRANSACTION_SPECIFIC_REQUIRED' });
}

module.exports = { CONTRACT_ID, CONTRACT_VERSION, PAYMENT_FIELD, LEDGER_FIELD,
  inspecteer, maak, zelfde, uitFinancieleRecords };
