/* webauthn, deel "cbor": het binaire decodeer-werk -- een minimale CBOR-lezer
   (voor attestationObject + COSE-sleutel), het ontleden van authenticatorData,
   en COSE->Node-KeyObject + handtekeningverificatie. Regel 1 (docs/de-lijn.md):
   GEEN eigen crypto -- SHA-256/handtekeningverificatie komen uit node:crypto; de
   CBOR-lezer is puur een binair formaat decoderen, geen crypto. */
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


module.exports = { b64u, vanB64u, sha256, gelijk, cborLees, ontleedAuthData, coseNaarSleutel, verifieerHandtekening };
