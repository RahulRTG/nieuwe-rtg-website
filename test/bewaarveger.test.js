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
  const tot = new Map();       // id -> ms tot wanneer het lidmaatschap betaald is
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
    lidmaatschapTot: (id) => tot.get(id) || 0,
    nu: () => tijd
  });
  return { db, v, users, states, gewist, tot, tik: (ms) => { tijd += ms; }, savesGedaan: () => saves };
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

test('gratis app (nooit een termijn): de jaartermijn na de goedkeuring geldt, dan weg', () => {
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

test('verlengen verlengt: zolang de pas betaald doorloopt blijft het bewijs staan', () => {
  const { v, users, states, gewist, tot, tik } = bouw();
  users.set(5, { id: 5, verified: 'verified', id_doc: '5-pas.bin' });
  states.set(5, { geverifieerdOp: new Date(T0).toISOString() });
  // twee jaar na de goedkeuring, maar de betaling dekt nog tot over een maand
  tot.set(5, T0 + 760 * DAG);
  tik(2 * 366 * DAG);
  assert.equal(v.veeg().dossiers, 0, 'wie blijft verlengen, blijft zijn bewijs houden');
  assert.deepEqual(gewist, []);
});

test('relatie voorbij zonder verzoek: DIRECT wissen, geen jaar wachten', () => {
  const { v, users, states, gewist, tot, tik } = bouw();
  users.set(6, { id: 6, verified: 'verified', id_doc: '6-pas.bin' });
  states.set(6, { geverifieerdOp: new Date(T0).toISOString() });
  tot.set(6, T0 + 30 * DAG);          // betaald tot over een maand
  tik(29 * DAG);
  assert.equal(v.veeg().dossiers, 0, 'zolang de dekking loopt: blijven staan');
  tik(2 * DAG);                        // de dekking is net voorbij
  assert.equal(v.veeg().dossiers, 1, 'de dag na het einde is het bewijs weg');
  assert.deepEqual(gewist, [6]);
});

test('relatie voorbij MET vastgelegd verzoek: nog een jaar, en dan alsnog weg', () => {
  const { v, users, states, gewist, tot, tik } = bouw();
  users.set(8, { id: 8, verified: 'verified', id_doc: '8-pas.bin' });
  states.set(8, { geverifieerdOp: new Date(T0).toISOString(),
    bewaarVerzoek: { at: new Date(T0).toISOString(), reden: 'lopend geschil over een boeking', door: 'eigenaar' } });
  tot.set(8, T0 + 30 * DAG);
  tik(200 * DAG);                      // ruim na het einde, binnen het extra jaar
  assert.equal(v.veeg().dossiers, 0, 'het verzoek houdt het dossier een jaar langer');
  assert.deepEqual(gewist, []);
  tik(200 * DAG);                      // nu voorbij einde + een jaar
  assert.equal(v.veeg().dossiers, 1, 'ook een verzoek loopt af');
  assert.deepEqual(gewist, [8]);
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
