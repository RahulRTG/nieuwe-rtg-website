/* INVARIANT 7: DE PROVIDERSTATUS KOMT NOOIT UIT WAT DE CLIENT STUURT.

   Een echte server, de echte deuren, en een nagemaakte Stripe op 127.0.0.1.
   De client probeert op elke weg die hij heeft een betaling als betaald te laten
   gelden:

     1. bij het opladen zelf velden meesturen die "betaald" zeggen
        (status, providerStatus, betaald, paid, bedrag, geladen);
     2. "terugkomen na de betaling": dezelfde oplading met dezelfde idem nog
        eens, met die velden;
     3. de webhook zelf aanroepen ZONDER handtekening;
     4. de webhook met een VERVALSTE handtekening (een ander geheim);
     5. de webhook met een kapotte handtekening op een geldige tijd.

   SINDS DE VRIJGAVELAAG (server/kern/vrijgave/) komt stap 1 niet eens meer bij
   de aanbieder. Een echte providernaam is nooit een neprail, en zonder
   releasegebonden bewijs staat geld.opwaarderen in deze wereld DICHT: de
   oplading wordt geweigerd en de nagemaakte Stripe ziet nul PaymentIntents.
   Dat bewijs valt in een toets niet na te maken -- en dat is de bedoeling:
   credentials zijn nooit "aan". Wat hier eerst 402 (wacht op de aanbieder) was,
   is nu 503 van de poort, en de bewering is strenger geworden: er begint niets.

   De TEGENPROEF hoort erbij, anders bewijst een 400 niets: dezelfde gebeurtenis
   met de ECHTE handtekening van de aanbieder wordt aangenomen (200) -- de
   weigeringen hierboven zijn dus geen deur die alles weigert. Ze schrijft niets
   bij, want RTG is die betaling nooit begonnen: een melding van de aanbieder
   over een betaling die RTG niet kent, maakt geen geld. Dat de ondertekende
   melding een LOPENDE oplading wel precies een keer bijschrijft, staat in
   test/oplaadwebhook-crash.test.js (in een proefwereld met een open poort). */
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

test('de client kan een betaling op geen enkele weg zelf betaald maken; de ondertekende webhook wel aangenomen', async () => {
  const token = await lid();
  const vals = { status: 'betaald', providerStatus: 'succeeded', betaald: true, paid: true,
    payment_status: 'paid', bedrag: 2500, geladen: 2500 };

  // 1. opladen met "betaald"-velden in het verzoek: de poort weigert, de aanbieder ziet niets
  const op = await api('/api/pay/oplaad', Object.assign({ centen: 2500, idem: 'ps-1' }, vals), token);
  assert.equal(op.status, 503, 'een echte rail zonder releasebewijs is dicht: ' + JSON.stringify(op.body));
  assert.equal(op.body.capability, 'geld.opwaarderen', JSON.stringify(op.body));
  assert.equal(await saldo(token), 0);

  // 2. terugkomen na de betaling, met dezelfde idem en dezelfde valse velden
  const terug = await api('/api/pay/oplaad', Object.assign({ centen: 2500, idem: 'ps-1' }, vals), token);
  assert.notEqual(terug.body.ok, true, JSON.stringify(terug.body));
  assert.equal(await saldo(token), 0, 'terugkomen met "betaald" in het verzoek schrijft niets bij');
  assert.equal(intents.size, 0, 'een geweigerde oplading bereikt de aanbieder nooit');

  /* Een gebeurtenis zoals de aanbieder hem zou sturen, voor een betaling die
     RTG nooit begon. Met opzet GEEN referentie in RTG's eigen vorm (BW-...):
     zo'n melding is mogelijk sneller dan het eigen record en krijgt daarom een
     5xx zodat de aanbieder het opnieuw probeert (kern/betaalwaarheid). */
  const intent = { id: 'pi_toets_vreemd', object: 'payment_intent', status: 'succeeded', amount: 2500,
    amount_received: 2500, currency: 'eur', metadata: { referentie: 'EXTERN-ONBEKEND' } };
  const gebeurtenis = { id: 'evt_ps_' + crypto.randomBytes(4).toString('hex'), type: 'payment_intent.succeeded',
    data: { object: intent } };
  const ruw = JSON.stringify(gebeurtenis);

  // 3. de webhook zonder handtekening
  assert.equal((await webhook(ruw)).status, 400);
  // 4. met een vervalste handtekening (een ander geheim)
  assert.equal((await webhook(ruw, { 'stripe-signature': stripeHandtekening(ruw, 'whsec_vervalst') })).status, 400);
  // 5. met een kapotte handtekening, en met de demo-kop die een ander pad kiest
  assert.equal((await webhook(ruw, { 'stripe-signature': 't=1,v1=' + 'a'.repeat(64) })).status, 400);
  assert.equal((await webhook(ruw, { 'x-rtg-signature': crypto.createHmac('sha256', 'whsec_vervalst').update(ruw).digest('hex') })).status, 400);
  assert.equal(await saldo(token), 0, 'geen enkele niet-ondertekende melding schrijft iets bij');

  // TEGENPROEF: de echte handtekening van de aanbieder wordt aangenomen ...
  const echt = await webhook(ruw, { 'stripe-signature': stripeHandtekening(ruw, GEHEIM) });
  assert.equal(echt.status, 200, JSON.stringify(echt.body));
  // ... en maakt geen geld voor een betaling die RTG nooit begon
  assert.equal(await saldo(token), 0, 'een ondertekende melding over een onbekende betaling schrijft niets bij');
});
