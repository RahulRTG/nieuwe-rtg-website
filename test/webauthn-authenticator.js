/* EEN AUTHENTICATOR NASPELEN, MET ECHTE CRYPTO.

   Een passkey-ceremonie is niet na te doen met een verzonnen JSON-blokje: de
   server verifieert een ECDSA-handtekening over authenticatorData plus de hash
   van clientDataJSON, en dat is precies het punt. Dit bestand bouwt daarom een
   echte P-256-sleutel uit node:crypto en zet de bijbehorende CBOR-structuren in
   elkaar, zodat de eigen WebAuthn-laag een geldige registratie en een geldige
   login te zien krijgt -- zonder een browser.

   WAAROM HET HIER STAAT EN NIET IN EEN TOETSBESTAND. Het stond in
   test/webauthn-eigen.test.js, en dat bestand toetst server/webauthn.js
   RECHTSTREEKS: het roept verifyRegistrationResponse() aan met de verwachte
   origin en rpID die het zelf meegeeft. Daar is de crypto mee geborgd, maar de
   ROUTES niet -- en dat is dezelfde blinde vlek als bij het pasbesluit, waar de
   kern-toets de naam met de hand meegaf en de fout in de route zat. Wie de
   ceremonie ook op /api/webauthn/* wil naspelen, heeft deze authenticator nodig,
   en twee kopieen ervan zouden uiteenlopen zodra het formaat verandert.

   Gebruik:
     const { maakAuthenticator, clientData, b64u, cMap } = require('./webauthn-authenticator');
*/
'use strict';
const crypto = require('crypto');

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

/* Een authenticator voor een bepaalde rpID (de hostnaam waarvoor de sleutel
   geldt). Geeft de prive-sleutel terug om mee te ondertekenen, de credential-id
   en een bouwer voor authenticatorData. */
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

  /* De twee complete antwoorden, zoals een browser ze zou afleveren. Ze staan
     hier en niet in de toets, want de vorm hoort bij de authenticator. */
  function registratieAntwoord(challenge, origin) {
    const attObj = cMap(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData(0x45, 0, true)]]));
    return { id: b64u(credId), rawId: b64u(credId), type: 'public-key',
      response: { clientDataJSON: clientData('webauthn.create', challenge, origin),
        attestationObject: b64u(attObj), transports: ['internal'] } };
  }
  function loginAntwoord(challenge, origin, teller) {
    const cd = clientData('webauthn.get', challenge, origin);
    const authD = authData(0x05, teller == null ? 1 : teller, false);   // UP|UV
    const teTekenen = Buffer.concat([authD, crypto.createHash('sha256').update(Buffer.from(cd, 'base64url')).digest()]);
    return { id: b64u(credId), rawId: b64u(credId), type: 'public-key',
      response: { authenticatorData: b64u(authD), clientDataJSON: cd,
        signature: b64u(crypto.sign('sha256', teTekenen, privateKey)), userHandle: null } };
  }

  return { privateKey, credId, authData, registratieAntwoord, loginAntwoord };
}

const clientData = (type, challenge, origin) =>
  b64u(Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false })));

module.exports = { maakAuthenticator, clientData, b64u, cMap };
