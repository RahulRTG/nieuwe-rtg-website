'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { valideer } = require('../server/config');

const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
  RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@voorbeeld.nl', DATABASE_URL: 'postgresql://db',
  REDIS_URL: 'redis://cache', RTG_MEDIA_BACKEND: 's3', ERR_WEBHOOK_URL: 'https://alarm.example',
  OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', SMTP_URL: 'smtp://mail', OPENAI_API_KEY: 'ai',
  RTF_IBAN: 'NL11FOUND0000000001' };
const geldig = { ADYEN_API_KEY: 'AQE-test', ADYEN_MERCHANT_ACCOUNT: 'RTG_EU',
  ADYEN_HMAC_KEY: 'ab'.repeat(32), APP_URL: 'https://app.rtg.example',
  ADYEN_CHECKOUT_BASE_URL: 'https://rtg-checkout-live.adyenpayments.com/checkout/v72' };

test('Adyen kan in productie de echte betaalprovider zijn zonder Stripe of Mollie', () => {
  const r = valideer(Object.assign({}, basis, geldig));
  assert.ok(!r.fouten.some(x => /ADYEN_|STRIPE_SECRET_KEY.*ontbreken/.test(x)), JSON.stringify(r.fouten));
});

test('Adyen blokkeert productie zonder HMAC en met een test-endpoint', () => {
  const r = valideer(Object.assign({}, basis, geldig, { ADYEN_HMAC_KEY: '',
    ADYEN_CHECKOUT_BASE_URL: 'https://checkout-test.adyen.com/v72' }));
  assert.ok(r.fouten.some(x => /ADYEN_HMAC_KEY/.test(x)));
  assert.ok(r.fouten.some(x => /live ADYEN_CHECKOUT_BASE_URL/.test(x)));
});
