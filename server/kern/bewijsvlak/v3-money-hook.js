'use strict';

let adapter = null;
function installMoneyHook(value) {
  if (!value || typeof value.moneyEvidence !== 'function' || typeof value.assessMoney !== 'function' ||
    typeof value.confirmMoney !== 'function' || typeof value.verifyOwnerProof !== 'function')
    throw new Error('bewijsvlak v3: ongeldige money-adapter');
  adapter = value;
}
function eis() {
  if (!adapter) require('./runtime').current(); // laad de private compositie bij los domeingebruik
  if (!adapter) {
    const error = new Error('bewijsvlak v3: money-adapter is niet geïnstalleerd');
    error.code = 'EVIDENCE_ADAPTER_UNAVAILABLE';
    throw error;
  }
  return adapter;
}
function moneyHookFailure(error, code) {
  return Object.freeze({ ok: false, shadow: true,
    code: error && error.code || code || 'MONEY_EVIDENCE_FAILED',
    incidentId: error && error.incidentId || null });
}

const subject = payment => ({ domain: 'money', type: 'payment', id: String(payment.id) });
const correlation = payment => 'payment_' + String(payment.id).toLowerCase();
const atVan = payment => payment.bijgewerktAt || new Date().toISOString();
const common = payment => ({ subjectRef: subject(payment), correlationId: correlation(payment),
  provider: payment.provider, capability: 'payment.authorize', at: atVan(payment) });

function ownerAssertion(payment, factType) {
  const events = payment && Array.isArray(payment.gebeurtenissen) ? payment.gebeurtenissen : [];
  const event = events[events.length - 1];
  if (!event || !event.zegel || event.status !== payment.status) {
    const error = new Error('bewijsvlak v3: betaling mist het actuele Payment Truth-event');
    error.code = 'OWNER_ASSERTION_MISMATCH';
    throw error;
  }
  return { subjectRef: subject(payment), factType, status: String(payment.status),
    provider: String(payment.provider || '').toLowerCase(),
    providerStatus: String(payment.providerStatus || '').toLowerCase(),
    amountCents: Math.round(Number(payment.centen)), currency: String(payment.valuta || '').toLowerCase(),
    eventSeal: String(event.zegel), eventNumber: Number(event.nr), eventAt: String(event.at) };
}

function ownerReceipt(payment, factType, purpose, owner) {
  const o = owner || {}, assertion = ownerAssertion(payment, factType);
  return eis().verifyOwnerProof(o.proof, { owner: 'payment-truth', purpose, factType,
    subjectRef: subject(payment), eventRef: assertion.eventSeal, assertion });
}

function ownerEvidence(payment, factType, value, owner) {
  const purpose = factType === 'payment.provider.outcome_unknown' ? 'money-execution' : 'money-domain';
  const receipt = ownerReceipt(payment, factType, purpose, owner);
  return eis().moneyEvidence({ ...common(payment), factType, value, ownerReceipt: receipt });
}

function providerSettled(payment, providerEventId, value, ingressProof, providerAssertion) {
  return providerFact(payment, 'payment.provider.settled', providerEventId, value || {
    providerEventId: String(providerEventId || ''), providerStatus: payment.providerStatus,
    amountCents: payment.centen, currency: payment.valuta
  }, ingressProof, providerAssertion);
}

function providerFact(payment, factType, providerEventId, value, ingressProof, providerAssertion) {
  if (!ingressProof) {
    const error = new Error('bewijsvlak v3: geverifieerd providerbewijs ontbreekt');
    error.code = 'INGRESS_PROOF_REQUIRED';
    throw error;
  }
  const a = providerAssertion || {}, refs = [payment.providerId, payment.providerPaymentId]
    .filter(Boolean).map(String);
  const valid = a.provider === String(payment.provider || '').toLowerCase() &&
    a.paymentRef === String(payment.id) && a.amountCents === Math.round(Number(payment.centen)) &&
    a.currency === String(payment.valuta || '').toLowerCase() &&
    a.status === String(payment.providerStatus || '').toLowerCase() &&
    !!a.providerObjectId && (!refs.length || refs.includes(String(a.providerObjectId)) ||
      refs.includes(String(a.providerPaymentId || '')));
  if (!valid) {
    const error = new Error('bewijsvlak v3: providerassertion hoort niet bij deze betaling');
    error.code = 'INGRESS_ASSERTION_MISMATCH';
    throw error;
  }
  return eis().moneyEvidence({ ...common(payment), ingressProof, providerAssertion: a,
    factType, value });
}

const providerReversed = (payment, providerEventId, value, ingressProof, providerAssertion) =>
  providerFact(payment, 'payment.reversed', providerEventId, value || { reversed: true },
    ingressProof, providerAssertion);
const providerDisputed = (payment, providerEventId, value, ingressProof, providerAssertion) =>
  providerFact(payment, 'payment.disputed', providerEventId, value || { disputed: true },
    ingressProof, providerAssertion);

function confirmed(payment, providerEventId, ingressProof, providerAssertion, owner) {
  try {
    const c = common(payment);
    const receipt = ownerReceipt(payment, 'payment.ledger.posted', 'money-domain', owner);
    return eis().confirmMoney({ ...c, subjectRef: subject(payment),
      correlationId: correlation(payment), at: atVan(payment), ingressProof, providerAssertion,
      ownerReceipt: receipt,
      domainValue: { paymentRef: payment.id, status: payment.status,
        amountCents: payment.centen, currency: payment.valuta },
      externalValue: { providerEventId: String(providerEventId || ''),
        providerStatus: payment.providerStatus, amountCents: payment.centen, currency: payment.valuta } });
  } catch (error) {
    return moneyHookFailure(error);
  }
}

function unknown(payment, error, owner) {
  try {
    const receipt = ownerReceipt(payment, 'payment.provider.outcome_unknown', 'money-execution', owner);
    const technical = eis().moneyEvidence({ subjectRef: subject(payment), correlationId: correlation(payment),
      factType: 'payment.provider.outcome_unknown', provider: payment.provider, at: new Date().toISOString(),
      value: { code: String(error && error.code || 'PROVIDER_ERROR'), outcome: 'UNKNOWN' },
      ownerReceipt: receipt });
    return eis().assessMoney({ subjectRef: subject(payment), evidenceRefs: [technical.evidenceId],
      correlationId: correlation(payment), at: technical.observedAt });
  } catch (hookError) { return moneyHookFailure(hookError, 'MONEY_UNKNOWN_EVIDENCE_FAILED'); }
}

module.exports = { install: installMoneyHook, confirmed, unknown, ownerEvidence, providerSettled,
  providerReversed, providerDisputed };
