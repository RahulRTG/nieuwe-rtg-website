'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Adyen = require('../server/adyen');

function antwoord(data) { return { status: 200, json() { return data; } }; }

test('de eigen Adyen-client maakt, controleert en betaalt via de juiste zakelijke rail terug', async () => {
  const gezien = [];
  const http = { async vraag(o) {
    gezien.push(o);
    if (/\/refunds$/.test(o.url)) return antwoord({ pspReference: '881-refund', status: 'received' });
    if (o.method === 'GET') return antwoord({ id: 'PL-1', status: 'active', reference: 'BW-1',
      amount: { value: 1250, currency: 'EUR' }, url: 'https://pay.adyen.com/x' });
    return antwoord({ id: 'PL-1', status: 'active', url: 'https://pay.adyen.com/x' });
  } };
  const a = Adyen('api-geheim', { http, baseUrl: 'https://checkout-test.adyen.com/v72',
    merchantAccount: 'RTG_TEST', hmacKey: 'ab'.repeat(32) });
  const p = await a.paymentLinks.create({ reference: 'BW-1', merchantAccount: 'RTG_TEST',
    amount: { value: 1250, currency: 'EUR' } }, { idempotencyKey: 'idem-1' });
  assert.equal(p.id, 'PL-1');
  assert.equal(gezien[0].headers['x-api-key'], 'api-geheim');
  assert.equal(gezien[0].headers['idempotency-key'], 'idem-1');
  assert.equal(gezien[0].json.merchantAccount, 'RTG_TEST');
  await a.paymentLinks.retrieve('PL-1');
  assert.equal(gezien[1].method, 'GET');
  await a.refunds.create('881-payment', { merchantAccount: 'RTG_TEST',
    amount: { value: 400, currency: 'EUR' } }, { idempotencyKey: 'refund-1' });
  assert.match(gezien[2].url, /\/payments\/881-payment\/refunds$/);
  assert.equal(gezien[2].headers['idempotency-key'], 'refund-1');
});

test('Adyens officiële HMAC-voorbeeld slaagt en geknoei met het bedrag faalt', () => {
  const a = Adyen('api', { hmacKey: '44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056' });
  const item = { pspReference: '7914073381342284', originalReference: '', merchantAccountCode: 'TestMerchant',
    merchantReference: 'TestPayment-1407325143704', amount: { value: 1130, currency: 'EUR' },
    eventCode: 'AUTHORISATION', success: 'true',
    additionalData: { hmacSignature: 'coqCmt/IZ4E3CzPvMY8zTjQVL5hYJUiBRg8UU+iCWo0=' } };
  assert.equal(a.verifieerMelding(item), true);
  assert.equal(a.verifieerMelding(Object.assign({}, item, { amount: { value: 1131, currency: 'EUR' } })), false);
});
