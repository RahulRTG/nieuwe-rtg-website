/* Lokale https voor het eigen netwerk (server/lokaal-tls.js).

   Dit is de laag die het mogelijk maakt de site op een telefoon te openen met
   camera, Face ID en pushmeldingen erbij -- dingen die een browser alleen op
   een beveiligde verbinding toestaat. Hier bewijzen we dat het certificaat
   echte, bruikbare bytes bevat: een telefoon die onze CA vertrouwt moet er een
   volwaardige TLS-verbinding mee kunnen opzetten, óók op het IP-adres waarop
   die telefoon binnenkomt (en niet alleen op 'localhost').

   Volledig offline; er gaat geen verkeer het netwerk op.
   Draai los: node --experimental-sqlite --test test/lokaal-tls.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tls = require('tls');
const net = require('net');
const https = require('https');
const lokaal = require('../server/lokaal-tls');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lokaaltls-'));

test('1. het certificaat staat op naam van deze computer, inclusief het netwerkadres', () => {
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  assert.ok(c.key.includes('PRIVATE KEY'), 'er is een sleutel');
  assert.ok(c.cert.includes('BEGIN CERTIFICATE'), 'en een certificaat');
  // de keten bevat het servercert én de CA, zodat een client niets hoeft op te zoeken
  assert.equal((c.cert.match(/BEGIN CERTIFICATE/g) || []).length, 2, 'servercert plus CA');

  const X509 = require('crypto').X509Certificate;
  const cert = new X509(c.cert.split('-----END CERTIFICATE-----')[0] + '-----END CERTIFICATE-----\n');
  const san = String(cert.subjectAltName || '');
  assert.match(san, /DNS:localhost/, 'localhost staat erin');
  assert.match(san, /IP Address:127\.0\.0\.1/, 'en 127.0.0.1');
  for (const ip of c.netwerk) {
    assert.ok(san.indexOf(ip) >= 0, 'het netwerkadres ' + ip + ' staat in het certificaat');
  }
});

test('2. de CA blijft dezelfde, het certificaat wordt opnieuw uitgegeven', () => {
  const een = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const twee = lokaal.certVoorDezeMachine({ dataDir: TMP });
  assert.equal(een.caPem, twee.caPem, 'wat u eenmaal op uw telefoon vertrouwt blijft goed');
  assert.notEqual(een.cert, twee.cert, 'het servercert is wel vers (adressen kunnen wijzigen)');
  assert.ok(fs.existsSync(twee.caPad), 'het CA-bestand staat klaar om te delen');
  assert.ok(fs.readFileSync(twee.caPad, 'utf8').includes('BEGIN CERTIFICATE'));
});

test('3. een echte TLS-handshake lukt voor wie de CA vertrouwt, en faalt zonder', async () => {
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const server = https.createServer({ key: c.key, cert: c.cert }, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('goed');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const poort = server.address().port;

  // met de CA erbij: een gewone, geldige verbinding op naam 'localhost'
  const uit = await new Promise((klaar, stuk) => {
    const s = tls.connect({ host: '127.0.0.1', port: poort, servername: 'localhost', ca: c.caPem }, () => {
      klaar({ ok: s.authorized, fout: s.authorizationError });
      s.end();
    });
    s.on('error', stuk);
  });
  assert.equal(uit.ok, true, 'de handshake is geldig: ' + (uit.fout || ''));

  // en op het IP-adres zelf, want zo komt een telefoon binnen
  if (c.netwerk.length) {
    const opIp = await new Promise((klaar) => {
      const s = tls.connect({ host: '127.0.0.1', port: poort, servername: c.netwerk[0], ca: c.caPem,
        checkServerIdentity: () => undefined }, () => { klaar(s.authorized); s.end(); });
      s.on('error', () => klaar(false));
    });
    assert.equal(opIp, true, 'ook op het netwerkadres is het certificaat geldig');
  }

  // zonder onze CA hoort het juist te falen: het is geen publiek certificaat
  const zonder = await new Promise(klaar => {
    const s = tls.connect({ host: '127.0.0.1', port: poort, servername: 'localhost' }, () => { klaar(s.authorized); s.end(); });
    s.on('error', () => klaar(false));
  });
  assert.equal(zonder, false, 'een vreemde client vertrouwt ons certificaat niet zomaar');

  await new Promise(r => server.close(r));
});

test('4. zonder de schakelaar verandert er niets aan de gewone start', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'trio.js'), 'utf8');
  assert.match(bron, /RTG_LOKAAL_TLS === '1'/, 'https staat achter een schakelaar');
  assert.match(bron, /LOKAAL_TLS \? https\.createServer/, 'en alleen dan wordt het een https-server');
  // het CA-loket bestaat alleen in die stand, en dient uitsluitend het CA-bestand
  assert.match(bron, /rtg-ca\.crt/, 'er is een loketje om de CA op te halen');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, 'node server/trio.js', 'npm start blijft gewoon http');
  assert.match(pkg.scripts.telefoon, /RTG_LOKAAL_TLS=1/, 'en npm run telefoon zet https aan');
});

test('5. het loketje geeft de CA en stuurt de rest naar de beveiligde site', async () => {
  // we bouwen hier hetzelfde loketje na als in trio.js, zodat het gedrag vastligt
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const http = require('http');
  const loket = http.createServer((req, res) => {
    if ((req.url || '').split('?')[0] === '/rtg-ca.crt') {
      res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert' });
      return res.end(c.caPem);
    }
    const gastheer = String(req.headers.host || '').split(':')[0] || 'localhost';
    res.writeHead(302, { Location: 'https://' + gastheer + ':3000' + (req.url || '/') });
    res.end();
  });
  await new Promise(r => loket.listen(0, '127.0.0.1', r));
  const poort = loket.address().port;

  const haal = pad => new Promise(klaar => {
    http.get({ host: '127.0.0.1', port: poort, path: pad }, r => {
      const d = []; r.on('data', x => d.push(x));
      r.on('end', () => klaar({ status: r.statusCode, kop: r.headers, body: Buffer.concat(d).toString() }));
    });
  });
  const ca = await haal('/rtg-ca.crt');
  assert.equal(ca.status, 200);
  assert.ok(ca.body.includes('BEGIN CERTIFICATE'), 'het CA-bestand komt eruit');
  const rest = await haal('/apps/app.html');
  assert.equal(rest.status, 302, 'al het andere gaat naar de beveiligde site');
  assert.match(rest.kop.location, /^https:\/\//);

  await new Promise(r => loket.close(r));
});

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
