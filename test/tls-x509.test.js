/* Bewijst dat onze eigen X.509/DER-laag echte, bruikbare bytes maakt: een
   self-signed certificaat dat OpenSSL (via Node's tls) accepteert in een ECHTE
   TLS-handshake, en een CSR die correct over de juiste inhoud is ondertekend.
   Als onze DER-codering ook maar één byte fout had, faalde de handshake of de
   handtekening-verificatie. Volledig offline. Draai los:
   node --experimental-sqlite --test test/tls-x509.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const tls = require('tls');
const x509 = require('../server/lib/x509');

// piepklein DER-loopje: geef het n-de kind van een SEQUENCE terug als {full, value}
function derKind(buf, index) {
  let off = 2; if (buf[1] & 0x80) off = 2 + (buf[1] & 0x7f);
  let i = off;
  for (let k = 0; ; k++) {
    let len = buf[i + 1]; let hlen = 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let j = 0; j < n; j++) len = len * 256 + buf[i + 2 + j]; hlen = 2 + n; }
    const full = buf.slice(i, i + hlen + len), value = buf.slice(i + hlen, i + hlen + len);
    if (k === index) return { tag: buf[i], full, value };
    i += hlen + len;
  }
}

// Één handshake tegen een server met ons cert; ruimt ALLE sockets/timers op zodat
// node:test netjes afsluit (een open TLS-socket houdt de event-loop anders vast).
function handshake(certPem, keyPem, clientOpts) {
  return new Promise((resolve, reject) => {
    const server = tls.createServer({ cert: certPem, key: keyPem, ALPNProtocols: ['h2', 'http/1.1'] },
      (sock) => { sock.on('error', () => {}); sock.end('hoi'); });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const poort = server.address().port;
      const s = tls.connect(Object.assign({ port: poort, host: '127.0.0.1', rejectUnauthorized: false }, clientOpts), () => {
        const r = { alpn: s.alpnProtocol, proto: s.getProtocol(), cn: s.getPeerCertificate().subject.CN };
        s.destroy(); server.close(() => resolve(r));
      });
      s.on('error', (e) => { s.destroy(); server.close(() => reject(e)); });
      const t = setTimeout(() => { s.destroy(); server.close(() => reject(new Error('handshake-timeout'))); }, 5000);
      t.unref();
    });
  });
}

test('self-signed cert doorstaat een echte TLS-handshake (OpenSSL accepteert onze DER) met ALPN en TLS 1.3', async () => {
  const { certPem, keyPem } = x509.selfSigned({ names: ['localhost', '127.0.0.1'], cn: 'localhost' });

  const info = x509.certInfo(certPem);
  assert.match(info.subject, /CN=localhost/, 'subject CN = localhost');
  assert.match(info.san, /DNS:localhost/, 'SAN bevat de hostnaam');
  assert.match(info.san, /IP Address:127\.0\.0\.1/, 'SAN bevat het IP');
  assert.ok(info.validTo > new Date(), 'het cert is nog geldig');

  const uit = await handshake(certPem, keyPem, { ALPNProtocols: ['h2', 'http/1.1'], servername: 'localhost' });
  assert.equal(uit.alpn, 'h2', 'ALPN koos h2 (HTTP/2 over TLS)');
  assert.equal(uit.proto, 'TLSv1.3', 'de verbinding is TLS 1.3');
  assert.equal(uit.cn, 'localhost', 'de client zag ons cert met CN=localhost');
});

test('een RSA self-signed cert werkt net zo goed (brede client-compatibiliteit)', async () => {
  const { certPem, keyPem } = x509.selfSigned({ type: 'rsa', names: ['localhost'] });
  const uit = await handshake(certPem, keyPem, { servername: 'localhost' });
  assert.ok(uit.proto.startsWith('TLSv1.'), 'RSA-handshake gelukt op ' + uit.proto);
});

test('de CSR is correct ondertekend over de CertificationRequestInfo', () => {
  const paar = x509.genKeyPair({ type: 'ec' });
  const { csrDer } = x509.maakCSR({ key: paar, cn: 'rahultravelgroup.example', names: ['rahultravelgroup.example', 'www.rahultravelgroup.example'] });
  const cri = derKind(csrDer, 0).full;               // exact de ondertekende bytes
  const sig = derKind(csrDer, 2).value.slice(1);     // BIT STRING: eerste byte = ongebruikte bits
  assert.ok(crypto.verify('sha256', cri, paar.publicKey, sig), 'de handtekening klopt over de CRI met de publieke sleutel');
});
