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

function verzoek(headers, opties) {
  const req = { url: '/iets', headers: headers || {}, socket: { remoteAddress: '10.0.0.9' } };
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
