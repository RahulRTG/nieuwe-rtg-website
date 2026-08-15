'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { keurMotor } = require('../server/config/productie-motor');
const { motorProef } = require('../scripts/lib/motor-proef');

test('productie blokkeert een halve Rust-cutover en een zwak sidecartoken', () => {
  const fouten = [], waarschuwingen = [];
  keurMotor({ RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor', RTG_MOTOR_TOKEN: 'kort' }, fouten, waarschuwingen);
  assert.ok(fouten.some(f => /REKEN_URL/.test(f)));
  assert.ok(fouten.some(f => /GELD_URL/.test(f)));
  assert.ok(fouten.some(f => /TOKEN/.test(f)));
});

test('productie accepteert een volledig bedrade Rust-sidecar', () => {
  const fouten = [], waarschuwingen = [];
  keurMotor({
    RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor',
    RTG_MOTOR_REKEN_URL: 'http://motor:3100', RTG_MOTOR_GELD_URL: 'http://motor:3100',
    RTG_MOTOR_TOKEN: 'x'.repeat(32), RTG_CAPABILITY_RUST_BIN: '/app/rtg-motor',
    RTG_CAPABILITY_RUST_MODE: 'canary', RTG_CAPABILITY_RUST_CANARY_PCT: '10'
  }, fouten, waarschuwingen);
  assert.deepEqual(fouten, []);
  assert.deepEqual(waarschuwingen, []);
});

test('productie keurt capability-canarygrenzen en meldt de centrale noodstop', () => {
  const fouten = [], waarschuwingen = [];
  keurMotor({
    RTG_CAPABILITY_RUST_MODE: 'canary', RTG_CAPABILITY_RUST_CANARY_PCT: '101',
    RTG_CAPABILITY_RUST_BIN: 'relatief/motor', RTG_RUST_ALLES_UIT: '1'
  }, fouten, waarschuwingen);
  assert.ok(fouten.some(f => /0 tot en met 100/.test(f)));
  assert.ok(fouten.some(f => /absoluut pad/.test(f)));
  assert.ok(waarschuwingen.some(w => /alle Rust-appmigraties/.test(w)));
});

test('go-live-proef eist de daadwerkelijk geconfigureerde native motoren', async () => {
  const env = {
    RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor',
    RTG_MOTOR_REKEN_URL: 'http://motor:3100', RTG_MOTOR_TOKEN: 'geheim'
  };
  let gezien;
  const goed = await motorProef(env, async (url, opties) => {
    gezien = { url, opties };
    return new Response(JSON.stringify({ ok: true, klopt: true,
      nativeMotoren: ['magnaat-markt', 'pay-grootboek', 'bank-grootboek'] }), { status: 200 });
  });
  assert.equal(goed.ok, true);
  assert.equal(gezien.url, 'http://motor:3100/api/motor/status');
  assert.equal(gezien.opties.headers['x-rtg-motor-token'], 'geheim');

  const mist = await motorProef(env, async () => new Response(JSON.stringify({
    ok: true, klopt: true, nativeMotoren: ['magnaat-markt']
  }), { status: 200 }));
  assert.equal(mist.ok, false);
  assert.match(mist.fout, /pay-grootboek/);
});

test('go-live-proef begrenst een vijandig groot statusantwoord', async () => {
  const r = await motorProef({ RTG_MOTOR_SHADOW: 'http://motor:3100' }, async () =>
    new Response('{}', { status: 200, headers: { 'content-length': String(300 * 1024) } }));
  assert.equal(r.ok, false);
  assert.match(r.fout, /te groot/);
});

test('de centrale noodstop raakt geen Rust-appmotor aan', async () => {
  let aangeroepen = false;
  const r = await motorProef({ RTG_RUST_ALLES_UIT: '1', RTG_MOTOR_SHADOW: 'http://motor:3100' }, async () => {
    aangeroepen = true;
    throw new Error('mag niet');
  });
  assert.equal(r.ok, true);
  assert.equal(r.noodstop, true);
  assert.equal(aangeroepen, false);
});
