/* Eigen, dunne client voor de Stripe-API, i.p.v. het pakket 'stripe'. Dekt
   precies wat de betaal-naad (server/betaal.js) gebruikt: een PaymentIntent
   en een Payout aanmaken (met idempotentiesleutel), en de handtekening van
   een inkomende webhook verifieren. Draait op onze eigen HTTP-client, form-
   urlencoded zoals de Stripe-API verwacht. Geen dependency.

   const Stripe = require('./stripe'); const stripe = Stripe(SECRET_KEY);
   await stripe.paymentIntents.create(params, { idempotencyKey });
   stripe.webhooks.constructEvent(ruweBody, handtekening, secret);  */
'use strict';
const crypto = require('crypto');
const http = require('./lib/http');

const BASIS = (process.env.STRIPE_BASE_URL || 'https://api.stripe.com').replace(/\/+$/, '');

function Stripe(apiKey, opts) {
  opts = opts || {};
  const timeout = opts.timeout || 80000;

  async function post(pad, params, extra) {
    const headers = { authorization: 'Bearer ' + apiKey, 'user-agent': 'rtg-stripe/1', 'stripe-version': '2024-06-20' };
    if (extra && extra.idempotencyKey) headers['idempotency-key'] = String(extra.idempotencyKey);
    const r = await http.vraag({ url: BASIS + pad, form: params || {}, headers, timeout, maxRetries: 1 });
    let data = {}; try { data = r.json(); } catch (e) {}
    if (r.status >= 200 && r.status < 300) return data;
    const bericht = (data && data.error && data.error.message) || ('Stripe-API-fout ' + r.status);
    const fout = new Error(bericht);
    fout.status = r.status; fout.type = data && data.error && data.error.type; fout.raw = data;
    throw fout;
  }

  return {
    paymentIntents: { create(params, extra) { return post('/v1/payment_intents', params, extra); } },
    payouts: { create(params, extra) { return post('/v1/payouts', params, extra); } },
    webhooks: {
      /* Stripe-handtekening: de header is "t=<tijd>,v1=<hmac>,...". De getekende
         payload is `${t}.${ruweBody}`; de HMAC-SHA256 met het endpoint-secret
         moet overeenkomen met (een van) de v1-waarden. Constant-tijd vergeleken,
         en met een tolerantie op de tijd tegen replay (standaard 5 minuten). */
      constructEvent(ruweBody, handtekening, secret, toleranceSec) {
        const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
        const delen = {};
        for (const stuk of String(handtekening || '').split(',')) {
          const i = stuk.indexOf('='); if (i < 0) continue;
          const k = stuk.slice(0, i).trim(); const v = stuk.slice(i + 1).trim();
          if (k === 'v1') (delen.v1 = delen.v1 || []).push(v); else delen[k] = v;
        }
        if (!delen.t || !delen.v1 || !delen.v1.length) throw new Error('Ongeldige Stripe-handtekening (geen t/v1).');
        const verwacht = crypto.createHmac('sha256', secret).update(delen.t + '.' + buf.toString('utf8')).digest('hex');
        const verwB = Buffer.from(verwacht, 'utf8');
        const raak = delen.v1.some(v => { const g = Buffer.from(String(v), 'utf8'); return g.length === verwB.length && crypto.timingSafeEqual(g, verwB); });
        if (!raak) throw new Error('Stripe-handtekening klopt niet.');
        const tol = toleranceSec != null ? toleranceSec : 300;
        if (tol && Math.abs(Math.floor(Date.now() / 1000) - Number(delen.t)) > tol) throw new Error('Stripe-webhook is te oud (mogelijke replay).');
        return JSON.parse(buf.toString('utf8'));
      }
    }
  };
}

module.exports = Stripe;
