'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Mollie = require('../server/mollie');

test('de eigen Mollie-client zet auth, bedragen en idempotentie exact op de rail', async () => {
  const gezien = [];
  const http = { async vraag(o) {
    gezien.push(o);
    if (/\/refunds$/.test(o.url)) return antwoord({ id: 're_1', status: 'pending' });
    if (o.method === 'GET') return antwoord({ id: 'tr_1', status: 'paid', amount: { currency: 'EUR', value: '12.50' } });
    return antwoord({ id: 'tr_1', status: 'open', _links: { checkout: { href: 'https://www.mollie.com/checkout/x' } } });
  } };
  const m = Mollie('test_geheim', { http, baseUrl: 'https://mollie.test' });
  const p = await m.payments.create({ amount: { currency: 'EUR', value: '12.50' } }, { idempotencyKey: 'idem-1' });
  assert.equal(p.id, 'tr_1');
  assert.equal(gezien[0].headers.authorization, 'Bearer test_geheim');
  assert.equal(gezien[0].headers['idempotency-key'], 'idem-1');
  assert.deepEqual(gezien[0].json.amount, { currency: 'EUR', value: '12.50' });
  await m.payments.retrieve('tr_1');
  assert.equal(gezien[1].method, 'GET');
  await m.refunds.create('tr_1', { amount: { currency: 'EUR', value: '4.00' } }, { idempotencyKey: 'ref-1' });
  assert.match(gezien[2].url, /\/v2\/payments\/tr_1\/refunds$/);
  assert.equal(gezien[2].headers['idempotency-key'], 'ref-1');
});

function antwoord(data) {
  return { status: 200, json() { return data; } };
}

test('MOLLIE_BASE_URL leidt de sleutel alleen in de testomgeving om', async () => {
  const oud = { env: process.env.NODE_ENV, url: process.env.MOLLIE_BASE_URL };
  const gezien = [];
  const http = { async vraag(o) { gezien.push(o.url); return antwoord({ id: 'tr_1', status: 'open' }); } };
  try {
    process.env.MOLLIE_BASE_URL = 'https://vreemd.example';
    process.env.NODE_ENV = 'production';
    await Mollie('live_geheim', { http }).payments.retrieve('tr_1');
    process.env.NODE_ENV = 'test';
    await Mollie('test_geheim', { http }).payments.retrieve('tr_1');
  } finally {
    if (oud.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud.env;
    if (oud.url === undefined) delete process.env.MOLLIE_BASE_URL; else process.env.MOLLIE_BASE_URL = oud.url;
  }
  assert.match(gezien[0], /^https:\/\/api\.mollie\.com\/v2\/payments\/tr_1$/, 'productie negeert de omleiding');
  assert.match(gezien[1], /^https:\/\/vreemd\.example\//);
});
