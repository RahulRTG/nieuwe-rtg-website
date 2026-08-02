/* De bewaarveger: de wisregels uit het papierwerkregister als code
   (server/bewaarveger.js). Elke regel heeft een eigen toets en is met een
   mutatie geverifieerd; de klok is geinjecteerd, dus niets slaapt echt.

   Draai los: node --experimental-sqlite --test test/bewaarveger.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBewaarveger } = require('../server/bewaarveger');

const DAG = 86400000;
const T0 = Date.parse('2026-08-02T12:00:00Z');

function bouw() {
  const db = { data: { live: {} } };
  const gewist = [];
  const users = new Map();     // id -> { id, verified, id_doc }
  const states = new Map();    // id -> md
  const accounts = {
    listByVerification: (st) => [...users.values()].filter(u => u.verified === st),
    getMemberState: (id) => states.get(id) || {},
    saveMemberState: (id, md) => states.set(id, md),
    setVerification: (id, st, doc) => { const u = users.get(id); u.verified = st; if (doc !== undefined) u.id_doc = doc; }
  };
  let tijd = T0, saves = 0;
  const v = maakBewaarveger({
    db, save: () => saves++, accounts,
    identiteitsmap: { wisAllesVan: (id) => gewist.push(id) },
    nu: () => tijd
  });
  return { db, v, users, states, gewist, tik: (ms) => { tijd += ms; }, savesGedaan: () => saves };
}

test('locatie: een spoor van acht dagen oud gaat weg, een vers spoor blijft', () => {
  const { db, v, tik } = bouw();
  db.data.live['user-1'] = { lat: 52.4, lng: 4.9, updatedAt: new Date(T0).toISOString() };
  db.data.live['user-2'] = { lat: 52.3, lng: 4.8, updatedAt: new Date(T0).toISOString() };
  tik(8 * DAG);
  db.data.live['user-2'].updatedAt = new Date(T0 + 8 * DAG - 3600000).toISOString(); // een uur geleden bijgewerkt
  const r = v.veeg();
  assert.equal(r.posities, 1, 'een spoor geveegd');
  assert.ok(!db.data.live['user-1'], 'het oude spoor is weg');
  assert.ok(db.data.live['user-2'], 'wie echt onderweg is behoudt zijn positie');
});

test('locatie: op dag zes blijft alles staan (de termijn is 7 dagen, geen 5)', () => {
  const { db, v, tik } = bouw();
  db.data.live['user-1'] = { updatedAt: new Date(T0).toISOString() };
  tik(6 * DAG);
  assert.equal(v.veeg().posities, 0);
  assert.ok(db.data.live['user-1']);
});

test('id-bewijs: een jaar na goedkeuring gaan scan en selfie de kluis uit, de uitkomst blijft', () => {
  const { v, users, states, gewist, tik } = bouw();
  users.set(7, { id: 7, verified: 'verified', id_doc: '7-pas.bin' });
  states.set(7, { selfie: '7-selfie.bin', nationaliteit: 'Nederlandse', geverifieerdOp: new Date(T0).toISOString() });
  tik(366 * DAG);
  const r = v.veeg();
  assert.equal(r.dossiers, 1);
  assert.deepEqual(gewist, [7], 'de identiteitsmap is voor dit account geveegd');
  assert.equal(users.get(7).id_doc, null, 'de documentverwijzing is weg');
  assert.equal(users.get(7).verified, 'verified', 'maar de UITKOMST blijft: het lid is en blijft geverifieerd');
  assert.ok(!states.get(7).selfie, 'de selfie-verwijzing is weg');
  assert.equal(states.get(7).nationaliteit, 'Nederlandse', 'en de vastgelegde uitkomstvelden blijven staan');
});

test('id-bewijs: binnen het jaar blijft alles staan', () => {
  const { v, users, states, gewist, tik } = bouw();
  users.set(7, { id: 7, verified: 'verified', id_doc: '7-pas.bin' });
  states.set(7, { geverifieerdOp: new Date(T0).toISOString() });
  tik(300 * DAG);
  assert.equal(v.veeg().dossiers, 0);
  assert.equal(users.get(7).id_doc, '7-pas.bin');
  assert.deepEqual(gewist, []);
});

test('klok-backfill: wie voor deze regel is goedgekeurd krijgt de datum van vandaag, niet een verzonnen verleden', () => {
  const { v, users, states, gewist, tik } = bouw();
  users.set(3, { id: 3, verified: 'verified', id_doc: '3-pas.bin' });
  states.set(3, {});                                  // goedgekeurd voor de regel bestond: geen datum
  const r1 = v.veeg();
  assert.equal(r1.klokGestart, 1, 'de klok is gestart');
  assert.equal(r1.dossiers, 0, 'en er is NIETS gewist: een verzonnen verleden wist op een moment dat niemand koos');
  assert.ok(states.get(3).geverifieerdOp, 'de datum staat er nu');
  tik(366 * DAG);
  assert.equal(v.veeg().dossiers, 1, 'een jaar na de klokstart gaat het bewijs alsnog netjes weg');
  assert.deepEqual(gewist, [3]);
});

test('afgewezen: het vangnet veegt restanten van een afwijzing, ongeacht leeftijd', () => {
  const { v, users, states, gewist } = bouw();
  users.set(9, { id: 9, verified: 'rejected', id_doc: '9-pas.bin' });
  states.set(9, { selfie: '9-selfie.bin' });
  const r = v.veeg();
  assert.equal(r.dossiers, 1);
  assert.deepEqual(gewist, [9]);
  assert.equal(users.get(9).id_doc, null);
});

test('idempotent: een al geveegd dossier wordt niet elke ronde opnieuw "geveegd"', () => {
  const { v, users, states, gewist, tik } = bouw();
  users.set(7, { id: 7, verified: 'verified', id_doc: '7-pas.bin' });
  states.set(7, { geverifieerdOp: new Date(T0).toISOString() });
  tik(366 * DAG);
  assert.equal(v.veeg().dossiers, 1, 'de eerste ronde veegt');
  const r2 = v.veeg();
  assert.equal(r2.dossiers, 0, 'de tweede ronde ziet een leeg dossier en raakt het niet aan');
  assert.equal(gewist.length, 1, 'de identiteitsmap is precies een keer geveegd, niet elk uur opnieuw');
});

test('een schone ronde bewaart niets en schrijft niets (geen save zonder reden)', () => {
  const { v, savesGedaan } = bouw();
  assert.deepEqual(v.veeg(), { posities: 0, dossiers: 0, klokGestart: 0 });
  assert.equal(savesGedaan(), 0, 'geen wijziging, geen schrijfactie');
});
