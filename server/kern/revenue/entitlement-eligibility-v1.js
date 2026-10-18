/* RTG PAYMENT ENTITLEMENT ELIGIBILITY V1.

   Deze interne projectie zegt uitsluitend of bestaand betalingsbewijs geschikt
   ZOU ZIJN als invoer voor een afzonderlijke entitlementbeslissing. Zij verleent
   niets. De catalogus, Payment Truth, RTG Pay en reconciliation blijven ieder
   eigenaar van hun eigen waarheid; het adaptercontract bindt alleen hun refs. */
'use strict';

const catalogusV1 = require('./catalogus-v1');
const contract = require('./entitlement-eligibility-v1/contract');
const diepVast = require('./immutable');

const PROJECTIE_ID = 'rtg.revenue.payment-entitlement-eligibility';
const PROJECTIE_VERSION = '1.0.0';

function tekst(v) { return String(v == null ? '' : v).trim(); }
function basis(context, beslissing) {
  return diepVast({ schemaVersion: 1, projectionId: PROJECTIE_ID,
    projectionVersion: PROJECTIE_VERSION, mode: 'READ_ONLY', context, decision: beslissing,
    effects: { eligibleOnly: true, granted: false, revoked: false, mutated: false, financial: false } });
}

function dicht(code, reason, extra) {
  return basis({ actorAccountRef: null, subjectAccountRef: null, scopeKind: null,
    targetRef: null, productId: null }, {
    eligibility: 'DENIED', source: { id: 'rtg.revenue.product-payment-binding', provenance: {} },
    lifecycle: { payment: 'UNKNOWN', ledger: 'UNKNOWN', reconciliation: 'UNKNOWN' },
    denial: { code, reason, ...(extra || {}) }, facts: {}
  });
}

function eligibilityContextVan(vraag) {
  const v = vraag || {}, actor = tekst(v.actorAccountRef), subject = tekst(v.subjectAccountRef);
  const scopeKind = tekst(v.scopeKind), targetRef = tekst(v.targetRef), productId = tekst(v.productId);
  if (!actor || actor !== subject || !['ACCOUNT', 'TENANT'].includes(scopeKind) || !targetRef ||
      !productId || (scopeKind === 'ACCOUNT' && targetRef !== subject)) return null;
  return { actorAccountRef: actor, subjectAccountRef: subject, scopeKind, targetRef, productId };
}

function paymentBindingKlopt(binding, context) {
  return !!(binding && binding.verified === true && tekst(binding.actorAccountRef) === context.actorAccountRef &&
    tekst(binding.subjectAccountRef) === context.subjectAccountRef &&
    tekst(binding.scopeKind) === context.scopeKind && tekst(binding.targetRef) === context.targetRef &&
    tekst(binding.provenance) && binding.accountState && typeof binding.accountState.active === 'boolean');
}

function productVan(catalogus, productId) {
  return catalogus && Array.isArray(catalogus.products)
    ? catalogus.products.find(p => p && p.productId === productId) || null : null;
}

function productBeslissing(context, product, code, reason, extra) {
  return basis(context, {
    eligibility: 'DENIED',
    source: { id: catalogusV1.CATALOG_ID,
      provenance: { catalog: (product && product.sources || []).map(x => ({ ...x })) } },
    lifecycle: { payment: 'NOT_READ', ledger: 'NOT_READ', reconciliation: 'NOT_READ' },
    denial: { code, reason, ...(extra || {}) },
    facts: product ? { productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion } : {}
  });
}

function maakEntitlementEligibilityV1({ bindingVoor, bewijsVoor, catalogusVoor } = {}) {
  const leesCatalogus = catalogusVoor || (vraag => catalogusV1.projecteerAiExtraS(vraag.pricingSettings));

  function beslis(vraag) {
    const context = eligibilityContextVan(vraag);
    if (!context) return dicht('UNKNOWN_CONTEXT',
      'De account-, tenant- of productcontext is onbekend of niet aan dezelfde actor gebonden.');
    if (typeof bindingVoor !== 'function') return dicht('ACCOUNT_BINDING_UNAVAILABLE',
      'De bestaande account- en tenantbinding is niet aangesloten.');
    let binding;
    try { binding = bindingVoor({ ...context }); } catch (_) {
      return dicht('ACCOUNT_BINDING_UNAVAILABLE', 'De bestaande binding kon niet veilig worden gelezen.');
    }
    if (!paymentBindingKlopt(binding, context)) return dicht('ACCOUNT_CONTEXT_NOT_VERIFIED',
      'De bestaande accountbron bevestigt deze account- en tenantcontext niet.');
    if (!binding.accountState.active) return productBeslissing(context, null, 'ACCOUNT_INACTIVE',
      'De bestaande accountbron meldt dat deze account niet actief is.');

    let catalogus;
    try { catalogus = leesCatalogus(vraag || {}); } catch (_) {
      return productBeslissing(context, null, 'CATALOG_UNAVAILABLE',
        'De bestaande catalogus kon niet veilig worden gelezen.');
    }
    const product = productVan(catalogus, context.productId);
    if (!product) return productBeslissing(context, null, 'PRODUCT_NOT_FOUND',
      'Dit product bestaat niet in de bestaande Revenue Catalog.');
    if (!product.availability || product.availability.purchasable !== true)
      return productBeslissing(context, product, 'PRODUCT_NOT_PURCHASABLE',
        product.availability && product.availability.reason || 'Dit catalogusproduct is niet koopbaar.');
    if (!product.price || product.price.state !== 'AVAILABLE' ||
        !Number.isSafeInteger(product.price.amountCenten) || product.price.amountCenten < 0)
      return productBeslissing(context, product, 'PRICE_UNAVAILABLE',
        product.price && product.price.reason || 'De catalogus levert geen vastgestelde prijs.');

    const verwacht = { scopeKind: context.scopeKind, accountRef: context.subjectAccountRef,
      tenantRef: context.scopeKind === 'TENANT' ? context.targetRef : null,
      productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion,
      amountCenten: product.price.amountCenten, currency: product.price.currency };
    if (typeof bewijsVoor !== 'function') return productBeslissing(context, product,
      'PAYMENT_BINDING_ADAPTER_UNAVAILABLE',
      'Er is geen serveradapter die product, account, betaling, grootboek en reconciliation exact bindt.',
      { missingFields: contract.veldenVoor(context.scopeKind) });

    let bewijs;
    try { bewijs = bewijsVoor({ context: { ...context }, expected: { ...verwacht } }); }
    catch (_) { return productBeslissing(context, product, 'PAYMENT_BINDING_ADAPTER_UNAVAILABLE',
      'De bestaande betaalbewijsadapter kon niet veilig worden gelezen.',
      { missingFields: contract.veldenVoor(context.scopeKind) }); }
    const keuring = contract.inspecteer(bewijs, verwacht);
    if (!keuring.ok) return productBeslissing(context, product, keuring.code,
      keuring.code === 'BINDING_CONTRACT_INCOMPLETE'
        ? 'De betaalbronnen missen verplichte bindende velden.'
        : 'De betaalbronnen verwijzen niet exact naar hetzelfde product, account, tenant en bedrag.',
      { missingFields: keuring.missingFields, mismatches: keuring.mismatches });
    const bezwaar = contract.stand(bewijs);
    const bron = { id: contract.ADAPTER_ID, provenance: {
      catalog: (product.sources || []).map(x => ({ ...x })),
      adapter: bewijs.provenance.adapter.map(x => ({ ...x })),
      paymentTruth: bewijs.provenance.paymentTruth.map(x => ({ ...x })),
      ledger: bewijs.provenance.ledger.map(x => ({ ...x })),
      reconciliation: bewijs.provenance.reconciliation.map(x => ({ ...x }))
    } };
    const facts = { productId: product.productId, productVersion: product.productVersion,
      offerId: product.offerId, offerVersion: product.offerVersion,
      paymentTruthRef: bewijs.payment.paymentTruthRef, ledgerRef: bewijs.ledger.ledgerRef,
      reconciliationRef: bewijs.reconciliation.reconciliationRef,
      amountCenten: bewijs.payment.amountCenten, currency: bewijs.payment.currency };
    return basis(context, { eligibility: bezwaar ? 'DENIED' : 'ELIGIBLE', source: bron,
      lifecycle: { payment: bewijs.payment.status, settledAt: bewijs.payment.settledAt,
        refundedCenten: bewijs.payment.refundedCenten, reversal: bewijs.payment.reversalState,
        ledger: bewijs.ledger.status, ledgerReversal: bewijs.ledger.reversalState,
        reconciliation: bewijs.reconciliation.status,
        reconciliationUncertainty: bewijs.reconciliation.uncertainty,
        reconciledAt: bewijs.reconciliation.reconciledAt },
      denial: bezwaar ? { code: bezwaar[0], reason: bezwaar[1] } : null, facts });
  }

  return Object.freeze({ beslis });
}

module.exports = { PROJECTIE_ID, PROJECTIE_VERSION, maakEntitlementEligibilityV1,
  adapterContract: contract };
