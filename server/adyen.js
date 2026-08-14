/* Dunne Adyen-client voor Pay by Link, statuscontrole en refunds. Kaartgegevens
   komen nooit bij RTG: de klant betaalt op Adyens gehoste pagina. De betekenis
   van providerstatussen blijft in kern/betaalwaarheid wonen. */
'use strict';

const crypto = require('crypto');
const standaardHttp = require('./lib/http');

module.exports = function Adyen(apiKey, opties) {
  opties = opties || {};
  const http = opties.http || standaardHttp;
  const basis = String(opties.baseUrl || process.env.ADYEN_CHECKOUT_BASE_URL ||
    'https://checkout-test.adyen.com/v72').replace(/\/+$/, '');
  const merchantAccount = String(opties.merchantAccount || process.env.ADYEN_MERCHANT_ACCOUNT || '');
  const hmacKey = String(opties.hmacKey || process.env.ADYEN_HMAC_KEY || '');
  const timeout = opties.timeout || 80000;

  async function vraag(methode, pad, inhoud, extra) {
    const headers = { 'x-api-key': apiKey, 'user-agent': 'rtg-adyen/1' };
    if (extra && extra.idempotencyKey) headers['idempotency-key'] = String(extra.idempotencyKey).slice(0, 64);
    const r = await http.vraag({ url: basis + pad, method: methode,
      json: inhoud === undefined ? undefined : inhoud, headers, timeout, maxRetries: 1 });
    let data = {};
    try { data = r.json(); } catch (e) {}
    if (r.status >= 200 && r.status < 300) return data;
    const fout = new Error(data && (data.message || data.errorCode)
      ? (data.message || 'Adyen-fout') + (data.errorCode ? ' (' + data.errorCode + ')' : '')
      : 'Adyen-API-fout ' + r.status);
    fout.status = r.status; fout.raw = data; throw fout;
  }

  const enc = (v) => encodeURIComponent(String(v));
  const ontsnap = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  function hmacPayload(item) {
    const a = item.amount || {};
    return [item.pspReference, item.originalReference, item.merchantAccountCode,
      item.merchantReference, a.value, a.currency, item.eventCode, item.success]
      .map(ontsnap).join(':');
  }
  function verifieerMelding(item) {
    const gegeven = item && item.additionalData && item.additionalData.hmacSignature;
    if (!hmacKey || !gegeven || !/^[A-Fa-f0-9]+$/.test(hmacKey) || hmacKey.length % 2) return false;
    const verwacht = crypto.createHmac('sha256', Buffer.from(hmacKey, 'hex'))
      .update(hmacPayload(item), 'utf8').digest('base64');
    const a = Buffer.from(verwacht, 'utf8'), b = Buffer.from(String(gegeven), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  return {
    merchantAccount,
    handmatigeCapture: String(opties.captureMode || process.env.ADYEN_CAPTURE_MODE || 'automatic') === 'manual',
    paymentLinks: {
      create(params, extra) { return vraag('POST', '/paymentLinks', params, extra); },
      retrieve(id) { return vraag('GET', '/paymentLinks/' + enc(id)); }
    },
    refunds: {
      create(paymentPspReference, params, extra) {
        return vraag('POST', '/payments/' + enc(paymentPspReference) + '/refunds', params, extra);
      }
    },
    hmacPayload,
    verifieerMelding
  };
};
