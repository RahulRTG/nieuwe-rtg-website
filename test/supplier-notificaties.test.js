/* ============================================================================
   DE MELDINGENBEL VAN EEN ZAAK -- eerste vulling, authenticatie en tenantgrens.

   De leveranciersapp deed bij binnenkomst al een POST naar
   /api/supplier/notifications, maar die route bestond niet. De client slikte de
   404 in, zodat de bel pas na een nieuw live-event iets liet zien. Deze toets
   legt zowel het antwoordcontract als de belangrijkere grens vast: de zaakcode
   komt uit het token. Een `code` in de body leest of wist nooit de buren.

   Draai los: node --test test/supplier-notificaties.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, basis, kiku, hoshi, lid, voorKiku, markerEen, markerTwee;

async function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(basis + pad, {
    method: 'POST', headers, body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function zaakToken(code) {
  const rooster = await post('/api/supplier/roster', { code });
  assert.equal(rooster.status, 200, code + ': rooster niet bereikbaar');
  const manager = rooster.body.staff.find(m => m.role === 'manager');
  assert.ok(manager, code + ': geen manager in het toetsrooster');
  const inlog = await post('/api/supplier/login', { code, staffId: manager.id, pin: '1234' });
  assert.equal(inlog.status, 200, code + ': manager kon niet inloggen');
  return inlog.body.token;
}

const dag = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function reserveer(marker, datum, tijd) {
  const r = await post('/api/reserveer', {
    supplierCode: 'KIKUNOI', datum, tijd, personen: 2, notitie: marker
  }, lid);
  assert.equal(r.status, 200, 'de toetsmelding kon niet worden gemaakt: ' + JSON.stringify(r.body));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '' } });
  basis = srv.base;
  kiku = await zaakToken('KIKUNOI');
  hoshi = await zaakToken('HOSHI');

  const uniek = Date.now().toString().slice(-8);
  const reg = await post('/api/auth/register', {
    name: 'Meldingen Toets', email: 'meldingen' + uniek + '@x.nl', phone: '06' + uniek,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  });
  assert.equal(reg.status, 200, 'toetslid kon niet worden gemaakt');
  lid = reg.body.token;
});

test.after(() => stop(srv && srv.child));

test('1. de lijst is geen openbare route en een ledentoken is geen zaaksleutel', async () => {
  assert.equal((await post('/api/supplier/notifications', {})).status, 401);
  assert.equal((await post('/api/supplier/notifications', {}, lid)).status, 401);
});

test('2. de eerste vulling levert de recente lijst van uitsluitend de eigen zaak', async () => {
  const begin = await post('/api/supplier/notifications', {}, kiku);
  assert.equal(begin.status, 200);
  assert.ok(Array.isArray(begin.body.notifications), 'antwoordcontract mist notifications[]');
  const herhaald = await post('/api/supplier/notifications', {}, kiku);
  assert.deepEqual(herhaald.body, begin.body, 'de leesroute veranderde haar eigen meldingenkast');
  voorKiku = new Set(begin.body.notifications.map(n => n.id));

  markerEen = 'TENANT-EEN-' + Date.now();
  await reserveer(markerEen, dag(31), '19:10');

  const eigen = await post('/api/supplier/notifications', { code: 'HOSHI' }, kiku);
  assert.equal(eigen.status, 200);
  const nieuw = eigen.body.notifications.find(n => !voorKiku.has(n.id) && String(n.body).includes(markerEen));
  assert.ok(nieuw, 'de nieuwe melding kwam niet terug in de eerste vulling');
  assert.equal(nieuw.read, false);
  assert.ok(eigen.body.notifications.length <= 40, 'dezelfde bewaartermijn als de meldingenkast');

  /* De scherpste grensproef: HOSHI vraagt in zijn body nadrukkelijk om KIKUNOI.
     Het token wint; de zojuist gemaakte KIKUNOI-melding blijft onzichtbaar. */
  const buur = await post('/api/supplier/notifications', { code: 'KIKUNOI' }, hoshi);
  assert.equal(buur.status, 200);
  assert.ok(!buur.body.notifications.some(n => n.id === nieuw.id),
    'een bodyparameter wisselde de tenant van HOSHI naar KIKUNOI');
});

test('3. ook markeren als gelezen blijft binnen de tenant uit het token', async () => {
  markerTwee = 'TENANT-TWEE-' + Date.now();
  await reserveer(markerTwee, dag(32), '19:20');
  let lijst = (await post('/api/supplier/notifications', {}, kiku)).body.notifications;
  const nieuw = lijst.find(n => String(n.body).includes(markerTwee));
  assert.ok(nieuw && !nieuw.read, 'de tweede toetsmelding begint niet ongelezen');

  const buurWist = await post('/api/supplier/notifications/read', { code: 'KIKUNOI' }, hoshi);
  assert.equal(buurWist.status, 200);
  lijst = (await post('/api/supplier/notifications', {}, kiku)).body.notifications;
  assert.equal(lijst.find(n => n.id === nieuw.id).read, false,
    'HOSHI kon met een bodyparameter KIKUNOI-meldingen lezen');

  assert.equal((await post('/api/supplier/notifications/read', {}, kiku)).status, 200);
  lijst = (await post('/api/supplier/notifications', {}, kiku)).body.notifications;
  assert.equal(lijst.find(n => n.id === nieuw.id).read, true, 'de eigen gelezen-stand werd niet bewaard');
});

test('4. de browser gebruikt het antwoord en voegt de initcall racevrij samen met SSE', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'leverancier', 'leverancier-84a.js'), 'utf8');
  assert.match(bron, /neemNotifs\(d\s*&&\s*d\.notifications\)/,
    'de initcall wordt gedaan maar zijn notifications[] verdwijnen nog steeds');
  assert.match(bron, /addEventListener\('hello',[\s\S]*?neemNotifs\(d\.unread\)/,
    'de SSE-hello vervangt de eerste vulling nog in plaats van haar samen te voegen');
});
