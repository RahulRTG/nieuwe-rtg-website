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
  assert.equal(pkg.scripts.start, 'node scripts/start.js', 'npm start gebruikt de lokale, veilige env-loader');
  const lokaleStart = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'start.js'), 'utf8');
  assert.match(lokaleStart, /require\('\.\.\/server\/trio'\)/,
    'de env-loader geeft daarna door aan dezelfde gewone http-start');
  assert.match(pkg.scripts.telefoon, /RTG_LOKAAL_TLS=1/, 'en npm run telefoon zet https aan');
});

test('5. het loketje geeft de CA en stuurt de rest naar de beveiligde site', async () => {
  // we bouwen hier hetzelfde loketje na als in trio.js, zodat het gedrag vastligt
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const http = require('http');
  const loket = http.createServer((req, res) => {
    if (lokaal.loketAntwoord(req, res, c, 3000)) return;
    const gastheer = String(req.headers.host || '').split(':')[0] || 'localhost';
    if ((req.url || '/').split('?')[0] === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(lokaal.loketPagina(3000, gastheer));
    }
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
  const voor = await haal('/');
  assert.equal(voor.status, 200, 'de voorpagina zegt of u binnen bent');
  assert.match(voor.body, /bereikbaar/, 'en zegt dat in gewone taal');
  assert.match(voor.body, /rtg-ca\.crt/, 'met de knop om het certificaat te halen');
  assert.match(voor.body, /Certificaatvertrouwensinstellingen/, 'en de stap die het vaakst vergeten wordt');
  const rest = await haal('/apps/app.html');
  assert.equal(rest.status, 302, 'al het andere gaat naar de beveiligde site');
  assert.match(rest.kop.location, /^https:\/\//);

  await new Promise(r => loket.close(r));
});

test('6. de QR in het venster is een echte, leesbare code', () => {
  const adres = 'https://192.168.178.218:3000/lokaal';
  const kunst = lokaal.qrInTerminal(adres);
  assert.ok(kunst && kunst.split('\n').length > 10, 'er komt een blok tekens uit');

  /* De twee dingen die een camera laten afhaken en die je met het blote oog
     niet ziet. Ze hebben ons hier allebei een ronde gekost.

     Polariteit: zonder eigen kleuren tekent een Terminal met witte
     achtergrond de code omgekeerd, en dan is hij onleesbaar. */
  assert.match(kunst, /\x1b\[97;40m/, 'wit op zwart wordt zelf gezet, niet aan het venster overgelaten');
  assert.match(kunst, /\x1b\[0m/, 'en netjes weer losgelaten');
  assert.ok(!/\x1b/.test(lokaal.qrInTerminal(adres, { kleur: false })), 'kaal blijft kaal, voor logbestanden');

  // Rustzone: de norm eist vier lege blokjes rondom, anders vindt een camera
  // de hoeken niet terug. Vier beeldrijen zijn twee tekstregels.
  const kaal = lokaal.qrInTerminal(adres, { kleur: false }).split('\n').map(r => r.slice(2));
  const leeg = r => /^█+$/.test(r);
  assert.ok(leeg(kaal[0]) && leeg(kaal[1]), 'boven zit een rustzone van vier blokjes');
  assert.ok(leeg(kaal[kaal.length - 1]) && leeg(kaal[kaal.length - 2]), 'onder ook');
  for (const r of kaal) {
    assert.match(r, /^████/, 'en links van elke regel');
    assert.match(r, /████$/, 'en rechts');
  }
  // en het is geen plaatje-dat-erop-lijkt: onze eigen decoder leest hem terug
  const qr = require('../public/shared/qr');
  const uit = qr.decode(qr.encode(adres, { ecc: 'M' }));
  assert.equal(uit.tekst, adres, 'de code bevat precies het adres van het loket');
});

test('7. de opstartregels wijzen naar het loket, niet naar het losse bestand', () => {
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const uitleg = lokaal.startUitleg(c, 3000);
  assert.match(uitleg, /https:\/\/localhost:3000/, 'het adres op deze computer staat er');
  if (c.netwerk.length) {
    assert.match(uitleg, new RegExp('https://' + c.netwerk[0].replace(/\./g, '\\.') + ':3000/lokaal'),
      'en het loket-adres voor de telefoon, over https');
    assert.match(uitleg, /camera/, 'met de uitleg dat de camera volstaat');
    assert.match(uitleg, /Bezoek deze website/, 'en wat te doen bij de eenmalige waarschuwing');
  }
});

/* De aanleiding voor deze test: een iPhone met "Alleen HTTPS" aan weigerde het
   http-loket op poort 3010 al voordat er iets verstuurd werd. Het certificaat
   was daardoor onbereikbaar zonder eerst een beveiliging uit te zetten. Sinds
   die dag hangt het loket aan beide kanten. */
test('8. het loket hangt ook aan de beveiligde kant, voor telefoons die http weigeren', async () => {
  const c = lokaal.certVoorDezeMachine({ dataDir: TMP });
  const server = https.createServer({ key: c.key, cert: c.cert }, (req, res) => {
    if (lokaal.loketAntwoord(req, res, c, 3000)) return;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('de site zelf');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const poort = server.address().port;

  const haal = pad => new Promise((klaar, stuk) => {
    https.get({ host: '127.0.0.1', port: poort, path: pad, servername: 'localhost', ca: c.caPem }, r => {
      const d = []; r.on('data', x => d.push(x));
      r.on('end', () => klaar({ status: r.statusCode, body: Buffer.concat(d).toString() }));
    }).on('error', stuk);
  });

  const ca = await haal('/rtg-ca.crt');
  assert.equal(ca.status, 200);
  assert.ok(ca.body.includes('BEGIN CERTIFICATE'), 'het CA-bestand komt ook over https binnen');
  const pagina = await haal('/lokaal');
  assert.match(pagina.body, /bereikbaar/, 'de uitlegpagina staat er ook');
  assert.match(pagina.body, /Certificaatvertrouwensinstellingen/, 'met de stap die het vaakst vergeten wordt');
  const rest = await haal('/apps/app.html');
  assert.equal(rest.body, 'de site zelf', 'de rest gaat gewoon naar de site door');

  await new Promise(r => server.close(r));

  // en de poortwachter rijgt het er echt aan, niet alleen deze test
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'trio.js'), 'utf8');
  assert.match(bron, /loketAntwoord\(req, res, tlsCert, PORT\)/, 'trio.js hangt het loket aan de https-kant');
});

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
