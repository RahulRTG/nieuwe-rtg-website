/* Synthetische providerobjecten achter de echte adapter/BW-naad. Geen Stripe-
   netwerk, kaartgegevens of charges; GET/POST-tellers bewaken dezelfde PI. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const terugkerend = () => ({ modus: 'innen', toestemmingRef: 'contract:hash',
  customerId: 'cus_eigen', paymentMethodId: 'pm_oud' });
function tuig() {
  let gets = 0, posts = 0;
  const env = { STRIPE_PUBLIC_KEY: 'pk_test_synthetisch', STRIPE_SECRET_KEY: 'sk_test_synthetisch' };
  const p = { id: 'pi_eigen', customer: 'cus_eigen', payment_method: 'pm_oud',
    amount: 1200, amount_received: 0, currency: 'eur', status: 'requires_action',
    client_secret: 'pi_eigen_secret_synthetisch', livemode: false,
    metadata: { referentie: 'BW-eigen', toestemmingRef: 'contract:hash' },
    payment_method_types: ['card', 'sepa_debit'], confirmation_method: 'automatic' };
  const method = { id: 'pm_oud', customer: 'cus_eigen', type: 'card' };
  const charge = { id: 'ch_eigen', payment_intent: p.id, customer: p.customer,
    payment_method: method.id, payment_method_details: { type: 'card', card: {} } };
  const stripe = { paymentIntents: { async retrieve(id) { gets++; assert.equal(id, p.id); return structuredClone(p); },
    async create() { posts++; throw Object.assign(Error('authentication required'),
      { status: 402, raw: { error: { payment_intent: { id: p.id } } } }); } },
    paymentMethods: { async retrieve(id) { gets++; assert.equal(id, method.id); return structuredClone(method); } },
    charges: { async retrieve(id) { gets++; assert.equal(id, charge.id); return structuredClone(charge); } } };
  const rail = require('../server/betaal/ontvangst')({ crypto, stripe, env, standaard: 'stripe',
    get() {}, set() {} });
  const opties = () => ({ aanbieder: 'stripe', providerId: p.id, referentie: 'BW-eigen',
    bedrag: 1200, valuta: 'eur', terugkerend: terugkerend() });
  return { p, method, charge, rail, opties, env, stripe, tellers: () => ({ gets, posts }) };
}
test('klantactie haalt uitsluitend eigen bestaande PI op; secret nooit als betaald bewijs', async () => {
  const a = tuig(), r = await a.rail.haalKlantactie(a.opties());
  assert.deepEqual(r, { soort: 'stripe-bevestigen', publicKey: a.env.STRIPE_PUBLIC_KEY,
    clientSecret: a.p.client_secret, paymentMethodId: 'pm_oud', nieuweBetaalmethode: false });
  assert.deepEqual(a.tellers(), { gets: 2, posts: 0 });
  assert.equal(r.betaald, undefined);
});
test('402 met null payment_method bewaart echte bestaande PI via authenticated last_payment_error', async () => {
  const a = tuig(); Object.assign(a.p, { status: 'requires_payment_method', payment_method: null,
    last_payment_error: { decline_code: 'authentication_required', payment_method: { id: 'pm_oud' } } });
  const r = await a.rail.maakBetaling({ ...a.opties(), idempotentieSleutel: 'zelfde' });
  assert.equal(r.id, a.p.id); assert.equal(r.status, 'requires_payment_method');
  const actie = await a.rail.haalKlantactie(a.opties());
  assert.equal(actie.paymentMethodId, 'pm_oud'); assert.equal(actie.nieuweBetaalmethode, false);
  assert.equal(a.tellers().posts, 1);
});
test('echte kaartweigering vraagt nieuwe kaart op dezelfde PI, geen tweede POST', async () => {
  const a = tuig(); Object.assign(a.p, { status: 'requires_payment_method', payment_method: null,
    last_payment_error: { decline_code: 'insufficient_funds', payment_method: { id: 'pm_oud' } } });
  const r = await a.rail.haalKlantactie(a.opties());
  assert.equal(r.nieuweBetaalmethode, true); assert.equal(r.paymentMethodId, null);
  assert.equal(a.tellers().posts, 0);
});
test('geweigerde eigen SEPA kan alleen met nieuwe kaart en expliciete klantactie dezelfde PI herstellen', async () => {
  const a = tuig(); a.method.type = 'sepa_debit';
  Object.assign(a.p, { status: 'requires_payment_method', payment_method: null,
    last_payment_error: { decline_code: 'insufficient_funds', payment_method: { id: 'pm_oud' } } });
  const r = await a.rail.haalKlantactie(a.opties());
  assert.equal(r.nieuweBetaalmethode, true); assert.equal(r.paymentMethodId, null);
  assert.equal(r.clientSecret, a.p.client_secret); assert.equal(a.tellers().posts, 0);
  a.p.status = 'requires_action'; a.p.payment_method = 'pm_oud';
  await assert.rejects(a.rail.haalKlantactie(a.opties()), undefined, 'geen kaartconfirm op een SEPA-PM');
});
test('andere owner/ref/consent/bedrag/valuta/secret/status/config geeft geen klantactie', async () => {
  const mutanten = [a => a.p.customer = 'cus_vreemd', a => a.p.metadata.referentie = 'BW-vreemd',
    a => a.p.metadata.toestemmingRef = 'vreemd', a => a.p.amount++, a => a.p.currency = 'usd',
    a => a.p.client_secret = 'pi_vreemd_secret_x', a => a.p.status = 'processing',
    a => a.p.status = 'succeeded', a => a.p.status = 'canceled', a => a.p.confirmation_method = 'manual',
    a => a.method.customer = 'cus_vreemd', a => a.method.type = 'sepa_debit',
    a => a.env.STRIPE_PUBLIC_KEY = 'sk_test_geheim', a => a.env.STRIPE_PUBLIC_KEY = 'pk_live_x',
    a => delete a.env.STRIPE_PUBLIC_KEY, a => a.p.livemode = true,
    a => a.p.payment_method = null];
  for (const wijzig of mutanten) {
    const a = tuig(); wijzig(a);
    await assert.rejects(a.rail.haalKlantactie(a.opties()), undefined, String(wijzig));
    assert.equal(a.tellers().posts, 0);
  }
});
test('na nieuwe-kaartconfirm komt herbruikbare afspraak alleen uit verified PI/PM/Charge', async () => {
  const a = tuig(); Object.assign(a.p, { status: 'succeeded', amount_received: 1200,
    payment_method: 'pm_nieuw', setup_future_usage: 'off_session', latest_charge: 'ch_eigen' });
  a.method.id = a.charge.payment_method = 'pm_nieuw';
  const r = await a.rail.haalBetaalafspraak({ aanbieder: 'stripe', providerId: a.p.id,
    referentie: 'BW-eigen', toestemmingRef: 'contract:hash', customerId: 'cus_eigen', paymentMethodId: 'pm_oud' });
  assert.equal(r.status, 'gereed'); assert.equal(r.paymentMethodId, 'pm_nieuw');
  assert.equal(r.customerId, 'cus_eigen'); assert.equal(a.tellers().posts, 0);
  delete a.p.setup_future_usage;
  await assert.rejects(a.rail.haalBetaalafspraak({ aanbieder: 'stripe', providerId: a.p.id,
    referentie: 'BW-eigen', toestemmingRef: 'contract:hash', customerId: 'cus_eigen', paymentMethodId: 'pm_oud' }));
});
test('onderbroken 3DS van nieuwe kaart hervat dezelfde eigen PI zonder vroege PM-opslag', async () => {
  const a = tuig(); a.p.payment_method = a.method.id = 'pm_nieuw';
  a.p.setup_future_usage = 'off_session'; a.method.customer = null;
  const r = await a.rail.haalKlantactie(a.opties());
  assert.equal(r.paymentMethodId, 'pm_nieuw'); assert.equal(r.nieuweBetaalmethode, false);
  const o = { aanbieder: 'stripe', providerId: a.p.id, referentie: 'BW-eigen',
    toestemmingRef: 'contract:hash', customerId: 'cus_eigen', paymentMethodId: 'pm_oud' };
  assert.equal((await a.rail.haalBetaalafspraak(o)).status, 'wachtend');
  a.method.customer = 'cus_vreemd'; await assert.rejects(a.rail.haalKlantactie(a.opties()));
  a.method.customer = null; delete a.p.setup_future_usage;
  await assert.rejects(a.rail.haalKlantactie(a.opties()));
});
test('BW-klantactie vereist eigen actor, vaste binding en open staat, ook na provider-await', async () => {
  const a = tuig(), data = {}, w = require('../server/kern/betaalwaarheid')({ d: () => data,
    save() {}, crypto, betaal: a.rail });
  const b = w.maak({ actor: 'acc:1', idem: 'factuur:1', soort: 'factuur', bronRef: 'F1',
    centen: 1200, context: { own: true, accountId: 1, invoiceId: 'F1', contractId: 'C1', termijn: 2 } });
  const r = w.van(b.id); Object.assign(r, { status: 'WACHT_OP_KLANT', provider: 'stripe',
    providerId: a.p.id, start: { aanbieder: 'stripe', terugkerend: terugkerend() } });
  a.p.metadata.referentie = b.id;
  await assert.rejects(w.herstel(b.id, 'acc:2')); assert.equal(a.tellers().gets, 0);
  const uit = await w.herstel(b.id, 'acc:1'); assert.equal(uit.clientSecret, a.p.client_secret);
  assert.equal(JSON.stringify(data).includes('secret_synthetisch'), false);
  for (const waarde of [[{ id: 'refund' }], { id: 'ongeldig' }]) {
    r.terugbetaalOpdrachten = waarde;
    await assert.rejects(w.herstel(b.id, 'acc:1'));
  }
  delete r.terugbetaalOpdrachten;
  const origineel = a.stripe.paymentIntents.retrieve;
  a.stripe.paymentIntents.retrieve = async id => { const p = await origineel(id);
    data.betaalWaarheid = structuredClone(data.betaalWaarheid); data.betaalWaarheid[b.id].status = 'BEVESTIGD'; return p; };
  await assert.rejects(w.herstel(b.id, 'acc:1'));
  assert.equal(a.tellers().posts, 0);
});

test('een bestaande provider wordt bij een conflicterende melding niet eerst overschreven', async () => {
  const data = {}, w = require('../server/kern/betaalwaarheid')({ d: () => data, save() {}, crypto, betaal: {
    async maakBetaling() { return { id: 'pi_eigen', aanbieder: 'stripe', status: 'processing', bedrag: 1200, valuta: 'eur' }; }
  } });
  const b = w.maak({ actor: 'acc:1', idem: 'ref', soort: 'factuur', bronRef: 'F1', centen: 1200 });
  await w.begin(b.id, { aanbieder: 'stripe' });
  const voor = structuredClone(w.van(b.id));
  await assert.rejects(w.providerMelding({ eventId: 'vreemde-rail', referentie: b.id, aanbieder: 'adyen',
    status: 'captured', bedrag: 1200, valuta: 'eur' }), e => e.code === 'BETAALWAARHEID_PUBLICATIE_CONFLICT');
  assert.deepEqual(w.van(b.id), voor);
});
