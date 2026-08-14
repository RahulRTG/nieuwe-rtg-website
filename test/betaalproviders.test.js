'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const ontvangst = require('../server/betaal/ontvangst');

test('Stripe, Mollie en Adyen zijn alle drie kiesbare gehoste klantroutes', async () => {
  const gezien = {};
  const stripe = { checkout: { sessions: {
    async create(p) { gezien.stripe = p; return { id: 'cs_1', status: 'open', payment_status: 'unpaid',
      url: 'https://checkout.stripe.com/c/pay/cs_1' }; }, async retrieve() {} } },
  paymentIntents: {}, refunds: {} };
  const mollie = { payments: { async create(p) { gezien.mollie = p; return { id: 'tr_1', status: 'open',
    _links: { checkout: { href: 'https://mollie.com/checkout/tr_1' } } }; } }, refunds: {} };
  const adyen = { merchantAccount: 'RTG_EU', paymentLinks: { async create(p) { gezien.adyen = p;
    return { id: 'PL-1', status: 'active', url: 'https://pay.adyen.com/PL-1' }; } }, refunds: {} };
  const opslag = new Map();
  const rail = ontvangst({ crypto, stripe, mollie, adyen, standaard: 'stripe',
    get: k => opslag.get(k), set: (k, v) => opslag.set(k, v), env: {} });
  assert.deepEqual(rail.mogelijkheden().rails.map(x => x.id), ['stripe', 'mollie', 'adyen']);
  const basis = { bedrag: 1895, valuta: 'eur', referentie: 'BW-KLANT', omschrijving: 'Avondeten',
    returnUrl: 'https://rtg.example/apps/bestellen.html', webhookUrl: 'https://rtg.example/api/betaal/webhook/mollie' };
  const s = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'stripe', methode: 'hosted', idempotentieSleutel: 's' }));
  const m = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'mollie', methode: 'ideal', idempotentieSleutel: 'm' }));
  const a = await rail.maakBetaling(Object.assign({}, basis,
    { aanbieder: 'adyen', methode: 'online', idempotentieSleutel: 'a' }));
  assert.match(s.checkoutUrl, /stripe\.com/);
  assert.match(m.checkoutUrl, /mollie\.com/);
  assert.match(a.checkoutUrl, /adyen\.com/);
  assert.equal(gezien.stripe.client_reference_id, 'BW-KLANT');
  assert.equal(gezien.mollie.metadata.referentie, 'BW-KLANT');
  assert.equal(gezien.adyen.reference, 'BW-KLANT');
  assert.equal(gezien.adyen.merchantAccount, 'RTG_EU');
});
