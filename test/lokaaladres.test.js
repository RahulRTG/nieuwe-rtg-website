/* WELKE ADRESSEN STUREN WE NIET NAAR HTTPS, EN WAAROM DIE PRECIES.

   server/lib/lokaaladres.js beantwoordt één vraag: kan er voor dit adres een
   certificaat bestaan? Zo nee, dan is een 301 naar https een 301 naar niets --
   de browser krijgt ERR_CONNECTION_RESET en de server lijkt stuk terwijl hij
   gewoon draait. Dat is hier echt gebeurd, op 192.0.2.x (TEST-NET-1).

   Deze toets staat er omdat de vorige dekking een BROWSERTOETS was
   (test/media.e2e.js), en die meet dit alleen op het adres dat de machine
   toevallig draagt. Op een laptop is dat 192.168.x en dan is de hele
   TEST-NET-regel onbeproefd. Een lijst reeksen hoort per reeks getoetst te
   worden en niet per toevallige omgeving.

   De tweede helft is net zo belangrijk als de eerste: een ECHT publiek adres
   moet WEL doorgestuurd worden. Een lijst die te ruim wordt, zet stilletjes de
   https-dwang uit -- en dat is precies het slot dat dit blok moet zijn. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lokaalAdres } = require('../server/lib/lokaaladres');

test('lokaal: alles waarvoor geen certificaat kan bestaan', () => {
  const lokaal = [
    ['localhost', 'de naam zelf'],
    ['localhost:3000', 'met poort erachter'],
    ['127.0.0.1', 'loopback'],
    ['127.0.0.53:8080', 'de rest van 127/8'],
    ['::1', 'IPv6-loopback'],
    ['[::1]:3000', 'IPv6-loopback met haken en poort'],
    ['rtg.local', 'mDNS'],
    ['10.0.0.5', 'RFC 1918'],
    ['192.168.1.20', 'RFC 1918, het gewone thuisnetwerk'],
    ['172.16.0.1', 'RFC 1918, onderrand'],
    ['172.31.255.254', 'RFC 1918, bovenrand'],
    ['169.254.10.1', 'link-local'],
    ['100.64.0.1', 'CGNAT, onderrand'],
    ['100.127.255.254', 'CGNAT, bovenrand'],
    ['192.0.2.2', 'TEST-NET-1 -- het adres dat dit alles aan het licht bracht'],
    ['198.51.100.7', 'TEST-NET-2'],
    ['203.0.113.9', 'TEST-NET-3'],
    ['', 'geen host: er is niets om naar door te sturen']
  ];
  for (const [host, waarom] of lokaal) {
    assert.equal(lokaalAdres(host), true, host + ' hoort lokaal te zijn (' + waarom + ')');
  }
});

test('niet lokaal: een echt domein of een publiek IP hoort naar https', () => {
  const publiek = [
    ['app.rahultravelgroup.com', 'het echte domein; hier ging het ooit mis'],
    ['rahultravelgroup.com', 'kaal domein'],
    ['8.8.8.8', 'publiek IP'],
    ['172.15.0.1', 'net ONDER de RFC 1918-reeks van 172.16'],
    ['172.32.0.1', 'net BOVEN de RFC 1918-reeks van 172.31'],
    ['100.63.255.255', 'net onder CGNAT'],
    ['100.128.0.1', 'net boven CGNAT'],
    ['192.0.3.1', 'naast TEST-NET-1, dus een gewoon adres'],
    ['203.0.114.1', 'naast TEST-NET-3'],
    ['11.0.0.1', 'lijkt op 10/8 maar is het niet'],
    ['1.192.168.1', '192.168 in het MIDDEN telt niet -- de reeks staat vooraan'],
    ['localhost.example.com', 'begint met localhost maar is een echt domein']
  ];
  for (const [host, waarom] of publiek) {
    assert.equal(lokaalAdres(host), false, host + ' hoort NIET lokaal te zijn (' + waarom + ')');
  }
});

test('de host wordt gelezen zoals hij in de kop staat', () => {
  // hoofdletters, poorten en haken mogen het oordeel niet veranderen
  assert.equal(lokaalAdres('LOCALHOST:8080'), true, 'hoofdletters');
  assert.equal(lokaalAdres('RTG.LOCAL'), true, 'hoofdletters op .local');
  assert.equal(lokaalAdres('192.0.2.2:41523'), true, 'poort erachter');
  assert.equal(lokaalAdres('EXAMPLE.COM'), false, 'een echt domein blijft een echt domein');
  assert.equal(lokaalAdres(null), true, 'null telt als geen host');
  assert.equal(lokaalAdres(undefined), true, 'undefined ook');
});
