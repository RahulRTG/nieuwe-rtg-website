/* Alleen navraag voor klantbevestiging van een BESTAANDE off-session PI.
   Geen create/confirm op de server, geen browserbewijs en geen secretopslag.
   Docs: stripe.com/docs/payments/save-and-reuse-cards-only, 13-11-2026. */
'use strict';
const { normaliseer, providerId, referentie, ongeldig } = require('./terugkerend');
const idVan = x => typeof x === 'string' ? x : x && x.id;
const methodeVan = p => idVan(p.payment_method) || (p.status === 'requires_payment_method'
  ? idVan(p.last_payment_error?.payment_method) : null);

module.exports = ({ stripe, weigerUit, env }) => async function haalKlantactie(o) {
  weigerUit();
  if (!stripe || o?.aanbieder !== 'stripe') throw ongeldig('Stripe-klantbevestiging is niet beschikbaar.');
  const r = normaliseer(o.terugkerend);
  if (!r || r.modus !== 'innen') throw ongeldig('Dit is geen bestaande termijnbetaling.');
  const id = providerId(o.providerId, 'pi'), ref = referentie(o.referentie);
  if (!Number.isSafeInteger(o.bedrag) || o.bedrag < 1 || o.valuta !== 'eur')
    throw ongeldig('De oorspronkelijke betaalopdracht ontbreekt.');
  const publicKey = String(env?.STRIPE_PUBLIC_KEY || '');
  const mode = /^pk_(test|live)_[A-Za-z0-9]+$/.exec(publicKey)?.[1];
  const secretMode = /^(?:sk|rk)_(test|live)_/.exec(String(env?.STRIPE_SECRET_KEY || ''))?.[1];
  if (!mode || secretMode !== mode) throw ongeldig('De openbare Stripe-sleutel is niet passend geconfigureerd.');
  const p = await stripe.paymentIntents.retrieve(id);
  if (p.id !== id || idVan(p.customer) !== r.customerId || p.amount !== o.bedrag ||
      p.currency !== o.valuta || p.metadata?.referentie !== ref ||
      p.metadata?.toestemmingRef !== r.toestemmingRef || p.livemode !== (mode === 'live') ||
      p.confirmation_method !== 'automatic' || !Array.isArray(p.payment_method_types) ||
      !p.payment_method_types.includes('card') ||
      !['requires_action', 'requires_confirmation', 'requires_payment_method'].includes(p.status) ||
      typeof p.client_secret !== 'string' || !p.client_secret.startsWith(id + '_secret_') ||
      p.client_secret.length <= id.length + 8)
    throw ongeldig('De provider bevestigt geen passende open klantactie.');
  const paymentMethodId = providerId(methodeVan(p), 'pm');
  // Ook na een mislukte klantpoging kan Stripe een nieuwe, nog niet opgeslagen
  // kaart noemen. Alleen een werkelijk aan DEZE klant gekoppelde kaart geldt.
  const method = await stripe.paymentMethods.retrieve(paymentMethodId);
  const nieuweBetaalmethode = p.status === 'requires_payment_method' &&
    p.last_payment_error?.decline_code !== 'authentication_required';
  // Stripe koppelt een nieuw ingevoerde kaart pas na succesvolle bevestiging
  // aan Customer. Hervat een onderbroken 3DS daarom vanuit deze eigen PI,
  // zonder de nog ongekoppelde kaart alvast als toekomstige afspraak op te slaan.
  const nogNietGekoppeld = paymentMethodId !== r.paymentMethodId && method.customer == null &&
    p.setup_future_usage === 'off_session';
  const methodeToegestaan = method.type === 'card' || nieuweBetaalmethode && method.type === 'sepa_debit';
  if (method.id !== paymentMethodId || idVan(method.customer) !== r.customerId && !nogNietGekoppeld || !methodeToegestaan)
    throw ongeldig('Klantbevestiging vereist een kaart van de oorspronkelijke providerklant.');
  return { soort: 'stripe-bevestigen', publicKey, clientSecret: p.client_secret,
    paymentMethodId: nieuweBetaalmethode ? null : paymentMethodId, nieuweBetaalmethode };
};
module.exports.methodeVan = methodeVan;
