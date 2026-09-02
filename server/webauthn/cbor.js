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
/* DE DIEPTEGRENS. WebAuthn is ondiep: het attestationObject is een map met drie
   sleutels en de COSE-sleutel is een platte map. Tweeendertig is dus ruim boven
   alles wat een echte authenticator stuurt, en ver onder de stapel van node --
   zodat een geneste invoer een NETTE weigering geeft in plaats van een
   "Maximum call stack size exceeded" halverwege een verzoekafhandelaar. */
const MAX_DIEPTE = 32;

/* DRIE BUDGETTEN, EN ZE KOMEN ALLE DRIE UIT EEN GEMETEN GAT (STANDAARD.md par. 6).

   1. LEZEN VOORBIJ HET EINDE. `buf[p]` is `undefined` voorbij de buffer,
      `undefined >> 5` is 0 en `undefined & 0x1f` is 0 -- dus las deze functie
      daar een keurige "unsigned int 0" en liep door op verzonnen bytes. Een
      ontleder die data VERZINT waar er geen is, is erger dan een die valt: de
      aanroeper krijgt een geldig ogende waarde terug.

   2. EEN LENGTE DIE NIET KAN. Bij `ai === 27` komt de lengte uit acht bytes en
      werd hij onbeperkt overgenomen. Negen bytes (`9b ff ff ff ff ff ff ff ff`)
      lieten de lus in case 4 achttien triljoen keer aftellen: gemeten 9325 ms
      event-loop-blokkade, bereikbaar voor elk ingelogd lid via
      POST /api/webauthn/registreer. Node is een draad, dus dat is geen trage
      route maar een stilstaand platform.

      De grens is niet een verzonnen maximum maar de buffer zelf: een element
      kost minstens een byte en een mappaar minstens twee, dus meer beloven dan
      er nog ligt kan per definitie niet kloppen. Daarmee weigert hij precies
      het onmogelijke en geen enkel geldig document.

   3. EEN STRING DIE MEER BELOOFT DAN ER IS. `subarray` KLEMT en gooit niet, dus
      een bytestring van 200 die er 3 heeft kwam er als 3 uit -- met de belofte
      dat het er 200 waren. Bij een COSE-sleutel is dat het verschil tussen een
      sleutel en een stuk van een sleutel.

   WAT ER MET OPZET NIET WORDT BEGRENSD: majortype 0 en 1. Daar is de waarde
   geen byte-aantal maar het GETAL zelf, en een grote unsigned int is volkomen
   geldige CBOR. Wie daar dezelfde grens op zet, weigert echte invoer. */
function cborLees(buf, p, diepte) {
  diepte = diepte || 0;
  if (diepte > MAX_DIEPTE) throw new Error('CBOR: te diep genest (grens ' + MAX_DIEPTE + ')');
  if (!(p >= 0) || p >= buf.length) throw new Error('CBOR: lezen voorbij het einde van de buffer');
  const eerste = buf[p];
  const major = eerste >> 5;
  const ai = eerste & 0x1f;
  p += 1;
  let lengte = ai, extra = 0;
  if (ai === 24) extra = 1;
  else if (ai === 25) extra = 2;
  else if (ai === 26) extra = 4;
  else if (ai === 27) extra = 8;
  else if (ai > 27) throw new Error('CBOR: ongeldige lengte-codering');
  if (p + extra > buf.length) throw new Error('CBOR: het lengteveld loopt voorbij het einde van de buffer');
  if (extra === 1) lengte = buf[p];
  else if (extra === 2) lengte = buf.readUInt16BE(p);
  else if (extra === 4) lengte = buf.readUInt32BE(p);
  else if (extra === 8) lengte = Number(buf.readBigUInt64BE(p));
  p += extra;

  /* De ruimte die er nog IS, als bovengrens voor alles wat een aantal bytes of
     elementen belooft. */
  const rest = buf.length - p;

  switch (major) {
    case 0: return { waarde: lengte, eind: p };                       // unsigned int
    case 1: return { waarde: -1 - lengte, eind: p };                  // negative int
    case 2:                                                            // byte string
      if (lengte > rest) throw new Error('CBOR: bytestring belooft ' + lengte + ' bytes, er zijn er ' + rest);
      return { waarde: buf.subarray(p, p + lengte), eind: p + lengte };
    case 3:                                                            // text
      if (lengte > rest) throw new Error('CBOR: tekststring belooft ' + lengte + ' bytes, er zijn er ' + rest);
      return { waarde: buf.toString('utf8', p, p + lengte), eind: p + lengte };
    case 4: {                                                          // array
      if (lengte > rest) throw new Error('CBOR: array belooft ' + lengte + ' elementen, er passen er hoogstens ' + rest);
      const arr = [];
      for (let i = 0; i < lengte; i++) { const r = cborLees(buf, p, diepte + 1); arr.push(r.waarde); p = r.eind; }
      return { waarde: arr, eind: p };
    }
    case 5: {                                                          // map
      if (lengte > rest / 2) throw new Error('CBOR: map belooft ' + lengte + ' paren, er passen er hoogstens ' + Math.floor(rest / 2));
      const m = new Map();
      for (let i = 0; i < lengte; i++) {
        const k = cborLees(buf, p, diepte + 1); p = k.eind;
        const v = cborLees(buf, p, diepte + 1); p = v.eind;
        m.set(k.waarde, v.waarde);
      }
      return { waarde: m, eind: p };
    }
    case 6: { const r = cborLees(buf, p, diepte + 1); return { waarde: r.waarde, eind: r.eind }; } // tag: inhoud
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
