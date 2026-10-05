/* Het gedeelde stroomticket (server/kern/stroomticket.js), regel voor regel:
   128 bits en alleen de hash, kort en eenmalig, binding aan het onderwerp, het
   plafond (weigeren of de oudste verdringen), de hercontrole bij openen, en
   een weigering van het domein die ongewijzigd terugkomt. De twee domeinen
   (gezinsstroom, lesstroom) hebben hun eigen toetsen; dit is de mechaniek.

   Draai los: node --test test/stroomticket.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ST = require('../server/kern/stroomticket');

function wereld(extra = {}) {
  let klok = Date.parse('2026-10-04T12:00:00.000Z');
  const nu = () => new Date(klok).toISOString();
  const bearer = require('../server/kern/bearercode')({ crypto, namespace: 'toets.stroom', nu });
  const db = {};
  // de semantiek van bewerkCollectie: een KOPIE die pas na afloop de collectie wordt
  const transactie = werk => { const k = JSON.parse(JSON.stringify(db)); const uit = werk(k);
    for (const x of Object.keys(db)) delete db[x]; Object.assign(db, k); return Promise.resolve(uit); };
  const st = ST(Object.assign({ bearer, nu, transactie, lees: (s, k) => s[k],
    schrijf: (s, k, rij) => { s[k] = rij; }, prefix: 'TST', issuer: 'toets', doel: 'toets-stroom',
    scope: ['toets.stroom'], geldigMs: 30000, maxOpen: 2 }, extra));
  return { st, db, schuif: ms => { klok += ms; } };
}
const ja = () => true;

test('1. uitgifte: 128 bits, alleen de hash, kort en eenmalig', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 'a', b: 'x' } }));
  assert.match(m.code, /^TST\.[0-9A-F]{32}$/);
  assert.equal(w.st.vorm(m.code), true);
  assert.equal(JSON.stringify(w.db).includes(m.code.slice(4)), false, 'nooit het ticket zelf');
  assert.equal(w.db.a[0].max_gebruik, 1);
  assert.equal(Date.parse(w.db.a[0].expires_at) - Date.parse(w.db.a[0].issued_at), 30000);
  const o = await w.st.claim('a', m.code, { hercontrole: ja });
  assert.deepEqual(o, { ok: true, onderwerp: { a: 'a', b: 'x' } });
  assert.deepEqual(await w.st.claim('a', m.code, { hercontrole: ja }), { ok: false, reden: 'onbekend' }, 'eenmalig');
  assert.deepEqual(w.db.a, [], 'en weg uit de opslag');
});

test('2. twee gelijktijdige claims: precies een opent', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 'a' } }));
  const uit = await Promise.all([w.st.claim('a', m.code, { hercontrole: ja }), w.st.claim('a', m.code, { hercontrole: ja })]);
  assert.equal(uit.filter(u => u.ok).length, 1);
});

test('3. binding: een ander onderwerp opent niets, en het ticket is daarna op', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 'a', kanaal: 'k1' } }));
  assert.deepEqual(await w.st.claim('a', m.code, { voor: () => ({ binding: { kanaal: 'k2' } }), hercontrole: ja }),
    { ok: false, reden: 'binding' });
  assert.equal((await w.st.claim('a', m.code, { voor: () => ({ binding: { kanaal: 'k1' } }), hercontrole: ja })).ok, false);
  const n = await w.st.geef('a', () => ({ onderwerp: { a: 'a' } }));
  assert.equal((await w.st.claim('b', n.code, { hercontrole: ja })).ok, false, 'een andere sleutel vindt hem niet');
});

test('4. hercontrole: wat eronder ligt moet nog leven', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 'a' } }));
  let gezien = null;
  const uit = await w.st.claim('a', m.code, { hercontrole: o => { gezien = o; return false; } });
  assert.deepEqual(uit, { ok: false, reden: 'hercontrole' });
  assert.deepEqual(gezien, { a: 'a' });
  assert.deepEqual(w.db.a, [], 'ook dan opgebruikt');
  await assert.rejects(w.st.claim('a', m.code, {}), /hercontrole/, 'een claim zonder hercontrole bestaat niet');
});

test('5. verloop: na de geldigheid niets meer, en opgeruimd', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 'a' } }));
  await w.st.geef('a', () => ({ onderwerp: { a: 'a' } }));
  w.schuif(30001);
  assert.deepEqual(await w.st.claim('a', m.code, { hercontrole: ja }), { ok: false, reden: 'verlopen' });
  assert.deepEqual(w.db.a, [], 'het verlopen buurticket ook');
});

test('6. plafond: weigeren per onderwerp, of de oudste per groep verdringen', async () => {
  const w = wereld();
  await w.st.geef('a', () => ({ onderwerp: {} }));
  await w.st.geef('a', () => ({ onderwerp: {} }));
  assert.deepEqual(await w.st.geef('a', () => ({ onderwerp: {} })), { vol: true });
  assert.equal(w.db.a.length, 2);
  assert.equal((await w.st.geef('b', () => ({ onderwerp: {} }))).ok, true, 'een ander onderwerp heeft een eigen plafond');
  const v = wereld({ bijVol: 'oudste', groep: o => o.p });
  const eerste = await v.st.geef('a', () => ({ onderwerp: { p: '1' } }));
  await v.st.geef('a', () => ({ onderwerp: { p: '1' } }));
  await v.st.geef('a', () => ({ onderwerp: { p: '2' } }));
  await v.st.geef('a', () => ({ onderwerp: { p: '1' } }));
  assert.deepEqual(v.db.a.map(t => t.onderwerp.p).sort(), ['1', '1', '2']);
  assert.equal((await v.st.claim('a', eerste.code, { hercontrole: ja })).ok, false, 'de oudste is verdrongen');
});

test('7. een weigering van het domein komt ongewijzigd terug, zonder ticket', async () => {
  const w = wereld();
  const NEE = Object.freeze({ status: 404 });
  assert.equal((await w.st.geef('a', () => ({ weiger: NEE }))).weiger, NEE);
  assert.equal(w.db.a, undefined);
  assert.equal((await w.st.claim('a', 'TST.' + '0'.repeat(32), { voor: () => ({ weiger: NEE }), hercontrole: ja })).weiger, NEE);
});

test('8. de soort moet kort en begrensd zijn', () => {
  assert.throws(() => wereld({ geldigMs: ST.MAX_GELDIG_MS + 1 }), /kort/);
  assert.throws(() => wereld({ maxOpen: 0 }), /plafond/);
  assert.throws(() => wereld({ bijVol: 'negeer' }), /bijVol/);
  assert.throws(() => wereld({ transactie: null }), /collectietransactie/);
});
