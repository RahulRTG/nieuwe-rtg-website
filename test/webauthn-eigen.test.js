/* Eigen WebAuthn-laag (server/webauthn.js), die @simplewebauthn/server verving.
   We spelen een volledige ceremonie na met een ECHTE EC P-256-sleutel uit
   node:crypto: bouwen zelf een authenticatorData + attestationObject (CBOR),
   ondertekenen de assertion, en controleren dat de eigen laag de registratie en
   login accepteert -- en rommel/verkeerde origin/kapotte handtekening weigert.
   Zo is de crypto geborgd zonder een browser. Los: node --test test/webauthn-eigen.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const wa = require('../server/webauthn');

const b64u = b => Buffer.from(b).toString('base64url');

/* ---- piepkleine CBOR-encoder, alleen voor de testvectoren ---- */
function head(mj, len) {
  const mt = mj << 5;
  if (len < 24) return Buffer.from([mt | len]);
  if (len < 256) return Buffer.from([mt | 24, len]);
  const b = Buffer.alloc(3); b[0] = mt | 25; b.writeUInt16BE(len, 1); return b;
}
const cU = n => head(0, n), cN = n => head(1, -1 - n), cB = b => Buffer.concat([head(2, b.length), b]);
const cT = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([head(3, b.length), b]); };
function cVal(v) {
  if (Buffer.isBuffer(v)) return cB(v);
  if (typeof v === 'string') return cT(v);
  if (typeof v === 'number') return v < 0 ? cN(v) : cU(v);
  if (v instanceof Map) return cMap(v);
  throw new Error('cVal?');
}
function cMap(m) {
  const p = [head(5, m.size)];
  for (const [k, v] of m) { p.push(typeof k === 'number' ? (k < 0 ? cN(k) : cU(k)) : cT(k)); p.push(cVal(v)); }
  return Buffer.concat(p);
}

/* ---- een authenticator naspelen ---- */
function maakAuthenticator(rpID) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = cMap(new Map([[1, 2], [3, -7], [-1, 1],
    [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
  const credId = crypto.randomBytes(20);
  const rpIdHash = crypto.createHash('sha256').update(rpID).digest();
  const authData = (flags, count, withCred) => {
    const fl = Buffer.from([flags]); const sc = Buffer.alloc(4); sc.writeUInt32BE(count);
    if (!withCred) return Buffer.concat([rpIdHash, fl, sc]);
    const idLen = Buffer.alloc(2); idLen.writeUInt16BE(credId.length);
    return Buffer.concat([rpIdHash, fl, sc, Buffer.alloc(16), idLen, credId, cose]);
  };
  return { privateKey, credId, authData };
}
const clientData = (type, challenge, origin) =>
  b64u(Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false })));

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
});

test('de CBOR-lezer geeft de exacte bytelengte terug (voor het knippen van de COSE-sleutel)', () => {
  const m = cMap(new Map([[1, 2], [3, -7]]));
  const extra = Buffer.from([0xaa, 0xbb]);
  const r = wa._cborLees(Buffer.concat([m, extra]), 0);
  assert.equal(r.eind, m.length, 'de map eindigt precies waar de extra bytes beginnen');
  assert.equal(r.waarde.get(1), 2);
  assert.equal(r.waarde.get(3), -7);
});
