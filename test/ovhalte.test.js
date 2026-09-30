/* OV: halte in plaats van punt, een jaar (NAVIGATIE.md N17).

   Het tarief heeft een AFSTAND nodig en geen punt. Tijdens de rit mag het
   instappunt bestaan (N11), maar wat er na het uitchecken van de rit overblijft
   is instaphalte, uitstaphalte, afstand en prijs -- een jaar, eerder weg via
   de vergeetroute. In-process: kern/ov is een gewone fabriek, dus geen server.

   De referentieprijs PRIJS_VOOR_N17 is gemeten op de code van VOOR deze
   wijziging (commit e7abd94bc), met exact dezelfde rit hieronder: instap bij
   een bus die NIET op een halte staat, uitstap met de eigen GPS van het lid.
   Het tarief mag door het besluit niet veranderen. Draai los:
   node --test test/ovhalte.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { haversine, etaMinutes } = require('../server/lib/geo');
const { maakOv } = require('../server/kern/ov');

const PRIJS_VOOR_N17 = 235;   // centen, gemeten op e7abd94bc
const KM_VOOR_N17 = 2.5;

const BUS = { lat: 38.9052, lng: 1.4285 };      // ~400 m van halte Ibiza-stad
const UITSTAP = { lat: 38.9148, lng: 1.4547 };  // eigen GPS van het lid, bij Talamanca

function wereld(ritten) {
  const db = { data: {
    suppliers: [{ code: 'OVT', name: 'Proef OV', type: 'ov', city: 'Ibiza', lijnen: [
      { id: 'L1', soort: 'bus', naam: 'Kustlijn 1', frequentieMin: 12, tarief: { basis: 180, perKm: 22 },
        haltes: [
          { id: 'h-air', naam: 'Aeroport', lat: 38.873, lng: 1.373 },
          { id: 'h-stad', naam: 'Ibiza-stad', lat: 38.908, lng: 1.432 },
          { id: 'h-mar', naam: 'Marina Botafoch', lat: 38.918, lng: 1.449 },
          { id: 'h-tal', naam: 'Talamanca', lat: 38.915, lng: 1.455 }] }] }],
    ovVoertuigen: [], ovRitten: ritten || [] } };
  const pay = { saldoVan: () => 1e6, laadOp: async () => ({ ok: true }), boekAsync: async () => ({ ok: true }) };
  // de incheckcode leeft sinds #403 in een collectietransactie; hier een in het geheugen
  const bewerkCollectie = async (naam, werk) => werk(db.data[naam] || (db.data[naam] = {}));
  const ov = maakOv({ db, save: () => {}, crypto, bewerkCollectie, schoon: (s) => String(s || ''), codenaamVan: k => 'cn-' + k,
    haversine, etaMinutes, pay, notify: () => {} });
  return { db, ov };
}
const bus = (db) => db.data.ovVoertuigen.push({ id: 'v1', code: 'OVT', lijnId: 'L1', soort: 'bus',
  naam: 'Bus 1', ...BUS, at: new Date().toISOString() });
const puntIn = (o) => /"(lat|lng)"\s*:/.test(JSON.stringify(o));

test('1. na in- en uitchecken staat er halte naar halte, afstand en prijs -- en geen punt', async () => {
  const { db, ov } = wereld();
  bus(db);
  const inch = ov.ovHierIn('user-1', BUS);
  assert.equal(inch.status, 200);
  // ZAKT OP: `in: { lat: voertuig.lat, lng: voertuig.lng, at }` terug in ritStart
  assert.equal(puntIn(db.data.ovRitten[0].in), false, 'ook tijdens de rit staat het instappunt niet in de opslag');
  const uit = await ov.ovCheckUit('user-1', UITSTAP, 'x1');
  assert.equal(uit.status, 200);
  const rit = db.data.ovRitten[0];
  // ZAKT OP: `rit.uit = { ...uitPunt, at: nu() }` terug in checkUit
  assert.equal(puntIn(rit), false, 'geen lat/lng in in of uit: ' + JSON.stringify(rit));
  // ZAKT OP: halteBij() die `{ halte: null }` geeft, of de halte weglaten uit in/uit
  assert.equal(rit.in.halte, 'Ibiza-stad');
  assert.equal(rit.in.halteId, 'h-stad');
  assert.equal(rit.uit.halte, 'Talamanca');
  assert.equal(rit.km, KM_VOOR_N17);
  // ZAKT OP: `at` weglaten uit de rit in ritStart (dan ziet de bewaarveger geen datum)
  assert.ok(rit.at && rit.at === rit.in.at, 'de datum bovenaan is die van het inchecken (bewaarveger)');
  const beeld = ov.ovMijn('user-1').ritten[0];
  assert.equal(beeld.van, 'Ibiza-stad');
  assert.equal(beeld.naar, 'Talamanca');
});

test('2. het tarief is niet veranderd: dezelfde rit kost wat hij voor N17 kostte', async () => {
  const { db, ov } = wereld();
  bus(db);
  ov.ovHierIn('user-1', BUS);
  const uit = await ov.ovCheckUit('user-1', UITSTAP, 'x2');
  /* ZAKT OP: rekenen vanaf de instapHALTE in plaats van het instappunt uit het
     geheugen (inPuntVan zonder inPunten): dan wordt het 226 en 2,1 km. */
  assert.equal(uit.prijs, PRIJS_VOOR_N17);
  assert.equal(uit.km, KM_VOOR_N17);
  assert.equal(db.data.ovRitten[0].prijs, PRIJS_VOOR_N17);
});

test('3. na een herstart rekent een lopende rit vanaf de instaphalte, zonder punt te verzinnen', async () => {
  const { db, ov } = wereld();
  bus(db);
  ov.ovHierIn('user-1', BUS);
  // "herstart": een nieuwe fabriek op dezelfde ritten; het geheugen is leeg
  const na = wereld(db.data.ovRitten);
  bus(na.db);
  const ov2 = na.ov;
  const uit = await ov2.ovCheckUit('user-1', UITSTAP, 'x3');
  assert.equal(uit.status, 200);
  // ZAKT OP: inPuntVan zonder terugval op de halte (dan km 0 en de basisprijs 180)
  const verwacht = Math.round(180 + Math.round(haversine({ lat: 38.908, lng: 1.432 }, UITSTAP) / 100) / 10 * 22);
  assert.ok(Math.abs(uit.prijs - verwacht) <= 3, 'rekent vanaf de halte: ' + uit.prijs + ' ~ ' + verwacht);
  assert.ok(uit.km > 2);
});

test('4. ritten van voor N17 verliezen hun punten bij het opstarten; een lopende rit houdt zijn tarief', async () => {
  const oud = [
    { id: 'rt-a', key: 'user-2', code: 'OVT', lijnId: 'L1', soort: 'bus', voertuigId: 'v1', status: 'uit',
      in: { ...BUS, at: '2026-09-01T10:00:00.000Z' }, uit: { ...UITSTAP, at: '2026-09-01T10:20:00.000Z' }, prijs: 235, km: 2.5 },
    { id: 'rt-b', key: 'user-3', code: 'OVT', lijnId: 'L1', soort: 'bus', voertuigId: 'v1', status: 'in',
      in: { ...BUS, at: new Date().toISOString() }, uit: null, prijs: null }
  ];
  const { db, ov } = wereld(oud);
  // ZAKT OP: puntenWeg() niet aanroepen bij het opstarten
  assert.equal(puntIn(db.data.ovRitten), false, JSON.stringify(db.data.ovRitten));
  assert.equal(db.data.ovRitten[0].in.halte, 'Ibiza-stad');
  assert.equal(db.data.ovRitten[0].uit.halte, 'Talamanca');
  assert.equal(db.data.ovRitten[0].at, '2026-09-01T10:00:00.000Z');
  const uit = await ov.ovCheckUit('user-3', UITSTAP, 'x4');
  // ZAKT OP: het punt van de lopende rit niet in het geheugen overnemen bij het omzetten
  assert.equal(uit.prijs, PRIJS_VOOR_N17);
});

test('5. een jaar: het bewaarbeleid kent ovRitten en de veger haalt een oude rit weg', () => {
  const { BELEID, veeg } = require('../server/bewaartermijnen');
  const regel = BELEID.find(r => r.tak === 'ovRitten');
  // ZAKT OP: de regel uit server/bewaarbeleid-vervoer.js halen, of de spread in bewaarbeleid.js
  assert.ok(regel, 'ovRitten staat in het bewaarbeleid');
  assert.equal(regel.dagen, 365);
  const oud = new Date(Date.now() - 366 * 86400000).toISOString();
  const vers = new Date(Date.now() - 300 * 86400000).toISOString();
  const db = { data: { ovRitten: [{ id: 'o', key: 'user-1', at: oud }, { id: 'v', key: 'user-1', at: vers }] } };
  veeg(db, { echt: true });
  assert.deepEqual(db.data.ovRitten.map(r => r.id), ['v']);
});

test('6. de vergeetroute neemt de OV-ritten van het lid mee, en alleen die', () => {
  const db = { data: { cvs: {}, live: {}, posts: [], notifications: {},
    ovRitten: [{ id: 'a', key: 'user-7' }, { id: 'b', key: 'user-70' }, { id: 'c', key: 'user-7' }] } };
  const { wisEigen } = require('../server/kern/vergeten/eigen')({ db, lidBoardLogWis: null });
  wisEigen('user-7', () => {}, [], 'cn-7');
  // ZAKT OP: de ovRitten-regel in kern/vergeten/eigen.js weghalen
  assert.deepEqual(db.data.ovRitten.map(r => r.id), ['b']);
});
