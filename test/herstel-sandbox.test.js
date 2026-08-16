/* De lokale SMS-sandbox in de echte herstelroute: acceptatie maakt een geldige
   tweestapsflow; een providerstoring geeft generiek antwoord en geen token. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

async function post(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('lokale SMS-sandbox draagt de herstelcode zonder externe bezorging', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', SMS_SANDBOX: '1' } });
  try {
    await post(srv.base, '/api/auth/register', { name: 'Sandbox Lid', email: 'sms-sandbox@x.nl', phone: '+31612345678',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const r = await post(srv.base, '/api/auth/forgot', { email: 'sms-sandbox@x.nl' });
    assert.equal(r.status, 200);
    assert.equal(r.body.tweestaps, true);
    assert.ok(r.body.devResetUrl && r.body.devCode, 'de lokale proef levert beide testvelden op');
  } finally { stop(srv.child); }
});

test('SMS-providerstoring geeft geen half geldige herstel-link uit', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', SMS_SANDBOX: '1', SMS_SANDBOX_RESULT: 'failed' } });
  try {
    await post(srv.base, '/api/auth/register', { name: 'Storing Lid', email: 'sms-storing@x.nl', phone: '+31612345679',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const r = await post(srv.base, '/api/auth/forgot', { email: 'sms-storing@x.nl' });
    assert.equal(r.status, 200, 'de publieke route verklapt de providerstoring niet');
    assert.equal(r.body.tweestaps, true);
    assert.ok(!r.body.devResetUrl && !r.body.devCode, 'zonder geaccepteerde SMS bestaat er geen herstelpoging');
  } finally { stop(srv.child); }
});
