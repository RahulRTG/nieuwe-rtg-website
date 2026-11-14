/* Volledige server/auth/SQLite/factuur/BW-keten over HTTP. Stripe is een
   expliciet lokale protocolserver; geen echte kaart, mail of live provider. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), crypto = require('node:crypto');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { startServer, stopNet } = require('./helper');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-abonnement-http-'));
let srv, provider, sessie, intent, gemaakt = 0, token;
const env = { NODE_ENV: 'test', RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '',
  RTG_KLOK: '', SMTP_URL: '', RTG_BETALEN_UIT: '0', RTG_MAGNAAT_TEST: '1',
  STRIPE_UITGAAND_UIT_BEWUST: '1', STRIPE_SECRET_KEY: 'sk_test_abonnement_http',
  STRIPE_PUBLIC_KEY: 'pk_test_abonnement_http', STRIPE_WEBHOOK_SECRET: 'whsec_abonnement_http',
  MOLLIE_API_KEY: '', ADYEN_API_KEY: '', RTG_ABONNEMENTEN_ZELFSERVICE: '1', APP_URL: 'https://rtg.example' };
async function api(pad, body = {}, bearer = token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
const eigen = (pad, body, bearer) => api('/api/mijn/abonnement/automatisch/' + pad, body, bearer);
function inspecteer() {
  const code = "const a=require('./server/accounts');a.init();const o=require('./server/db');o.load();" +
    "console.log(JSON.stringify({tier:a.getUserById(1).tier,md:a.getMemberState(1),contracten:o.db.data.contracten,bw:o.db.data.betaalWaarheid}));";
  const r = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout.trim().split('\n').at(-1));
}
test.before(async () => {
  const seed = spawnSync(process.execPath, ['-e', "const a=require('./server/accounts');a.init();" +
    "const u=a.createUserSync({email:'abonnement-http@example.test',realName:'Synthetisch lid',password:'proefwachtwoord123',tier:'guest'});" +
    "a.saveMemberState(u.id,{geboren:'1990-01-01',invoices:[]});a.checkpoint();"],
  { cwd: path.join(__dirname, '..'), env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);
  provider = http.createServer(async (req, res) => {
    try {
      assert.equal(req.headers.authorization, 'Bearer ' + env.STRIPE_SECRET_KEY);
      let raw = ''; for await (const b of req) raw += b;
      const form = new URLSearchParams(raw);
      let uit;
      if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
        gemaakt++;
        assert.ok(req.headers['idempotency-key']);
        assert.equal(form.get('payment_intent_data[setup_future_usage]'), 'off_session');
        assert.equal(form.get('success_url'), 'https://rtg.example/apps/geld.html?abonnement=herstel#lidmaatschap');
        assert.equal(form.get('line_items[0][price_data][unit_amount]'), '25000');
        const metadata = { referentie: form.get('metadata[referentie]'), toestemmingRef: form.get('metadata[toestemmingRef]') };
        sessie = { id: 'cs_http', mode: 'payment', status: 'open', payment_status: 'unpaid',
          payment_intent: 'pi_http', customer: 'cus_http', client_reference_id: metadata.referentie,
          metadata, amount_total: 25000, currency: 'eur', url: 'https://checkout.stripe.com/c/synthetisch' };
        intent = { id: 'pi_http', status: 'requires_action', amount: 25000, amount_received: 0,
          currency: 'eur', metadata, customer: 'cus_http', payment_method: 'pm_http', latest_charge: 'ch_http',
          setup_future_usage: 'off_session' };
        uit = sessie;
      } else if (req.url === '/v1/checkout/sessions/cs_http') uit = sessie;
      else if (req.url === '/v1/payment_intents/pi_http') uit = intent;
      else if (req.url === '/v1/payment_methods/pm_http') uit = { id: 'pm_http', customer: 'cus_http', type: 'card' };
      else if (req.url === '/v1/charges/ch_http') uit = { id: 'ch_http', customer: 'cus_http', payment_intent: 'pi_http',
        payment_method: 'pm_http', payment_method_details: { type: 'card', card: {} } };
      else throw Error('Onverwachte providerroute: ' + req.method + ' ' + req.url);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(uit));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: e.message } })); }
  });
  await new Promise(r => provider.listen(0, '127.0.0.1', r));
  srv = await startServer({ env: { ...env, STRIPE_BASE_URL: 'http://127.0.0.1:' + provider.address().port } });
  const login = await api('/api/auth/login', { login: 'abonnement-http@example.test', password: 'proefwachtwoord123', pasApp: 'rtg' }, null);
  assert.equal(login.status, 200, JSON.stringify(login.body)); token = login.body.token;
});
test.after(async () => {
  await stopNet(srv?.child);
  if (provider) { provider.closeAllConnections(); await new Promise(r => provider.close(r)); }
  fs.rmSync(dir, { recursive: true, force: true });
});
test('eigen gratis account kan aanbieden, tekenen, betalen en herstellen via echte routes, zonder dubbele inning', async () => {
  assert.equal((await eigen('stand', {}, null)).status, 401);
  assert.equal((await eigen('stand')).body.beschikbaar, true);
  const b = { pas: 'rtg', frequentie: 'maand', idempotencyKey: crypto.randomUUID() };
  const aanbod = await eigen('aanbod', b);
  assert.equal(aanbod.status, 200, JSON.stringify(aanbod.body));
  const c = aanbod.body.contract, contractId = c.id;
  assert.equal((await eigen('aanbod', b)).body.contract.id, contractId);
  assert.equal((await eigen('teken', { contractId, aanbodHash: c.aanbod.hash,
    naam: 'Synthetisch lid', akkoord: true, doorlopendeBetalingAkkoord: true })).status, 200);
  assert.equal(inspecteer().tier, 'guest');
  const betaald = await eigen('betalen', { contractId });
  assert.equal(betaald.status, 200, JSON.stringify(betaald.body));
  assert.equal(betaald.body.status, 'WACHT_OP_KLANT');
  assert.equal(gemaakt, 1);
  assert.equal((await eigen('herstel', { contractId })).body.status, 'WACHT_OP_KLANT');
  assert.equal(inspecteer().tier, 'guest');
  sessie.status = 'complete'; sessie.payment_status = 'paid'; intent.status = 'succeeded'; intent.amount_received = 25000;
  const raw = JSON.stringify({ id: 'evt_http_abonnement', type: 'checkout.session.completed', data: { object: sessie } });
  const tijd = Math.floor(Date.now() / 1000);
  const handtekening = crypto.createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(tijd + '.' + raw).digest('hex');
  for (let n = 0; n < 2; n++) {
    const webhook = await fetch(srv.base + '/api/betaal/webhook', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + tijd + ',v1=' + handtekening }, body: raw });
    assert.equal(webhook.status, 200, await webhook.text());
  }
  assert.equal(inspecteer().tier, 'rtg', 'webhook activeert zonder dat de klant de herstelknop moet indrukken');
  const hersteld = await eigen('herstel', { contractId });
  assert.equal(hersteld.status, 200, JSON.stringify(hersteld.body));
  assert.equal(hersteld.body.status, 'ACTIEF');
  const vers = inspecteer(), factuur = vers.md.invoices.find(i => i.abonnement?.contractId === contractId);
  assert.equal(vers.tier, 'rtg'); assert.equal(factuur.status, 'paid');
  assert.equal(factuur.betaalBewijzen.length, 1);
  assert.equal((await eigen('herstel', { contractId })).body.status, 'ACTIEF');
  assert.equal(gemaakt, 1);
});
