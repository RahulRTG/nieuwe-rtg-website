/* Taktoetsen voor de SSRF-afweer (server/kern/ssrf.js). Deze toetsen bestaan
   omdat de dekkingsmeting over de HELE suite liet zien dat een reeks takken van
   ssrf.js door geen enkele toets werd geraakt: het octet boven 255, elke losse
   privé-range afzonderlijk (en net ernaast), de IPv6-gevallen site-local en
   IPv4-mapped-publiek, de hex-zonder-dubbelepunt-tak, elke interne-hostnaam-
   uitgang, en in veiligeWebhookUrl de intern-tak met een ongeldige of lege URL.
   Een tak die niemand raakt, kan stil omvallen; hier staat per tak wat hij
   hoort te doen.

   Bewust NIET vastgelegd (staat als bevinding in het rapport, niet als toets):
   een hostnaam die met "fc"/"fd" begint, een interne hostnaam met afsluitende
   punt, en een IPv4-mapped metadata-adres achter intern:true.
   Draai: node --test test/ssrf-takken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const ssrf = require('../server/kern/ssrf');

test('een octet boven 255 is geen IPv4-literal en dus geen privé-adres', () => {
  // 256.1.1.1 is geen IP; het mag niet als 0.x of 10.x worden gelezen
  assert.equal(ssrf.onveiligIpLiteral('256.1.1.1'), false);
  assert.equal(ssrf.onveiligIpLiteral('10.0.0.999'), false);
  assert.equal(ssrf.metadataDoel('169.254.169.256'), false, 'geen geldig v4, dus geen metadata');
});

test('elke privé-IPv4-range wordt aan beide kanten van zijn grens juist gelezen', () => {
  const onveilig = ['10.0.0.0', '10.255.255.255', '127.0.0.1', '127.255.0.1', '0.0.0.0', '0.1.2.3',
    '172.16.0.0', '172.31.255.255', '192.168.0.0', '192.168.255.255', '169.254.0.1',
    '100.64.0.0', '100.127.255.255', '224.0.0.0', '239.255.255.255', '240.0.0.1', '255.255.255.255'];
  for (const ip of onveilig) assert.equal(ssrf.onveiligIpLiteral(ip), true, ip + ' moet onveilig zijn');
  const veilig = ['11.0.0.1', '9.255.255.255', '126.0.0.1', '128.0.0.1', '1.0.0.1',
    '172.15.255.255', '172.32.0.0', '171.16.0.1', '192.167.0.1', '192.169.0.1', '193.168.0.1',
    '169.253.0.1', '169.255.0.1', '168.254.0.1', '100.63.255.255', '100.128.0.0', '101.64.0.1',
    '223.255.255.255'];
  for (const ip of veilig) assert.equal(ssrf.onveiligIpLiteral(ip), false, ip + ' is publiek');
});

test('IPv6-literals: loopback, onbepaald, link-local, ULA en site-local zijn onveilig', () => {
  for (const h of ['::1', '[::1]', '::', '::0', 'fe80::1', 'FE80::abcd', 'fc00::1', 'fd12:3456::1',
    'fec0::1', '[fec0::1]']) {
    assert.equal(ssrf.onveiligIpLiteral(h), true, h + ' moet onveilig zijn');
  }
});

test('IPv4-mapped IPv6 volgt het IPv4-oordeel; onleesbaar staartstuk is onveilig', () => {
  assert.equal(ssrf.onveiligIpLiteral('::ffff:10.0.0.1'), true, 'mapped privé');
  assert.equal(ssrf.onveiligIpLiteral('::ffff:169.254.169.254'), true, 'mapped metadata');
  assert.equal(ssrf.onveiligIpLiteral('::ffff:8.8.8.8'), false, 'mapped publiek blijft publiek');
  // de URL-parser schrijft ::ffff:127.0.0.1 om naar hex; ook die vorm blijft onveilig
  assert.equal(ssrf.onveiligIpLiteral('::ffff:7f00:1'), true, 'hex-vorm van een loopback-adres');
  assert.equal(ssrf.onveiligIpLiteral('::ffff:999.1.1.1'), true);
});

test('publieke IPv6-literals en gewone hostnamen zijn geen onveilige literal', () => {
  assert.equal(ssrf.onveiligIpLiteral('2001:db8::1'), false);
  assert.equal(ssrf.onveiligIpLiteral('[2606:4700::1111]'), false);
  assert.equal(ssrf.onveiligIpLiteral('abc'), false, 'hex zonder dubbelepunt is geen IPv6');
  assert.equal(ssrf.onveiligIpLiteral('example.com'), false);
});

test('veiligeExternalUrl weigert een ongeldige of lege invoer met de juiste reden', () => {
  for (const v of [undefined, null, '', 'geen url', '://x']) {
    assert.deepEqual(ssrf.veiligeExternalUrl(v), { ok: false, reden: 'geen geldige URL' }, String(v));
  }
});

test('veiligeExternalUrl laat http en https door, en weigert al het andere met reden', () => {
  assert.deepEqual(ssrf.veiligeExternalUrl('http://example.com/'), { ok: true });
  assert.deepEqual(ssrf.veiligeExternalUrl('https://example.com/'), { ok: true });
  for (const u of ['ftp://example.com/', 'file:///etc/passwd', 'data:text/plain,x', 'javascript:alert(1)']) {
    assert.deepEqual(ssrf.veiligeExternalUrl(u), { ok: false, reden: 'alleen http(s)' }, u);
  }
});

test('veiligeExternalUrl weigert privé-literals, ook in de vormen die de URL-parser normaliseert', () => {
  const reden = 'privé/gereserveerd/metadata-adres';
  for (const u of ['http://127.0.0.1:8080/', 'http://2130706433/', 'http://0x7f.1/',
    'http://[::1]/', 'http://[fd00::1]/', 'http://[fec0::1]/', 'http://[::ffff:127.0.0.1]/',
    'http://172.20.1.1/', 'http://100.100.1.1/', 'http://239.1.1.1/']) {
    assert.deepEqual(ssrf.veiligeExternalUrl(u), { ok: false, reden }, u);
  }
  assert.deepEqual(ssrf.veiligeExternalUrl('http://[2001:db8::1]/'), { ok: true }, 'publiek IPv6');
  assert.deepEqual(ssrf.veiligeExternalUrl('http://93.184.216.34/'), { ok: true }, 'publiek IPv4');
});

test('veiligeExternalUrl weigert elke interne-hostnaamvorm, hoofdletterongevoelig', () => {
  const reden = 'interne hostnaam';
  for (const u of ['http://localhost/', 'http://LOCALHOST:3000/', 'http://app.localhost/',
    'http://db.internal/', 'http://metadata.google.internal/', 'http://printer.local/', 'http://Kluis.LOCAL/']) {
    assert.deepEqual(ssrf.veiligeExternalUrl(u), { ok: false, reden }, u);
  }
  // alleen het achtervoegsel telt, niet een woord dat erop lijkt
  assert.deepEqual(ssrf.veiligeExternalUrl('https://localhostbank.nl/'), { ok: true });
  assert.deepEqual(ssrf.veiligeExternalUrl('https://internal.example.com/'), { ok: true });
  assert.deepEqual(ssrf.veiligeExternalUrl('https://local.nl/'), { ok: true });
});

test('metadataDoel: lege invoer, haakjes en grenzen van 169.254/16', () => {
  assert.equal(ssrf.metadataDoel(undefined), false);
  assert.equal(ssrf.metadataDoel(null), false);
  assert.equal(ssrf.metadataDoel(''), false);
  assert.equal(ssrf.metadataDoel('[fe80::1]'), true, 'haakjes worden gestript');
  assert.equal(ssrf.metadataDoel('[FD00:EC2::254]'), true, 'hoofdletters + haakjes');
  assert.equal(ssrf.metadataDoel('169.254.0.0'), true);
  assert.equal(ssrf.metadataDoel('169.254.255.255'), true);
  assert.equal(ssrf.metadataDoel('169.253.169.254'), false);
  assert.equal(ssrf.metadataDoel('169.255.0.1'), false);
  assert.equal(ssrf.metadataDoel('170.254.0.1'), false);
  assert.equal(ssrf.metadataDoel('fd00::1'), false, 'gewone ULA is geen metadata');
  assert.equal(ssrf.metadataDoel('fe8::1'), false);
});

test('veiligeWebhookUrl zonder opties of met intern:false is gelijk aan veiligeExternalUrl', () => {
  for (const u of ['http://10.0.0.5/', 'http://localhost/', 'https://hooks.example.com/x', 'ftp://x/', 'nope']) {
    const verwacht = ssrf.veiligeExternalUrl(u);
    assert.deepEqual(ssrf.veiligeWebhookUrl(u), verwacht, u + ' zonder opts');
    assert.deepEqual(ssrf.veiligeWebhookUrl(u, null), verwacht, u + ' opts null');
    assert.deepEqual(ssrf.veiligeWebhookUrl(u, { intern: false }), verwacht, u + ' intern:false');
  }
});

test('veiligeWebhookUrl intern:true: ongeldige URL en verkeerd protocol krijgen hun eigen reden', () => {
  const o = { intern: true };
  for (const v of [undefined, null, '', 'geen url']) {
    assert.deepEqual(ssrf.veiligeWebhookUrl(v, o), { ok: false, reden: 'geen geldige URL' }, String(v));
  }
  for (const u of ['ftp://x/y', 'file:///etc/passwd', 'gopher://127.0.0.1/']) {
    assert.deepEqual(ssrf.veiligeWebhookUrl(u, o), { ok: false, reden: 'alleen http(s)' }, u);
  }
});

test('veiligeWebhookUrl intern:true: lokaal en intern mag, metadata/link-local nooit', () => {
  const o = { intern: true };
  for (const u of ['http://localhost:1025/', 'https://collector.internal/log', 'http://192.168.1.10/',
    'http://[::1]:9000/', 'https://hooks.example.com/x']) {
    assert.deepEqual(ssrf.veiligeWebhookUrl(u, o), { ok: true }, u);
  }
  const reden = 'cloud-metadata/link-local-adres';
  for (const u of ['http://169.254.169.254/latest/', 'https://169.254.1.1/', 'http://0xa9.0xfe.0xa9.0xfe/',
    'http://[fe80::1]/', 'http://[FE80::1]/', 'http://[fd00:ec2::254]/']) {
    assert.deepEqual(ssrf.veiligeWebhookUrl(u, o), { ok: false, reden }, u);
  }
});
