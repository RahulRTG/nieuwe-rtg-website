/* De eigen Stripe-client (server/stripe.js) i.p.v. het pakket 'stripe'.
   Getest tegen een nagemaakte Stripe-server (STRIPE_BASE_URL): een
   PaymentIntent en Payout worden als form-body met de juiste headers
   (Bearer + Idempotency-Key) verstuurd, een API-fout wordt een nette
   Error, en de webhook-handtekeningcontrole aanvaardt een echte Stripe-
   handtekening maar weigert een geknoeide of te oude.
   Draai los: node --experimental-sqlite --test test/stripe-eigen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const querystring = require('querystring');

function nepStripe(afhandelaar) {
  return new Promise((resolve) => {
    const laatste = { verzoeken: [] };
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', c => brok.push(c));
      req.on('end', () => {
        const ruw = Buffer.concat(brok).toString();
        laatste.verzoeken.push({ pad: req.url, form: querystring.parse(ruw), headers: req.headers, type: req.headers['content-type'] });
        const uit = afhandelaar(querystring.parse(ruw), req);
        res.statusCode = uit.status || 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(uit.json != null ? uit.json : {}));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, laatste, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

test('1. PaymentIntent + Payout: form-body, Bearer-sleutel en Idempotency-Key gaan mee', async () => {
  const server = await nepStripe((form, req) => {
    if (req.url === '/v1/payment_intents') return { json: { id: 'pi_1', status: 'requires_payment_method', client_secret: 'pi_1_secret' } };
    return { json: { id: 'po_1', status: 'pending' } };
  });
  const oud = process.env.STRIPE_BASE_URL; process.env.STRIPE_BASE_URL = server.base;
  try {
    // laad de client vers zodat hij de test-base oppikt
    delete require.cache[require.resolve('../server/stripe')];
    delete require.cache[require.resolve('../server/lib/http')];
    const Stripe = require('../server/stripe');
    const stripe = Stripe('sk_test_123');
    const pi = await stripe.paymentIntents.create(
      { amount: 1250, currency: 'eur', description: 'RTG Pass', metadata: { referentie: 'R-9' } },
      { idempotencyKey: 'idem-abc' });
    assert.equal(pi.id, 'pi_1');
    assert.equal(pi.status, 'requires_payment_method');
    const v = server.laatste.verzoeken[0];
    assert.match(v.type || '', /application\/x-www-form-urlencoded/, 'form-encoded body');
    assert.equal(v.headers['authorization'], 'Bearer sk_test_123');
    assert.equal(v.headers['idempotency-key'], 'idem-abc');
    assert.equal(v.form.amount, '1250');
    assert.equal(v.form['metadata[referentie]'], 'R-9', 'geneste metadata correct gecodeerd');
    const po = await stripe.payouts.create({ amount: 500, currency: 'eur' }, { idempotencyKey: 'idem-pay' });
    assert.equal(po.id, 'po_1');
    assert.equal(server.laatste.verzoeken[1].headers['idempotency-key'], 'idem-pay');
  } finally {
    server.srv.close();
    if (oud == null) delete process.env.STRIPE_BASE_URL; else process.env.STRIPE_BASE_URL = oud;
    delete require.cache[require.resolve('../server/stripe')];
  }
});

test('2. een API-fout wordt een nette Error met status en bericht', async () => {
  const server = await nepStripe(() => ({ status: 402, json: { error: { message: 'Your card was declined.', type: 'card_error' } } }));
  const oud = process.env.STRIPE_BASE_URL; process.env.STRIPE_BASE_URL = server.base;
  try {
    delete require.cache[require.resolve('../server/stripe')];
    const Stripe = require('../server/stripe');
    const stripe = Stripe('sk_test_123');
    await assert.rejects(
      () => stripe.paymentIntents.create({ amount: 100, currency: 'eur' }, {}),
      (e) => e.status === 402 && /declined/.test(e.message) && e.type === 'card_error');
  } finally {
    server.srv.close();
    if (oud == null) delete process.env.STRIPE_BASE_URL; else process.env.STRIPE_BASE_URL = oud;
    delete require.cache[require.resolve('../server/stripe')];
  }
});

test('3. webhook: een echte Stripe-handtekening wordt aanvaard, geknoei en ouderdom niet', () => {
  const Stripe = require('../server/stripe');
  const stripe = Stripe('sk_test_123');
  const secret = 'whsec_test';
  const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
  const t = Math.floor(Date.now() / 1000);
  const teken = (tijd, inhoud) => 't=' + tijd + ',v1=' + crypto.createHmac('sha256', secret).update(tijd + '.' + inhoud).digest('hex');

  // geldig
  const ev = stripe.webhooks.constructEvent(body, teken(t, body), secret);
  assert.equal(ev.type, 'payment_intent.succeeded');
  // geknoeide body
  assert.throws(() => stripe.webhooks.constructEvent('{"id":"evt_hack"}', teken(t, body), secret), /klopt niet/);
  // verkeerd secret
  assert.throws(() => stripe.webhooks.constructEvent(body, teken(t, body), 'whsec_ander'), /klopt niet/);
  // te oud (buiten de tolerantie)
  assert.throws(() => stripe.webhooks.constructEvent(body, teken(t - 10000, body), secret), /te oud/);
  // vormfout
  assert.throws(() => stripe.webhooks.constructEvent(body, 'onzin', secret), /Ongeldige Stripe-handtekening/);
});
