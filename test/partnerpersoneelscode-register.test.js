/* De personeelscode van het partnerkanaal zonder server (B14,
   partnerkanaal.personeels_en_partnercode): 128 bits, hash-only, onderwerp en
   doel, verval, een maximum aantal boekingen dat atomair wordt verbruikt, roteren
   en intrekken, een oude zelfgekozen code opent niets, en zoeken in constante
   tijd over ALLE rijen. De server-kant: test/partnerpersoneelscode.test.js.
   Draai los: node --test test/partnerpersoneelscode-register.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const K = require('../server/kern/partnerpersoneelscode');

const VORM = /^PK\.[0-9A-F]{32}$/;
function register(nu, cr) {
  const db = { data: { partners: [
    { code: 'ATLAS', name: 'Atlas', staff: { serviceRate: 0.02, code: 'ATLAS-TEAM' } },
    { code: 'NOVA', name: 'Nova' }
  ] }, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save: () => {} });
  const s = K.maakPersoneelscodes({ db, crypto: cr || crypto, bewerkCollectie, nu,
    zoekPartner: code => db.data.partners.find(p => p.code === code) || null });
  return { db, s };
}

test('1. uitgeven: 128 bits, alleen de hash, onderwerp, verval en een mens op naam', async () => {
  let t = Date.parse('2026-09-29T09:00:00Z');
  const { db, s } = register(() => t);
  assert.equal((await s.geef({ partner: 'ATLAS' })).status, 403, 'geen uitgever, geen code');
  assert.equal((await s.geef({ partner: 'NOVA', door: 'k' })).status, 409, 'geen personeelskanaal');
  assert.equal((await s.geef({ partner: 'NIEMAND', door: 'k' })).status, 404);
  assert.equal((await s.geef({ partner: 'ATLAS', door: 'k', dagen: K.MAX_DAGEN + 1 })).status, 400);
  assert.equal((await s.geef({ partner: 'ATLAS', door: 'k', maxGebruik: 0 })).status, 400);
  const r = await s.geef({ partner: 'atlas', label: 'nr 12', dagen: 10, maxGebruik: 2, door: 'kantoor:toets' });
  assert.match(r.code, VORM);
  assert.equal(r.partner, 'ATLAS');
  assert.equal(r.max_gebruik, 2);
  const opslag = JSON.stringify(db.data[K.COLLECTIE]);
  assert.ok(!opslag.includes(r.code.slice(3)), 'alleen een hash in de opslag');
  const rij = db.data[K.COLLECTIE][r.id];
  assert.equal(rij.toegang.issuer, K.ISSUER);
  assert.equal(rij.toegang.doel, K.DOEL);
  assert.deepEqual(rij.toegang.scope, K.SCOPE.slice());
  assert.deepEqual(rij.toegang.onderwerp, { partner: 'ATLAS', medewerker: r.id });
  const v = s.welke(r.code.toLowerCase());
  assert.equal(v.partner.code, 'ATLAS');
  assert.equal(v.resterend, 2, 'tonen verbruikt niets');
  assert.equal(s.welke(r.code).resterend, 2);
  t += 11 * 86400000;
  assert.equal(s.welke(r.code), null, 'na tien dagen verlopen');
  assert.equal(await s.claim(r.code), null, 'en een verlopen code boekt niet');
});

test('2. een boeking verbruikt precies een gebruik, en opgebruikt is dicht', async () => {
  const { s } = register();
  const r = await s.geef({ partner: 'ATLAS', maxGebruik: 2, door: 'k' });
  const c1 = await s.claim(r.code);
  assert.equal(c1.partner.code, 'ATLAS');
  assert.equal(c1.id, r.id);
  assert.equal(s.welke(r.code).resterend, 1);
  assert.ok(await s.claim(r.code));
  assert.equal(await s.claim(r.code), null, 'het derde gebruik bestaat niet');
  assert.equal(s.welke(r.code), null);
  assert.equal(s.lijst('ATLAS')[0].stand, 'opgebruikt');
});

test('3. een oude, zelfgekozen code en de partnercode openen niets', async () => {
  const { s } = register();
  await s.geef({ partner: 'ATLAS', door: 'k' });
  for (const oud of ['ATLAS-TEAM', 'ATLAS', 'atlas', 'PK.' + '0'.repeat(32), '', null])
    assert.equal(s.welke(oud), null, 'opent niets: ' + oud);
  assert.equal(await s.claim('ATLAS-TEAM'), null);
});

test('4. roteren trekt de vorige in, intrekken sluit, en het onderwerp moet kloppen', async () => {
  const { db, s } = register();
  const r = await s.geef({ partner: 'ATLAS', door: 'k' });
  assert.equal((await s.roteer({ id: r.id })).status, 403, 'roteren doet een mens op naam');
  assert.equal((await s.roteer({ id: 'pm_' + '0'.repeat(16), door: 'k' })).status, 404);
  const n = await s.roteer({ id: r.id, door: 'k' });
  assert.match(n.code, VORM);
  assert.notEqual(n.code, r.code);
  assert.equal(n.rotatie, 2);
  assert.equal(s.welke(r.code), null, 'de oude opent niets meer');
  assert.ok(s.welke(n.code));
  const w = await s.trekIn({ id: r.id, door: 'k', reden: 'uit dienst' });
  assert.equal(w.ingetrokken, true);
  assert.equal(s.welke(n.code), null);
  assert.equal((await s.trekIn({ id: r.id, door: 'k' })).ingetrokken, false, 'een tweede keer verandert niets');
  // een rij waarvan het onderwerp niet bij de plek past, opent niets
  const x = await s.geef({ partner: 'ATLAS', door: 'k' });
  db.data[K.COLLECTIE][x.id].toegang.onderwerp.partner = 'NOVA';
  assert.equal(s.welke(x.code), null);
  // een partner die zijn personeelskanaal verliest, sluit al zijn codes
  const y = await s.geef({ partner: 'ATLAS', door: 'k' });
  delete db.data.partners[0].staff;
  assert.equal(s.welke(y.code), null);
  assert.equal(await s.claim(y.code), null);
});

test('5. het overzicht draagt nooit een code of een hash', async () => {
  const { s } = register();
  const r = await s.geef({ partner: 'ATLAS', label: 'balie', door: 'k' });
  const l = s.lijst('ATLAS');
  assert.equal(l.length, 1);
  assert.equal(l[0].id, r.id);
  assert.equal(l[0].geldig, true);
  const tekst = JSON.stringify(l);
  assert.ok(!tekst.includes(r.code.slice(3)), 'geen code');
  assert.ok(!/code_hash|[0-9a-f]{64}/.test(tekst), 'geen hash');
  assert.deepEqual(s.lijst('NOVA'), []);
});

test('6. constante tijd: elke rij wordt vergeleken, met timingSafeEqual over 32 bytes', async () => {
  const gezien = [];
  const tel = Object.assign(Object.create(crypto), { timingSafeEqual: (a, b) => { gezien.push([a.length, b.length]); return crypto.timingSafeEqual(a, b); } });
  const { s } = register(undefined, tel);
  const a = await s.geef({ partner: 'ATLAS', door: 'k' });
  await s.geef({ partner: 'ATLAS', door: 'k' });
  await s.geef({ partner: 'ATLAS', door: 'k' });
  gezien.length = 0;
  assert.ok(s.welke(a.code));
  assert.deepEqual(gezien, [[32, 32], [32, 32], [32, 32]], 'alle drie de rijen, ook na de treffer');
  gezien.length = 0;
  assert.ok(await s.claim(a.code));
  assert.equal(gezien.length, 3, 'de claim zoekt ook over alle rijen');
});
