/* OPNIEUW BEGINNEN -- het zevende werkwoord van de bodem, op een echte server.

   SAMENLEVING.md par. 2 noemde "opnieuw beginnen" het werkwoord zonder
   eigenaar, en vroeg dat het als PROJECTIE over wat er al staat zou komen.
   Deze toets houdt vier dingen vast:

   1. Het gratis account komt erbij (de bodem staat achter geen betaling), de
      bezoeker zonder account niet, en zonder sessie niemand.
   2. Elke ingang die de projectie noemt BESTAAT: een scherm staat op schijf en
      een route antwoordt (zonder sessie: geen 404). Een projectie die naar een
      deur wijst die er niet is, is het dode spoor uit EXECUTIE.md opnieuw.
   3. Ze toont over de persoon alleen ja/nee, nooit het e-mailadres of het
      telefoonnummer zelf.
   4. Ze schrijft zelf niets: twee keer opvragen laat de export van het lid
      gelijk, op het huisbrede handelingenspoor na -- en dat zegt ze er zelf bij.
   En wat er niet is (de schuld) staat er met een reden in plaats van leeg. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

let base, child;
const post = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

test.before(async () => { ({ base, child } = await startServer()); });
test.after(() => stop(child));

test('1. gratis account ja, bezoeker zonder account nee, zonder sessie nee', async () => {
  const gratis = await registreerGratis(base);
  assert.ok(gratis, 'registreren als gratis account lukte niet; niet gemeten is geen uitslag');
  const r = await post('/api/account/opnieuw', {}, gratis.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual(r.body.onderdelen.map(o => o.id), ['terugkomen', 'meenemen', 'achterlaten', 'schuld']);

  const gast = (await post('/api/login', { tier: 'guest' })).body;
  const g = await post('/api/account/opnieuw', {}, gast.token);
  assert.equal(g.status, 403, 'een bezoeker zonder account kreeg een overzicht van een account dat er niet is');
  assert.match(g.body.error, /account/);

  const anoniem = await post('/api/account/opnieuw', {});
  assert.equal(anoniem.status, 401);
});

test('2. elke ingang die de projectie noemt, bestaat', async () => {
  const gratis = await registreerGratis(base);
  const r = await post('/api/account/opnieuw', {}, gratis.token);
  const ingangen = r.body.onderdelen.flatMap(o => [o.ingang, ...(o.ingangen || [])]).filter(Boolean);
  assert.ok(ingangen.length >= 6, 'te weinig ingangen gelezen: ' + ingangen.length);
  for (const i of ingangen) {
    if (i.scherm) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', i.scherm)), 'scherm bestaat niet: ' + i.scherm);
    if (i.route) {
      const z = await post(i.route, {});
      assert.notEqual(z.status, 404, 'route bestaat niet: ' + i.route);
    }
  }
  // wat er niet is, staat er met een reden en niet als lege plek
  const schuld = r.body.onderdelen.find(o => o.id === 'schuld');
  assert.equal(schuld.stand, 'nietGebouwd');
  assert.ok(schuld.reden.length > 40);
  // wat na wissen blijft, komt van de gegevenskaart en niet uit een eigen lijst
  const kaart = await post('/api/mijn/gegevens', {}, gratis.token);
  assert.equal(kaart.status, 200, 'het gratis account kreeg zijn gegevenskaart niet (tier guest is twee mensen): ' + JSON.stringify(kaart.body));
  const blijft = r.body.onderdelen.find(o => o.id === 'achterlaten').blijftStaan;
  assert.ok(Array.isArray(blijft) && blijft.length > 0, 'er staat niets bij wat er na wissen blijft');
  assert.deepEqual(blijft, kaart.body.naOpheffen, 'twee antwoorden op de vraag wat er na wissen blijft');
});

test('3. alleen ja/nee over de persoon, nooit het gegeven zelf', async () => {
  const gratis = await registreerGratis(base);
  const r = await post('/api/account/opnieuw', {}, gratis.token);
  const stand = r.body.onderdelen.find(o => o.id === 'terugkomen').jouwStand;
  assert.equal(stand.emailBekend, true);
  assert.equal(stand.telefoonBekend, true);
  const tekst = JSON.stringify(r.body);
  assert.doesNotMatch(tekst, /@voorbeeld\.nl/, 'het e-mailadres stond in het overzicht');
  assert.doesNotMatch(tekst, /"06\d{8}"/, 'het telefoonnummer stond in het overzicht');
});

test('4. de projectie bewaart niets: opvragen verandert het dossier niet', async () => {
  const gratis = await registreerGratis(base);
  const schoon = (d) => { const c = JSON.parse(JSON.stringify(d)); delete c.handelingen; delete c.exportedAt; return JSON.stringify(c); };
  const voor = await post('/api/privacy/export', {}, gratis.token);
  assert.equal(voor.status, 200);
  await post('/api/account/opnieuw', {}, gratis.token);
  await post('/api/account/opnieuw', {}, gratis.token);
  const na = await post('/api/privacy/export', {}, gratis.token);
  assert.equal(schoon(na.body), schoon(voor.body), 'het dossier veranderde door het overzicht op te vragen');
  // het enige dat verandert is het huisbrede handelingenspoor, en dat zegt het overzicht er zelf bij
  const opgevraagd = na.body.handelingen.regels.filter(r => r.pad === '/api/account/opnieuw').length;
  assert.equal(opgevraagd, 2, 'het handelingenspoor hoort elke aanroep te tonen');
  const r = await post('/api/account/opnieuw', {}, gratis.token);
  assert.match(r.body.nietGedaan.join(' '), /handelingenspoor/, 'het overzicht verzwijgt dat het spoor de aanroep noteert');
});
