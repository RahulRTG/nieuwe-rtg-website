/* Stripe-betaalmethode voor volgende termijnen, binnen de bestaande rail.
   Setup is GEEN betaling. Ook een browserredirect is geen bewijs: de lezer
   haalt Session, Intent, PaymentMethod en eventueel Mandate zelf bij Stripe.
   Bronnen: docs.stripe.com/payments/checkout/save-and-reuse,
   /api/payment_intents/create en /api/mandates/object (13 november 2026).
   De contractlaag blijft eigenaar van toestemming, intrekking en betaalgrenzen. */
'use strict';
const { normaliseer, referentie, providerId, ongeldig } = require('./terugkerend');
const idVan = x => typeof x === 'string' ? x : x && x.id;
const METHODEN = Object.freeze(['card', 'sepa_debit']);

module.exports = function stripeAfspraak({ stripe, weigerUit, get, set, crypto }) {
  function eisRail(o) {
    weigerUit();
    if (!stripe || !o || o.aanbieder !== 'stripe') throw ongeldig('Een betaalafspraak vereist de actieve Stripe-rail.');
  }
  function binding(obj, o) {
    if (!obj || !obj.metadata || obj.metadata.referentie !== o.referentie ||
        obj.metadata.toestemmingRef !== o.toestemmingRef)
      throw ongeldig('De providerafspraak hoort niet bij deze referentie en toestemming.');
  }
  function afdruk(o) { return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex'); }

  async function maakBetaalafspraak(o) {
    eisRail(o);
    const toestemmingRef = referentie(o.toestemmingRef), ref = referentie(o.referentie);
    const sleutel = referentie(o.idempotentieSleutel);
    if (!o.returnUrl || typeof o.returnUrl !== 'string') throw ongeldig('Checkout vereist een vaste terugkeer-URL.');
    const digest = afdruk([ref, toestemmingRef, o.returnUrl]);
    const cacheKey = 'betaalafspraak:' + sleutel, oud = get(cacheKey);
    if (oud) {
      if (oud.afdruk !== digest) throw ongeldig('Deze setupsleutel hoort bij een andere betaalafspraak.');
      return { ...oud.resultaat, herhaald: true };
    }
    const metadata = { referentie: ref, toestemmingRef };
    const p = await stripe.checkout.sessions.create({ mode: 'setup', currency: 'eur',
      customer_creation: 'always', payment_method_types: [...METHODEN],
      client_reference_id: ref, metadata, setup_intent_data: { metadata },
      success_url: o.returnUrl, cancel_url: o.returnUrl }, { idempotencyKey: sleutel });
    providerId(p.id, 'cs');
    const resultaat = { providerId: p.id, aanbieder: 'stripe', status: 'wachtend',
      checkoutUrl: p.url || null, referentie: ref, toestemmingRef };
    set(cacheKey, { afdruk: digest, resultaat });
    return { ...resultaat };
  }

  async function haalBetaalafspraak(o) {
    if (String(o?.providerId || '').startsWith('pi_')) return haalIntentAfspraak(o);
    eisRail(o); providerId(o.providerId, 'cs'); referentie(o.referentie); referentie(o.toestemmingRef);
    const s = await stripe.checkout.sessions.retrieve(o.providerId);
    binding(s, o);
    if (s.id !== o.providerId || s.client_reference_id !== o.referentie || !['payment', 'setup'].includes(s.mode))
      throw ongeldig('De opgehaalde Checkout Session hoort niet bij deze opdracht.');
    const basis = { providerId: s.id, aanbieder: 'stripe', referentie: o.referentie, toestemmingRef: o.toestemmingRef };
    if (s.status !== 'complete') return { ...basis, status: s.status === 'expired' ? 'geannuleerd' : 'wachtend' };
    const setup = s.mode === 'setup', intentId = providerId(idVan(setup ? s.setup_intent : s.payment_intent), setup ? 'seti' : 'pi');
    const intent = await (setup ? stripe.setupIntents : stripe.paymentIntents).retrieve(intentId);
    binding(intent, o);
    if (intent.id !== intentId || (setup ? intent.usage : intent.setup_future_usage) !== 'off_session')
      throw ongeldig('De provider bevestigt geen off-sessionafspraak voor deze intent.');
    if (intent.status !== 'succeeded' || (!setup && s.payment_status !== 'paid'))
      return { ...basis, status: intent.status === 'canceled' ? 'geannuleerd' : 'wachtend' };
    const customerId = providerId(idVan(s.customer), 'cus');
    if (idVan(intent.customer) !== customerId) throw ongeldig('Session en Intent hebben verschillende klanten.');
    return bevestigdeMethode(intent, basis, customerId, setup);
  }

  async function haalIntentAfspraak(o) {
    eisRail(o); providerId(o.providerId, 'pi'); referentie(o.referentie); referentie(o.toestemmingRef);
    const customerId = providerId(o.customerId, 'cus'), oudeMethode = providerId(o.paymentMethodId, 'pm');
    const intent = await stripe.paymentIntents.retrieve(o.providerId);
    binding(intent, o);
    if (intent.id !== o.providerId || idVan(intent.customer) !== customerId)
      throw ongeldig('Deze termijnbetaling hoort niet bij de opgeslagen providerklant.');
    const basis = { providerId: intent.id, aanbieder: 'stripe', referentie: o.referentie, toestemmingRef: o.toestemmingRef };
    if (intent.status !== 'succeeded') return { ...basis, status: 'wachtend' };
    if (idVan(intent.payment_method) !== oudeMethode && intent.setup_future_usage !== 'off_session')
      throw ongeldig('De nieuwe betaalmethode is niet voor toekomstige termijnen bevestigd.');
    return bevestigdeMethode(intent, basis, customerId, false);
  }

  async function bevestigdeMethode(intent, basis, customerId, setup) {
    const intentId = intent.id, paymentMethodId = providerId(idVan(intent.payment_method), 'pm');
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (method.id !== paymentMethodId || idVan(method.customer) !== customerId || !METHODEN.includes(method.type))
      throw ongeldig('De opgeslagen betaalmethode hoort niet bij deze klant of is niet ondersteund.');
    let mandateId = setup ? idVan(intent.mandate) : null;
    if (!setup) {
      const chargeId = providerId(idVan(intent.latest_charge), 'ch');
      const charge = await stripe.charges.retrieve(chargeId);
      if (charge.id !== chargeId || idVan(charge.payment_intent) !== intentId ||
          idVan(charge.customer) !== customerId || idVan(charge.payment_method) !== paymentMethodId ||
          charge.payment_method_details?.type !== method.type)
        throw ongeldig('De providerontvangst en betaalmethode zijn niet dezelfde.');
      mandateId = idVan(charge.payment_method_details[method.type]?.mandate);
    }
    if (method.type === 'sepa_debit' && !mandateId) throw ongeldig('SEPA mist een bevestigd herbruikbaar mandaat.');
    if (mandateId) {
      providerId(mandateId, 'mandate');
      const mandate = await stripe.mandates.retrieve(mandateId);
      if (mandate.id !== mandateId || mandate.status !== 'active' || mandate.type !== 'multi_use' ||
          idVan(mandate.payment_method) !== paymentMethodId)
        throw ongeldig('Het mandaat is niet actief, herbruikbaar en aan deze betaalmethode gebonden.');
    }
    return Object.freeze({ ...basis, status: 'gereed', customerId, paymentMethodId,
      paymentMethodType: method.type, mandateId: mandateId || null,
      setupIntentId: setup ? intentId : null, betaalId: setup ? null : intentId });
  }

  async function innen(parameters, opties, terugkerend) {
    const r = normaliseer(terugkerend);
    Object.assign(parameters, { customer: r.customerId, payment_method: r.paymentMethodId,
      confirm: true, off_session: true, payment_method_types: [...METHODEN] });
    parameters.metadata.toestemmingRef = r.toestemmingRef;
    if (r.mandateId) parameters.mandate = r.mandateId;
    let p;
    try { p = await stripe.paymentIntents.create(parameters, opties); }
    catch (e) {
      // Een 402 kan een bestaande PI met vereiste klantactie dragen. Alleen
      // het kenmerk gebruiken; status en secret opnieuw authenticated ophalen.
      const id = idVan(e && e.raw && e.raw.error && e.raw.error.payment_intent);
      if (!id || e.status !== 402) throw e;
      try { providerId(id, 'pi'); }
      catch (fout) { delete fout.nietVerstuurd; throw fout; } // POST kan al uitgevoerd zijn
      p = await stripe.paymentIntents.retrieve(id);
      if (p.id !== id) throw new Error('Stripe gaf een andere PaymentIntent terug.');
    }
    if (idVan(p.customer) !== r.customerId || require('./stripe-klantactie').methodeVan(p) !== r.paymentMethodId ||
        p.amount !== parameters.amount || p.currency !== parameters.currency ||
        (p.status === 'succeeded' && p.amount_received !== parameters.amount) ||
        p.metadata?.referentie !== parameters.metadata.referentie || p.metadata?.toestemmingRef !== r.toestemmingRef)
      throw Object.assign(new Error('De terugkerende providerbetaling wijkt af van de opdracht.'), { code: 'BETAALAFSPRAAK_CONFLICT' });
    return p;
  }
  return { maakBetaalafspraak, haalBetaalafspraak, innen };
};

module.exports.METHODEN = METHODEN;
