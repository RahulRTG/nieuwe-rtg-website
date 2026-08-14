/* Dunne Mollie-client voor de betaalnaad. Geen SDK en geen extra dependency:
   alleen de vier handelingen die RTG nodig heeft. De client geeft provider-
   antwoorden ongewijzigd terug; de betekenis van een status woont in de
   betaalwaarheid en niet in deze transportlaag. */
'use strict';

const standaardHttp = require('./lib/http');

function Mollie(apiKey, opties) {
  opties = opties || {};
  const http = opties.http || standaardHttp;
  const basis = String(opties.baseUrl || process.env.MOLLIE_BASE_URL || 'https://api.mollie.com')
    .replace(/\/+$/, '');
  const timeout = opties.timeout || 80000;

  async function vraag(methode, pad, inhoud, extra) {
    const headers = {
      authorization: 'Bearer ' + apiKey,
      'user-agent': 'rtg-mollie/1'
    };
    if (extra && extra.idempotencyKey) headers['idempotency-key'] = String(extra.idempotencyKey);
    const r = await http.vraag({
      url: basis + pad,
      method: methode,
      json: inhoud === undefined ? undefined : inhoud,
      headers,
      timeout,
      maxRetries: 1
    });
    let data = {};
    try { data = r.json(); } catch (e) {}
    if (r.status >= 200 && r.status < 300) return data;
    const bericht = data && data.detail ? data.detail : ('Mollie-API-fout ' + r.status);
    const fout = new Error(bericht);
    fout.status = r.status;
    fout.raw = data;
    throw fout;
  }

  const enc = (v) => encodeURIComponent(String(v));
  return {
    payments: {
      create(params, extra) { return vraag('POST', '/v2/payments', params, extra); },
      retrieve(id) { return vraag('GET', '/v2/payments/' + enc(id)); }
    },
    refunds: {
      create(paymentId, params, extra) {
        return vraag('POST', '/v2/payments/' + enc(paymentId) + '/refunds', params, extra);
      },
      retrieve(paymentId, refundId) {
        return vraag('GET', '/v2/payments/' + enc(paymentId) + '/refunds/' + enc(refundId));
      }
    }
  };
}

module.exports = Mollie;
