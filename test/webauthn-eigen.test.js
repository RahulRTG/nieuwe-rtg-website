/* Eigen WebAuthn-laag (server/webauthn.js), die @simplewebauthn/server verving.
   We spelen een volledige ceremonie na met een ECHTE EC P-256-sleutel uit
   node:crypto: bouwen zelf een authenticatorData + attestationObject (CBOR),
   ondertekenen de assertion, en controleren dat de eigen laag de registratie en
   login accepteert -- en rommel/verkeerde origin/kapotte handtekening weigert.
   Zo is de crypto geborgd zonder een browser.

   DE AUTHENTICATOR ZELF STAAT NIET MEER HIER. Hij is verhuisd naar
   test/webauthn-authenticator.js, want test/webauthn.test.js speelt dezelfde
   ceremonie nu ook af op de ECHTE ROUTES. Dit bestand toetst server/webauthn.js
   rechtstreeks en geeft de verwachte origin en rpID met de hand mee -- precies
   zoals de kern-toets bij het pasbesluit dat deed, en daar zat de fout in de
   route. Twee lagen, een authenticator.

   Los: node --test test/webauthn-eigen.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const wa = require('../server/webauthn');
const { maakCeremonieOpslag } = require('../server/kern/webauthn');
const { maakAuthenticator, clientData, b64u, cMap } = require('./webauthn-authenticator');

const RP = 'localhost', ORIGIN = 'https://localhost';

test('registratie: een geldige passkey wordt geaccepteerd, met de juiste velden terug', () => {
  const opt = wa.generateRegistrationOptions({ rpName: 'RTG', rpID: RP,
    userID: Buffer.from('rtg-1'), userName: 'lid-1', attestationType: 'none', excludeCredentials: [] });
  assert.ok(opt.challenge.length >= 16);
  assert.equal(opt.rp.id, RP);
  assert.deepEqual(opt.pubKeyCredParams.map(p => p.alg).sort(), [-257, -8, -7].sort());

  const a = maakAuthenticator(RP);
  const ad = a.authData(0x45, 0, true); // UP|UV|AT
  const attObj = cMap(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad]]));
  const resp = { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { clientDataJSON: clientData('webauthn.create', opt.challenge, ORIGIN),
      attestationObject: b64u(attObj), transports: ['internal'] } };

  const uit = wa.verifyRegistrationResponse({ response: resp, expectedChallenge: opt.challenge,
    expectedOrigin: ORIGIN, expectedRPID: RP });
  assert.equal(uit.verified, true);
  assert.equal(uit.registrationInfo.credential.id, b64u(a.credId));
  assert.ok(uit.registrationInfo.credential.publicKey instanceof Uint8Array);
  assert.equal(uit.registrationInfo.credential.counter, 0);
  assert.equal(uit.registrationInfo.credentialDeviceType, 'singleDevice');
});

test('registratie: verkeerde origin, verkeerde challenge en verkeerde rpID falen', () => {
  const opt = wa.generateRegistrationOptions({ rpName: 'RTG', rpID: RP, userID: Buffer.from('rtg-2'), userName: 'lid-2' });
  const a = maakAuthenticator(RP);
  const attObj = cMap(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', a.authData(0x45, 0, true)]]));
  const resp = { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { clientDataJSON: clientData('webauthn.create', opt.challenge, ORIGIN), attestationObject: b64u(attObj) } };
  assert.throws(() => wa.verifyRegistrationResponse({ response: resp, expectedChallenge: opt.challenge, expectedOrigin: 'https://kwaad.nl', expectedRPID: RP }), /origin/);
  assert.throws(() => wa.verifyRegistrationResponse({ response: resp, expectedChallenge: 'ander', expectedOrigin: ORIGIN, expectedRPID: RP }), /challenge/);
  assert.throws(() => wa.verifyRegistrationResponse({ response: resp, expectedChallenge: opt.challenge, expectedOrigin: ORIGIN, expectedRPID: 'ander.nl' }), /rpIdHash/);
  assert.throws(() => wa.verifyRegistrationResponse({ response: { ...resp, rawId: 'ander' },
    expectedChallenge: opt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP }), /rawId/,
  'de buitenste credentialvelden mogen de geattesteerde sleutel niet tegenspreken');

  const overGrens = { ...resp, response: { ...resp.response,
    clientDataJSON: clientData('webauthn.create', opt.challenge, ORIGIN, { crossOrigin: true }) } };
  assert.throws(() => wa.verifyRegistrationResponse({ response: overGrens, expectedChallenge: opt.challenge,
    expectedOrigin: ORIGIN, expectedRPID: RP }), /cross-origin/,
  'een toekomstige cross-origin browserstroom staat niet stilzwijgend open');
});

test('login: een echte handtekening slaagt, kapot faalt, teller loopt vooruit', () => {
  const a = maakAuthenticator(RP);
  // eerst registreren om de opgeslagen COSE-sleutel te krijgen
  const rOpt = wa.generateRegistrationOptions({ rpName: 'RTG', rpID: RP, userID: Buffer.from('rtg-3'), userName: 'lid-3' });
  const attObj = cMap(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', a.authData(0x45, 0, true)]]));
  const reg = wa.verifyRegistrationResponse({ response: { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { clientDataJSON: clientData('webauthn.create', rOpt.challenge, ORIGIN), attestationObject: b64u(attObj) } },
    expectedChallenge: rOpt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP });
  const opgeslagenPk = reg.registrationInfo.credential.publicKey;

  const lOpt = wa.generateAuthenticationOptions({ rpID: RP, userVerification: 'preferred',
    allowCredentials: [{ id: b64u(a.credId), transports: ['internal'] }] });
  assert.equal(lOpt.rpId, RP);
  const cd = clientData('webauthn.get', lOpt.challenge, ORIGIN);
  const authD = a.authData(0x05, 7, false); // UP|UV, teller 7
  const signData = Buffer.concat([authD, crypto.createHash('sha256').update(Buffer.from(cd, 'base64url')).digest()]);
  const sig = crypto.sign('sha256', signData, a.privateKey);

  const resp = { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { authenticatorData: b64u(authD), clientDataJSON: cd, signature: b64u(sig), userHandle: null } };
  const cred = { id: b64u(a.credId), publicKey: opgeslagenPk, counter: 0, transports: ['internal'] };

  const uit = wa.verifyAuthenticationResponse({ response: resp, expectedChallenge: lOpt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP, credential: cred });
  assert.equal(uit.verified, true);
  assert.equal(uit.authenticationInfo.newCounter, 7);

  // kapotte handtekening
  const kapot = Buffer.from(sig); kapot[kapot.length - 1] ^= 0xff;
  const respKapot = { ...resp, response: { ...resp.response, signature: b64u(kapot) } };
  assert.throws(() => wa.verifyAuthenticationResponse({ response: respKapot, expectedChallenge: lOpt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP, credential: cred }), /handtekening/);
});

test('login: teller-regressie (gekloonde sleutel) wordt geweigerd', () => {
  const a = maakAuthenticator(RP);
  const rOpt = wa.generateRegistrationOptions({ rpName: 'RTG', rpID: RP, userID: Buffer.from('rtg-4'), userName: 'lid-4' });
  const attObj = cMap(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', a.authData(0x45, 0, true)]]));
  const reg = wa.verifyRegistrationResponse({ response: { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { clientDataJSON: clientData('webauthn.create', rOpt.challenge, ORIGIN), attestationObject: b64u(attObj) } },
    expectedChallenge: rOpt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP });

  const lOpt = wa.generateAuthenticationOptions({ rpID: RP, allowCredentials: [{ id: b64u(a.credId) }] });
  const cd = clientData('webauthn.get', lOpt.challenge, ORIGIN);
  const authD = a.authData(0x05, 3, false); // teller 3
  const sig = crypto.sign('sha256', Buffer.concat([authD, crypto.createHash('sha256').update(Buffer.from(cd, 'base64url')).digest()]), a.privateKey);
  const resp = { id: b64u(a.credId), rawId: b64u(a.credId), type: 'public-key',
    response: { authenticatorData: b64u(authD), clientDataJSON: cd, signature: b64u(sig), userHandle: null } };
  // opgeslagen teller staat al op 5 -> 3 is een teruggang
  assert.throws(() => wa.verifyAuthenticationResponse({ response: resp, expectedChallenge: lOpt.challenge, expectedOrigin: ORIGIN, expectedRPID: RP,
    credential: { id: b64u(a.credId), publicKey: reg.registrationInfo.credential.publicKey, counter: 5 } }), /teller/);

  const authNul = a.authData(0x05, 0, false);
  const sigNul = crypto.sign('sha256', Buffer.concat([authNul,
    crypto.createHash('sha256').update(Buffer.from(cd, 'base64url')).digest()]), a.privateKey);
  const respNul = { ...resp, response: { ...resp.response, authenticatorData: b64u(authNul), signature: b64u(sigNul) } };
  assert.throws(() => wa.verifyAuthenticationResponse({ response: respNul, expectedChallenge: lOpt.challenge,
    expectedOrigin: ORIGIN, expectedRPID: RP,
    credential: { id: b64u(a.credId), publicKey: reg.registrationInfo.credential.publicKey, counter: 5 } }), /teller/,
  'een teller die van positief terugvalt naar nul schakelt de kloondetectie niet uit');
});

test('eenmalige ceremonies blijven hard begrensd en verlopen in afloopvolgorde', () => {
  let tijd = 100;
  const opslag = maakCeremonieOpslag({ max: 3, ttlMs: 10, nu: () => tijd });
  opslag.zet('a', 'A'); opslag.zet('b', 'B'); opslag.zet('c', 'C');
  assert.equal(opslag.aantal(), 3);
  opslag.zet('d', 'D');
  assert.equal(opslag.aantal(), 3, 'verse aanvraag vier kan de opslag niet laten groeien');
  assert.equal(opslag.pak('a'), null, 'bij drukte valt alleen de oudste ongebruikte ceremonie af');
  assert.equal(opslag.pak('d').challenge, 'D', 'de nieuwste ceremonie blijft bruikbaar');
  tijd = 111;
  assert.equal(opslag.pak('b'), null, 'verlopen ceremonies zijn niet meer bruikbaar');
  assert.equal(opslag.aantal(), 0, 'verlopen regels worden zonder volledige scan opgeruimd');
});

test('de CBOR-lezer geeft de exacte bytelengte terug (voor het knippen van de COSE-sleutel)', () => {
  const m = cMap(new Map([[1, 2], [3, -7]]));
  const extra = Buffer.from([0xaa, 0xbb]);
  const r = wa._cborLees(Buffer.concat([m, extra]), 0);
  assert.equal(r.eind, m.length, 'de map eindigt precies waar de extra bytes beginnen');
  assert.equal(r.waarde.get(1), 2);
  assert.equal(r.waarde.get(3), -7);
});
