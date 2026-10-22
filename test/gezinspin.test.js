'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pin = require('../server/foundation/gezinspin')({ crypto });
test('gezins-PIN behoudt bestaande opgeslagen scrypt32-vorm en voorloopnul', async () => {
  const salt = '00112233445566778899aabbccddeeff';
  const oud = { salt, hash: crypto.scryptSync('0123', salt, 32).toString('hex') };
  assert.equal(await pin.checkPin(oud, '0123'), true);
  assert.equal(await pin.checkPin(oud, '123'), false);
  assert.equal(await pin.checkPin(oud, '9876'), false);
  const nieuw = await pin.hashPin('0123');
  assert.deepEqual(Object.keys(nieuw).sort(), ['hash', 'salt']);
  assert.match(nieuw.salt, /^[0-9a-f]{32}$/);
  assert.match(nieuw.hash, /^[0-9a-f]{64}$/);
  assert.equal(nieuw.hash, crypto.scryptSync('0123', nieuw.salt, 32).toString('hex'));
  assert.equal(await pin.checkPin(nieuw, '0123'), true);
  assert.notEqual((await pin.hashPin('0123')).salt, nieuw.salt);
});
test('PIN-weigeringen en cryptofout behouden gesloten gedrag', async () => {
  for (const x of [null, {}, { salt: 'x', hash: 'xx' }, { salt: 'x', hash: '00' }])
    assert.equal(await pin.checkPin(x, '0123'), false);
  const fout = require('../server/foundation/gezinspin')({ crypto: {
    randomBytes: crypto.randomBytes, scrypt: (_p, _s, _n, cb) => cb(Error('crypto mislukt'))
  } });
  assert.equal(await fout.checkPin({ salt: 's', hash: '00' }, '0123'), false);
  await assert.rejects(fout.hashPin('0123'), /crypto mislukt/);
  for (const x of ['0123', '12345', '123456']) assert.equal(pin.geldigePin(x), true);
  for (const x of ['', '123', '1234567', '12ab', ' 1234']) assert.equal(pin.geldigePin(x), false);
});
