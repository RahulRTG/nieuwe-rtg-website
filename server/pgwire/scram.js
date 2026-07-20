/* pgwire, deel "scram": de SCRAM-SHA-256-handshake (RFC 5802/7677) als pure
   stappen, los van de socket. Regel 1 (docs/de-lijn.md): GEEN eigen crypto --
   uitsluitend node:crypto (pbkdf2, hmac, sha256). De client (./client) schrijft
   de teruggegeven buffers naar de verbinding en bewaart de tussenstand; hier zit
   alleen de wiskunde, zodat ze los te toetsen is. */
'use strict';
const crypto = require('crypto');
const { cstr, int32 } = require('./protocol');

// Stap 1: client-first. Kies een nonce en bouw het SASLInitialResponse-bericht.
function start() {
  const nonce = crypto.randomBytes(18).toString('base64');
  const clientFirstBare = 'n=,r=' + nonce;
  const ir = Buffer.from('n,,' + clientFirstBare, 'utf8');
  const body = Buffer.concat([cstr('SCRAM-SHA-256'), int32(ir.length), ir]);
  return { nonce, clientFirstBare, body };
}

// Stap 2: op server-first. Leid de sleutels af en bouw client-final met proof.
// Gooit als de server-nonce niet met onze nonce begint (RFC-eis).
function vervolg({ password, nonce, clientFirstBare, serverFirst }) {
  const kv = {}; serverFirst.split(',').forEach(x => { const i = x.indexOf('='); kv[x.slice(0, i)] = x.slice(i + 1); });
  const r = kv.r, salt = Buffer.from(kv.s, 'base64'), iter = parseInt(kv.i, 10);
  if (!r || !r.startsWith(nonce)) throw new Error('pg: SCRAM-nonce klopt niet');
  const saltedPassword = crypto.pbkdf2Sync(String(password || ''), salt, iter, 32, 'sha256');
  const hmac = (key, str) => crypto.createHmac('sha256', key).update(str).digest();
  const clientKey = hmac(saltedPassword, 'Client Key');
  const storedKey = crypto.createHash('sha256').update(clientKey).digest();
  const clientFinalZonderProof = 'c=biws,r=' + r;
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

module.exports = { start, vervolg, eindeControle };
