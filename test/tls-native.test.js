/* Bewijst dat onze native TLS-laag (server/lib/tls.js) echt HTTPS termineert:
   HTTP/1.1 over TLS serveren, ALPN naar h2 aanbieden, zelf een self-signed cert
   maken en cachen, en het certificaat LIVE omwisselen (setSecureContext) zonder
   herstart -- de haak waar de ACME-vernieuwing op leunt. Volledig offline. Draai:
   node --experimental-sqlite --test test/tls-native.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tlsmod = require('../server/lib/tls');
const x509 = require('../server/lib/x509');

function luister(server) { return new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port))); }
// Forceer het sluiten: een http2-secure-server houdt anders open sessies (en dus
// de event-loop) vast, waardoor node:test niet afsluit.
function sluit(server) { return new Promise(r => { try { if (server.closeAllConnections) server.closeAllConnections(); } catch (e) {} server.close(() => r()); }); }

// HTTPS/1.1 GET (ALPN valt terug op http/1.1); geeft status, body en TLS-versie.
function httpsGet(poort, pad) {
  return new Promise((resolve, reject) => {
    const req = https.get({ host: '127.0.0.1', port: poort, path: pad, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'], servername: 'localhost', agent: false },
      (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { const proto = res.socket.getProtocol(); res.socket.destroy(); resolve({ status: res.statusCode, body: b, proto }); }); res.socket.on('error', () => {}); });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}
// Rauwe TLS-connect: welk ALPN en welke TLS-versie, en de CN van het servercert.
function tlsPeek(poort, alpn) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ port: poort, host: '127.0.0.1', rejectUnauthorized: false, ALPNProtocols: alpn || ['h2', 'http/1.1'], servername: 'localhost' },
      () => { const r = { alpn: s.alpnProtocol, proto: s.getProtocol(), cn: s.getPeerCertificate().subject.CN }; s.destroy(); resolve(r); });
    s.on('error', (e) => { s.destroy(); reject(e); });
    const t = setTimeout(() => { s.destroy(); reject(new Error('timeout')); }, 5000); t.unref();
  });
}

test('native TLS serveert HTTPS met een opgegeven cert, biedt ALPN h2 en spreekt TLS 1.3', async () => {
  const { certPem, keyPem } = x509.selfSigned({ names: ['localhost'], cn: 'localhost' });
  const server = tlsmod.maakServer((req, res) => { res.statusCode = 200; res.end('veilig-' + req.url); }, { cert: certPem, key: keyPem });
  assert.equal(server.tlsBron, 'opgegeven', 'het opgegeven cert wordt gebruikt');
  const poort = await luister(server);
  try {
    const g = await httpsGet(poort, '/api/health');
    assert.equal(g.status, 200, 'HTTPS-GET geeft 200');
    assert.equal(g.body, 'veilig-/api/health', 'de app-response komt over TLS binnen');
    assert.equal(g.proto, 'TLSv1.3', 'de verbinding is TLS 1.3');
    const h2 = await tlsPeek(poort, ['h2', 'http/1.1']);
    assert.equal(h2.alpn, 'h2', 'ALPN biedt h2 (HTTP/2 over TLS) aan');
    assert.equal(h2.cn, 'localhost', 'het geserveerde cert heeft CN=localhost');
  } finally { await sluit(server); }
});

test('native TLS maakt en cachet zelf een self-signed cert in de datamap', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tls-'));
  try {
    const s1 = tlsmod.maakServer((req, res) => res.end('ok'), { dataDir: tmp });
    assert.match(s1.tlsBron, /self-signed \(nieuw\)/, 'eerste keer: vers self-signed cert');
    assert.ok(fs.existsSync(path.join(tmp, 'tls', 'self.crt')), 'het cert is in de datamap opgeslagen');
    const poort = await luister(s1);
    const g = await httpsGet(poort, '/');
    assert.equal(g.body, 'ok', 'het zelfgemaakte cert serveert echt HTTPS');
    await sluit(s1);

    const s2 = tlsmod.maakServer((req, res) => res.end('ok'), { dataDir: tmp });
    assert.match(s2.tlsBron, /self-signed \(cache\)/, 'tweede keer: hergebruikt het gecachete cert (geen nieuwe browserwaarschuwing)');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('native TLS wisselt het certificaat LIVE om zonder herstart (ACME-vernieuwing)', async () => {
  const a = x509.selfSigned({ names: ['localhost'], cn: 'oud.local' });
  const server = tlsmod.maakServer((req, res) => res.end('ok'), { cert: a.certPem, key: a.keyPem });
  const poort = await luister(server);
  try {
    assert.equal((await tlsPeek(poort)).cn, 'oud.local', 'begint met het oude cert');
    const b = x509.selfSigned({ names: ['localhost'], cn: 'nieuw.local' });
    assert.equal(server.herlaadCert(b.certPem, b.keyPem), true, 'herlaadCert slaagt');
    assert.equal((await tlsPeek(poort)).cn, 'nieuw.local', 'een nieuwe verbinding krijgt het verse cert -- live omgewisseld');
  } finally { await sluit(server); }
});
