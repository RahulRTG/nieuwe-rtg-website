/* DE TOKENCONTROLE VAN EEN VREEMDE PROVIDER, DE RANDEN (server/sso/jwt.js).

   jwt.verifieer beslist of een ID-token van de identiteitsprovider van een
   zakelijke klant iemand binnenlaat. test/sso.test.js toetst de grote
   valkuilen (alg:none, HS256-verwarring, iss/aud/nonce, verlopen). Hier staan
   de randen die daar niet stonden, steeds met een ECHTE handtekening zodat
   precies een ding scheef staat.

   Wat hier niet mag sneuvelen:
   1. een token dat geen drie delen heeft, of waarvan kop of inhoud geen
      JSON-object is, wordt geweigerd voor er een sleutel wordt gekozen;
   2. een lege of ontbrekende sleutelbos is een weigering, geen "dan maar
      zonder"; een onbekende kid is herkenbaar (onbekendeKid) zodat de aanroeper
      één keer mag verversen;
   3. zonder kid wordt alleen gekozen als er precies één passende sleutel is;
   4. een kid die naar een sleutel van het verkeerde type wijst, of naar een
      sleutel die zelf een ander alg noemt, of een onleesbare sleutel: weigeren;
   5. ES256 wordt echt geverifieerd (IEEE-P1363-handtekening), ook zonder eisen;
   6. een token met nbf in de toekomst (voorbij de klokspeling) of zonder sub
      laat niemand binnen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (jwk.kty !== spec.kty)` vervangen door `if (false)` -> "4." ZAKT
     (RAAK: de RSA-handtekening wordt dan tegen een EC-sleutel gelegd en de
     melding is niet meer de onze);
   - de nbf-controle `> nu` vervangen door `> nu + 1e12` -> "6." ZAKT (RAAK);
   - `if (past.length !== 1)` vervangen door `if (past.length < 1)` -> "3."
     ZAKT (RAAK: met twee RSA-sleutels zou de eerste gekozen worden).

   Draai: node --test test/sso-jwt-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('../server/sso/jwt');

const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const RSA = Object.assign(rsa.publicKey.export({ format: 'jwk' }), { kid: 'r1', use: 'sig' });
const EC = Object.assign(ec.publicKey.export({ format: 'jwk' }), { kid: 'e1' });
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const sec = () => Math.floor(Date.now() / 1000);
const claims = (x) => Object.assign({ iss: 'https://idp.test', aud: 'c', sub: 'u1', exp: sec() + 300 }, x || {});

function teken(c, kop) {
  const k = Object.assign({ alg: 'RS256', kid: 'r1' }, kop || {});
  const stuk = b64(k) + '.' + b64(c);
  const sig = k.alg === 'ES256'
    ? crypto.sign('sha256', Buffer.from(stuk), { key: ec.privateKey, dsaEncoding: 'ieee-p1363' })
    : crypto.sign('sha256', Buffer.from(stuk), rsa.privateKey);
  return stuk + '.' + sig.toString('base64url');
}
const JWKS = { keys: [RSA, EC] };

test('1. vorm: drie delen, JSON, objecten', () => {
  assert.throws(() => jwt.verifieer(undefined, JWKS, {}), /drie delen/);
  assert.throws(() => jwt.verifieer('a.b', JWKS, {}), /drie delen/);
  assert.throws(() => jwt.verifieer(b64('{x') + '.' + b64({}) + '.x', JWKS, {}), /Tokenkop is geen geldige JSON/);
  assert.throws(() => jwt.verifieer(b64({ alg: 'RS256' }) + '.' + b64('nee') + '.x', JWKS, {}), /Tokeninhoud is geen geldige JSON/);
  assert.throws(() => jwt.verifieer(b64('null') + '.' + b64({}) + '.x', JWKS, {}), /geen object/);
  assert.throws(() => jwt.verifieer(b64({ alg: 'RS256' }) + '.' + b64('7') + '.x', JWKS, {}), /geen object/);
});

test('2. sleutelbos: leeg, ontbrekend, alleen enc-sleutels, onbekende kid', () => {
  const t = teken(claims());
  assert.throws(() => jwt.verifieer(t, null, {}), /sleutelbos van de provider is leeg/);
  assert.throws(() => jwt.verifieer(t, { keys: 'nee' }, {}), /leeg/);
  assert.throws(() => jwt.verifieer(t, { keys: [null, Object.assign({}, RSA, { use: 'enc' })] }, {}), /leeg/,
    'een versleutelsleutel is geen ondertekensleutel');
  let fout;
  try { jwt.verifieer(teken(claims(), { kid: 'nieuw' }), JWKS, {}); } catch (e) { fout = e; }
  assert.match(fout.message, /Onbekende sleutel-id/);
  assert.equal(fout.onbekendeKid, true, 'de aanroeper moet kunnen zien dat verversen zin heeft');
});

test('3. zonder kid: alleen bij precies één passende sleutel', () => {
  const zonder = (kop) => teken(claims(), Object.assign({ kid: undefined }, kop));
  assert.equal(jwt.verifieer(zonder(), JWKS, {}).sub, 'u1', 'één RSA-sleutel in de bos: eenduidig');
  const tweeRsa = { keys: [RSA, Object.assign({}, RSA, { kid: 'r2' })] };
  assert.throws(() => jwt.verifieer(zonder(), tweeRsa, {}), /niet eenduidig/);
  assert.throws(() => jwt.verifieer(zonder(), { keys: [EC] }, {}), /niet eenduidig/, 'geen enkele passende sleutel');
});

test('4. verkeerd type, ander alg volgens de provider, onleesbare sleutel', () => {
  assert.throws(() => jwt.verifieer(teken(claims(), { kid: 'e1' }), JWKS, {}), /past niet bij het opgegeven algoritme/);
  const anderAlg = { keys: [Object.assign({}, RSA, { alg: 'RS512' })] };
  assert.throws(() => jwt.verifieer(teken(claims()), anderAlg, {}), /ander algoritme/);
  assert.equal(jwt.verifieer(teken(claims()), { keys: [Object.assign({}, RSA, { alg: 'RS256' })] }, {}).sub, 'u1');
  const kapot = { keys: [{ kty: 'RSA', kid: 'r1' }] };
  assert.throws(() => jwt.verifieer(teken(claims()), kapot, {}), /niet te lezen/);
});

test('5. ES256 wordt echt geverifieerd, ook zonder eisen-object', () => {
  const t = teken(claims(), { alg: 'ES256', kid: 'e1' });
  assert.equal(jwt.verifieer(t, JWKS).sub, 'u1');
  const delen = t.split('.');
  const anders = b64({ alg: 'ES256', kid: 'e1' }) + '.' + b64(claims({ sub: 'baas' })) + '.' + delen[2];
  assert.throws(() => jwt.verifieer(anders, JWKS), /handtekening klopt niet/);
});

test('6. nbf in de toekomst en een ontbrekende sub laten niemand binnen', () => {
  assert.throws(() => jwt.verifieer(teken(claims({ nbf: sec() + 3600 })), JWKS, {}), /nog niet geldig/);
  assert.equal(jwt.verifieer(teken(claims({ nbf: sec() + 30 })), JWKS, {}).sub, 'u1', 'binnen de klokspeling mag het');
  assert.equal(jwt.verifieer(teken(claims({ nbf: sec() - 10 })), JWKS, {}).sub, 'u1');
  assert.throws(() => jwt.verifieer(teken(claims({ sub: '' })), JWKS, {}), /geen onderwerp/);
});
