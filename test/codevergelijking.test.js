'use strict';
/* CODES VINDEN IN CONSTANTE TIJD (Fase 0, D13).

   kern/codelevenscyclus.js zocht een aangeboden code met
   `rijen.find(x => x.code_hash === hash(code))`. Die stopt bij de eerste
   treffer en bij het eerste verschillende teken, en verraadt zo via de
   looptijd iets over wat er opgeslagen staat. kern/bearercode.js deed het al
   goed; de levenscyclus gebruikt nu dezelfde vergelijking (vindOpHash uit kern/bearercode.js). */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { vindOpHash, hashGelijk: zelfdeHash } = require('../server/kern/bearercode');

const h = s => crypto.createHash('sha256').update(s).digest('hex');

function telCrypto() {
  const teller = { n: 0 };
  return { teller, crypto: Object.assign(Object.create(crypto), {
    timingSafeEqual: (a, b) => { teller.n++; return crypto.timingSafeEqual(a, b); } }) };
}

test('1. elke rij wordt vergeleken, ook na een treffer', () => {
  const rijen = [{ code_hash: h('a') }, { code_hash: h('b') }, { code_hash: h('c') }, { code_hash: h('d') }];
  const { teller, crypto: c } = telCrypto();
  assert.equal(vindOpHash(c, rijen, h('a')), rijen[0]);
  assert.equal(teller.n, 4, 'de zoeker stopte bij de eerste treffer');
});

test('2. geen treffer, rommel en een verkeerde lengte geven null, nooit een gooi', () => {
  const rijen = [{ code_hash: h('a') }, { code_hash: 'GEEN-HEX' }, null, { code_hash: h('a').slice(2) }];
  assert.equal(vindOpHash(crypto, rijen, h('z')), null);
  assert.equal(vindOpHash(crypto, rijen, 'onzin'), null);
  assert.equal(zelfdeHash(crypto, h('a'), h('b')), false);
  assert.equal(zelfdeHash(crypto, h('a'), h('a')), true);
});

test('3. de levenscyclus gebruikt de zoeker, met een echte uitgifte en controle', () => {
  const rijen = [];
  const maak = require('../server/kern/codelevenscyclus');
  const { teller, crypto: c } = telCrypto();
  const cyclus = maak({ opslag: () => rijen, staat: null, nu: () => '2026-10-04T12:00:00.000Z',
    rid: () => crypto.randomBytes(4).toString('hex'), crypto: c, save() {} });
  const d = cyclus;
  const codes = [1, 2, 3].map(i => d.uitgeven({ issuer: 'toets', doel: 'deur', scope: ['x'],
    onderwerp: { soort: 'proef', id: 'o' + i }, prefix: 'T' }).code);
  teller.n = 0;
  const r = d.controleer(codes[0], { doel: 'deur', scope: 'x' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(teller.n, 3, 'de controle vergeleek niet elke rij in constante tijd');
  assert.equal(d.controleer('T-ONBEKEND', { doel: 'deur', scope: 'x' }).status, 404);
});

test('4. de bron: geen === op een aangeboden codehash meer', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'codelevenscyclus.js'), 'utf8');
  assert.ok(!/code_hash\s*===\s*hash\(/.test(bron), 'codelevenscyclus vergelijkt weer met === op de hash van invoer');
});
