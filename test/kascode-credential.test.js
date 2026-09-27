/* KAS- EN TIKCODE ALS CREDENTIAL (CODECREDENTIALS.json, deuren
   pay.kascode_en_vooraf en pay.tikcode). Per control van de kascode een toets
   op de wereld van test/lib/kaswereld.js; tik en vooraf staan in
   kascode-tik-vooraf.test.js, de routes op een echte server in
   kascode-routes.test.js en atomiciteit over twee processen in de .pg-proef.

   Draai los: node --test test/kascode-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const kaswereld = require('./lib/kaswereld');
/* De wereld bouwt ze op; hier staan ze bij naam zodat scripts/mutatie.js weet
   welke modules deze toets op de proef stelt. */
const { LEASE_MS } = require('../server/kern/pay/kas-claim');
require('../server/kern/pay/kasbak');
require('../server/kern/pay/kassa');
const wereld = kaswereld;
const kaal = s => String(s).replace(/[^0-9A-Z]/g, '');
const kassaRegels = w => w.regels('kassa');

test('1. uitgifte: 128 bits, hash-only, issuer/doel/scope, vervaltijd en max_gebruik 1', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 5000 });
  assert.match(k.code, /^KC(-[0-9A-F]{4}){8}$/);
  assert.equal(kaal(k.code).length - 2, 32, '32 hextekens = 128 bits');
  const rij = Object.values(w.data.payKasToegang)[0];
  assert.match(rij.toegang.code_hash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(w.data).includes(kaal(k.code).slice(2)), false, 'nergens een kale code');
  const t = rij.toegang;
  assert.deepEqual([t.issuer, t.doel, t.scope, t.max_gebruik, t.gebruik], ['rtg.lid.kassa', 'pay-kassa', ['kassa.afrekenen'], 1, 0]);
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 300000);
});

test('2. een keer tonen: een retry met dezelfde sleutel geeft 409 zonder code', async () => {
  const w = wereld();
  const a = await w.kassa.kasCode({ codenaam: 'A', idem: 'x1' });
  const b = await w.kassa.kasCode({ codenaam: 'A', idem: 'x1' });
  assert.equal(b.status, 409);
  assert.equal(b.code, 'CODE_AL_UITGEGEVEN');
  assert.ok(w.kassa.kasStand(a.code), 'de eerste leeft nog');
});

test('3. roteren en intrekken gebeuren aan de serverkant', async () => {
  const w = wereld();
  const a = await w.kassa.kasCode({ codenaam: 'A' });
  const b = await w.kassa.kasCode({ codenaam: 'A' });
  assert.equal(w.kassa.kasStand(a.code), null, 'de vorige is ingetrokken');
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: a.code, centen: 100, idem: 'i' })).status, 404);
  assert.equal((await w.kassa.kasIntrek({ codenaam: 'A' })).ingetrokken, 1);
  assert.equal((await w.kassa.kasIntrek({ codenaam: 'A' })).ingetrokken, 0);
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: b.code, centen: 100, idem: 'j' })).status, 404);
  assert.equal(kassaRegels(w).length, 0);
});

test('4. verlopen is verlopen', async () => {
  const w = wereld();
  const a = await w.kassa.kasCode({ codenaam: 'A' });
  w.klok.t += 300001;
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: a.code, centen: 100, idem: 'i' })).status, 404);
});

test('5. zoeken is constant-time: elke rij wordt vergeleken, ook na de treffer', async () => {
  let vergeleken = 0;
  const tellend = Object.assign({}, crypto, { timingSafeEqual: (x, y) => { vergeleken++; return crypto.timingSafeEqual(x, y); } });
  const w = wereld({ cryptoIn: tellend });
  const eerste = await w.kassa.kasCode({ codenaam: 'A' });
  for (const c of ['B', 'C', 'D']) await w.kassa.kasCode({ codenaam: c });
  vergeleken = 0;
  assert.ok(w.kassa.kasStand(eerste.code));
  assert.equal(vergeleken, 4, 'vier rijen, vier vergelijkingen');
});

test('6. atomaire claim: twee kassa\'s tegelijk, een betaling; een retry boekt niets', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 5000 });
  const [x, y] = await Promise.all([
    w.kassa.kasInt({ supplierCode: 'Z1', code: k.code, centen: 1200, idem: 'z1' }),
    w.kassa.kasInt({ supplierCode: 'Z2', code: k.code, centen: 1300, idem: 'z2' })]);
  assert.equal([x, y].filter(r => r.ok).length, 1, JSON.stringify([x, y]));
  assert.equal(kassaRegels(w).length, 1);
  const winnaar = x.ok ? { s: 'Z1', i: 'z1', c: 1200 } : { s: 'Z2', i: 'z2', c: 1300 };
  const nog = await w.kassa.kasInt({ supplierCode: winnaar.s, code: k.code, centen: winnaar.c, idem: winnaar.i });
  assert.equal(nog.herhaald, true);
  assert.equal(kassaRegels(w).length, 1);
  assert.match(kassaRegels(w)[0].ref, /^KC\/KC[0-9a-f]{16}\/0$/, 'de ref is de claim, nooit de code');
  assert.equal(Object.values(w.data.payKasToegang)[0].toegang.gebruik, 1);
});

test('7. een weigering draait terug en geeft de code terug; boven het maximum claimt niets', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 1000 });
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 1001, idem: 'a' })).status, 402);
  w.stuk.weiger = { status: 403, error: 'grens', reden: 'eigen' };
  const r = await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 500, idem: 'b' });
  assert.equal(r.reden, 'eigen', 'de reden reist mee naar het lid');
  w.stuk.weiger = null;
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 500, idem: 'c' })).ok, true);
});

test('8. crash na de boeking: de claim blijft, een ander maakt hem af naar DEZE zaak', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 5000 });
  w.stuk.crash = true;
  const weg = await w.kassa.kasInt({ supplierCode: 'Z1', code: k.code, centen: 700, idem: 'e' });
  assert.equal(weg.status, 503, 'niet bevestigd is geen succes en geen weigering');
  assert.equal(Object.values(w.data.payKasToegang)[0].stand, 'claimend');
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z1', code: k.code, centen: 700, idem: 'e' })).code, 'KASCODE_BEZIG');
  w.klok.t += LEASE_MS + 1000;
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z2', code: k.code, centen: 4000, idem: 'x' })).status, 404);
  assert.equal(kassaRegels(w).length, 1, 'geen tweede boeking');
  assert.equal(w.saldi()['partner:Z1'], 700 - 17, 'het geld ging naar de zaak van de claim');
  const af = await w.kassa.kasInt({ supplierCode: 'Z1', code: k.code, centen: 700, idem: 'e' });
  assert.equal(af.herhaald, true);
});
