/* Het register van de zaakdoossleutels zonder server (devices.zaakdoos_sleutel, B12):
   hash-only, vervaldatum, plafond per zaak, legacy opent niets, de schaduw, de
   wacht in productie en constante tijd. Draai los: node --test test/doossleutels-register.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDoosSleutels, MAX_DOZEN_PER_ZAAK } = require('../server/kern/zaakdoos/sleutels');

const GEDEELD = 'gedeelde-doos-sleutel-voor-de-toets';
const eigen = (doos, sleutel) => ({ 'x-doos-id': doos, 'x-doos-eigen-sleutel': sleutel });
/* een verse opslag met de collectietransactie van de json-motor, zoals de server hem heeft */
function register(nu) {
  const db = { data: {}, writable: true };
  const save = () => {};
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save });
  return { db, s: maakDoosSleutels({ db, save, crypto, bewerkCollectie, nu }) };
}

test('1. het register: hash-only, vervalt, plafond per zaak, en een oude sleutel opent niets', async () => {
  let t = Date.parse('2026-09-27T09:00:00Z');
  const { db, s } = register(() => t);
  const r = await s.geef({ doos: 'Doos-X', zaak: 'kikunoi', dagen: 10, door: 'kantoor:toets' });
  assert.equal(r.doos, 'doos-x');
  assert.ok(!JSON.stringify(db.data).includes(r.sleutel.slice(3)), 'alleen een hash in de opslag');
  assert.deepEqual(s.welke('doos-x', r.sleutel, 'meting'), { doos: 'doos-x', zaak: 'KIKUNOI', expires_at: r.expires_at });
  assert.equal(s.welke('doos-x', r.sleutel.toLowerCase(), 'meting').doos, 'doos-x');
  assert.equal(s.welke('doos-x', r.sleutel, 'onbekend'), null);
  assert.equal((await s.geef({ doos: 'doos-y', zaak: 'KIKUNOI' })).status, 403, 'geen uitgever, geen sleutel');
  t += 11 * 86400000;
  assert.deepEqual(s.welke('doos-x', r.sleutel, 'meting'), { fout: 'verlopen' }, 'na tien dagen is hij verlopen');
  // een oude 48-hex-sleutel (van voor B12) opent niets, en staat als legacy in het overzicht
  db.data.doosSleutels['doos-oud'] = { hash: crypto.createHash('sha256').update('a'.repeat(48)).digest('hex'), sinds: 'x' };
  assert.equal(s.welke('doos-oud', 'a'.repeat(48), 'meting'), null);
  assert.equal(s.dozen().find(d => d.doos === null || d.legacy).legacy, true);
  // plafond per zaak
  for (let i = 0; i < MAX_DOZEN_PER_ZAAK; i++) assert.equal((await s.geef({ doos: 'p-' + i, zaak: 'HOSHI', door: 'k' })).ok, true);
  assert.equal((await s.geef({ doos: 'p-te-veel', zaak: 'HOSHI', door: 'k' })).status, 409);
  await s.trekIn({ doos: 'p-0', door: 'k' });
  assert.equal((await s.geef({ doos: 'p-te-veel', zaak: 'HOSHI', door: 'k' })).ok, true, 'na een intrekking past hij weer');
  // een doos van een andere zaak wordt niet overgenomen zolang zijn sleutel geldt
  assert.equal((await s.geef({ doos: 'p-1', zaak: 'KIKUNOI', door: 'k' })).status, 409);
  assert.equal((await s.trekIn({ doos: 'p-1', zaak: 'KIKUNOI', door: 'k' })).status, 404);
});

test('2. de lijst dozen op de gedeelde sleutel: zelfopgave, zeven dagen, en begrensd', async () => {
  let t = Date.parse('2026-09-23T09:00:00Z');
  const { db, s } = register(() => t);
  await s.geef({ doos: 'doos-x', zaak: 'KIKUNOI', door: 'k' });
  s.telWeg('gedeeld', 'Doos-X');
  s.telWeg('gedeeld', 'doos-x');
  s.telWeg('gedeeld', '../etc');
  s.telWeg('eigen', 'doos-y');
  const o = s.overzicht();
  assert.deepEqual(o.nogGedeeld.map(d => [d.doos, d.aantal, d.heeftEigen]),
    [['(geen geldige naam)', 1, false], ['doos-x', 2, true]], 'heeftEigen valt op');
  assert.match(o.nogGedeeldUitleg, /zelfopgave/);
  t += 8 * 86400000;
  assert.deepEqual(s.overzicht().nogGedeeld, [], 'zeven dagen');
  t += 30 * 86400000;
  s.telWeg('gedeeld', 'doos-z');
  assert.deepEqual(Object.keys(db.data.doosGedeeldGezien), ['doos-z'], 'dertig dagen');
  for (let i = 0; i < 250; i++) s.telWeg('gedeeld', 'verzonnen-' + i);
  assert.equal(Object.keys(db.data.doosGedeeldGezien).length, 200, 'begrensd');
});

/* 3. DE GEDEELDE SLEUTEL DICHT (buiten productie; in productie opent hij nooit
   iets, zie test/foundation-gezinstoken-productie.test.js). */
test('3a. dichtzetten wacht tot geen doos meer de gedeelde sleutel gebruikt', () => {
  let t = Date.parse('2026-09-24T09:00:00Z');
  const { s } = register(() => t);
  assert.equal(s.gedeeldeSleutel().dicht, false, 'standaard open');
  s.telWeg('gedeeld', 'doos-oud');
  const te = s.gedeeldZet({ dicht: true, wie: 'eigenaar' });
  assert.equal(te.status, 409, JSON.stringify(te));
  assert.deepEqual(te.nogGedeeld, ['doos-oud'], 'de weigering noemt de doos');
  assert.equal(s.gedeeldZet({ dicht: 'ja' }).status, 400);
  t += 8 * 86400000;
  assert.equal(s.gedeeldZet({ dicht: true, wie: 'eigenaar' }).dicht, true);
  assert.match(s.overzicht().uitleg, /is dicht/);
  assert.equal(s.gedeeldZet({ dicht: false, wie: 'eigenaar' }).dicht, false, 'weer open kan altijd');
});

test('3b. de wacht: dicht en productie houden gedeeld buiten, eigen komt binnen', async () => {
  const vorig = { s: process.env.RTG_DOOS_SLEUTEL, n: process.env.NODE_ENV };
  process.env.RTG_DOOS_SLEUTEL = GEDEELD;
  try {
    const db = { data: {}, writable: true };
    const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save: () => {} });
    const s = require('../server/kern/zaakdoos/sleutels').doosSleutelsVan({ db, save: () => {}, crypto, bewerkCollectie });
    const eigenSleutel = (await s.geef({ doos: 'doos-q', zaak: 'KIKUNOI', door: 'k' })).sleutel;
    const wacht = require('../server/routes/doos-wacht')({ crypto, register: () => s, beveilig: null, noteerAfketser: () => {} });
    const roep = (koppen, familie) => {
      const uit = { status: 200, body: null };
      const res = { status(c) { uit.status = c; return this; }, json(b) { uit.body = b; return this; } };
      const req = { ip: '10.0.0.' + Math.floor(Math.random() * 200), body: {}, get: (k) => koppen[k] };
      return { door: wacht(req, res, familie || 'meting'), uit, req };
    };
    assert.equal(roep({ 'x-doos-sleutel': GEDEELD, 'x-doos-id': 'doos-q' }).door, true, 'open: de gedeelde sleutel werkt');
    process.env.NODE_ENV = 'production';
    const p = roep({ 'x-doos-sleutel': GEDEELD });
    assert.equal(p.door, false, 'productie: gedeeld opent niets');
    assert.equal(p.uit.status, 403);
    const pe = roep(eigen('doos-q', eigenSleutel));
    assert.equal(pe.door, true, 'een eigen sleutel werkt in productie');
    assert.equal(pe.req.doosZaak, 'KIKUNOI');
    if (vorig.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = vorig.n;
    db.data.doosGedeeldGezien = {};
    assert.equal(s.gedeeldZet({ dicht: true, wie: 'eigenaar' }).dicht, true);
    const g = roep({ 'x-doos-sleutel': GEDEELD, 'x-doos-id': 'doos-q' });
    assert.equal(g.door, false);
    assert.match(g.uit.body.error, /eigen sleutel nodig/, 'de doos hoort waarom');
    const e = roep(eigen('doos-q', eigenSleutel), 'kloon');
    assert.equal(e.door, true, 'een eigen sleutel komt gewoon binnen');
    assert.equal(e.req.doosBewezen, 'doos-q');
  } finally {
    if (vorig.s === undefined) delete process.env.RTG_DOOS_SLEUTEL; else process.env.RTG_DOOS_SLEUTEL = vorig.s;
    if (vorig.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = vorig.n;
  }
});

test('4. constante tijd: timingSafeEqual over gelijke lengtes', async () => {
  const gezien = [];
  const tel = Object.assign(Object.create(crypto), { timingSafeEqual: (a, b) => { gezien.push([a.length, b.length]); return crypto.timingSafeEqual(a, b); } });
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save: () => {} });
  const s = maakDoosSleutels({ db, save: () => {}, crypto: tel, bewerkCollectie });
  const r = await s.geef({ doos: 'doos-t', zaak: 'KIKUNOI', door: 'k' });
  assert.ok(s.welke('doos-t', r.sleutel, 'meting'));
  assert.equal(s.welke('doos-t', 'ZD.' + 'F'.repeat(32), 'meting'), null);
  assert.deepEqual(gezien, [[32, 32], [32, 32]], 'twee keer 32 bytes');
  const vorig = process.env.RTG_DOOS_SLEUTEL;
  process.env.RTG_DOOS_SLEUTEL = GEDEELD;
  try {
    gezien.length = 0;
    const wacht = require('../server/routes/doos-wacht')({ crypto: tel, register: () => s, beveilig: null, noteerAfketser: () => {} });
    const res = { status() { return this; }, json() { return this; } };
    assert.equal(wacht({ ip: '10.9.9.9', body: {}, get: k => ({ 'x-doos-sleutel': 'kort' })[k] }, res, 'meting'), false);
    assert.deepEqual(gezien, [[32, 32]], 'gedeeld: als hash, ook bij andere lengte');
  } finally { if (vorig === undefined) delete process.env.RTG_DOOS_SLEUTEL; else process.env.RTG_DOOS_SLEUTEL = vorig; }
});

