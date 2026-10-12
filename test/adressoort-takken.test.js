/* DE ADRESSOORT EN DE BASIS VAN EEN LINK -- tak voor tak.

   Toetst server/config/adressoort.js (lokaal | openbaar | onbekend, ook voor
   IPv6 en IPv4-in-IPv6) en server/lib/linkbasis.js (wanneer een Origin- of
   Host-kop de basis van een e-maillink mag leveren, en welke vaste basis uit
   APP_URL of RTG_DOMAINS komt). Zuivere functies; waar process.env wordt
   gelezen, zet de toets de waarde na afloop terug. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { adresSoort } = require('../server/config/adressoort');
const lb = require('../server/lib/linkbasis');

test('adresSoort: lege en onleesbare namen zijn onbekend, nooit iets anders', () => {
  for (const h of ['', '   ', null, undefined, 'host:8080', 'rtg.nl:443', '[zz::1]'])
    assert.equal(adresSoort(h), 'onbekend', String(h));
});

test('adresSoort: loopback, mDNS en privé IPv4 zijn lokaal, ook met hoofdletters en haken', () => {
  for (const h of [' LOCALHOST ', '127.0.0.1', '127.9.9.9', '[::1]', 'Printer.Local', '10.20.30.40',
    '192.168.0.1', '172.16.0.1', '172.31.0.1'])
    assert.equal(adresSoort(h), 'lokaal', h);
});

test('adresSoort: IPv6 naar zijn reeks', () => {
  assert.equal(adresSoort('::'), 'onbekend', 'het ongespecificeerde adres');
  assert.equal(adresSoort('::ffff:192.168.1.1'), 'lokaal', 'IPv4 in IPv6-jas volgt het IPv4-deel');
  assert.equal(adresSoort('::ffff:8.8.8.8'), 'openbaar');
  assert.equal(adresSoort('[::ffff:127.0.0.1]'), 'lokaal');
  for (const h of ['fc00::1', 'fdab:1::2', 'fe80::1', 'febf::9'])
    assert.equal(adresSoort(h), 'lokaal', h + ' (ULA of link-local)');
  for (const h of ['2001:db8::1', '2001:0db8:1::1', '2001:db8', 'ff02::1', 'ff00::'])
    assert.equal(adresSoort(h), 'onbekend', h + ' (documentatie of multicast)');
  for (const h of ['2a00:1450:4001::200e', '[2606:4700::1111]', 'fec0::1', '2001:db9::1'])
    assert.equal(adresSoort(h), 'openbaar', h);
  assert.equal(adresSoort('.::1'), 'onbekend', 'een eerste groep die geen getal is');
});

test('adresSoort: gereserveerde en kale namen zijn onbekend, een opgegeven domein is openbaar', () => {
  for (const h of ['example.com', 'EXAMPLE.NET', 'example.org', 'a.example.com', 'b.example.net', 'x.test',
    'y.invalid', 'z.example', 'k.localhost', 'db.internal', 'anker.intern', 'containernaam'])
    assert.equal(adresSoort(h), 'onbekend', h);
  for (const h of ['rtg.nl', '8.8.8.8', '172.15.1.1', '172.32.1.1', 'myexample.com', 'test.rtg.nl'])
    assert.equal(adresSoort(h), 'openbaar', h);
});

test('lokaleUrl: alleen een URL naar deze machine of het eigen netwerk', () => {
  assert.equal(lb.lokaleUrl('http://localhost:3000/x'), true);
  assert.equal(lb.lokaleUrl('http://192.168.1.4'), true);
  assert.equal(lb.lokaleUrl('http://[::1]:3000'), true);
  assert.equal(lb.lokaleUrl('http://[2a00:1450::1]/'), false, 'een IPv6-adres heet niet stil lokaal');
  assert.equal(lb.lokaleUrl('http://[fe80::1]/'), false, 'alleen [::1] telt tussen haken');
  assert.equal(lb.lokaleUrl('https://kwaad.example'), false);
  assert.equal(lb.lokaleUrl('geen url'), false);
  assert.equal(lb.lokaleUrl('mailto:a@b.nl'), false, 'een URL zonder host');
});

const req = (headers, extra) => Object.assign({ headers }, extra || {});
const metHost = (host, protocol = 'http') => ({ headers: {}, protocol, get: k => (k === 'host' ? host : undefined) });

test('basisUitVerzoek: geen verzoek, geen koppen of de Origin "null" geeft geen basis', () => {
  assert.equal(lb.basisUitVerzoek(null, {}), '');
  assert.equal(lb.basisUitVerzoek({}, {}), '');
  assert.equal(lb.basisUitVerzoek(req({ origin: 'null' }), { NODE_ENV: 'test' }), '');
  assert.equal(lb.basisUitVerzoek(req({}), { NODE_ENV: 'test' }), '', 'geen Origin en geen protocol');
  assert.equal(lb.basisUitVerzoek(req({}, { protocol: 'http' }), { NODE_ENV: 'test' }), '', 'protocol zonder get()');
});

test('basisUitVerzoek: de toetsstand neemt elke kop over, daarbuiten alleen een lokale', () => {
  assert.equal(lb.basisUitVerzoek(req({ origin: 'https://kwaad.example' }), { NODE_ENV: 'test' }), 'https://kwaad.example');
  assert.equal(lb.basisUitVerzoek(req({ origin: 'https://kwaad.example' }), {}), '', 'een aanvaller levert geen basis');
  assert.equal(lb.basisUitVerzoek(req({ origin: 'http://localhost:4000' }), { NODE_ENV: 'development' }), 'http://localhost:4000');
  assert.equal(lb.basisUitVerzoek(metHost('127.0.0.1:5000'), {}), 'http://127.0.0.1:5000', 'de Host-kop als er geen Origin is');
  assert.equal(lb.basisUitVerzoek(metHost('rtg.nl', 'https'), {}), '');
});

test('basisUitVerzoek zonder env leest process.env', () => {
  const oud = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'test';
    assert.equal(lb.basisUitVerzoek(req({ origin: 'https://ergens.nl' })), 'https://ergens.nl');
    process.env.NODE_ENV = 'development';
    assert.equal(lb.basisUitVerzoek(req({ origin: 'https://ergens.nl' })), '');
  } finally { if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud; }
});

test('vasteBasis: APP_URL zonder slotstrepen, anders de eerste openbare naam uit RTG_DOMAINS', () => {
  assert.equal(lb.vasteBasis({ APP_URL: '  https://rtg.nl///  ' }), 'https://rtg.nl');
  assert.equal(lb.vasteBasis({ RTG_DOMAINS: ' , member, http://, rtg.local, app.rtg.nl, tweede.rtg.nl' }), 'https://app.rtg.nl',
    'lege, onleesbare, code- en lokale namen tellen niet');
  assert.equal(lb.vasteBasis({ RTG_DOMAINS: 'http://Site.RTG.nl' }), 'https://site.rtg.nl', 'altijd https');
  assert.equal(lb.vasteBasis({ RTG_DOMAINS: 'a b.nl' }), null, 'een naam die geen URL wordt telt niet');
  assert.equal(lb.vasteBasis({ RTG_DOMAINS: '' }), null);
  assert.match(lb.ONTBREEKT, /^APP_URL ontbreekt/);
});

test('vasteBasis zonder env leest process.env', () => {
  const oud = { a: process.env.APP_URL, d: process.env.RTG_DOMAINS };
  try {
    delete process.env.APP_URL; process.env.RTG_DOMAINS = 'portaal.rtg.nl';
    assert.equal(lb.vasteBasis(), 'https://portaal.rtg.nl');
  } finally {
    if (oud.a === undefined) delete process.env.APP_URL; else process.env.APP_URL = oud.a;
    if (oud.d === undefined) delete process.env.RTG_DOMAINS; else process.env.RTG_DOMAINS = oud.d;
  }
});
