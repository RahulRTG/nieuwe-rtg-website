/* Lokale protocolproef, geen Stripe-sandbox of echte inning. De echte dunne
   client en betaaladapter spreken uitsluitend deze loopbackserver. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');

async function tuig(t) {
  const requests = [], cache = new Map();
  const metadata = { referentie: 'BW-eerste', toestemmingRef: 'ctr-1:tekening-1' };
  const state = {
    session: { id: 'cs_test_eerste', mode: 'payment', status: 'complete', payment_status: 'paid',
      customer: 'cus_eigen', payment_intent: 'pi_eerste', client_reference_id: metadata.referentie, metadata },
    intent: { id: 'pi_eerste', customer: 'cus_eigen', payment_method: 'pm_eigen',
      status: 'succeeded', amount: 1250, amount_received: 1250, currency: 'eur',
      setup_future_usage: 'off_session', latest_charge: 'ch_eerste', metadata },
    setup: { id: 'seti_eerste', status: 'succeeded', usage: 'off_session', customer: 'cus_eigen',
      payment_method: 'pm_eigen', mandate: null, metadata },
    method: { id: 'pm_eigen', customer: 'cus_eigen', type: 'card', card: { last4: '4242' } },
    charge: { id: 'ch_eerste', customer: 'cus_eigen', payment_intent: 'pi_eerste',
      payment_method: 'pm_eigen', payment_method_details: { type: 'card', card: { mandate: null } } },
    mandate: { id: 'mandate_eigen', status: 'active', type: 'multi_use', payment_method: 'pm_eigen' },
    failCreate: false
  };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
    requests.push({ method: req.method, path: req.url, body, headers: req.headers });
    let result, code = 200;
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') result = {
      id: 'cs_test_eerste', mode: body.mode, status: 'open', payment_status: 'unpaid',
      url: 'https://checkout.stripe.com/c/pay/synthetisch' };
    else if (req.method === 'POST' && req.url === '/v1/payment_intents') {
      if (state.failCreate) { code = 402; result = { error: { message: 'authentication required',
        type: 'card_error', code: 'authentication_required', payment_intent: { id: state.intent.id } } }; }
      else result = state.intent;
    } else if (req.url === '/v1/checkout/sessions/cs_test_eerste') result = state.session;
    else if (req.url === '/v1/payment_intents/pi_eerste') result = state.intent;
    else if (req.url === '/v1/setup_intents/seti_eerste') result = state.setup;
    else if (req.url === '/v1/payment_methods/' + state.method.id) result = state.method;
    else if (req.url === '/v1/charges/ch_eerste') result = state.charge;
    else if (req.url === '/v1/mandates/mandate_eigen') result = state.mandate;
    else { code = 404; result = { error: { message: 'Onverwacht testpad: ' + req.url } }; }
    res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(result));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const old = { NODE_ENV: process.env.NODE_ENV, STRIPE_BASE_URL: process.env.STRIPE_BASE_URL };
  process.env.NODE_ENV = 'test'; process.env.STRIPE_BASE_URL = 'http://127.0.0.1:' + server.address().port;
  delete require.cache[require.resolve('../server/stripe')];
  const stripe = require('../server/stripe')('sk_test_local_protocol_only');
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete require.cache[require.resolve('../server/stripe')];
  });
  const rail = require('../server/betaal/ontvangst')({ crypto, stripe, standaard: 'stripe',
    env: { STRIPE_PUBLIC_KEY: 'pk_test_localprotocol', STRIPE_SECRET_KEY: 'sk_test_localprotocol' },
    get: k => cache.get(k), set: (k, v) => cache.set(k, v) });
  return { state, requests, rail, cache, stripe };
}
const eerste = () => ({ aanbieder: 'stripe', methode: 'hosted', bedrag: 1250, valuta: 'eur',
  referentie: 'BW-eerste', idempotentieSleutel: 'waarheid:BW-eerste', returnUrl: 'https://rtg.invalid/terug',
  terugkerend: { modus: 'vastleggen', toestemmingRef: 'ctr-1:tekening-1' } });
const innen = () => ({ ...eerste(), methode: undefined, terugkerend: { modus: 'innen',
  toestemmingRef: 'ctr-1:tekening-1', customerId: 'cus_eigen', paymentMethodId: 'pm_eigen' } });
const naslag = () => ({ aanbieder: 'stripe', providerId: 'cs_test_eerste',
  referentie: 'BW-eerste', toestemmingRef: 'ctr-1:tekening-1' });

test('eerste betaling: hosted bewaart uitsluitend na expliciete servertoestemming', async t => {
  const a = await tuig(t); await a.rail.maakBetaling(eerste());
  const r = a.requests[0];
  assert.equal(r.body.mode, 'payment'); assert.equal(r.body.customer_creation, 'always');
  assert.equal(r.body['payment_intent_data[setup_future_usage]'], 'off_session');
  assert.equal(r.body['payment_intent_data[metadata][toestemmingRef]'], 'ctr-1:tekening-1');
  assert.equal(r.body['line_items[0][price_data][unit_amount]'], '1250');
  assert.equal(r.headers['idempotency-key'], 'waarheid:BW-eerste');
  const one = eerste(); delete one.terugkerend; one.idempotentieSleutel = 'eenmalig';
  await a.rail.maakBetaling(one);
  assert.equal(a.requests[1].body.customer_creation, undefined);
});

test('nul-eerste gebruikt setup-only: geen line_items, bedrag of BW-betaling', async t => {
  const a = await tuig(t);
  const r = await a.rail.maakBetaalafspraak({ ...naslag(), idempotentieSleutel: 'setup:ctr-1', returnUrl: eerste().returnUrl });
  assert.equal(r.status, 'wachtend'); assert.equal(r.checkoutUrl.startsWith('https://checkout.stripe.com/'), true);
  const p = a.requests[0]; assert.equal(p.body.mode, 'setup'); assert.equal(p.body.customer_creation, 'always');
  assert.equal(p.body['setup_intent_data[metadata][toestemmingRef]'], naslag().toestemmingRef);
  assert.equal(Object.keys(p.body).some(k => /amount|line_items|payment_intent_data/.test(k)), false);
  assert.equal(a.requests.some(x => x.path === '/v1/payment_intents'), false);
});

test('betaalafspraak komt uit authenticated GET, niet uit aangeleverde customer/kaartvelden', async t => {
  const a = await tuig(t);
  const r = await a.rail.haalBetaalafspraak({ ...naslag(), customerId: 'cus_vreemd', paymentMethodId: 'pm_vreemd' });
  assert.equal(r.status, 'gereed'); assert.equal(r.customerId, 'cus_eigen'); assert.equal(r.paymentMethodId, 'pm_eigen');
  assert.equal(r.mandateId, null); assert.equal(JSON.stringify(r).includes('4242'), false);
  assert.deepEqual(a.requests.map(x => x.method), ['GET', 'GET', 'GET', 'GET']);
  assert.ok(a.requests.every(x => x.headers.authorization === 'Bearer sk_test_local_protocol_only'));
});

test('setup-afspraak verifieert de SetupIntent en presenteert geen betaaldstatus', async t => {
  const a = await tuig(t); a.state.session.mode = 'setup'; a.state.session.payment_status = 'no_payment_required';
  delete a.state.session.payment_intent; a.state.session.setup_intent = 'seti_eerste';
  const r = await a.rail.haalBetaalafspraak(naslag());
  assert.equal(r.status, 'gereed'); assert.equal(r.setupIntentId, 'seti_eerste');
  assert.equal(r.betaalId, null); assert.equal(r.bedrag, undefined);
});

test('open of processing afspraak geeft geen herbruikbare betaalmethode vrij', async t => {
  const a = await tuig(t); a.state.session.status = 'open';
  let r = await a.rail.haalBetaalafspraak(naslag()); assert.equal(r.status, 'wachtend'); assert.equal(r.customerId, undefined);
  a.state.session.status = 'complete'; a.state.intent.status = 'processing';
  r = await a.rail.haalBetaalafspraak(naslag()); assert.equal(r.status, 'wachtend'); assert.equal(r.paymentMethodId, undefined);
});

test('verwisselde sessie, consent, intent of eigenaar weigert zonder nieuwe inning', async t => {
  const a = await tuig(t);
  for (const mutate of [
    () => { a.state.session.metadata.toestemmingRef = 'anders'; },
    () => { a.state.intent.customer = 'cus_vreemd'; },
    () => { a.state.method.customer = 'cus_vreemd'; },
    () => { a.state.intent.setup_future_usage = 'on_session'; },
    () => { a.state.charge.payment_intent = 'pi_vreemd'; }
  ]) {
    const before = structuredClone(a.state); mutate();
    await assert.rejects(a.rail.haalBetaalafspraak(naslag())); Object.assign(a.state, before);
  }
  assert.equal(a.requests.some(x => x.method === 'POST'), false);
});

test('SEPA mandate moet actief, multi-use en aan dezelfde betaalmethode gebonden zijn', async t => {
  const a = await tuig(t); a.state.method.type = 'sepa_debit';
  a.state.charge.payment_method_details = { type: 'sepa_debit', sepa_debit: { mandate: 'mandate_eigen' } };
  assert.equal((await a.rail.haalBetaalafspraak(naslag())).mandateId, 'mandate_eigen');
  for (const [key, value] of [['status', 'inactive'], ['type', 'single_use'], ['payment_method', 'pm_vreemd']]) {
    const old = a.state.mandate[key]; a.state.mandate[key] = value;
    await assert.rejects(a.rail.haalBetaalafspraak(naslag())); a.state.mandate[key] = old;
  }
});

test('volgende termijn gebruikt dezelfde rail met confirm/off_session, fixed key en geen kaartdata', async t => {
  const a = await tuig(t); const o = innen();
  await a.rail.maakBetaling(o); await a.rail.maakBetaling(o);
  assert.equal(a.requests.length, 1);
  const p = a.requests[0]; assert.equal(p.path, '/v1/payment_intents');
  assert.equal(p.body.confirm, 'true'); assert.equal(p.body.off_session, 'true');
  assert.equal(p.body.customer, 'cus_eigen'); assert.equal(p.body.payment_method, 'pm_eigen');
  assert.equal(p.body['metadata[toestemmingRef]'], 'ctr-1:tekening-1');
  assert.equal(Object.keys(p.body).some(k => /card\[|payment_method_data/.test(k)), false);
  await assert.rejects(a.rail.maakBetaling({ ...o, terugkerend: { ...o.terugkerend, customerId: 'cus_vreemd' } }));
  assert.equal(a.requests.length, 1, 'gewijzigde ontvangst mag de cache niet als toestemming gebruiken');
});

test('off-session authentication_required hervindt de bestaande PI, maar bevestigt geen betaling', async t => {
  const a = await tuig(t); a.state.failCreate = true; a.state.intent.status = 'requires_action';
  a.state.intent.amount_received = 0; a.state.intent.client_secret = 'pi_eerste_secret_test';
  const r = await a.rail.maakBetaling(innen());
  assert.equal(r.id, 'pi_eerste'); assert.equal(r.status, 'requires_action'); assert.equal(r.bedrag, 1250);
  assert.equal(a.requests.filter(x => x.method === 'POST').length, 1);
  assert.equal(a.requests[1].path, '/v1/payment_intents/pi_eerste');
});

test('ongeldige recurring-opties weigeren vóór providerverkeer', async t => {
  const a = await tuig(t);
  for (const terugkerend of [{ modus: 'innen' }, { ...innen().terugkerend, paymentMethodId: 'tok_raw' },
    { ...eerste().terugkerend, customerId: 'cus_vreemd' }, { ...innen().terugkerend, card: '4242' }])
    await assert.rejects(a.rail.maakBetaling({ ...innen(), terugkerend }));
  await assert.rejects(a.rail.maakBetaling({ ...eerste(), methode: undefined }));
  assert.equal(a.requests.length, 0);
});

test('BW startopties bewaren een gevalideerde kopie die herstart en invoermutatie overleeft', () => {
  const { startVan } = require('../server/kern/betaalwaarheid/hervat'); const o = innen();
  const s = startVan(o); assert.deepEqual(s.terugkerend, o.terugkerend);
  o.terugkerend.customerId = 'cus_vreemd'; assert.equal(s.terugkerend.customerId, 'cus_eigen');
  assert.deepEqual(startVan(JSON.parse(JSON.stringify(s))), s);
});

test('setup-herhaling blijft dezelfde afspraak; gewijzigde referentie of consent is een conflict', async t => {
  const a = await tuig(t);
  const o = { ...naslag(), idempotentieSleutel: 'setup:ctr-1', returnUrl: eerste().returnUrl };
  const r = await a.rail.maakBetaalafspraak(o); r.providerId = 'cs_vervalst';
  assert.equal((await a.rail.maakBetaalafspraak(o)).providerId, 'cs_test_eerste');
  for (const veld of ['referentie', 'toestemmingRef', 'returnUrl'])
    await assert.rejects(a.rail.maakBetaalafspraak({ ...o, [veld]: 'anders' }));
  assert.equal(a.requests.length, 1);
});

test('betaalstop en andere provider weigeren setup plus ophalen vóór netwerkverkeer', async t => {
  const a = await tuig(t);
  const dicht = require('../server/betaal/ontvangst')({ crypto, stripe: a.stripe,
    standaard: 'stripe', env: {}, uit: true, get() {}, set() {} });
  const o = { ...naslag(), idempotentieSleutel: 'setup:ctr-1', returnUrl: eerste().returnUrl };
  await assert.rejects(dicht.maakBetaalafspraak(o)); await assert.rejects(dicht.haalBetaalafspraak(naslag()));
  await assert.rejects(a.rail.maakBetaalafspraak({ ...o, aanbieder: 'mollie' }));
  await assert.rejects(a.rail.haalBetaalafspraak({ ...naslag(), aanbieder: 'mollie' }));
  assert.equal(a.requests.length, 0);
});

test('een 402 over een vreemde intent en succeeded zonder ontvangen geld geven geen succes', async t => {
  const a = await tuig(t); a.state.failCreate = true;
  a.state.intent.metadata = { ...a.state.intent.metadata, referentie: 'BW-vreemd' };
  await assert.rejects(a.rail.maakBetaling(innen()), e => e.code === 'BETAALAFSPRAAK_CONFLICT' && !e.nietVerstuurd);
  a.state.failCreate = false; a.state.intent.metadata.referentie = 'BW-eerste'; a.state.intent.amount_received = 0;
  await assert.rejects(a.rail.maakBetaling(innen()), e => e.code === 'BETAALAFSPRAAK_CONFLICT');
  assert.equal(a.cache.size, 0, 'geen geslaagde ontvangst gecachet');
});

test('BW-herstart houdt dezelfde off-sessionopdracht en een requires_action-retry blijft onbetaald', async t => {
  const a = await tuig(t); a.state.failCreate = true; a.state.intent.status = 'requires_action';
  a.state.intent.amount_received = 0;
  const maak = require('../server/kern/betaalwaarheid'); let data = {}, snapshot, afhandelingen = 0;
  const save = () => { snapshot = JSON.stringify(data); };
  let w = maak({ d: () => data, save, crypto, betaal: a.rail });
  const p = w.maak({ actor: 'user-eigen', idem: 'termijn-2', soort: 'factuur', bronRef: 'inv-2', centen: 1250 });
  a.state.intent.metadata = { referentie: p.id, toestemmingRef: 'ctr-1:tekening-1' };
  w.bereidVoor(p.id, innen()); data = JSON.parse(snapshot);
  w = maak({ d: () => data, save, crypto, betaal: a.rail });
  w.registreerAfhandeling('factuur', () => { afhandelingen++; });
  let uit = await w.begin(p.id, w.van(p.id).start);
  assert.equal(uit.betaling.status, 'WACHT_OP_KLANT'); assert.equal(afhandelingen, 0);
  data = JSON.parse(snapshot); w = maak({ d: () => data, save, crypto, betaal: a.rail });
  w.registreerAfhandeling('factuur', () => { afhandelingen++; });
  uit = await w.begin(p.id, {});
  assert.equal(uit.betaling.status, 'WACHT_OP_KLANT'); assert.equal(afhandelingen, 0);
  assert.equal(a.requests.filter(r => r.method === 'POST').length, 1, 'retry haalt de bestaande PI op');
  a.state.intent.status = 'succeeded'; a.state.intent.amount_received = 1250;
  uit = await w.begin(p.id, {}); await w.begin(p.id, {});
  assert.equal(uit.betaling.status, 'BEVESTIGD'); assert.equal(afhandelingen, 1);
});

test('klantactieprotocol haalt bestaande 402-PI en kaart op; geen tweede create of serverconfirm', async t => {
  const a = await tuig(t); a.state.failCreate = true;
  Object.assign(a.state.intent, { status: 'requires_payment_method', amount_received: 0,
    payment_method: null, last_payment_error: { decline_code: 'authentication_required', payment_method: { id: 'pm_eigen' } },
    client_secret: 'pi_eerste_secret_protocol', confirmation_method: 'automatic', livemode: false,
    payment_method_types: ['card', 'sepa_debit'] });
  const p = await a.rail.maakBetaling(innen());
  assert.equal(JSON.stringify([...a.cache.values()]).includes('_secret_'), false,
    'de duurzame idemring bewaart geen tijdelijke klantsecret');
  const actie = await a.rail.haalKlantactie({ ...innen(), providerId: p.id });
  assert.equal(actie.paymentMethodId, 'pm_eigen'); assert.equal(actie.nieuweBetaalmethode, false);
  assert.equal(a.requests.filter(r => r.method === 'POST').length, 1);
  assert.deepEqual(a.requests.map(r => r.path), ['/v1/payment_intents', '/v1/payment_intents/pi_eerste',
    '/v1/payment_intents/pi_eerste', '/v1/payment_methods/pm_eigen']);
  assert.equal(a.requests.every(r => /^Bearer sk_test_/.test(r.headers.authorization)), true);
});

test('zelfde PI na klantbevestiging bindt bedrag, owner en consent opnieuw vóór betaald bewijs', async t => {
  const a = await tuig(t), original = structuredClone(a.state.intent);
  const opdracht = innen();
  assert.equal((await a.rail.haalBetaling('stripe', 'pi_eerste', opdracht)).status, 'succeeded');
  for (const wijzig of [p => p.customer = 'cus_vreemd', p => p.metadata.referentie = 'BW-vreemd',
    p => p.metadata.toestemmingRef = 'vreemd', p => p.amount++, p => p.amount_received--, p => p.currency = 'usd']) {
    a.state.intent = structuredClone(original); wijzig(a.state.intent);
    await assert.rejects(a.rail.haalBetaling('stripe', 'pi_eerste', opdracht));
  }
  assert.equal(a.requests.every(r => r.method === 'GET'), true);
});

test('nieuwe kaart krijgt pas na authenticated PI+PM+Charge een nieuwe terugkerende afspraak', async t => {
  const a = await tuig(t); a.state.intent.payment_method = a.state.method.id = a.state.charge.payment_method = 'pm_nieuw';
  const r = await a.rail.haalBetaalafspraak({ ...naslag(), providerId: 'pi_eerste',
    customerId: 'cus_eigen', paymentMethodId: 'pm_eigen' });
  assert.equal(r.paymentMethodId, 'pm_nieuw'); assert.equal(r.status, 'gereed');
  assert.deepEqual(a.requests.map(r => r.path), ['/v1/payment_intents/pi_eerste',
    '/v1/payment_methods/pm_nieuw', '/v1/charges/ch_eerste']);
  assert.equal(a.requests.every(r => r.method === 'GET'), true);
});
