/* DE PASSKEY-WEIGERINGEN, EEN VOOR EEN (server/webauthn/index.js).

   De gelukkige paden staan in test/webauthn-eigen.test.js; hier de WEIGERINGEN
   die er nog niet stonden, met een echte P-256-sleutel zodat het antwoord
   verder geldig is en precies EEN ding scheef staat.

   Wat hier niet mag sneuvelen:
   1. een onvolledig antwoord, een ander credential-type of een rawId die het id
      tegenspreekt, komt nooit tot de cryptografie;
   2. clientData die geen JSON is of van de verkeerde ceremonie komt
      (create <-> get) wordt geweigerd: een login-antwoord is geen registratie;
   3. zonder user-present-vlag geen sleutel en geen login, en met
      requireUserVerification ook niet zonder UV;
   4. de onmogelijke vlaggencombinatie "backed up maar niet backup-geschikt"
      wordt geweigerd; de geldige (BE+BS) levert multiDevice op;
   5. een registratie zonder geattesteerde sleutel, met een credential-id dat
      niet bij de attestatie hoort of met een ander attestatieformaat dan
      'none' legt niets vast;
   6. een login met een rpIdHash voor een andere host faalt, ook met een
      geldige handtekening.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in verifyAuthenticationResponse `if (!authData.up)` vervangen door
     `if (false)` -> "3. login zonder UP" ZAKT (RAAK);
   - in verifyRegistrationResponse `if (authData.bs && !authData.be)` vervangen
     door `if (false)` -> "4. registratie BS zonder BE" ZAKT (RAAK);
   - in controleerClientData `c.type !== verwachtType` vervangen door `false`
     -> "2. login met create-clientData" ZAKT (RAAK).

   Draai: node --test test/webauthn-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const wa = require('../server/webauthn');
const { maakAuthenticator, clientData, b64u, cMap } = require('./webauthn-authenticator');

const RP = 'localhost', ORIGIN = 'https://localhost', CH = 'uitdaging-1234567890';
const UP = 0x01, UV = 0x04, BE = 0x08, BS = 0x10, AT = 0x40;

function registratie(a, vlaggen, extra) {
  const e = extra || {};
  const attObj = e.attObj || cMap(new Map([['fmt', e.fmt || 'none'], ['attStmt', new Map()],
    ['authData', a.authData(vlaggen, 0, !e.zonderCred)]]));
  const r = { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { clientDataJSON: e.cd || clientData('webauthn.create', CH, ORIGIN), attestationObject: b64u(attObj) } };
  return Object.assign(r, e.buiten || {});
}
const reg = (resp, extra) => wa.verifyRegistrationResponse(Object.assign({ response: resp,
  expectedChallenge: CH, expectedOrigin: ORIGIN, expectedRPID: RP }, extra || {}));

/* Een login met willekeurige vlaggen en een ECHTE handtekening erover. */
function login(a, vlaggen, extra) {
  const e = extra || {};
  const cd = e.cd || clientData('webauthn.get', CH, ORIGIN);
  const ad = e.authData || a.authData(vlaggen, 5, false);
  const sig = crypto.sign('sha256', Buffer.concat([ad, crypto.createHash('sha256').update(Buffer.from(cd, 'base64url')).digest()]), a.privateKey);
  return { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { authenticatorData: b64u(ad), clientDataJSON: cd, signature: b64u(sig) } };
}
function credentialVan(a) {
  const uit = reg(registratie(a, UP | UV | AT));
  return { id: uit.registrationInfo.credential.id, publicKey: uit.registrationInfo.credential.publicKey, counter: 1 };
}
const aan = (resp, cred, extra) => wa.verifyAuthenticationResponse(Object.assign({ response: resp,
  expectedChallenge: CH, expectedOrigin: ORIGIN, expectedRPID: RP, credential: cred }, extra || {}));

test('opties: uitsluit- en toegestane sleutels gaan met id, type en transports mee', () => {
  const r = wa.generateRegistrationOptions({ rpName: 'RTG', rpID: RP, userID: Buffer.from('x'), userName: 'l',
    excludeCredentials: [{ id: 'abc', transports: ['usb'] }] });
  assert.deepEqual(r.excludeCredentials, [{ id: 'abc', type: 'public-key', transports: ['usb'] }]);
  const l = wa.generateAuthenticationOptions({ rpID: RP, allowCredentials: [{ id: 'def', transports: ['internal'] }] });
  assert.deepEqual(l.allowCredentials, [{ id: 'def', type: 'public-key', transports: ['internal'] }]);
  assert.notEqual(r.challenge, l.challenge);
  assert.deepEqual(wa.generateAuthenticationOptions({ rpID: RP }).allowCredentials, [], 'zonder lijst: elke passkey van deze RP');
});

test('1. registratie: onvolledig, ander type of tegensprekende id wordt geweigerd', () => {
  const a = maakAuthenticator(RP);
  assert.throws(() => reg({ id: 'x', type: 'public-key', response: { clientDataJSON: 'x' } }), /onvolledig registratie/);
  assert.throws(() => reg(registratie(a, UP | AT, { buiten: { type: 'password' } })), /credential-type/);
  assert.throws(() => reg(registratie(a, UP | AT, { buiten: { rawId: undefined, id: b64u(Buffer.from('ander')) } })), /credential-id komt niet overeen met attestatie/);
  assert.throws(() => reg(registratie(a, UP | AT, { buiten: { rawId: undefined, id: undefined } })), /credential-id komt niet overeen met attestatie/);
  assert.throws(() => reg(registratie(a, UP | AT, { buiten: { id: undefined } })), /rawId komt niet overeen/, 'een rawId zonder id');
});

test('2. registratie: kapotte of verkeerde clientData en een attestationObject dat geen map is', () => {
  const a = maakAuthenticator(RP);
  assert.throws(() => reg(registratie(a, UP | AT, { cd: b64u(Buffer.from('{geen json')) })), /geen geldige JSON/);
  assert.throws(() => reg(registratie(a, UP | AT, { cd: clientData('webauthn.get', CH, ORIGIN) })), /type klopt niet \(webauthn\.get\)/);
  assert.throws(() => reg(registratie(a, UP | AT, { attObj: Buffer.from([0x80]) })), /geen map/);
});

test('3. registratie: zonder UP geen sleutel, zonder UV niet als UV geëist is', () => {
  const a = maakAuthenticator(RP);
  assert.throws(() => reg(registratie(a, AT)), /user-present/);
  assert.throws(() => reg(registratie(a, UP | AT), { requireUserVerification: true }), /gebruikersverificatie/);
  assert.equal(reg(registratie(a, UP | UV | AT), { requireUserVerification: true }).verified, true);
});

test('4. registratie BS zonder BE geweigerd; BE+BS is een multiDevice-sleutel', () => {
  const a = maakAuthenticator(RP);
  assert.throws(() => reg(registratie(a, UP | BS | AT)), /backup-vlaggen/);
  const ok = reg(registratie(a, UP | BE | BS | AT));
  assert.equal(ok.registrationInfo.credentialDeviceType, 'multiDevice');
  assert.equal(ok.registrationInfo.credentialBackedUp, true);
  assert.deepEqual(ok.registrationInfo.credential.transports, []);
});

test('5. registratie zonder geattesteerde sleutel of met formaat packed legt niets vast', () => {
  const a = maakAuthenticator(RP);
  assert.throws(() => reg(registratie(a, UP, { zonderCred: true })), /geen credential in authenticatorData/);
  assert.throws(() => reg(registratie(a, UP | AT, { fmt: 'packed' })), /packed wordt niet ondersteund/);
});

test('1. login: onvolledig, ander type, vreemd id of tegensprekende rawId', () => {
  const a = maakAuthenticator(RP); const cred = credentialVan(a);
  const goed = login(a, UP | UV);
  assert.throws(() => aan({ ...goed, response: { ...goed.response, signature: undefined } }, cred), /onvolledig login/);
  assert.throws(() => aan({ ...goed, type: 'password' }, cred), /credential-id komt niet overeen/);
  assert.throws(() => aan(goed, { ...cred, id: 'iemand-anders' }), /credential-id komt niet overeen/);
  assert.throws(() => aan(goed, null), /credential-id komt niet overeen/);
  assert.throws(() => aan({ ...goed, id: undefined, rawId: undefined }, cred), /credential-id komt niet overeen/);
  assert.throws(() => aan({ ...goed, rawId: 'ander' }, cred), /rawId komt niet overeen/);
  assert.equal(aan(goed, cred).verified, true, 'het ongewijzigde antwoord slaagt wel');
});

test('2. login met create-clientData of rommel wordt geweigerd', () => {
  const a = maakAuthenticator(RP); const cred = credentialVan(a);
  assert.throws(() => aan(login(a, UP, { cd: clientData('webauthn.create', CH, ORIGIN) }), cred), /type klopt niet/);
  assert.throws(() => aan(login(a, UP, { cd: b64u(Buffer.from('rommel')) }), cred), /geen geldige JSON/);
});

test('6. login met de rpIdHash van een andere host faalt, ook met geldige handtekening', () => {
  const a = maakAuthenticator(RP); const cred = credentialVan(a);
  const vreemd = maakAuthenticator('kwaad.example').authData(UP | UV, 9, false);
  assert.throws(() => aan(login(a, UP, { authData: vreemd }), cred), /rpIdHash/);
});

test('3. login zonder UP, of zonder UV als die geëist is', () => {
  const a = maakAuthenticator(RP); const cred = credentialVan(a);
  assert.throws(() => aan(login(a, UV), cred), /user-present/);
  assert.throws(() => aan(login(a, UP), cred, { requireUserVerification: true }), /gebruikersverificatie/);
  assert.equal(aan(login(a, UP | UV), cred, { requireUserVerification: true }).verified, true);
});

test('4. login BS zonder BE geweigerd; BE+BS geeft multiDevice en de nieuwe teller', () => {
  const a = maakAuthenticator(RP); const cred = credentialVan(a);
  assert.throws(() => aan(login(a, UP | BS), cred), /backup-vlaggen/);
  const ok = aan(login(a, UP | BE | BS), cred);
  assert.deepEqual(ok.authenticationInfo, { newCounter: 5, credentialDeviceType: 'multiDevice', credentialBackedUp: true });
});
