/* De cadeaukaartcode (pay.giftcard_value_code), control voor control:
   entropie en kale code eenmaal, hash-only, issuer/doel/scope, vervaldatum,
   max_gebruik, intrekken en roteren, constant-time zoeken, de atomaire claim
   met idempotentie, en de migratie van oude 24-bitcodes met behoud van waarde.
   De routes tegen een echte server staan in test/giftcard-routes.test.js, de
   raceproef over twee instances in test/giftcard-credential.pg.test.js.

   Draai los: node --test test/giftcard-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const DAG = 86400000;

function wereld(data) {
  let klok = T0;
  const sleutels = [];
  const db = { data: Object.assign({ giftcards: [] }, data), writable: true };
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const bewerkCollectie = (s, werk) => { sleutels.push(s); return basis(s, werk); };
  const kern = require('../server/kern/cadeaukaart')({ db, bewerkCollectie, crypto,
    nu: () => new Date(klok).toISOString() });
  const koop = (extra) => kern.uitgeef(Object.assign({ supplierCode: 'ZAAK', supplierName: 'De Zaak',
    bedrag: 100, kocht: 'Kobalt', customerKey: 'lid-1', issuer: 'rtg.lid.cadeaukaart' }, extra));
  const inwissel = (code, bedrag, extra) => kern.verzilver(Object.assign({ supplierCode: 'ZAAK', code,
    bedrag, actor: 'kassa' }, extra));
  return { db, kern, koop, inwissel, sleutels, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, de kale code een keer, en op schijf alleen de hash', async () => {
  const w = wereld();
  const r = await w.koop();
  assert.equal(r.eenmalig, true);
  assert.match(r.code, /^GC(-[0-9A-F]{4}){8}$/, '32 hexcijfers = randomBytes(16)');
  const opslag = JSON.stringify(w.db.data.giftcards);
  const geheim = r.code.replace(/-/g, '').slice(2);
  assert.equal(opslag.includes(geheim), false, 'het geheime deel staat nergens in de collectie');
  const kaart = w.db.data.giftcards[0];
  assert.match(kaart.toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal('code' in kaart, false);
  const mijn = JSON.stringify(await w.kern.mijn('lid-1'));
  assert.equal(mijn.includes(geheim) || mijn.includes(kaart.toegang.code_hash), false, 'het overzicht draagt code noch hash');
  assert.notEqual((await w.koop()).code, r.code);
});

test('2. issuer, doel en scope: de code geldt bij EEN zaak voor EEN handeling', async () => {
  const w = wereld();
  const { code } = await w.koop();
  const t = w.db.data.giftcards[0].toegang;
  assert.equal(t.issuer, 'rtg.lid.cadeaukaart');
  assert.equal(t.doel, 'cadeaukaart-saldo');
  assert.deepEqual(t.scope, ['kassa.cadeaukaart.verzilveren']);
  assert.deepEqual(t.onderwerp, { soort: 'cadeaukaart', id: w.db.data.giftcards[0].id, supplierCode: 'ZAAK' });
  assert.equal((await w.inwissel(code, 1, { supplierCode: 'ANDER' })).status, 404, 'een andere zaak kent hem niet');
  t.doel = 'iets-anders';
  assert.equal((await w.inwissel(code, 1)).status, 409);
  t.doel = 'cadeaukaart-saldo'; t.onderwerp.supplierCode = 'ANDER';
  assert.equal((await w.inwissel(code, 1)).status, 404, 'een onderwerp van een andere zaak opent niets');
});

test('3. issued_at en expires_at: na een jaar is de kaart verlopen', async () => {
  const w = wereld();
  const { code } = await w.koop();
  const t = w.db.data.giftcards[0].toegang;
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 365 * DAG);
  w.schuif(366 * DAG);
  assert.equal((await w.inwissel(code, 1)).status, 410);
  assert.equal(w.db.data.giftcards[0].saldo, 100);
});

test('4. max_gebruik, gebruik en het saldo als grens', async () => {
  const w = wereld();
  const { code } = await w.koop();
  assert.equal((await w.inwissel(code, 30)).kaart.saldo, 70);
  assert.equal(w.db.data.giftcards[0].toegang.gebruik, 1);
  assert.equal((await w.inwissel(code, 71)).status, 409, 'nooit meer dan erop staat');
  assert.equal((await w.inwissel(code, 0)).status, 400);
  w.db.data.giftcards[0].toegang.max_gebruik = 1;
  assert.equal((await w.inwissel(code, 1)).status, 409, 'opgebruikt');
  assert.equal(w.db.data.giftcards[0].saldo, 70);
});

test('5. server-side intrekken en roteren: de oude code opent niets meer', async () => {
  const w = wereld();
  const { code, kaart } = await w.koop();
  await w.inwissel(code, 10);
  const vind = g => g.id === kaart.id;
  assert.equal((await w.kern.roteer({ vind, door: 'lid:K' })).status, 400, 'roteren vraagt een sleutel');
  assert.equal((await w.kern.roteer({ vind: () => false, door: 'lid:K', idem: 'r1' })).status, 404);
  const rot = await w.kern.roteer({ vind, door: 'lid:K', idem: 'r1' });
  assert.equal(rot.ok, true);
  assert.notEqual(rot.code, code);
  assert.equal((await w.kern.roteer({ vind, door: 'lid:K', idem: 'r1' })).code, undefined, 'dezelfde sleutel: geen tweede code');
  assert.equal((await w.inwissel(code, 1)).status, 409, 'de oude code is vervangen');
  assert.equal(w.db.data.giftcards[0].toegang.gebruik, 1, 'de teller reist mee');
  assert.equal((await w.inwissel(rot.code, 5)).kaart.saldo, 85);
  await w.kern.intrek({ vind, door: 'zaak:ZAAK' });
  const toen = w.db.data.giftcards[0].toegang.ingetrokken_at;
  w.schuif(1000);
  await w.kern.intrek({ vind, door: 'zaak:ZAAK' });
  assert.equal(w.db.data.giftcards[0].toegang.ingetrokken_at, toen, 'een tweede intrekking verandert niets');
  assert.equal((await w.inwissel(rot.code, 1)).status, 409, 'ingetrokken');
  assert.equal(w.db.data.giftcards[0].saldo, 85, 'het saldo blijft van de houder');
});

test('6. constant-time: elke hash, ook na een treffer, zonder vroege uitgang', async () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'cadeaukaart.js'), 'utf8');
  const lus = bron.slice(bron.indexOf('for (const x of bron)'), bron.indexOf('if (!g && oud'));
  assert.ok(lus.length > 40);
  assert.match(lus, /bearer\.zelfdeHash\(/);
  assert.doesNotMatch(lus, /\b(return|break)\b/);
  assert.doesNotMatch(lus, /===\s*gezocht|gezocht\s*===/);
  const w = wereld();
  for (let i = 0; i < 40; i++) await w.koop({ customerKey: 'x' + i });
  const { code } = await w.koop();
  assert.equal((await w.inwissel(code, 1)).ok, true);
});

test('7. de claim is een collectietransactie en een herhaling boekt niet twee keer', async () => {
  const w = wereld();
  const { code } = await w.koop();
  w.sleutels.length = 0;
  const [a, b] = await Promise.all([w.inwissel(code, 100), w.inwissel(code, 100)]);
  assert.deepEqual([a.ok, b.status].sort(), [409, true].sort());
  assert.deepEqual([...new Set(w.sleutels)], ['giftcards'], 'alles in de transactie op giftcards');
  const w2 = wereld();
  const k2 = await w2.koop();
  const een = await w2.inwissel(k2.code, 40, { idem: 'bon-1', viaBon: 'B1' });
  const twee = await w2.inwissel(k2.code, 40, { idem: 'bon-1', viaBon: 'B2' });
  assert.equal(twee.herhaald, true);
  assert.equal(twee.verzilvering.viaBon, 'B1', 'de eerste bon komt terug');
  assert.equal(w2.db.data.giftcards[0].saldo, 60, 'EEN keer afgeboekt');
  assert.equal((await w2.inwissel(k2.code, 41, { idem: 'bon-1' })).status, 409, 'andere som, zelfde sleutel');
  assert.equal(een.ok, true);
  const h = await w2.koop({ idem: 'koop-1' });
  const h2 = await w2.koop({ idem: 'koop-1' });
  assert.equal(h2.herhaald, true);
  assert.equal(h2.code, undefined, 'een herhaalde uitgifte toont geen code');
  assert.equal(h2.kaart.id, h.kaart.id);
});

test('8. oude 24-bitcodes: gehasht met behoud van waarde, en uit bon en idem-antwoord', async () => {
  const oud = 'RTG-GC-A1B2C3';
  const w = wereld({
    giftcards: [{ code: oud, supplierCode: 'ZAAK', supplierName: 'De Zaak', bedrag: 50, saldo: 30,
      customerKey: null, at: '2025-01-01T00:00:00.000Z', verzilveringen: [{ bedrag: 20, at: '2025-02-01T00:00:00.000Z' }] }],
    posSales: { ZAAK: [{ id: 'B0', method: 'cadeaukaart', kaartCode: oud, gcCode: oud }] },
    kassaIdem: { _keys: ['a', 'b'], a: { ok: true, kaart: { code: oud, saldo: 50 } },
      b: { ok: true, sale: { gcCode: oud, kaartCode: oud } } }
  });
  await w.kern.zorg();
  const alles = JSON.stringify([w.db.data.giftcards, w.db.data.posSales, w.db.data.kassaIdem]);
  assert.equal(alles.includes('A1B2C3'), false, 'de kale code staat nergens meer');
  const k = w.db.data.giftcards[0];
  assert.equal(k.legacy24, true);
  assert.ok(Date.parse(k.toegang.expires_at) >= T0 + 365 * DAG, 'minstens een jaar na de migratie');
  assert.equal(k.toegang.gebruik, 1);
  assert.equal(w.db.data.posSales.ZAAK[0].kaartId, k.id);
  assert.equal(w.db.data.kassaIdem.b.sale.kaartId, k.id);
  assert.equal((await w.inwissel('rtg-gc-a1b2c3', 30)).kaart.saldo, 0, 'de houder betaalt met wat hij had');
  const voor = JSON.stringify(w.db.data);
  await w.kern.migreer();
  assert.equal(JSON.stringify(w.db.data), voor, 'een tweede ronde verandert niets');
});
