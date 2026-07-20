/* Eigen web-push: VAPID (RFC 8292) + payload-versleuteling (RFC 8291, aes128gcm)
   op de INGEBOUWDE crypto van Node. Dit verving het pakket `web-push`.

   Belangrijk voor regel 1 van de lijn ("rol nooit je eigen encryptie"): we
   schrijven hier GEEN eigen cryptografie. We zetten alleen de bekende protocol-
   stappen op elkaar met Node's standaard-primitieven -- ECDH (P-256), HKDF-
   SHA256, AES-128-GCM en ECDSA (ES256). Dat is protocol-assemblage, geen eigen
   crypto. De sleutels, de HKDF en de GCM komen allemaal uit `node:crypto`.

   Publieke API (gelijk aan het oude pakket, zodat de rest niets merkt):
     generateVAPIDKeys()                      -> { publicKey, privateKey }  (base64url)
     setVapidDetails(subject, pub, priv)      -> onthoudt de VAPID-identiteit
     sendNotification(subscription, payload)  -> Promise; verwerpt met .statusCode

   Extra (voor tests en inzicht): encrypt(), decrypt(), vapidHeaders(). */
'use strict';
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const vanB64 = (s) => Buffer.from(String(s), 'base64url');
// getallen kunnen een voorloop-nul verliezen; op de curve-lengte terugbrengen
const padLinks = (buf, n) => buf.length >= n ? buf.subarray(buf.length - n) : Buffer.concat([Buffer.alloc(n - buf.length), buf]);

let vapid = null; // { subject, publicKey, privateKey }

/* ---------- VAPID-sleutelpaar (P-256), als base64url ---------- */
function generateVAPIDKeys() {
  const ec = crypto.createECDH('prime256v1');
  ec.generateKeys();
  return { publicKey: b64(ec.getPublicKey()), privateKey: b64(padLinks(ec.getPrivateKey(), 32)) };
}

function setVapidDetails(subject, publicKey, privateKey) {
  if (!subject || !/^(mailto:|https?:)/.test(subject)) throw new Error('VAPID-subject moet een mailto: of https:-URL zijn.');
  vapid = { subject, publicKey, privateKey };
}

// EC-sleutel-objecten uit ruwe bytes (via JWK). We rekenen het ECDH-geheim met
// crypto.diffieHellman op sleutel-objecten: de oudere ECDH.computeSecret weigert
// onder OpenSSL 3 geldige tegenpartij-sleutels (ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY).
function privObject(rawPriv, rawPub) {
  return crypto.createPrivateKey({ format: 'jwk', key: {
    kty: 'EC', crv: 'P-256',
    d: b64(padLinks(rawPriv, 32)),
    x: b64(rawPub.subarray(1, 33)), y: b64(rawPub.subarray(33, 65))
  } });
}
function pubObject(rawPub) {
  return crypto.createPublicKey({ format: 'jwk', key: {
    kty: 'EC', crv: 'P-256', x: b64(rawPub.subarray(1, 33)), y: b64(rawPub.subarray(33, 65))
  } });
}
// De publieke sleutel (65 bytes) horend bij een ruwe privesleutel afleiden.
function pubVanPriv(rawPriv) { const e = crypto.createECDH('prime256v1'); e.setPrivateKey(rawPriv); return e.getPublicKey(); }
// Gedeeld ECDH-geheim (X-coordinaat, 32 bytes) tussen onze sleutel en de tegenpartij.
function ecdhGeheim(rawPriv, zelfPub, tegenPub) {
  return padLinks(crypto.diffieHellman({ privateKey: privObject(rawPriv, zelfPub), publicKey: pubObject(tegenPub) }), 32);
}

/* ---------- VAPID-JWT (RFC 8292, ES256) ---------- */
function vapidHeaders(audience, det) {
  det = det || vapid;
  if (!det) throw new Error('Geen VAPID-gegevens ingesteld (setVapidDetails).');
  const kop = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const nu = Math.floor(Date.now() / 1000);
  const claim = b64(JSON.stringify({ aud: audience, exp: nu + 12 * 3600, sub: det.subject }));
  const invoer = kop + '.' + claim;
  const rawPub = vanB64(det.publicKey);
  const sig = crypto.sign('sha256', Buffer.from(invoer), { key: privObject(vanB64(det.privateKey), rawPub), dsaEncoding: 'ieee-p1363' });
  const jwt = invoer + '.' + b64(sig);
  return { Authorization: 'vapid t=' + jwt + ', k=' + det.publicKey };
}

/* ---------- payload-versleuteling (RFC 8291, content-encoding aes128gcm) ----------
   Alle HKDF-stappen via crypto.hkdfSync (Extract + Expand ineen). De optionele
   `vast` laat een test de anders-willekeurige afzendersleutel en salt vastzetten,
   zodat we tegen het RFC 8291-testvector kunnen ijken. */
function hkdf(ikm, salt, info, len) { return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len)); }

function encrypt(payload, sub, vast) {
  const uaPub = vanB64(sub.keys.p256dh);      // ontvanger (browser), 65 bytes
  const auth = vanB64(sub.keys.auth);          // 16 bytes gedeeld geheim
  const plat = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));

  const ec = crypto.createECDH('prime256v1');
  let asPriv, asPub;
  if (vast && vast.asPrivate) { asPriv = vast.asPrivate; asPub = vast.asPublic || pubVanPriv(asPriv); }
  else { asPub = ec.generateKeys(); asPriv = ec.getPrivateKey(); }
  const salt = vast && vast.salt ? vast.salt : crypto.randomBytes(16);

  const deeld = ecdhGeheim(asPriv, asPub, uaPub);                // ECDH-geheim (X)
  // RFC 8291: IKM = HKDF(auth ; ecdh ; "WebPush: info"\0 ua_pub as_pub ; 32)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]);
  const ikm = hkdf(deeld, auth, keyInfo, 32);
  // RFC 8188: CEK en NONCE uit IKM met de record-salt
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  // een enkel record: platte tekst + scheidingsbyte 0x02 (laatste record)
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([c.update(Buffer.concat([plat, Buffer.from([0x02])])), c.final(), c.getAuthTag()]);

  const rs = 4096;
  const kop = Buffer.alloc(21);
  salt.copy(kop, 0);
  kop.writeUInt32BE(rs, 16);
  kop.writeUInt8(asPub.length, 20);
  return Buffer.concat([kop, asPub, enc]); // header || keyid(as_pub) || ciphertext
}

// Tegenhanger (voor tests/inzicht): een aes128gcm-record ontsleutelen.
function decrypt(body, uaPrivate, auth) {
  const salt = body.subarray(0, 16);
  const idlen = body.readUInt8(20);
  const asPub = body.subarray(21, 21 + idlen);
  const cipher = body.subarray(21 + idlen);

  const uaPub = pubVanPriv(uaPrivate);
  const deeld = ecdhGeheim(uaPrivate, uaPub, asPub);
  const ikm = hkdf(deeld, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  const tag = cipher.subarray(cipher.length - 16);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(tag);
  let plat = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  // de scheidingsbyte (0x02 op het laatste record) en eventuele opvulling weg
  let i = plat.length - 1;
  while (i >= 0 && plat[i] === 0x00) i--;
  return plat.subarray(0, i); // i wijst nu op de 0x02
}

/* ---------- versturen ---------- */
function sendNotification(subscription, payload, opties) {
  opties = opties || {};
  return new Promise((resolve, reject) => {
    let doel;
    try { doel = new URL(subscription.endpoint); } catch (e) { reject(new Error('Ongeldige push-endpoint.')); return; }
    const headers = Object.assign({ TTL: String(opties.TTL != null ? opties.TTL : 2419200) }, vapidHeaders(doel.origin, opties.vapid));
    if (opties.urgency) headers.Urgency = opties.urgency;
    if (opties.topic) headers.Topic = opties.topic;

    let body = Buffer.alloc(0);
    if (payload != null) {
      if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth)
        { reject(new Error('Push-subscription mist de sleutels (p256dh/auth).')); return; }
      body = encrypt(payload, subscription);
      headers['Content-Encoding'] = 'aes128gcm';
      headers['Content-Type'] = 'application/octet-stream';
    }
    headers['Content-Length'] = body.length;

    const mod = doel.protocol === 'http:' ? http : https;
    const req = mod.request({ method: 'POST', hostname: doel.hostname, port: doel.port || undefined, path: doel.pathname + doel.search, headers }, (res) => {
      const brokken = [];
      res.on('data', (c) => brokken.push(c));
      res.on('end', () => {
        const tekst = Buffer.concat(brokken).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) { resolve({ statusCode: res.statusCode, headers: res.headers, body: tekst }); return; }
        const fout = new Error('Push mislukte, status ' + res.statusCode + ': ' + tekst.slice(0, 200));
        fout.statusCode = res.statusCode; fout.headers = res.headers; fout.body = tekst;
        reject(fout);
      });
    });
    req.on('error', reject);
    if (body.length) req.write(body);
    req.end();
  });
}

module.exports = { generateVAPIDKeys, setVapidDetails, sendNotification, encrypt, decrypt, vapidHeaders };
