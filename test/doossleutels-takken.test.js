/* ============================================================================
   DE ZAAKDOOSSLEUTELS (server/kern/zaakdoos/sleutels.js), DE RANDEN.

   test/doossleutels-register.test.js meet de hoofdroute zonder server. Hier
   wat daar niet langs komt: elke invoerweigering van geef(), intrekken van een
   oude 48-hex-sleutel en van een al ingetrokken sleutel, welke() met een
   onderwerp dat niet bij de rij hoort, een uitgever die weg is, het overzicht
   van een lege opslag en de cache per database. Alles in het geheugen.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDoosSleutels, doosSleutelsVan, MAX_DAGEN, FAMILIES } = require('../server/kern/zaakdoos/sleutels');

function register(extra) {
  const db = { data: {}, writable: true };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  const t = Date.parse('2026-10-01T09:00:00Z');
  return { db, s: maakDoosSleutels(Object.assign({ db, save, crypto, bewerkCollectie, nu: () => t }, extra || {})) };
}

test('zonder collectietransactie is er geen register', () => {
  assert.throws(() => maakDoosSleutels({ db: { data: {} }, save() {}, crypto }), /collectietransactie/);
});

test('geef weigert elke onjuiste invoer met een 400 of 403', async () => {
  const { s } = register();
  assert.equal((await s.geef({ doos: null, zaak: 'KIKUNOI', door: 'k' })).status, 400);
  assert.match((await s.geef({ doos: 'x', zaak: 'KIKUNOI', door: 'k' })).error, /2 tot 40/);
  assert.match((await s.geef({ doos: 'doos-a', zaak: undefined, door: 'k' })).error, /zaak/);
  assert.match((await s.geef({ doos: 'doos-a', zaak: 'K', door: 'k' })).error, /zaak/);
  assert.match((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', scope: [], door: 'k' })).error, /scope/);
  assert.match((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', scope: ['meting', 'stuur'], door: 'k' })).error, /meting, rapport/);
  assert.equal((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', dagen: 0, door: 'k' })).status, 400);
  assert.equal((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', dagen: 2.5, door: 'k' })).status, 400);
  assert.match((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', dagen: MAX_DAGEN + 1, door: 'k' })).error, /365/);
  assert.equal((await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: '' })).status, 403);
});

test('een smalle scope als losse tekst, en welke() houdt hem aan', async () => {
  const { s } = register();
  const r = await s.geef({ doos: 'doos-a', zaak: 'kikunoi', scope: 'meting', dagen: '30', door: 'kantoor:toets' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.scope, ['meting']);
  assert.equal(s.welke('doos-a', r.sleutel, 'meting').zaak, 'KIKUNOI');
  assert.ok(s.welke('doos-a', r.sleutel, 'update').fout, 'buiten de scope zegt hij waarom');
  assert.equal(s.welke('doos-a', '', 'meting'), null);
  assert.equal(s.welke('doos-b', r.sleutel, 'meting'), null, 'een onbekende doos');
  assert.equal(s.welke('doos-a', 'ZD.' + '0'.repeat(32), 'meting'), null, 'een verkeerde sleutel');
});

test('welke() weigert een sleutel waarvan het onderwerp niet bij de rij hoort', async () => {
  const { db, s } = register();
  const r = await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  db.data.doosSleutels['doos-a'].zaak = 'ANDERS';
  assert.equal(s.welke('doos-a', r.sleutel, 'meting'), null);
  db.data.doosSleutels['doos-a'].zaak = 'KIKUNOI';
  assert.equal(s.welke('doos-a', r.sleutel, 'meting').doos, 'doos-a');
});

test('een uitgever die niet meer actief is, opent niets', async () => {
  let weg = false;
  const { s } = register({ uitgeverWeg: r => weg && r.uitgegeven_door === 'kantoor:oud' });
  const r = await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'kantoor:oud' });
  assert.equal(s.welke('doos-a', r.sleutel, 'meting').doos, 'doos-a');
  weg = true;
  assert.deepEqual(s.welke('doos-a', r.sleutel, 'meting'), { fout: 'uitgever-niet-actief' });
});

test('opnieuw uitgeven bij dezelfde zaak roteert; de oude sleutel gaat dicht', async () => {
  const { s } = register();
  const a = await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  const b = await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  assert.notEqual(a.sleutel, b.sleutel);
  assert.equal(a.rotatie, 1);
  assert.equal(b.rotatie, 2, 'het volgnummer loopt door');
  assert.equal(s.welke('doos-a', a.sleutel, 'meting'), null, 'de oude sleutel opent niets meer');
  assert.equal(s.welke('doos-a', b.sleutel, 'meting').doos, 'doos-a');
});

test('intrekken: onbekend zonder zaak, een oude sleutel, twee keer, en met standaardwaarden', async () => {
  const { db, s } = register();
  assert.deepEqual(await s.trekIn({ doos: 'nergens' }), { ok: true, ingetrokken: false });
  assert.equal((await s.trekIn({ doos: 'nergens', zaak: 'KIKUNOI' })).status, 404);
  await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  db.data.doosSleutels['doos-oud'] = { hash: 'abc', sinds: 'x' };
  assert.deepEqual(await s.trekIn({ doos: 'Doos-Oud' }), { ok: true, ingetrokken: true, doos: 'doos-oud' });
  assert.equal('doos-oud' in db.data.doosSleutels, false, 'een oude sleutel wordt weggehaald');
  const eerst = await s.trekIn({ doos: 'doos-a', zaak: 'kikunoi' });
  assert.deepEqual(eerst, { ok: true, ingetrokken: true, doos: 'doos-a', zaak: 'KIKUNOI' });
  const t = db.data.doosSleutels['doos-a'].toegang;
  assert.ok(t.ingetrokken_at);
  assert.deepEqual(await s.trekIn({ doos: 'doos-a' }), { ok: true, ingetrokken: false, doos: 'doos-a' });
  const lijst = s.dozen('KIKUNOI');
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].geldig, false);
});

test('een doos van een andere zaak en het plafond per zaak', async () => {
  const { db, s } = register();
  await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  assert.equal((await s.geef({ doos: 'doos-a', zaak: 'HOSHI', door: 'k' })).status, 409);
  await s.trekIn({ doos: 'doos-a' });
  const over = await s.geef({ doos: 'doos-a', zaak: 'HOSHI', door: 'k' });
  assert.equal(over.zaak, 'HOSHI', 'na intrekken mag hij naar een andere zaak');
  db.data.doosSleutels.leeg = null;
  for (let i = 1; i < 8; i++) assert.equal((await s.geef({ doos: 'h-' + i, zaak: 'HOSHI', door: 'k' })).ok, true);
  const vol = await s.geef({ doos: 'h-8', zaak: 'HOSHI', door: 'k' });
  assert.equal(vol.status, 409);
  assert.match(vol.error, /8 dozen/);
  assert.equal((await s.geef({ doos: 'h-1', zaak: 'HOSHI', door: 'k' })).ok, true, 'roteren van een eigen doos telt niet mee');
});

test('een oude rij zonder doosnaam staat als legacy in het overzicht', () => {
  const { db, s } = register();
  db.data.doosSleutels = { x: { hash: 'abc' } };
  assert.deepEqual(s.dozen().map(d => [d.doos, d.legacy, d.geldig]), [[null, true, false]]);
});

test('een collectie die geen kaart is, breekt de transactie af', async () => {
  const { db, s } = register();
  db.data.doosSleutels = [];
  await assert.rejects(s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' }));
});

test('overzicht van een lege opslag, en een rij zonder uitgever', async () => {
  const { db, s } = register();
  assert.deepEqual(s.dozen(), []);
  assert.equal(s.welke('doos-a', 'ZD.' + 'A'.repeat(32), 'meting'), null);
  const o = s.overzicht();
  assert.deepEqual(o.dozen, []);
  await s.geef({ doos: 'doos-a', zaak: 'KIKUNOI', door: 'k' });
  delete db.data.doosSleutels['doos-a'].uitgegeven_door;
  s.telGebruik('doos-a');
  s.telGebruik('doos-a');
  const [rij] = s.dozen();
  assert.equal(rij.uitgegeven_door, null);
  assert.equal(rij.gebruik, 2);
  assert.equal(rij.laatst, '2026-10-01T09:00:00.000Z');
  assert.deepEqual(rij.scope, FAMILIES.slice());
  assert.equal(rij.verlooptBinnenDagen, 180);
  assert.equal(s.dozen('ANDERS').length, 0);
  assert.equal(s.dozen('kikunoi').length, 1);
});

test('een instantie per database', () => {
  const db = { data: {}, writable: true };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  const a = doosSleutelsVan({ db, save, crypto, bewerkCollectie });
  assert.equal(doosSleutelsVan({ db, save, crypto, bewerkCollectie }), a);
  const db2 = { data: {}, writable: true };
  assert.notEqual(doosSleutelsVan({ db: db2, save, crypto,
    bewerkCollectie: require('../server/db/collectie-bewerken')({ store: 'json', db: db2, save }) }), a);
});
