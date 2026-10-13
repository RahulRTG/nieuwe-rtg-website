/* DE TURN-KEURING TAK VOOR TAK (server/config/turn-adres.js en
   server/config/turn-credential.js).

   Wat dit bestand vasthoudt: welke hosts als openbaar gelden voor een relais
   (en welke privé, gereserveerd of een plaatshouder zijn, ook in IPv6- en
   IPv4-in-IPv6-jas), welke geheimen en gebruikersnamen sterk genoeg zijn, dat
   publieke productie alleen het tijdelijke TURN REST-credential kent, en hoe
   de levensduur en het ondoorzichtige actorlabel worden gevormd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const adres = require('../server/config/turn-adres');
const cred = require('../server/config/turn-credential');

test('priveIpv4: elke gereserveerde reeks is privé, een publiek adres niet', () => {
  for (const h of ['0.1.2.3', '10.0.0.1', '127.0.0.1', '224.0.0.1', '255.255.255.255',
    '100.64.0.1', '100.127.255.255', '169.254.1.1', '172.16.0.1', '172.31.255.1',
    '192.168.1.1', '192.0.0.1', '192.0.2.5', '198.18.0.1', '198.19.1.1', '198.51.100.7', '203.0.113.9'])
    assert.equal(adres.priveIpv4(h), true, h + ' hoort privé te zijn');
  for (const h of ['8.8.8.8', '100.63.0.1', '100.128.0.1', '169.253.1.1', '172.15.0.1', '172.32.0.1',
    '192.169.0.1', '198.17.0.1', '198.20.0.1', '198.51.101.1', '203.0.114.1', '203.1.113.1', '1.1.1.1'])
    assert.equal(adres.priveIpv4(h), false, h + ' hoort openbaar te zijn');
});

test('priveIpv4: een onleesbaar adres telt als privé (bij twijfel geen relais)', () => {
  for (const h of ['1.2.3', '1.2.3.4.5', '1.2.3.x', '1.2.3.256', '-1.2.3.4', '1.2.3.4.'])
    assert.equal(adres.priveIpv4(h), true, h);
});

test('priveIpv6: loopback, documentatie, ULA, link-local en multicast zijn privé', () => {
  for (const h of ['::', '::1', '2001:db8::', '2001:db8:1::1', 'fc00::1', 'FD12::1', 'fe80::1', 'fe9f::1',
    'feaf::1', 'febf::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])
    assert.equal(adres.priveIpv6(h), true, h);
  for (const h of ['2a00:1450::1', '2606:4700::1111', '::ffff:8.8.8.8', 'fec0::1'])
    assert.equal(adres.priveIpv6(h), false, h);
});

test('ipv4Mapped: zowel de gestippelde als de hexvorm komt terug als IPv4', () => {
  assert.equal(adres.ipv4Mapped('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(adres.ipv4Mapped('::ffff:7f00:1'), '127.0.0.1');
  assert.equal(adres.ipv4Mapped('0:0:0:0:0:ffff:0a00:0001'), '10.0.0.1');
  assert.equal(adres.ipv4Mapped('0:0::ffff:c0a8:101'), '192.168.1.1');
  /* Geen IPv6, of geen IPv4-in-IPv6. */
  assert.equal(adres.ipv4Mapped('127.0.0.1'), null);
  assert.equal(adres.ipv4Mapped(''), null);
  assert.equal(adres.ipv4Mapped(null), null);
  assert.equal(adres.ipv4Mapped('2001:db8::1'), null);
  assert.equal(adres.ipv4Mapped('1:2:3:4:5:6:7:8'), null);
  assert.equal(adres.ipv4Mapped('::fffe:7f00:1'), null, 'groep 6 moet ffff zijn');
  assert.equal(adres.ipv4Mapped('1::ffff:7f00:1'), null, 'de eerste vijf groepen moeten nul zijn');
});

test('openbareHost: IP-adressen volgen hun reeks, ook tussen haken', () => {
  assert.equal(adres.openbareHost('8.8.8.8'), true);
  assert.equal(adres.openbareHost('10.0.0.1'), false);
  assert.equal(adres.openbareHost('[2a00:1450::1]'), true);
  assert.equal(adres.openbareHost('[::1]'), false);
  assert.equal(adres.openbareHost('::ffff:7f00:1'), false, 'hexvorm van de loopback komt er niet door');
});

test('openbareHost: namen zonder punt, plaatshouders en gereserveerde domeinen zijn niet openbaar', () => {
  for (const h of ['', null, 'turnserver', 'turn.voorbeeld.nl', 'turn.example.com', 'your-domain.nl',
    'change-me.rtg.nl', 'turn.local', 'turn.internal', 'app.test', 'x.invalid', 'a.localhost',
    'x'.repeat(250) + '.com', 'bad_label.rtg.nl', '-begin.rtg.nl', 'eind-.rtg.nl', 'a..b.nl'])
    assert.equal(adres.openbareHost(h), false, String(h));
  for (const h of ['turn.rahultravelgroup.com', 'TURN.RTG.NL', 'a-b.c-d.nl', '[turn.rtg.nl]'])
    assert.equal(adres.openbareHost(h), true, h);
});

test('PLAATSHOUDER herkent de gebruikelijke invulwoorden', () => {
  for (const s of ['voorbeeld', 'EXAMPLE', 'placeholder', 'changeme', 'change-me', 'your-host', 'yourdomain',
    'vul-in', 'vulin', 'dummy', 'test-only', 'testonly'])
    assert.equal(adres.PLAATSHOUDER.test(s), true, s);
  assert.equal(adres.PLAATSHOUDER.test('k3ur1ng'), false);
});

const STERK = crypto.randomBytes(32).toString('hex');   // 64 tekens, ruim 8 verschillende

test('sterkGeheim: lengte, stuurtekens, plaatshouders, variatie en herhaling', () => {
  assert.equal(cred.sterkGeheim(STERK), true);
  assert.equal(cred.sterkGeheim(''), false);
  assert.equal(cred.sterkGeheim(undefined), false);
  assert.equal(cred.sterkGeheim(STERK.slice(0, 31)), false, 'korter dan 32');
  assert.equal(cred.sterkGeheim('a'.repeat(513)), false, 'langer dan 512');
  assert.equal(cred.sterkGeheim(STERK.slice(0, 20) + ' ' + STERK.slice(20)), false, 'spatie');
  assert.equal(cred.sterkGeheim(STERK + '\x7f'), false, 'DEL-teken');
  assert.equal(cred.sterkGeheim(STERK + '\n'), false, 'regeleinde');
  assert.equal(cred.sterkGeheim('placeholder-' + STERK), false, 'plaatshouder');
  assert.equal(cred.sterkGeheim('abcdefg'.repeat(6)), false, 'te weinig verschillende tekens (7)');
  assert.equal(cred.sterkGeheim('abcdefgh'.repeat(5)), false, 'een herhaald blok is geen sterk geheim');
  assert.equal(cred.sterkGeheim('abcdefgh'.repeat(4) + 'z'), true, 'geen zuivere herhaling meer');
});

test('geldigeGebruiker: lengte, verboden tekens en plaatshouders', () => {
  assert.equal(cred.geldigeGebruiker('rtg'), true);
  assert.equal(cred.geldigeGebruiker('rt'), false);
  assert.equal(cred.geldigeGebruiker('x'.repeat(129)), false);
  assert.equal(cred.geldigeGebruiker('x'.repeat(128)), true);
  assert.equal(cred.geldigeGebruiker('a:b'), false, 'de dubbele punt is het scheidingsteken van TURN REST');
  assert.equal(cred.geldigeGebruiker('a b c'), false);
  assert.equal(cred.geldigeGebruiker('dummy-user'), false);
  assert.equal(cred.geldigeGebruiker(null), false);
});

test('credentials: een sterk TURN_SECRET wint, ook in publieke productie', () => {
  assert.deepEqual(cred.credentials({ TURN_SECRET: STERK }), { soort: 'tijdelijk', secret: STERK });
  assert.deepEqual(cred.credentials({ TURN_SECRET: STERK, TURN_USER: 'rtg', TURN_PASS: STERK },
    { publiekeProductie: true }), { soort: 'tijdelijk', secret: STERK });
});

test('credentials: een vaste gebruiker/wachtwoord alleen buiten publieke productie', () => {
  const env = { TURN_SECRET: 'te-kort', TURN_USER: 'rtgturn', TURN_PASS: STERK };
  assert.deepEqual(cred.credentials(env), { soort: 'vast', username: 'rtgturn', credential: STERK });
  assert.equal(cred.credentials(env, { publiekeProductie: true }), null, 'nooit een permanente frontendcredential');
  assert.equal(cred.credentials({ TURN_USER: 'rtgturn', TURN_PASS: 'zwak' }), null);
  assert.equal(cred.credentials({ TURN_USER: 'x', TURN_PASS: STERK }), null);
  assert.equal(cred.credentials({}), null);
});

test('ttlVan: standaard vier uur, binnen [5 min, 4 uur] geklemd, onzin valt terug', () => {
  assert.equal(cred.ttlVan({}), cred.TTL_STANDAARD);
  assert.equal(cred.TTL_STANDAARD, 4 * 3600);
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: 'veel' }), cred.TTL_STANDAARD);
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: '600.5' }), cred.TTL_STANDAARD, 'geen geheel getal');
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: 'Infinity' }), cred.TTL_STANDAARD);
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: '600' }), 600);
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: '10' }), cred.TTL_MIN);
  assert.equal(cred.ttlVan({ TURN_CREDENTIAL_TTL: '999999' }), cred.TTL_MAX);
});

test('actorLabel: ondoorzichtig, stabiel per actor en per geheim, anoniem als er geen actor is', () => {
  const a = cred.actorLabel(STERK, 'sessie:lid-1');
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(a.includes('lid-1'), false);
  assert.equal(cred.actorLabel(STERK, 'sessie:lid-1'), a);
  assert.notEqual(cred.actorLabel(STERK, 'sessie:lid-2'), a);
  assert.notEqual(cred.actorLabel(STERK + 'x', 'sessie:lid-1'), a);
  assert.equal(cred.actorLabel(STERK, null), cred.actorLabel(STERK, 'anoniem'));
});

test('tijdelijk: verloop in de gebruikersnaam, en een HMAC-SHA1 als wachtwoord (TURN REST)', () => {
  const nu = () => 1_700_000_000_000;
  const c = cred.tijdelijk(STERK, { actor: 'a', ttl: 600, nu });
  assert.equal(c.verloopt, 1_700_000_000 + 600);
  assert.equal(c.username, c.verloopt + ':' + cred.actorLabel(STERK, 'a'));
  assert.equal(c.credential, crypto.createHmac('sha1', STERK).update(c.username).digest('base64'));
  const standaard = cred.tijdelijk(STERK);
  assert.ok(standaard.verloopt > Math.floor(Date.now() / 1000) + cred.TTL_STANDAARD - 5);
  assert.ok(standaard.username.endsWith(':' + cred.actorLabel(STERK, 'anoniem')));
});

test('192.0.x.x: alleen 192.0.0.0/24 en TEST-NET-1 (192.0.2.0/24) zijn gereserveerd, de rest is openbaar', () => {
  const { openbareHost } = adres;
  for (const ip of ['192.0.0.1', '192.0.0.255', '192.0.2.1', '192.0.2.255'])
    assert.equal(openbareHost(ip), false, ip + ' is gereserveerd');
  for (const ip of ['192.0.1.1', '192.0.3.1', '192.0.255.1'])
    assert.equal(openbareHost(ip), true, ip + ' is een gewoon adres');
});
