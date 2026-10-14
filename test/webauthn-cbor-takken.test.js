/* DE CBOR-LEZER EN DE COSE-SLEUTEL (server/webauthn/cbor.js).

   Alles wat een lid via een passkey aanlevert, gaat door deze lezer voordat er
   een handtekening wordt gecontroleerd. Een lezer die een lengte verzint of een
   onbekend sleuteltype "ongeveer" leest, beslist mee over toegang. Deze toetsen
   zetten de coderingen die de bestaande toetsen niet raakten op een rij, en
   verifiëren een login met ECHTE RSA- en Ed25519-sleutels (de twee algoritmen
   naast ES256 die we aankondigen in pubKeyCredParams).

   Wat hier niet mag sneuvelen:
   1. 2- en 4-byte-lengtevelden worden letterlijk gelezen; een lengteveld of
      tekststring die voorbij de buffer belooft, en een gereserveerde
      lengtecodering (28..30), geven een nette weigering;
   2. tags worden overgeslagen tot hun inhoud, de vier simpele waarden komen
      exact terug en een float wordt geweigerd;
   3. authenticatorData korter dan 37 bytes wordt niet "aangevuld";
   4. een COSE-sleutel die geen map is, een EC2-sleutel op een andere curve dan
      P-256, een OKP-sleutel op Ed448 of een onbekend kty wordt geweigerd;
   5. RSA- en Ed25519-handtekeningen worden echt geverifieerd: de juiste
      slaagt, een over andere data faalt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `else if (ai === 25) extra = 2;` vervangen door `extra = 1` ->
     "1. lengtevelden" ZAKT (RAAK);
   - `if (crv !== 1)` vervangen door `if (false)` -> "4. COSE-weigeringen"
     ZAKT (RAAK; node maakt dan een P-256-sleutel van P-384-coördinaten niet,
     maar de foutmelding is niet meer de onze);
   - `const opt = s.dsaEncoding ? ... : s.key` vervangen door
     `{ key: s.key, dsaEncoding: 'der' }` -> blijft groen voor RSA en Ed25519:
     node negeert dsaEncoding bij die sleuteltypen. Gelijkwaardige mutant.

   Draai: node --test test/webauthn-cbor-takken.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { cborLees, ontleedAuthData, coseNaarSleutel, verifieerHandtekening } = require('../server/webauthn/cbor');
const { cMap } = require('./webauthn-authenticator');

const B = (...x) => Buffer.from(x);

test('1. lengtevelden: 2 en 4 bytes worden letterlijk gelezen, te lange beloftes geweigerd', () => {
  assert.deepEqual(cborLees(B(0x19, 0x01, 0x02), 0), { waarde: 0x0102, eind: 3 });
  assert.deepEqual(cborLees(B(0x1a, 0x00, 0x01, 0x00, 0x00), 0), { waarde: 65536, eind: 5 });
  assert.deepEqual(cborLees(B(0x39, 0x01, 0x00), 0), { waarde: -257, eind: 3 });
  assert.throws(() => cborLees(B(0x1c), 0), /ongeldige lengte-codering/);
  assert.throws(() => cborLees(B(0x1e), 0), /ongeldige lengte-codering/);
  assert.throws(() => cborLees(B(0x1a, 0x00, 0x01), 0), /lengteveld loopt voorbij/);
  assert.throws(() => cborLees(B(0x65, 0x61, 0x62), 0), /tekststring belooft 5 bytes, er zijn er 2/);
  assert.deepEqual(cborLees(B(0x62, 0x6f, 0x6b), 0), { waarde: 'ok', eind: 3 });
});

test('2. tags, simpele waarden en floats', () => {
  assert.deepEqual(cborLees(B(0xc1, 0x05), 0), { waarde: 5, eind: 2 }, 'tag 1 wordt overgeslagen tot zijn inhoud');
  assert.deepEqual([0xf4, 0xf5, 0xf6, 0xf7].map(b => cborLees(B(b), 0).waarde), [false, true, null, undefined]);
  assert.throws(() => cborLees(B(0xf9, 0x3c, 0x00), 0), /niet-ondersteunde simpele\/float/);
  assert.throws(() => cborLees(B(0xe0), 0), /niet-ondersteunde simpele/);
});

test('3. authenticatorData korter dan 37 bytes wordt geweigerd', () => {
  assert.throws(() => ontleedAuthData(Buffer.alloc(36)), /te kort/);
  const ok = ontleedAuthData(Buffer.concat([Buffer.alloc(32), B(0x1d), B(0, 0, 0, 7)]));
  assert.deepEqual([ok.up, ok.uv, ok.be, ok.bs, ok.at, ok.signCount], [true, true, true, true, false, 7]);
});

test('4. COSE-weigeringen: geen map, verkeerde curve, Ed448, onbekend kty', () => {
  assert.throws(() => coseNaarSleutel(B(0x80)), /COSE: geen map/);
  const p384 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-384' }).publicKey.export({ format: 'jwk' });
  assert.throws(() => coseNaarSleutel(cMap(new Map([[1, 2], [3, -35], [-1, 2],
    [-2, Buffer.from(p384.x, 'base64url')], [-3, Buffer.from(p384.y, 'base64url')]]))), /alleen P-256/);
  assert.throws(() => coseNaarSleutel(cMap(new Map([[1, 1], [3, -8], [-1, 7], [-2, Buffer.alloc(57)]]))), /alleen Ed25519/);
  assert.throws(() => coseNaarSleutel(cMap(new Map([[1, 4], [3, -1]]))), /niet-ondersteund sleuteltype 4 \(alg -1\)/);
});

test('5. RSA (RS256) en Ed25519: de juiste handtekening slaagt, een over andere data faalt', () => {
  const data = Buffer.from('authData||hash(clientData)');
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rj = rsa.publicKey.export({ format: 'jwk' });
  const rsaCose = cMap(new Map([[1, 3], [3, -257], [-1, Buffer.from(rj.n, 'base64url')], [-2, Buffer.from(rj.e, 'base64url')]]));
  const rsaSig = crypto.sign('sha256', data, rsa.privateKey);
  assert.equal(verifieerHandtekening(rsaCose, data, rsaSig), true);
  assert.equal(verifieerHandtekening(rsaCose, Buffer.from('iets anders'), rsaSig), false);
  assert.equal(coseNaarSleutel(rsaCose).digest, 'sha256');

  const ed = crypto.generateKeyPairSync('ed25519');
  const ej = ed.publicKey.export({ format: 'jwk' });
  const edCose = cMap(new Map([[1, 1], [3, -8], [-1, 6], [-2, Buffer.from(ej.x, 'base64url')]]));
  const edSig = crypto.sign(null, data, ed.privateKey);
  assert.equal(verifieerHandtekening(edCose, data, edSig), true);
  assert.equal(verifieerHandtekening(edCose, Buffer.from('iets anders'), edSig), false);
  assert.equal(coseNaarSleutel(edCose).digest, null);
});
