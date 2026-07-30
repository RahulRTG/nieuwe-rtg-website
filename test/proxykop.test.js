/* DE X-FORWARDED-KOPPEN: van rechts lezen, niet van links.

   Gevonden in de randronde. server/server.js zet `trust proxy: 1` -- er staat
   in productie een reverse proxy voor de app. server/web/verrijk.js las
   vervolgens het LINKSE adres uit X-Forwarded-For.

   Dat is het adres dat de bezoeker zelf mag verzinnen. Een proxy plakt zijn
   waarneming er RECHTS achter; wat er links staat heeft hij nooit gewist. Wie
   dus meestuurde:

       X-Forwarded-For: 9.9.9.9

   werd door de server gezien als 9.9.9.9. En bij het volgende verzoek als
   8.8.8.8. Gevolg:

     - server/rem.js telt op req.ip, dus ELKE snelheidslimiet was met één kop te
       omzeilen -- inclusief de brute-force-grens op de inlog;
     - het beveiligingslogboek en de quarantaine van De Wacht wezen naar een IP
       van andermans keuze, dus je kon een ander laten afsnijden.

   Wat deze test NIET bewijst: dat `trust proxy: 1` klopt. Staat er in werkelijk-
   heid geen proxy voor de app, dan IS de bezoeker de eerste hop en is elke
   X-Forwarded-lezing te vertrouwen noch te repareren. Dat is een eis aan de
   installatie (zie PRODUCTION.md), niet aan deze code.

   Draai los: node --test test/proxykop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { verrijk } = require('../server/web/verrijk');

/* Standaard komt de verbinding hier van 10.0.0.9 -- een privaat adres, dus een
   geldige proxy-positie. Zo toetsen de eerste tests de leesvolgorde. Test 7 en 8
   toetsen de tweede helft: WIE de kop mag sturen. */
function verzoek(headers, opties, vanaf) {
  const req = { url: '/iets', headers: headers || {}, socket: { remoteAddress: vanaf || '10.0.0.9' } };
  const res = { setHeader() {}, getHeader() {}, end() {} };
  verrijk(req, res, opties || { 'trust proxy': 1 });
  return req;
}

test('1. zonder proxykop telt het adres van de verbinding zelf', () => {
  assert.equal(verzoek({}).ip, '10.0.0.9');
});

test('2. de proxy zet het echte adres erin, en dat gebruiken we', () => {
  assert.equal(verzoek({ 'x-forwarded-for': '203.0.113.5' }).ip, '203.0.113.5');
});

test('3. HET GAT: een verzonnen adres vooraan wordt genegeerd', () => {
  // de aanvaller stuurt 9.9.9.9 mee; onze proxy plakt zijn waarneming erachter
  const r = verzoek({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5' });
  assert.equal(r.ip, '203.0.113.5', 'de waarneming van onze eigen proxy wint');
  assert.notEqual(r.ip, '9.9.9.9', 'anders is elke snelheidslimiet met een kop te omzeilen');
});

test('4. ook een hele ketting verzinsels haalt niets uit', () => {
  const r = verzoek({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.5' });
  assert.equal(r.ip, '203.0.113.5');
});

test('5. hetzelfde voor protocol en host: rechts telt', () => {
  // "ik kom over https" terwijl de proxy http zag: de proxy wint
  assert.equal(verzoek({ 'x-forwarded-proto': 'https, http' }).protocol, 'http');
  assert.equal(verzoek({ 'x-forwarded-proto': 'https' }).protocol, 'https', 'een echte https-proxy werkt gewoon');
  // een verzonnen host vooraan mag de echte niet verdringen (e-maillinks!)
  assert.equal(verzoek({ 'x-forwarded-host': 'kwaadaardig.example, rtg.example.com' }).hostname, 'rtg.example.com');
});

test('6. zonder trust proxy wordt de kop helemaal genegeerd', () => {
  const r = verzoek({ 'x-forwarded-for': '9.9.9.9' }, {});
  assert.equal(r.ip, '10.0.0.9', 'geen proxy ingesteld = geen enkele kop geloven');
});

/* ---------- de tweede helft: WIE mag die kop sturen ----------

   Van rechts lezen dekt het geval "er staat een proxy voor de app". Het dekt
   NIET het geval waarin de app rechtstreeks aan het internet hangt: dan is de
   bezoeker zelf de rechtse, en verzint hij nog steeds zijn eigen adres. Zolang
   dat kon, bleef elke snelheidslimiet met een kop te omzeilen.

   De enige waarneming die niemand kan vervalsen is het adres van de verbinding.
   Dus geloven we de kop alleen van een vertrouwde proxy-positie. */

test('7. een bezoeker die RECHTSTREEKS binnenkomt mag niets verzinnen', () => {
  // publiek bronadres = geen proxy ertussen = de kop is van de bezoeker zelf
  const r = verzoek({ 'x-forwarded-for': '9.9.9.9' }, { 'trust proxy': 1 }, '203.0.113.77');
  assert.equal(r.ip, '203.0.113.77', 'we tellen op de verbinding, niet op zijn kop');
  assert.notEqual(r.ip, '9.9.9.9', 'anders is de rem een formaliteit zodra er geen proxy staat');
});

test('8. een reverse proxy op loopback of in het eigen net wordt wel geloofd', () => {
  for (const proxy of ['127.0.0.1', '::1', '10.0.0.9', '172.17.0.3', '192.168.1.2']) {
    assert.equal(verzoek({ 'x-forwarded-for': '203.0.113.5' }, { 'trust proxy': 1 }, proxy).ip,
      '203.0.113.5', 'proxy op ' + proxy + ' hoort vertrouwd te zijn');
  }
  // en ook daar wint de waarneming van de proxy van wat de bezoeker ervoor plakt
  assert.equal(verzoek({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5' }, { 'trust proxy': 1 }, '127.0.0.1').ip, '203.0.113.5');
});

test('9. staat de proxy op een publiek adres, dan kan dat expliciet', () => {
  const inst = { 'trust proxy': 1, 'proxy ips': ['198.51.100.9'] };
  assert.equal(verzoek({ 'x-forwarded-for': '203.0.113.5' }, inst, '198.51.100.9').ip, '203.0.113.5',
    'de opgegeven proxy wordt geloofd');
  assert.equal(verzoek({ 'x-forwarded-for': '9.9.9.9' }, inst, '203.0.113.77').ip, '203.0.113.77',
    'iedereen daarbuiten niet -- ook loopback niet meer, want de lijst is dan de hele waarheid');
});
