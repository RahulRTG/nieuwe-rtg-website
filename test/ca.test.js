/* Bewijst onze eigen interne CA (server/lib/ca.js): een root-CA die als CA geldt,
   server- en client-certificaten uitgeeft die via ONS CA-cert vertrouwd worden
   (niet via rejectUnauthorized:false), mTLS-clientauthenticatie, en intrekking via
   een door de CA ondertekende CRL. Alles offline. Draai los:
   node --experimental-sqlite --test test/ca.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ca = require('../server/lib/ca');
const tlsmod = require('../server/lib/tls');

function derKind(buf, index) {
  let off = 2; if (buf[1] & 0x80) off = 2 + (buf[1] & 0x7f);
  let i = off;
  for (let k = 0; ; k++) {
    let len = buf[i + 1]; let hlen = 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let j = 0; j < n; j++) len = len * 256 + buf[i + 2 + j]; hlen = 2 + n; }
    const full = buf.slice(i, i + hlen + len);
    if (k === index) return { full, value: buf.slice(i + hlen, i + hlen + len) };
    i += hlen + len;
  }
}
function luister(s) { return new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port))); }
function sluit(s) { return new Promise(r => { try { if (s.closeAllConnections) s.closeAllConnections(); } catch (e) {} s.close(() => r()); }); }
// HTTPS-GET met een expliciete trust anchor (ons CA-cert), optioneel met een clientcert (mTLS).
function get(poort, caPem, clientCert) {
  const opt = { host: '127.0.0.1', port: poort, path: '/', servername: 'localhost', agent: false };
  if (caPem) opt.ca = caPem; if (clientCert) { opt.cert = clientCert.certPem; opt.key = clientCert.keyPem; }
  return new Promise((resolve, reject) => {
    const req = https.get(opt, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { res.socket.destroy(); resolve({ status: res.statusCode, body: b }); }); res.socket.on('error', () => {}); });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

test('de root-CA is een echte CA, self-signed geldig, en persisteert', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ca-'));
  try {
    const a1 = ca.maakCA({ dataDir: tmp, naam: 'RTG Test CA' });
    assert.equal(a1.vers, true, 'eerste keer: een nieuwe CA gemaakt');
    const c = new crypto.X509Certificate(a1.caCertPem);
    assert.equal(c.ca, true, 'het CA-cert heeft basicConstraints CA:TRUE');
    assert.match(c.subject, /CN=RTG Test CA/, 'de opgegeven CA-naam');
    assert.ok(c.verify(c.publicKey), 'de root is geldig self-signed');
    assert.ok(fs.existsSync(path.join(tmp, 'tls', 'ca', 'ca.key')), 'de CA-sleutel is bewaard');
    const a2 = ca.maakCA({ dataDir: tmp });
    assert.equal(a2.vers, false, 'tweede keer: dezelfde CA hergebruikt');
    assert.equal(a2.caCertPem, a1.caCertPem, 'hetzelfde CA-cert');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('een door de CA uitgegeven servercert wordt vertrouwd via ONS CA-cert (echte keten)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ca2-'));
  const a = ca.maakCA({ dataDir: tmp });
  const leaf = a.geefUitServer({ names: ['localhost', '127.0.0.1'], cn: 'localhost' });
  // keten-verificatie met Node's parser
  const caCert = new crypto.X509Certificate(a.caCertPem), leafCert = new crypto.X509Certificate(leaf.certPem);
  assert.ok(leafCert.verify(caCert.publicKey), 'het leaf-cert is door de CA ondertekend');
  assert.ok(leafCert.checkIssued(caCert), 'het leaf is uitgegeven door de CA (issuer/SKI-AKI kloppen)');
  assert.equal(leafCert.ca, false, 'het leaf-cert is geen CA');

  const server = tlsmod.maakServer((req, res) => res.end('intern'), { cert: leaf.certPem, key: leaf.keyPem });
  const poort = await luister(server);
  try {
    const g = await get(poort, a.bundelPem());               // client vertrouwt ALLEEN onze CA
    assert.equal(g.status, 200); assert.equal(g.body, 'intern', 'met ons CA-cert als anchor is de verbinding vertrouwd');
    await assert.rejects(() => get(poort, null), /self-signed|unable to (verify|get)|SELF_SIGNED|UNABLE/i, 'zonder onze CA weigert de client het cert');
  } finally { await sluit(server); fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('mTLS: de CA authenticeert een clientcertificaat; zonder cert blijft de client anoniem', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ca3-'));
  const a = ca.maakCA({ dataDir: tmp });
  const serverLeaf = a.geefUitServer({ names: ['localhost'], cn: 'localhost' });
  const clientCert = a.geefUitClient({ cn: 'zaakdoos-01' });
  const oud = process.env.RTG_TLS_HTTP2;
  process.env.RTG_TLS_HTTP2 = '0';                            // https-pad: req.socket.authorized is betrouwbaar
  const server = tlsmod.maakServer((req, res) => res.end(req.socket.authorized ? 'auth:' + req.socket.getPeerCertificate().subject.CN : 'anon'),
    { cert: serverLeaf.certPem, key: serverLeaf.keyPem, ca: a.bundelPem(), requestCert: true, rejectUnauthorized: false });
  const poort = await luister(server);
  try {
    const metCert = await get(poort, a.bundelPem(), clientCert);
    assert.equal(metCert.body, 'auth:zaakdoos-01', 'een CA-clientcert wordt herkend en geauthenticeerd');
    const zonder = await get(poort, a.bundelPem());
    assert.equal(zonder.body, 'anon', 'zonder clientcert blijft de verbinding anoniem');
  } finally { await sluit(server); if (oud === undefined) delete process.env.RTG_TLS_HTTP2; else process.env.RTG_TLS_HTTP2 = oud; fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('intrekken: de CRL is door de CA ondertekend en bevat de ingetrokken serial', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ca4-'));
  try {
    const a = ca.maakCA({ dataDir: tmp });
    const leaf = a.geefUitServer({ names: ['svc.intern'] });
    assert.equal(a.ingetrokken().length, 0, 'nog niets ingetrokken');
    a.trekIn(leaf.serial);
    assert.equal(a.ingetrokken().length, 1, 'de serial staat op de intrekkingslijst');
    const crlDer = a.crlDer();
    const tbs = derKind(crlDer, 0).full, sig = derKind(crlDer, 2).value.slice(1);
    const caPub = new crypto.X509Certificate(a.caCertPem).publicKey;
    assert.ok(crypto.verify('sha256', tbs, caPub, sig), 'de CRL is geldig door de CA ondertekend');
    assert.ok(crlDer.includes(Buffer.from(leaf.serial, 'hex')), 'de ingetrokken serial staat in de CRL');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
