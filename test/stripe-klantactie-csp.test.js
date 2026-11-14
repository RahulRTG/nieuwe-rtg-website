'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CSP } = require('../server/middleware/csp');
test('Stripe CSP opent alleen de expliciete Geld-pagina, nooit Magnaat of andere HTML', () => {
  const c = CSP('nonce', false, '/apps/geld.html');
  assert.match(c, /script-src 'self' 'nonce-nonce' https:\/\/js.stripe.com https:\/\/\*.js.stripe.com;/);
  assert.match(c, /connect-src 'self' https:\/\/api.stripe.com;/);
  assert.match(c, /frame-src 'self' https:\/\/js.stripe.com https:\/\/\*.js.stripe.com https:\/\/hooks.stripe.com;/);
  assert.doesNotMatch(c, /unsafe-eval|checkout.stripe.com|maps.googleapis|https:\/\/\*.stripe.com/);
  for (const pad of ['', '/', '/apps/app.html', '/apps/geld.html/elders', '/apps/geld.html?betaal=1'])
    assert.doesNotMatch(CSP('nonce', false, pad), /stripe/);
  assert.doesNotMatch(CSP('nonce', true, '/apps/geld.html'), /stripe/);
  assert.match(CSP('nonce', true, '/apps/geld.html'), /connect-src 'none'/);
});
test('echte HTML-voordeur geeft het betaal-CSP door op GET en HEAD', async () => {
  const path = require('node:path'), { cspNonce } = require('../server/middleware/voordeur');
  for (const method of ['GET', 'HEAD']) {
    const headers = {};
    await new Promise((resolve, reject) => {
      const req = { path: '/apps/geld.html', url: '/apps/geld.html', method, headers: {}, query: {} };
      const res = { set(k, v) { headers[k.toLowerCase()] = v; return this; },
        setHeader(k, v) { return this.set(k, v); }, type() { return this; },
        send() { resolve(); }, end() { resolve(); } };
      cspNonce(path.join(__dirname, '..', 'public'), true)(req, res, () => reject(Error('voordeur overgeslagen')));
    });
    assert.match(headers['content-security-policy'], /https:\/\/api.stripe.com/);
  }
});
