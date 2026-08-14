'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { valideer } = require('../server/config');

const basis = { NODE_ENV: 'production', RTG_ENC_KEY: 'e'.repeat(64),
  RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
  RTG_OWNER_EMAIL: 'eigenaar@voorbeeld.nl', DATABASE_URL: 'postgresql://db',
  REDIS_URL: 'redis://cache', RTG_MEDIA_BACKEND: 's3', ERR_WEBHOOK_URL: 'https://alarm.example',
  OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', SMTP_URL: 'smtp://mail', OPENAI_API_KEY: 'ai',
  RTF_IBAN: 'NL11FOUND0000000001' };

test('Mollie kan in productie de echte betaalprovider zijn zonder Stripe', () => {
  const r = valideer(Object.assign({}, basis, { MOLLIE_API_KEY: 'live_x', APP_URL: 'https://app.rtg.example' }));
  assert.ok(!r.fouten.some(x => /STRIPE_SECRET_KEY|MOLLIE_API_KEY/.test(x)), JSON.stringify(r.fouten));
});

test('Mollie weigert een door de aanvrager te sturen terugkeeradres', () => {
  const r = valideer(Object.assign({}, basis, { MOLLIE_API_KEY: 'live_x' }));
  assert.ok(r.fouten.some(x => /MOLLIE_API_KEY.*APP_URL/.test(x)));
});
