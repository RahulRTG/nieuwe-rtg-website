/* ============================================================================
   DE REM OP DE CODE-DEUREN VAN DE RTFOUNDATION

   Zes routes laten binnen op alleen een code in het lijf: het clubportaal, de
   clubberichten en de vier stadsraad-routes. Die partijen hebben geen
   RTG-account, dus dat IS de bedoelde weg -- maar er zat geen enkele rem op, en
   dan hangt de sterkte volledig aan de lengte van de code. Gevonden bij het
   dichten van keuringsregel 28, waar deze routes als "publiek met reden" op de
   lijst kwamen.

   WAAROM TWEE REMMEN, EN WAAROM DE EERSTE VERSIE FOUT WAS

   Mijn eerste sleutel was ip+code. Dat leest als regel 7 (de grendel hangt aan
   het doel) maar draait hem hier om: een raadmachine gebruikt elke poging een
   ANDERE code, dus elke poging kreeg een verse bak en de rem stond er voor
   niets. Een sleutel mag niet meebewegen met wat de aanvaller varieert.

     - de IP-rem (20/min) stopt het afgrazen: veel codes vanaf een bron;
     - de code-rem (60/min) stopt het omgekeerde: veel bronnen op EEN code.

   Beide krijgen hier een eigen assertie, want ze vangen verschillende dingen en
   een van de twee kan stil wegvallen zonder dat de ander het merkt.

   DE X-FORWARDED-FOR IN DEZE TOETS IS ECHT, GEEN TRUC. De verbinding komt van
   loopback en dat is een vertrouwde proxy (server/web/verrijk.js), dus de kop
   telt -- precies zoals achter een reverse proxy in productie. Een bezoeker die
   rechtstreeks binnenkomt kan hem niet verzinnen; dat staat in test/ip.test.js.

   Draai los: node --experimental-sqlite --test test/rtfcoderem.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfcoderem-'));

const IP_LIMIET = 20;    // per minuut per bron
const CODE_LIMIET = 60;  // per minuut per code

/* Een verzonnen code die zeker niet bestaat, met een teller erin zodat elke
   poging een andere is -- dat is exact wat een raadmachine doet. */
let n = 0;
const verzonnenCode = () => 'CLUB-Z' + String(++n).padStart(5, '0');

function post(pad, body, ip) {
  const kop = { 'Content-Type': 'application/json' };
  if (ip) kop['X-Forwarded-For'] = ip;
  return fetch(base + pad, { method: 'POST', headers: kop, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTF-REM-KEURING' } });
  base = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de bron-rem: twintig codes per minuut, daarna dicht -- ook met een verse code', async () => {
  const ip = '203.0.113.11';
  const statussen = [];
  for (let i = 0; i < IP_LIMIET; i++) statussen.push((await post('/api/rtf/club/portaal', { code: verzonnenCode() }, ip)).status);

  /* Eerst het gedrag ZONDER rem vastleggen: een onbekende code is een 404 en
     geen 429. Zonder deze regel zou een toets die alles op 429 zet ook groen
     staan, en dan meet hij de rem niet maar het bestaan van de route. */
  assert.deepEqual([...new Set(statussen)], [404], 'de eerste twintig pogingen komen gewoon bij de route uit');

  const overGrens = await post('/api/rtf/club/portaal', { code: verzonnenCode() }, ip);
  assert.equal(overGrens.status, 429, 'de eenentwintigste poging vanaf dezelfde bron loopt tegen de rem');
  assert.ok(/rustig|veel verzoeken/i.test(String(overGrens.body.error || '')), 'en zegt waarom');

  /* De sleutel beweegt NIET mee met de code. Dit is de assertie die de eerste,
     foute versie (ip+code) had laten zakken: die gaf hier gewoon weer 404. */
  const nogSteedsDicht = await post('/api/rtf/club/portaal', { code: verzonnenCode() }, ip);
  assert.equal(nogSteedsDicht.status, 429, 'een verse code opent de rem niet');

  // en de rem sluit alleen deze bron af, niet de route
  const andereBron = await post('/api/rtf/club/portaal', { code: verzonnenCode() }, '203.0.113.12');
  assert.equal(andereBron.status, 404, 'een andere bron komt er gewoon door');
});

test('de bron-rem hangt over alle zes de code-deuren, niet over een ervan', async () => {
  const ip = '203.0.113.21';
  const deuren = ['/api/rtf/club/portaal', '/api/rtf/club/bericht', '/api/rtf/partner/raad',
    '/api/rtf/partner/besluit-start', '/api/rtf/partner/stem', '/api/rtf/partner/besluit-sluit'];
  /* Verdeeld over de deuren: als een van de zes zijn eigen bak had (of geen rem
     had) dan telt hij hier niet mee en blijft de eenentwintigste open. */
  for (let i = 0; i < IP_LIMIET; i++) await post(deuren[i % deuren.length], { code: verzonnenCode() }, ip);
  for (const deur of deuren) {
    const r = await post(deur, { code: verzonnenCode() }, ip);
    assert.equal(r.status, 429, deur + ' telt mee in dezelfde bak');
  }
});

test('de code-rem: zestig pogingen op EEN code, ook al komt elke twintig van een andere bron', async () => {
  const code = 'CLUB-QQQQQQ';
  const statussen = [];
  // vier bronnen die elk precies op hun eigen grens blijven: samen tachtig
  for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4'])
    for (let i = 0; i < IP_LIMIET; i++) statussen.push((await post('/api/rtf/club/portaal', { code }, ip)).status);

  assert.equal(statussen.length, 80);
  const geremd = statussen.map((s, i) => s === 429 ? i : -1).filter(i => i >= 0);
  assert.equal(geremd.length, 80 - CODE_LIMIET, 'twintig van de tachtig lopen tegen de code-rem');
  assert.equal(geremd[0], CODE_LIMIET, 'en dat zijn precies de pogingen vanaf de eenenzestigste');
  assert.deepEqual([...new Set(statussen.slice(0, CODE_LIMIET))], [404],
    'de eerste zestig komen bij de route uit -- de IP-rem heeft hier niets geraakt');
});

test('de rem staat niet in de weg van een echte club', async () => {
  const login = await post('/api/office/login', { code: 'RTF-REM-KEURING' });
  const token = login.body.token;
  assert.ok(token, 'het kantoor logt in');
  const club = await fetch(base + '/api/rtfkantoor/club/maak', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ naam: 'SV Remproef', stad: 'Delft', sport: 'voetbal' })
  }).then(r => r.json());
  assert.ok(club.club && /^CLUB-/.test(club.club.code), 'de club krijgt een code');

  /* Verse bron, echte code: dit is de gewone gebruiker. Twee keer achter elkaar,
     want een portaal dat je een keer opent doet dat vaak dubbel (kaart + log). */
  const ip = '192.0.2.77';
  assert.equal((await post('/api/rtf/club/portaal', { code: club.club.code }, ip)).status, 200);
  const tweede = await post('/api/rtf/club/portaal', { code: club.club.code.toLowerCase() }, ip);
  assert.equal(tweede.status, 200, 'en kleine letters horen bij dezelfde code, aan beide kanten van de rem');
});
