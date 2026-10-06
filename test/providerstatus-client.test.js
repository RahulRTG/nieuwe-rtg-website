/* INVARIANT 7: DE PROVIDERSTATUS KOMT NOOIT UIT WAT DE CLIENT STUURT.

   Een echte server, de echte deuren, en een nagemaakte Stripe op 127.0.0.1 die
   elke PaymentIntent op `processing` laat staan -- de kaart is dus NIET belast.
   Daarna probeert de client op elke weg die hij heeft de betaling als betaald te
   laten gelden:

     1. bij het opladen zelf velden meesturen die "betaald" zeggen
        (status, providerStatus, betaald, paid, bedrag, geladen);
     2. "terugkomen na de betaling": dezelfde oplading met dezelfde idem nog
        eens, nu met die velden;
     3. de webhook zelf aanroepen ZONDER handtekening;
     4. de webhook met een VERVALSTE handtekening (een ander geheim);
     5. de webhook met een kapotte handtekening op een geldige tijd.

   Na elke poging staat de wallet op nul en heet de betaling niet betaald.

   De TEGENPROEF hoort erbij, anders bewijst nul niets: dezelfde gebeurtenis
   met de ECHTE handtekening van de aanbieder schrijft precies 25 euro bij.
   Een instrument dat niet kan uitslaan, is geen instrument. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { startServer, stop } = require('./helper');

const GEHEIM = 'whsec_toets_' + crypto.randomBytes(8).toString('hex');
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let srv, base, provider, tmp;
const intents = new Map();

test.before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-providerstatus-'));
  /* De nagemaakte Stripe: maakt een PaymentIntent en laat hem op processing
     staan, ook bij opvragen. Alleen een ondertekende webhook kan dat veranderen. */
  provider = http.createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/payment_intents') {
      const p = new URLSearchParams(body);
      const id = 'pi_toets_' + (intents.size + 1);
      const intent = { id, object: 'payment_intent', status: 'processing', amount: Number(p.get('amount')),
        currency: p.get('currency') || 'eur', metadata: { referentie: p.get('metadata[referentie]') } };
      intents.set(id, intent);
      return res.end(JSON.stringify(intent));
    }
    const m = /^\/v1\/payment_intents\/([^/?]+)/.exec(req.url);
    if (req.method === 'GET' && m && intents.has(m[1])) return res.end(JSON.stringify(intents.get(m[1])));
    res.statusCode = 404; res.end(JSON.stringify({ error: { message: 'onbekend' } }));
  });
  await new Promise(r => provider.listen(0, '127.0.0.1', r));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', PAYMENT_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_local_fixture', STRIPE_WEBHOOK_SECRET: GEHEIM,
    STRIPE_BASE_URL: 'http://127.0.0.1:' + provider.address().port,
    MOLLIE_API_KEY: '', ADYEN_API_KEY: '', RTG_BETALEN_UIT: '0' } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  if (provider) provider.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* al weg */ }
});

const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const webhook = (ruw, koppen) => fetch(base + '/api/betaal/webhook', { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, koppen || {}), body: ruw })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const stripeHandtekening = (ruw, geheim, t = Math.floor(Date.now() / 1000)) =>
  't=' + t + ',v1=' + crypto.createHmac('sha256', geheim).update(t + '.' + ruw).digest('hex');

async function lid() {
  const u = Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const r = await api('/api/auth/register', { name: 'Status Toets', email: 'status-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1984-04-04', tier: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  return r.body.token;
}
const saldo = async token => (await api('/api/pay/overzicht', {}, token)).body.saldo;

test('de client kan een betaling op geen enkele weg zelf betaald maken; de ondertekende webhook wel', async () => {
  const token = await lid();
  const vals = { status: 'betaald', providerStatus: 'succeeded', betaald: true, paid: true,
    payment_status: 'paid', bedrag: 2500, geladen: 2500 };

  // 1. opladen met "betaald"-velden in het verzoek
  const op = await api('/api/pay/oplaad', Object.assign({ centen: 2500, idem: 'ps-1' }, vals), token);
  assert.equal(op.status, 402, 'de aanbieder zegt processing, dus de oplading wacht: ' + JSON.stringify(op.body));
  assert.equal(await saldo(token), 0);

  // 2. terugkomen na de betaling, met dezelfde idem en dezelfde valse velden
  const terug = await api('/api/pay/oplaad', Object.assign({ centen: 2500, idem: 'ps-1' }, vals), token);
  assert.notEqual(terug.body.ok, true, JSON.stringify(terug.body));
  assert.equal(await saldo(token), 0, 'terugkomen met "betaald" in het verzoek schrijft niets bij');

  // de route geeft het betaling-id niet terug; de enige PaymentIntent is van deze oplading
  assert.equal(intents.size, 1, 'precies een PaymentIntent, ook na het terugkomen');
  const intent = [...intents.values()][0];
  assert.match(String(intent.metadata.referentie), /^BW-/, JSON.stringify(intent));
  const gebeurtenis = { id: 'evt_ps_' + crypto.randomBytes(4).toString('hex'), type: 'payment_intent.succeeded',
    data: { object: Object.assign({}, intent, { status: 'succeeded', amount_received: 2500 }) } };
  const ruw = JSON.stringify(gebeurtenis);

  // 3. de webhook zonder handtekening
  assert.equal((await webhook(ruw)).status, 400);
  // 4. met een vervalste handtekening (een ander geheim)
  assert.equal((await webhook(ruw, { 'stripe-signature': stripeHandtekening(ruw, 'whsec_vervalst') })).status, 400);
  // 5. met een kapotte handtekening, en met de demo-kop die een ander pad kiest
  assert.equal((await webhook(ruw, { 'stripe-signature': 't=1,v1=' + 'a'.repeat(64) })).status, 400);
  assert.equal((await webhook(ruw, { 'x-rtg-signature': crypto.createHmac('sha256', 'whsec_vervalst').update(ruw).digest('hex') })).status, 400);
  assert.equal(await saldo(token), 0, 'geen enkele niet-ondertekende melding schrijft iets bij');

  // TEGENPROEF: de echte handtekening van de aanbieder
  const echt = await webhook(ruw, { 'stripe-signature': stripeHandtekening(ruw, GEHEIM) });
  assert.equal(echt.status, 200, JSON.stringify(echt.body));
  assert.equal(await saldo(token), 2500, 'de ondertekende bevestiging schrijft precies het bedrag bij');
  // en een herhaling van diezelfde ondertekende melding doet niets meer
  assert.equal((await webhook(ruw, { 'stripe-signature': stripeHandtekening(ruw, GEHEIM) })).status, 200);
  assert.equal(await saldo(token), 2500);
});
