/* Tests voor de productie-hardening: config-validatie, duurzame opslag,
   betaal-naad (idempotentie + webhook-verificatie) en de logger.
   Draai: node --test test/productie.test.js
   NB: STRIPE_WEBHOOK_SECRET wordt hier gezet vóór het laden van betaal.js,
   omdat die de secret bij het inladen leest. */
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'test-webhook-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../server/config');
const betaal = require('../server/betaal');
const { schrijfDuurzaam } = require('../server/db');
const { middleware, foutMiddleware } = require('../server/log');

/* ---------- config-validatie ---------- */

test('config: onveilige productie geeft blokkerende fouten', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_DEMO: '1', DEMO_PASS: 'Imran' });
  assert.ok(r.productie);
  assert.ok(r.fouten.length >= 3, 'demo aan, geen enc-key en standaard-wachtwoord moeten falen');
  assert.ok(r.fouten.some(f => /RTG_DEMO/.test(f)));
  assert.ok(r.fouten.some(f => /RTG_ENC_KEY/.test(f)));
});

test('config: veilige productie is foutloos', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_ENC_KEY: 'a'.repeat(64),
    APP_URL: 'https://x', DATABASE_URL: 'postgresql://x', REDIS_URL: 'r', SENTRY_DSN: 's', SMTP_URL: 'm', STRIPE_SECRET_KEY: 'k' });
  assert.equal(r.fouten.length, 0);
  assert.equal(r.waarschuwingen.length, 0);
});

test('config: ontbrekende enc-key mag met bewuste opt-out', () => {
  const r = config.valideer({ NODE_ENV: 'production', RTG_ALLOW_PLAINTEXT: '1', RTG_ENC_KEY: '' });
  assert.ok(!r.fouten.some(f => /RTG_ENC_KEY ontbreekt/.test(f)));
});

test('config: buiten productie nooit blokkeren', () => {
  const r = config.valideer({ NODE_ENV: 'development', RTG_DEMO: '1' });
  assert.equal(r.fouten.length, 0);
});

test('config: ongeldige PORT wordt afgekeurd', () => {
  const r = config.valideer({ NODE_ENV: 'development', PORT: '99999' });
  assert.ok(r.fouten.some(f => /PORT/.test(f)));
});

/* ---------- duurzame opslag ---------- */

test('db.schrijfDuurzaam: schrijft atomisch, laat geen .tmp achter, met 0600', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dur-'));
  const f = path.join(dir, 'data.json');
  schrijfDuurzaam(f, JSON.stringify({ a: 1 }), 0o600);
  assert.equal(fs.readFileSync(f, 'utf8'), '{"a":1}');
  assert.equal(fs.existsSync(f + '.tmp'), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  // overschrijven vervangt de inhoud volledig
  schrijfDuurzaam(f, JSON.stringify({ b: 2 }), 0o600);
  assert.equal(fs.readFileSync(f, 'utf8'), '{"b":2}');
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ---------- betaal-naad ---------- */

test('betaal: demo-provider bevestigt en is idempotent', async () => {
  const a = await betaal.maakBetaling({ bedrag: 1500, referentie: 'inv-9', idempotentieSleutel: 'sleutel-A' });
  assert.equal(a.aanbieder, 'demo');
  assert.equal(a.status, 'betaald');
  const b = await betaal.maakBetaling({ bedrag: 1500, referentie: 'inv-9', idempotentieSleutel: 'sleutel-A' });
  assert.equal(b.id, a.id, 'zelfde idempotentiesleutel geeft dezelfde betaling');
  assert.equal(b.herhaald, true);
});

test('betaal: bedrag moet positief zijn', async () => {
  await assert.rejects(() => betaal.maakBetaling({ bedrag: 0 }));
  await assert.rejects(() => betaal.maakBetaling({ bedrag: -5 }));
  await assert.rejects(() => betaal.maakBetaling({ bedrag: 'tien' }));
});

test('betaal: webhook accepteert geldige en weigert ongeldige handtekening', () => {
  const body = Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_1' }));
  const sig = betaal.tekenDemo(body);
  const evt = betaal.verifieerWebhook(body, sig);
  assert.equal(evt.type, 'payment_intent.succeeded');
  assert.throws(() => betaal.verifieerWebhook(body, 'onzin'), /handtekening/i);
  assert.throws(() => betaal.verifieerWebhook(body, sig.slice(0, -2) + '00'), /handtekening/i);
});

/* ---------- logger-middleware ---------- */

test('log.middleware: zet een X-Request-Id op het antwoord', () => {
  const headers = {};
  const req = { headers: {}, method: 'GET', path: '/x' };
  const res = { set: (k, v) => { headers[k] = v; }, on: () => {} };
  middleware()(req, res, () => {});
  assert.ok(req.id, 'req.id gezet');
  assert.equal(headers['X-Request-Id'], req.id);
});

test('log.foutMiddleware: geeft nette 500 met id, lekt geen details', () => {
  let code = 0, payload = null;
  const req = { id: 'abc', path: '/kapot' };
  const res = { headersSent: false, status(c) { code = c; return this; }, json(o) { payload = o; return this; } };
  foutMiddleware()(new Error('interne details'), req, res, () => {});
  assert.equal(code, 500);
  assert.equal(payload.id, 'abc');
  assert.ok(!/interne details/.test(JSON.stringify(payload)), 'interne foutmelding mag niet lekken');
});
