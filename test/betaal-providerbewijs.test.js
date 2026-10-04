'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const maakProviderBewijs = require('../server/betaal/providerbewijs');
const maakWebhook = require('../server/betaal/webhook');
const maakNaslag = require('../server/betaal/naslag');

const payment = { id: 'pi_1', status: 'succeeded', aanbieder: 'stripe',
  referentie: 'PAY-1', bedrag: 1000, valuta: 'eur' };

test('payment-providerbewijs is boundary-gebonden, assertion-exact en eenmalig', () => {
  const trusted = maakProviderBewijs(), rogue = maakProviderBewijs();
  const trustedObject = { ...payment }, rogueObject = { ...payment };
  trusted.mark(trustedObject, 'stripe', 'evt-1', 'stripe-signature');
  rogue.mark(rogueObject, 'stripe', 'evt-1', 'caller-fabricated');
  const forged = rogue.issue(rogueObject);
  assert.throws(() => trusted.verify(forged, { provider: 'stripe', purpose: 'money',
    assertion: trusted.assertionVan(payment, 'stripe') }), e => e.code === 'INGRESS_PROOF_INVALID');

  const token = trusted.issue(trustedObject);
  assert.throws(() => trusted.issue(trustedObject), e => e.code === 'INGRESS_PROOF_REPLAY');
  assert.throws(() => trusted.verify(token, { provider: 'stripe', purpose: 'money',
    assertion: trusted.assertionVan({ ...payment, referentie: 'PAY-2' }, 'stripe') }),
  e => e.code === 'INGRESS_PROOF_INVALID');
  assert.throws(() => trusted.verify(token, { provider: 'stripe', purpose: 'money',
    assertion: trusted.assertionVan(payment, 'stripe') }), e => e.code === 'INGRESS_PROOF_INVALID',
  'een token is ook na een mismatch opgebrand');
});

test('alleen een echte Stripe signature-verifier markeert het webhookobject', () => {
  const boundary = maakProviderBewijs();
  const event = { id: 'evt_signed', type: 'payment_intent.succeeded', data: { object: {
    id: 'pi_1', status: 'succeeded', amount: 1000, amount_received: 1000, currency: 'eur',
    metadata: { referentie: 'PAY-1' }
  } } };
  const stripe = { webhooks: { constructEvent() { return event; } } };
  const layer = maakWebhook({ crypto, stripe, BETALEN_UIT: false, WEBHOOK_SECRET: 'whsec_test',
    env: { NODE_ENV: 'test' }, markProviderEvidence: boundary.mark });
  const verified = layer.verifieerWebhook(Buffer.from('{}'), 'signed');
  const token = boundary.issue(verified);
  const assertion = boundary.assertionVan(payment, 'stripe');
  assert.equal(boundary.verify(token, { provider: 'stripe', purpose: 'money', assertion }).provider, 'stripe');

  const demoBoundary = maakProviderBewijs();
  const demo = maakWebhook({ crypto, stripe: null, BETALEN_UIT: false, WEBHOOK_SECRET: 'demo-secret',
    env: { NODE_ENV: 'test' }, markProviderEvidence: demoBoundary.mark });
  const raw = Buffer.from(JSON.stringify(event));
  const parsed = demo.verifieerWebhook(raw,
    crypto.createHmac('sha256', 'demo-secret').update(raw).digest('hex'));
  assert.throws(() => demoBoundary.issue(parsed), e => e.code === 'INGRESS_PROOF_REQUIRED');
});

test('Mollie lookup met geauthenticeerde API markeert precies het teruggegeven resultaat', async () => {
  const boundary = maakProviderBewijs();
  const mollie = { payments: { async retrieve() { return { id: 'tr_1', status: 'paid',
    metadata: { referentie: 'PAY-1' }, amount: { value: '10.00', currency: 'EUR' }, details: {} }; } } };
  const naslag = maakNaslag({ crypto, stripe: null, mollie, adyen: null, stripeGehost: null,
    weigerUit() {}, mollieBedrag() {}, markProviderEvidence: boundary.mark });
  const result = await naslag.haalBetaling('mollie', 'tr_1');
  const token = boundary.issue(result), assertion = boundary.assertionVan(result, 'mollie');
  assert.equal(boundary.verify(token, { provider: 'mollie', purpose: 'money', assertion }).provider, 'mollie');
  assert.throws(() => boundary.issue({ ...result }), e => e.code === 'INGRESS_PROOF_REQUIRED');
});

test('alleen Payment Truth en de bootstrap mogen de proof-verifier aanroepen', () => {
  const root = path.join(__dirname, '..', 'server'), hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.js') &&
        /providerBewijsVan|providerAssertionVan|verifieerProviderBewijs/.test(fs.readFileSync(file, 'utf8')))
        hits.push(path.relative(path.join(__dirname, '..'), file));
    }
  }
  walk(root);
  assert.deepEqual(hits.sort(), [
    'server/betaal.js',
    'server/kern/betaalwaarheid/bewijs.js',
    'server/opzet/trust-bewijs.js'
  ]);
});

test('alleen de private V3-compositie mag domeinhooks installeren', () => {
  const root = path.join(__dirname, '..', 'server'), hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(file, 'utf8');
        if (/v3-(?:money|external|authority)-hook/.test(source) && /\.install\s*\(/.test(source))
          hits.push(path.relative(path.join(__dirname, '..'), file));
      }
    }
  }
  walk(root);
  assert.deepEqual(hits, ['server/kern/bewijsvlak/v3-pilots.js']);
});

test('alleen de echte domeineigenaren mogen owner-proofs uitgeven en lage hooks aanroepen', () => {
  const root = path.join(__dirname, '..', 'server'), issuers = [], money = [], authority = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(file, 'utf8'), rel = path.relative(path.join(__dirname, '..'), file);
        if (/require\(['"][^'"]*v3-owner-proof['"]\)/.test(source)) issuers.push(rel);
        if (/require\(['"][^'"]*v3-money-hook['"]\)/.test(source)) money.push(rel);
        if (/require\(['"][^'"]*v3-authority-hook['"]\)/.test(source)) authority.push(rel);
      }
    }
  }
  walk(root);
  assert.deepEqual(issuers.sort(), [
    'server/kern/betaalwaarheid/bewijs.js',
    'server/kern/connection-consent.js',
    'server/kern/reservering/domeinbewijs.js'
  ]);
  assert.deepEqual(money.sort(), [
    'server/kern/betaalwaarheid/bewijs.js',
    'server/kern/bewijsvlak/v3-pilots.js'
  ]);
  assert.deepEqual(authority.sort(), [
    'server/kern/bewijsvlak/v3-pilots.js',
    'server/kern/connection-consent.js'
  ]);
  assert.equal(Object.hasOwn(require('../server/kern/bewijsvlak/v3-money-hook'), 'domainPosted'), false);
  assert.equal(Object.hasOwn(require('../server/kern/bewijsvlak/v3-money-hook'), 'reconciliationMatched'), false);
  assert.equal(Object.hasOwn(require('../server/kern/bewijsvlak/v3-authority-hook'), 'record'), false);
});
