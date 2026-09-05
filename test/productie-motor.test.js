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
  assert.ok(fouten.some(f => /STATE_KEY_FILE/.test(f)));
});

test('productie accepteert een volledig bedrade Rust-sidecar', () => {
  const fouten = [], waarschuwingen = [];
  keurMotor({
    RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor',
    RTG_MOTOR_REKEN_URL: 'http://motor:3100', RTG_MOTOR_GELD_URL: 'http://motor:3100',
    RTG_MOTOR_STATE_KEY_FILE: '/run/secrets/motor-state-key',
    RTG_MOTOR_EXPECT_GENESIS: 'g-0123456789abcdef0123456789abcdef',
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
    RTG_MOTOR_REKEN_URL: 'http://motor:3100', RTG_MOTOR_TOKEN: 'geheim',
    RTG_MOTOR_EXPECT_GENESIS: 'g-0123456789abcdef0123456789abcdef'
  };
  const gezien = [];
  const goed = await motorProef(env, async (url, opties) => {
    gezien.push({ url, opties });
    if (url.endsWith('/api/bank/status')) return new Response(JSON.stringify({
      ok:true, klopt:true, som:0, vingerafdruk:'bank-v1'
    }), { status:200 });
    return new Response(JSON.stringify({ ok: true, klopt: true, som:0,
      duurzaam:{ gereed:true, snapshotGeldig:true, snapshotGeladen:true, versleuteld:true,
        algoritme:'XChaCha20-Poly1305', genesisId:'g-0123456789abcdef0123456789abcdef', keyId:'k-1',
        huidigeRevisie:7, laatsteDuurzameRevisie:7, laatsteSchrijfFout:null },
      nativeMotoren: ['magnaat-markt', 'pay-grootboek', 'bank-grootboek'] }), { status: 200 });
  });
  assert.equal(goed.ok, true);
  assert.equal(gezien[0].url, 'http://motor:3100/api/motor/status');
  assert.equal(gezien[0].opties.headers['x-rtg-motor-token'], 'geheim');
  assert.equal(gezien[1].url, 'http://motor:3100/api/bank/status');

  const mist = await motorProef(env, async () => new Response(JSON.stringify({
    ok: true, klopt: true, nativeMotoren: ['magnaat-markt']
  }), { status: 200 }));
  assert.equal(mist.ok, false);
  assert.match(mist.fout, /pay-grootboek/);
});

test('geld-readiness weigert liveness, corrupte snapshots en een ongezonde bank', async () => {
  const env = { RTG_MOTOR_GELD:'motor', RTG_MOTOR_GELD_URL:'http://motor:3100',
    RTG_MOTOR_EXPECT_GENESIS:'g-0123456789abcdef0123456789abcdef' };
  const geenDuurzaamheid = await motorProef(env, async () => new Response(JSON.stringify({
    ok:true, klopt:true, som:0, nativeMotoren:['pay-grootboek', 'bank-grootboek']
  }), { status:200 }));
  assert.equal(geenDuurzaamheid.ok, false);
  assert.match(geenDuurzaamheid.fout, /duurzaamheids.*snapshotbewijs/);

  const bankCorrupt = await motorProef(env, async url => new Response(JSON.stringify(
    url.endsWith('/api/bank/status')
      ? { ok:true, klopt:false, som:1, vingerafdruk:'bank-fout' }
      : { ok:true, klopt:true, som:0, nativeMotoren:['pay-grootboek', 'bank-grootboek'],
        duurzaam:{ gereed:true, snapshotGeldig:true, snapshotGeladen:true, versleuteld:true,
          algoritme:'XChaCha20-Poly1305', genesisId:'g-0123456789abcdef0123456789abcdef', keyId:'k-1',
          huidigeRevisie:7, laatsteDuurzameRevisie:7, laatsteSchrijfFout:null } }
  ), { status:200 }));
  assert.equal(bankCorrupt.ok, false);
  assert.match(bankCorrupt.fout, /bank-grootboek/);
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

test('een echte geldrail vereist de autoritatieve motor', () => {
  const fouten = [];
  keurMotor({ STRIPE_SECRET_KEY: 'echt', RTG_MOTOR_GELD: 'schaduw' }, fouten, []);
  assert.ok(fouten.some(f => /echte geldrail.*RTG_MOTOR_GELD=motor/i.test(f)));
  const groen = [];
  keurMotor({ STRIPE_SECRET_KEY: 'echt', RTG_MOTOR_GELD: 'motor',
    RTG_MOTOR_GELD_URL: 'http://127.0.0.1:3100', RTG_MOTOR_TOKEN: 'x'.repeat(32),
    RTG_MOTOR_STATE_KEY_FILE: '/run/secrets/motor-state-key',
    RTG_MOTOR_EXPECT_GENESIS: 'g-0123456789abcdef0123456789abcdef' }, groen, []);
  assert.ok(!groen.some(f => /echte geldrail/i.test(f)));
});
