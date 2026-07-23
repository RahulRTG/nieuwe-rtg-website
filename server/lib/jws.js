/* JOSE/JWS in huis: precies wat de ACME-client (RFC 8555) nodig heeft om zich bij
   Let's Encrypt te legitimeren. Een ACME-account is een sleutelpaar; elk verzoek
   is een JWS die met de accountsleutel is ondertekend. Dit is JSON + base64url +
   één handtekening via Node's crypto -- geen eigen cryptografie.

   ES256 (ECDSA P-256) is de standaard: klein en door Let's Encrypt geaccepteerd.
   Let op de valkuil: JOSE eist de RAW (IEEE P1363) r||s-vorm van de ECDSA-
   handtekening, NIET de DER-vorm die crypto.sign standaard geeft -- vandaar
   dsaEncoding: 'ieee-p1363'. */
'use strict';
const crypto = require('crypto');

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlJSON(obj) { return b64url(Buffer.from(JSON.stringify(obj))); }

// De publieke JWK van een sleutel (voor het 'jwk'-veld bij newAccount) plus het
// alg dat erbij hoort. Alleen de publieke leden.
function jwkVan(key) {
  const pub = crypto.createPublicKey(key);
  const jwk = pub.export({ format: 'jwk' });
  if (jwk.kty === 'EC') return { alg: 'ES256', jwk: { crv: jwk.crv, kty: 'EC', x: jwk.x, y: jwk.y } };
  if (jwk.kty === 'RSA') return { alg: 'RS256', jwk: { e: jwk.e, kty: 'RSA', n: jwk.n } };
  throw new Error('onbekend sleuteltype voor JWS: ' + jwk.kty);
}

// JWK-thumbprint (RFC 7638): canonieke JSON met de verplichte leden in
// lexicografische volgorde, SHA-256, base64url. De keyAuthorization van een
// challenge is token + '.' + thumbprint.
function thumbprint(jwk) {
  const canon = jwk.kty === 'EC'
    ? { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
    : { e: jwk.e, kty: jwk.kty, n: jwk.n };
  return b64url(crypto.createHash('sha256').update(JSON.stringify(canon)).digest());
}

// Een geflatteerde JWS (ACME-vorm): { protected, payload, signature }, alle drie
// base64url. Lege payload ('') is de "POST-as-GET" van ACME.
function tekenJWS(beschermd, payload, key) {
  const beschermdB64 = b64urlJSON(beschermd);
  const payloadB64 = payload === '' || payload == null ? '' : b64urlJSON(payload);
  const invoer = Buffer.from(beschermdB64 + '.' + payloadB64);
  const alg = beschermd.alg;
  const sig = alg === 'ES256'
    ? crypto.sign('sha256', invoer, { key, dsaEncoding: 'ieee-p1363' })   // RAW r||s, niet DER
    : crypto.sign('sha256', invoer, key);
  return { protected: beschermdB64, payload: payloadB64, signature: b64url(sig) };
}

module.exports = { b64url, b64urlJSON, jwkVan, thumbprint, tekenJWS };
