'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakMagnaat = require('../server/kern/magnaat-motorklant');
const maakPay = require('../server/kern/pay/motorklant');
const maakBank = require('../server/kern/bank/motorklant');
const maakSchaduw = require('../server/kern/pay/schaduw');

async function metEnv(waarden, werk) {
  const oud = {};
  for (const [naam, waarde] of Object.entries(waarden)) {
    oud[naam] = process.env[naam];
    process.env[naam] = String(waarde);
  }
  try { return await werk(); }
  finally {
    for (const [naam, waarde] of Object.entries(oud)) {
      if (waarde === undefined) delete process.env[naam];
      else process.env[naam] = waarde;
    }
  }
}

test('één noodvlag schakelt Magnaat, pay, bank en schaduwverkeer terug zonder netwerk', async () => {
  await metEnv({
    RTG_RUST_ALLES_UIT: '1', RTG_MAGNAAT_RUST: 'motor', RTG_MOTOR_GELD: 'motor',
    RTG_MOTOR_REKEN_URL: 'http://127.0.0.1:3100',
    RTG_MOTOR_GELD_URL: 'http://127.0.0.1:3100', RTG_MOTOR_SHADOW: 'http://127.0.0.1:3100'
  }, async () => {
    let netwerk = 0;
    const haal = async () => { netwerk += 1; throw new Error('niet aanraken'); };
    const oudeFetch = globalThis.fetch;
    globalThis.fetch = haal;
    try {
      const magnaat = maakMagnaat({ fetch: haal });
      const pay = maakPay();
      const bank = maakBank();
      const schaduw = maakSchaduw();
      assert.equal(magnaat.aan, false);
      assert.equal(magnaat.modus, 'uit');
      assert.equal(magnaat.status().globaleNoodstop, true);
      assert.equal(pay.aan, false);
      assert.equal(pay.modus, 'uit');
      assert.equal(bank.aan, false);
      assert.equal(bank.modus, 'uit');
      assert.equal(schaduw.aan, false);
      await assert.rejects(magnaat.markt({}), fout => fout.code === 'MOTOR_UIT');
      assert.equal((await pay.boekGuard({})).status, 503);
      assert.equal((await pay.saldiSnapshot()).status, 503);
      assert.equal((await bank.bankBoek({})).status, 503);
      assert.equal((await bank.bankSaldiSnapshot()).status, 503);
      assert.equal(netwerk, 0);
    } finally { globalThis.fetch = oudeFetch; }
  });
});
