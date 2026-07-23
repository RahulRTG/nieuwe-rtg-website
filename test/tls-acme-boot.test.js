/* Bewijst de boot-lijm (server/lib/tls-acme.js): de ACME-accountsleutel en het
   opgehaalde certificaat persisteren, en -- het echte werk -- dat startAcme een
   vers uitgegeven certificaat LIVE in een draaiende native TLS-server laadt. De
   nep-CA valideert de HTTP-01-challenge via dezelfde winkel die de boot-lijm
   intern maakt, precies zoals Let's Encrypt de .well-known-URL zou ophalen.
   Volledig offline. Draai los:
   node --experimental-sqlite --test test/tls-acme-boot.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const tls = require('tls');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jws = require('../server/lib/jws');
const x509 = require('../server/lib/x509');
const tlsmod = require('../server/lib/tls');
const tlsAcme = require('../server/lib/tls-acme');

// piepklein DER-loopje: het n-de kind van een SEQUENCE
function derKind(buf, index) {
  let off = 2; if (buf[1] & 0x80) off = 2 + (buf[1] & 0x7f);
  let i = off;
  for (let k = 0; ; k++) {
    let len = buf[i + 1]; let hlen = 2;
    if (len & 0x80) { const nn = len & 0x7f; len = 0; for (let j = 0; j < nn; j++) len = len * 256 + buf[i + 2 + j]; hlen = 2 + nn; }
    const full = buf.slice(i, i + hlen + len);
    if (k === index) return { full, value: buf.slice(i + hlen, i + hlen + len) };
    i += hlen + len;
  }
}
// Trouwe nep-CA: geeft -- net als de echte -- een cert uit VOOR de publieke
// sleutel uit de CSR, zodat het uitgegeven cert bij de sleutel van de client past
// en de TLS-server het echt kan serveren.
function nepCA(winkel) {
  const B = 'https://acme.test';
  const u = { dir: B + '/dir', nonce: B + '/nonce', newAccount: B + '/acct', newOrder: B + '/neworder', account: B + '/acct/1', order: B + '/order/1', authz: B + '/authz/1', chall: B + '/chall/1', finalize: B + '/finalize/1', cert: B + '/cert/1' };
  const caKey = x509.genKeyPair({ type: 'ec' });          // de sleutel van de nep-CA
  let acctJwk = null, authGeldig = false, uitgegeven = null, n = 0;
  const resp = (status, headers, body) => { const tekst = typeof body === 'string' ? body : (body == null ? '' : JSON.stringify(body)); return Promise.resolve({ status, headers: Object.assign({ 'replay-nonce': 'n' + (++n) }, headers), tekst, json: () => JSON.parse(tekst) }); };
  return function vraag(o) {
    if (o.method === 'GET') return resp(200, {}, { newNonce: u.nonce, newAccount: u.newAccount, newOrder: u.newOrder });
    if (o.method === 'HEAD') return resp(200, {}, '');
    const j = JSON.parse(o.body); const beschermd = JSON.parse(Buffer.from(j.protected, 'base64url').toString());
    const payload = j.payload ? JSON.parse(Buffer.from(j.payload, 'base64url').toString()) : '';
    const pub = crypto.createPublicKey({ key: beschermd.jwk || acctJwk, format: 'jwk' });
    assert.ok(crypto.verify('sha256', Buffer.from(j.protected + '.' + j.payload), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(j.signature, 'base64url')), 'JWS verifieert');
    if (o.url === u.newAccount) { acctJwk = beschermd.jwk; return resp(201, { location: u.account }, { status: 'valid' }); }
    if (o.url === u.newOrder) return resp(201, { location: u.order }, { status: 'pending', authorizations: [u.authz], finalize: u.finalize });
    if (o.url === u.authz) return resp(200, {}, { status: authGeldig ? 'valid' : 'pending', identifier: { value: 'example.test' }, challenges: [{ type: 'http-01', token: 'tok-1', url: u.chall, status: authGeldig ? 'valid' : 'pending' }] });
    if (o.url === u.chall) { if (winkel.haal('tok-1') === 'tok-1.' + jws.thumbprint(acctJwk)) authGeldig = true; return resp(200, {}, { status: 'valid' }); }
    if (o.url === u.finalize) {                            // geef een cert uit voor de SPKI uit de CSR
      const csrDer = Buffer.from(payload.csr, 'base64url');
      const spki = derKind(derKind(csrDer, 0).full, 2).full;   // CSR -> CRI (kind 0) -> SPKI (kind 2)
      uitgegeven = x509.certVoor({ subjectSpkiDer: spki, subjectType: 'ec', cn: 'example.test', names: ['example.test'], issuerKey: caKey, issuerCn: 'Nep CA' }).certPem;
      return resp(200, {}, { status: 'valid', certificate: u.cert });
    }
    if (o.url === u.order) return resp(200, {}, { status: uitgegeven ? 'valid' : 'processing', certificate: uitgegeven ? u.cert : undefined, finalize: u.finalize, authorizations: [u.authz] });
    if (o.url === u.cert) return resp(200, {}, uitgegeven);
    return resp(404, {}, { type: 'malformed' });
  };
}
function luister(s) { return new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port))); }
function sluit(s) { return new Promise(r => { try { if (s.closeAllConnections) s.closeAllConnections(); } catch (e) {} s.close(() => r()); }); }
function tlsPeek(poort) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ port: poort, host: '127.0.0.1', rejectUnauthorized: false, servername: 'example.test' }, () => { const cn = s.getPeerCertificate().subject.CN; s.destroy(); resolve(cn); });
    s.on('error', (e) => { s.destroy(); reject(e); }); const t = setTimeout(() => { s.destroy(); reject(new Error('timeout')); }, 5000); t.unref();
  });
}

test('de ACME-accountsleutel en het certificaat persisteren in de datamap', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-acmeboot-'));
  try {
    const k1 = tlsAcme.laadAccountSleutel(tmp), k2 = tlsAcme.laadAccountSleutel(tmp);
    assert.equal(k1, k2, 'dezelfde accountsleutel over herstarts heen');
    assert.ok(k1.includes('PRIVATE KEY'), 'het is een private sleutel');
    const ss = x509.selfSigned({ names: ['x.test'] });
    tlsAcme.bewaarCert(tmp, ss.certPem, ss.keyPem);
    const terug = tlsAcme.laadCert(tmp);
    assert.equal(terug.cert, ss.certPem, 'het certificaat komt onveranderd terug van schijf');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('startAcme haalt een certificaat en laadt het LIVE in de draaiende TLS-server', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-acmeboot2-'));
  const begin = x509.selfSigned({ names: ['example.test'], cn: 'self-signed-start' });
  const server = tlsmod.maakServer((req, res) => res.end('ok'), { cert: begin.certPem, key: begin.keyPem });
  const poort = await luister(server);
  let handle = null;
  try {
    assert.equal(await tlsPeek(poort), 'self-signed-start', 'de server begint op het self-signed cert');
    handle = await tlsAcme.startAcme({ server, domains: ['example.test'], email: 'roellie.i@gmail.com', dataDir: tmp, http01Poort: 0, maakVraag: (winkel) => nepCA(winkel) });
    assert.equal(handle.status, 'nieuw', 'er is een nieuw certificaat opgehaald');
    assert.equal(await tlsPeek(poort), 'example.test', 'de server serveert nu LIVE het door ACME uitgegeven certificaat');
    assert.ok(fs.existsSync(path.join(tmp, 'tls', 'live', 'fullchain.pem')), 'het certificaat is op schijf bewaard voor een warme herstart');
  } finally {
    if (handle) handle.stop();
    await sluit(server);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
