/* Eigen WebAuthn-verificatie, i.p.v. het pakket @simplewebauthn/server.

   Let op de nuance bij regel 1 (docs/de-lijn.md): we schrijven hier GEEN eigen
   cryptografie. We zetten alleen de bekende WebAuthn-protocolstappen op elkaar met
   Node's standaard-primitieven -- SHA-256 en handtekeningverificatie (ECDSA P-256,
   RSA PKCS#1v1.5, Ed25519) -- allemaal uit `node:crypto`. Het enige echt "eigen"
   stuk is een kleine CBOR-lezer voor het attestationObject en de COSE-sleutel; dat
   is puur decoderen van een binair formaat, geen crypto.

   Scope: attestationType 'none' (wij vragen geen attestatie op -- we willen niet
   weten welk merk authenticator iemand gebruikt). Er is dus geen attestatie-
   handtekening te controleren; we verifieren de identiteit bij het INLOGGEN via de
   assertion-handtekening over de opgeslagen publieke sleutel. Dat is de kant die
   telt: registratie legt de publieke sleutel vast, login bewijst het bezit ervan.

   Zelfde vorm en veldnamen als het pakket, zodat server/kern/webauthn.js niets
   merkt: generateRegistrationOptions, verifyRegistrationResponse,
   generateAuthenticationOptions, verifyAuthenticationResponse. */
'use strict';
const crypto = require('crypto');

/* ---------- base64url <-> bytes ---------- */
const b64u = buf => Buffer.from(buf).toString('base64url');
const vanB64u = s => Buffer.from(String(s), 'base64url');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest();

/* Constante-tijd vergelijking van twee buffers (lengteverschil = ongelijk). */
function gelijk(a, b) {
  a = Buffer.from(a); b = Buffer.from(b);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------- minimale CBOR-lezer ----------
   Genoeg voor WebAuthn: unsigned/negatieve ints, byte- en tekststrings, arrays,
   maps, tags (overgeslagen) en de simpele waarden (true/false/null). Geen floats
   nodig voor attestatie 'none'. Geeft { waarde, eind } terug zodat de aanroeper de
   exacte byte-lengte kent (nodig om de COSE-sleutel uit authData te knippen). */
function cborLees(buf, p) {
  const eerste = buf[p];
  const major = eerste >> 5;
  const ai = eerste & 0x1f;
  p += 1;
  let lengte = ai, extra = 0;
  if (ai === 24) { lengte = buf[p]; extra = 1; }
  else if (ai === 25) { lengte = buf.readUInt16BE(p); extra = 2; }
  else if (ai === 26) { lengte = buf.readUInt32BE(p); extra = 4; }
  else if (ai === 27) { lengte = Number(buf.readBigUInt64BE(p)); extra = 8; }
  else if (ai > 27) throw new Error('CBOR: ongeldige lengte-codering');
  p += extra;

  switch (major) {
    case 0: return { waarde: lengte, eind: p };                       // unsigned int
    case 1: return { waarde: -1 - lengte, eind: p };                  // negative int
    case 2: return { waarde: buf.subarray(p, p + lengte), eind: p + lengte }; // byte string
    case 3: return { waarde: buf.toString('utf8', p, p + lengte), eind: p + lengte }; // text
    case 4: {                                                          // array
      const arr = [];
      for (let i = 0; i < lengte; i++) { const r = cborLees(buf, p); arr.push(r.waarde); p = r.eind; }
      return { waarde: arr, eind: p };
    }
    case 5: {                                                          // map
      const m = new Map();
      for (let i = 0; i < lengte; i++) {
        const k = cborLees(buf, p); p = k.eind;
        const v = cborLees(buf, p); p = v.eind;
        m.set(k.waarde, v.waarde);
      }
      return { waarde: m, eind: p };
    }
    case 6: { const r = cborLees(buf, p); return { waarde: r.waarde, eind: r.eind }; } // tag: inhoud
    case 7:                                                            // simple
      if (ai === 20) return { waarde: false, eind: p };
      if (ai === 21) return { waarde: true, eind: p };
      if (ai === 22) return { waarde: null, eind: p };
      if (ai === 23) return { waarde: undefined, eind: p };
      throw new Error('CBOR: niet-ondersteunde simpele/float-waarde');
    default: throw new Error('CBOR: onbekend majortype');
  }
}

/* ---------- authenticatorData ontleden ----------
   Layout: rpIdHash(32) | flags(1) | signCount(4, BE) | [attestedCredentialData] |
   [extensions]. attestedCredentialData (alleen als AT-vlag gezet):
   aaguid(16) | credIdLen(2,BE) | credId(L) | credPublicKey(COSE). */
const VLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40, ED: 0x80 };
function ontleedAuthData(buf) {
  if (buf.length < 37) throw new Error('authenticatorData te kort');
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const signCount = buf.readUInt32BE(33);
  const uit = { rpIdHash, flags, signCount,
    up: !!(flags & VLAG.UP), uv: !!(flags & VLAG.UV),
    be: !!(flags & VLAG.BE), bs: !!(flags & VLAG.BS),
    at: !!(flags & VLAG.AT), ed: !!(flags & VLAG.ED) };
  let p = 37;
  if (uit.at) {
    uit.aaguid = buf.subarray(p, p + 16); p += 16;
    const len = buf.readUInt16BE(p); p += 2;
    uit.credentialId = buf.subarray(p, p + len); p += len;
    const r = cborLees(buf, p);              // COSE-sleutel als CBOR-map
    uit.credentialPublicKey = buf.subarray(p, r.eind); // exacte COSE-bytes bewaren
    uit.cose = r.waarde;
    p = r.eind;
  }
  return uit;
}

/* ---------- COSE-sleutel -> Node KeyObject + verificatie-parameters ----------
   COSE-labels: kty(1): 2=EC2, 3=RSA, 1=OKP. alg(3): -7=ES256, -257=RS256, -8=EdDSA.
   EC2: crv(-1) 1=P-256, x(-2), y(-3). RSA: n(-1), e(-2). OKP: crv(-1) 6=Ed25519, x(-2).
   We bouwen een JWK en laten node:crypto de sleutel maken -- geen eigen crypto. */
function coseNaarSleutel(coseBytes) {
  const m = cborLees(Buffer.from(coseBytes), 0).waarde;
  if (!(m instanceof Map)) throw new Error('COSE: geen map');
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2) {                                   // EC2
    const crv = m.get(-1);
    if (crv !== 1) throw new Error('COSE: alleen P-256 ondersteund');
    const key = crypto.createPublicKey({ key: {
      kty: 'EC', crv: 'P-256', x: b64u(m.get(-2)), y: b64u(m.get(-3)) }, format: 'jwk' });
    return { key, digest: 'sha256', dsaEncoding: 'der' };
  }
  if (kty === 3) {                                   // RSA
    const key = crypto.createPublicKey({ key: {
      kty: 'RSA', n: b64u(m.get(-1)), e: b64u(m.get(-2)) }, format: 'jwk' });
    return { key, digest: 'sha256' };
  }
  if (kty === 1) {                                   // OKP (Ed25519)
    const crv = m.get(-1);
    if (crv !== 6) throw new Error('COSE: alleen Ed25519 ondersteund');
    const key = crypto.createPublicKey({ key: {
      kty: 'OKP', crv: 'Ed25519', x: b64u(m.get(-2)) }, format: 'jwk' });
    return { key, digest: null };                    // Ed25519: geen aparte digest
  }
  throw new Error('COSE: niet-ondersteund sleuteltype ' + kty + ' (alg ' + alg + ')');
}
function verifieerHandtekening(coseBytes, data, handtekening) {
  const s = coseNaarSleutel(coseBytes);
  const opt = s.dsaEncoding ? { key: s.key, dsaEncoding: s.dsaEncoding } : s.key;
  return crypto.verify(s.digest, data, opt, handtekening);
}

/* ---------- clientDataJSON controleren ---------- */
function controleerClientData(clientDataJSON, verwachtType, verwachteChallenge, verwachteOrigin) {
  let c;
  try { c = JSON.parse(vanB64u(clientDataJSON).toString('utf8')); }
  catch (e) { throw new Error('clientDataJSON is geen geldige JSON'); }
  if (c.type !== verwachtType) throw new Error('clientData.type klopt niet (' + c.type + ')');
  if (!gelijk(Buffer.from(String(c.challenge)), Buffer.from(String(verwachteChallenge))))
    throw new Error('challenge komt niet overeen');
  if (c.origin !== verwachteOrigin) throw new Error('origin komt niet overeen (' + c.origin + ')');
  return c;
}

/* ================= publieke API (zelfde vorm als @simplewebauthn) ================= */

const PUB_KEY_PARAMS = [                              // volgorde als het pakket: EdDSA, ES256, RS256
  { alg: -8, type: 'public-key' },
  { alg: -7, type: 'public-key' },
  { alg: -257, type: 'public-key' }
];

function generateRegistrationOptions(opts) {
  const challenge = b64u(crypto.randomBytes(32));
  return {
    challenge,
    rp: { name: opts.rpName, id: opts.rpID },
    user: { id: b64u(opts.userID), name: opts.userName, displayName: opts.userName },
    pubKeyCredParams: PUB_KEY_PARAMS,
    timeout: 60000,
    attestation: opts.attestationType || 'none',
    excludeCredentials: (opts.excludeCredentials || []).map(c => ({
      id: c.id, type: 'public-key', transports: c.transports })),
    authenticatorSelection: opts.authenticatorSelection || { residentKey: 'preferred', userVerification: 'preferred' },
    extensions: { credProps: true }
  };
}

function generateAuthenticationOptions(opts) {
  return {
    challenge: b64u(crypto.randomBytes(32)),
    timeout: 60000,
    rpId: opts.rpID,
    userVerification: opts.userVerification || 'preferred',
    allowCredentials: (opts.allowCredentials || []).map(c => ({
      id: c.id, type: 'public-key', transports: c.transports }))
  };
}

function verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID }) {
  const resp = response && response.response;
  if (!resp || !resp.clientDataJSON || !resp.attestationObject) throw new Error('onvolledig registratie-antwoord');
  controleerClientData(resp.clientDataJSON, 'webauthn.create', expectedChallenge, expectedOrigin);

  const att = cborLees(vanB64u(resp.attestationObject), 0).waarde;
  if (!(att instanceof Map)) throw new Error('attestationObject: geen map');
  const fmt = att.get('fmt');
  const authData = ontleedAuthData(Buffer.from(att.get('authData')));

  if (!gelijk(authData.rpIdHash, sha256(Buffer.from(expectedRPID, 'utf8'))))
    throw new Error('rpIdHash komt niet overeen met de verwachte RP-ID');
  if (!authData.up) throw new Error('user-present-vlag ontbreekt');
  if (!authData.at || !authData.credentialId || !authData.credentialPublicKey)
    throw new Error('geen credential in authenticatorData');

  // fmt 'none': geen attestatie-handtekening. Andere formaten steunen we (nog) niet.
  if (fmt !== 'none') throw new Error('attestatieformaat ' + fmt + ' wordt niet ondersteund (verwacht: none)');
  // sanity: de COSE-sleutel moet bruikbaar zijn (gooit anders)
  coseNaarSleutel(authData.credentialPublicKey);

  return {
    verified: true,
    registrationInfo: {
      fmt,
      credential: {
        id: b64u(authData.credentialId),
        publicKey: new Uint8Array(authData.credentialPublicKey),
        counter: authData.signCount,
        transports: (resp.transports || [])
      },
      credentialDeviceType: authData.be ? 'multiDevice' : 'singleDevice',
      credentialBackedUp: authData.bs
    }
  };
}

function verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID, credential }) {
  const resp = response && response.response;
  if (!resp || !resp.clientDataJSON || !resp.authenticatorData || !resp.signature)
    throw new Error('onvolledig login-antwoord');
  controleerClientData(resp.clientDataJSON, 'webauthn.get', expectedChallenge, expectedOrigin);

  const authDataBuf = vanB64u(resp.authenticatorData);
  const authData = ontleedAuthData(authDataBuf);
  if (!gelijk(authData.rpIdHash, sha256(Buffer.from(expectedRPID, 'utf8'))))
    throw new Error('rpIdHash komt niet overeen met de verwachte RP-ID');
  if (!authData.up) throw new Error('user-present-vlag ontbreekt');

  // ondertekend wordt: authenticatorData || sha256(clientDataJSON)
  const data = Buffer.concat([authDataBuf, sha256(vanB64u(resp.clientDataJSON))]);
  const cose = Buffer.from(credential.publicKey);
  if (!verifieerHandtekening(cose, data, vanB64u(resp.signature)))
    throw new Error('handtekening klopt niet');

  // teller-regressie: een gekloonde sleutel valt op doordat de teller terugloopt
  const oud = credential.counter || 0;
  const nieuw = authData.signCount;
  if ((oud > 0 || nieuw > 0) && nieuw <= oud && nieuw !== 0)
    throw new Error('teller liep terug (mogelijk gekloonde sleutel)');

  return { verified: true, authenticationInfo: { newCounter: nieuw, credentialDeviceType: authData.be ? 'multiDevice' : 'singleDevice', credentialBackedUp: authData.bs } };
}

module.exports = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  // hulpstukken (voor tests / hergebruik)
  _cborLees: cborLees, _ontleedAuthData: ontleedAuthData, _coseNaarSleutel: coseNaarSleutel
};
