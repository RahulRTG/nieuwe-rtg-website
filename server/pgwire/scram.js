/* pgwire, deel "scram": de SCRAM-SHA-256(-PLUS)-handshake (RFC 5802/7677) als pure
   stappen, los van de socket. Regel 1 (docs/de-lijn.md): GEEN eigen crypto --
   uitsluitend node:crypto (pbkdf2, hmac, sha256). De client (./client) schrijft
   de teruggegeven buffers naar de verbinding en bewaart de tussenstand; hier zit
   alleen de wiskunde, zodat ze los te toetsen is.

   Channel binding (SCRAM-SHA-256-PLUS, tls-server-end-point, RFC 5929): als de
   verbinding TLS is en de server PLUS aanbiedt, binden we de handshake aan het
   servercertificaat. Dat sluit een man-in-the-middle uit die wel het TLS termineert
   maar het echte certificaat niet heeft. Bij een gewone (niet-TLS) verbinding of een
   server zonder PLUS valt alles terug op gewoon SCRAM-SHA-256 -- identiek als voorheen. */
'use strict';
const crypto = require('crypto');
const { cstr, int32 } = require('./protocol');

// Stap 1: client-first. Kies een nonce en bouw het SASLInitialResponse-bericht.
// cb (optioneel) = { header, data } uit kanaalBinding(): dan SCRAM-SHA-256-PLUS.
function start(cb) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const clientFirstBare = 'n=,r=' + nonce;
  const gs2 = cb ? cb.header : 'n,,';                       // gs2-cbind-flag + authzid
  const mech = cb ? 'SCRAM-SHA-256-PLUS' : 'SCRAM-SHA-256';
  const ir = Buffer.from(gs2 + clientFirstBare, 'utf8');
  const body = Buffer.concat([cstr(mech), int32(ir.length), ir]);
  return { nonce, clientFirstBare, gs2, cbindData: cb ? cb.data : null, mech, body };
}

// Stap 2: op server-first. Leid de sleutels af en bouw client-final met proof.
// Gooit als de server-nonce niet met onze nonce begint (RFC-eis). De c= (channel
// binding) is base64(gs2-header + cbind-data); zonder binding is dat base64('n,,')='biws'.
function vervolg({ password, nonce, clientFirstBare, serverFirst, gs2, cbindData }) {
  const kv = {}; serverFirst.split(',').forEach(x => { const i = x.indexOf('='); kv[x.slice(0, i)] = x.slice(i + 1); });
  const r = kv.r, salt = Buffer.from(kv.s, 'base64'), iter = parseInt(kv.i, 10);
  if (!r || !r.startsWith(nonce)) throw new Error('pg: SCRAM-nonce klopt niet');
  const saltedPassword = crypto.pbkdf2Sync(String(password || ''), salt, iter, 32, 'sha256');
  const hmac = (key, str) => crypto.createHmac('sha256', key).update(str).digest();
  const clientKey = hmac(saltedPassword, 'Client Key');
  const storedKey = crypto.createHash('sha256').update(clientKey).digest();
  const cbind = Buffer.concat([Buffer.from(gs2 || 'n,,', 'utf8'), cbindData || Buffer.alloc(0)]);
  const clientFinalZonderProof = 'c=' + cbind.toString('base64') + ',r=' + r;
  const authMessage = clientFirstBare + ',' + serverFirst + ',' + clientFinalZonderProof;
  const clientSignature = hmac(storedKey, authMessage);
  const proof = Buffer.alloc(clientKey.length);
  for (let i = 0; i < clientKey.length; i++) proof[i] = clientKey[i] ^ clientSignature[i];
  const serverKey = hmac(saltedPassword, 'Server Key');
  const serverSignature = hmac(serverKey, authMessage).toString('base64');
  const clientFinal = Buffer.from(clientFinalZonderProof + ',p=' + proof.toString('base64'), 'utf8');
  return { clientFinal, serverSignature };
}

// Stap 3: op server-final. Controleer dat de server onze verwachte handtekening
// terugstuurt (bewijst dat de server het wachtwoord ook kent). Gooit bij mismatch.
function eindeControle(data, serverSignature) {
  const kv = {}; data.toString('utf8').split(',').forEach(x => { const i = x.indexOf('='); kv[x.slice(0, i)] = x.slice(i + 1); });
  if (kv.v !== serverSignature) throw new Error('pg: SCRAM-serverhandtekening klopt niet');
}

/* ---------- tls-server-end-point channel binding (RFC 5929) ----------
   De binding-data is de hash van het DER-servercertificaat, met de hash uit het
   handtekening-algoritme van het certificaat -- behalve MD5/SHA-1, die naar SHA-256
   gaan (RFC 5929 §4.1, zoals PostgreSQL/OpenSSL doen). Onbekend -> SHA-256. */
const OID_HASH = {
  '1.2.840.113549.1.1.4': 'sha256',   // md5WithRSA   -> sha256 (opgewaardeerd)
  '1.2.840.113549.1.1.5': 'sha256',   // sha1WithRSA  -> sha256 (opgewaardeerd)
  '1.2.840.113549.1.1.11': 'sha256',  // sha256WithRSA
  '1.2.840.113549.1.1.12': 'sha384',  // sha384WithRSA
  '1.2.840.113549.1.1.13': 'sha512',  // sha512WithRSA
  '1.2.840.10045.4.3.2': 'sha256',    // ecdsa-with-SHA256
  '1.2.840.10045.4.3.3': 'sha384',    // ecdsa-with-SHA384
  '1.2.840.10045.4.3.4': 'sha512',    // ecdsa-with-SHA512
  '1.3.101.112': 'sha512'             // Ed25519
};
// Minimale DER-lezer: tag + lengte (kort/lang) -> {tag, inhoud, eind}. Geen crypto.
function leesTLV(buf, o) {
  const tag = buf[o]; let i = o + 1; let len = buf[i++];
  if (len & 0x80) { let n = len & 0x7f; len = 0; while (n-- > 0) len = (len << 8) | buf[i++]; }
  return { tag, inhoud: i, eind: i + len };
}
function oidNaarString(b) {
  const uit = [Math.floor(b[0] / 40), b[0] % 40]; let val = 0;
  for (let i = 1; i < b.length; i++) { val = (val << 7) | (b[i] & 0x7f); if (!(b[i] & 0x80)) { uit.push(val); val = 0; } }
  return uit.join('.');
}
// Certificaat = SEQ { tbsCertificate SEQ, signatureAlgorithm SEQ { OID, ... }, ... }.
function certHashAlgo(der) {
  try {
    const cert = leesTLV(der, 0);            // buitenste SEQUENCE
    const tbs = leesTLV(der, cert.inhoud);   // 1e kind: tbsCertificate -> overslaan
    const alg = leesTLV(der, tbs.eind);      // 2e kind: signatureAlgorithm SEQUENCE
    const oid = leesTLV(der, alg.inhoud);    // 1e kind daarvan: de OID
    return OID_HASH[oidNaarString(der.subarray(oid.inhoud, oid.eind))] || 'sha256';
  } catch (e) { return 'sha256'; }
}
// Bouw de channel-binding uit een DER-certificaat (Buffer). null als er geen is.
function kanaalBinding(der) {
  if (!der || !der.length) return null;
  const data = crypto.createHash(certHashAlgo(der)).update(der).digest();
  return { header: 'p=tls-server-end-point,,', data };
}

module.exports = { start, vervolg, eindeControle, kanaalBinding, _certHashAlgo: certHashAlgo };
