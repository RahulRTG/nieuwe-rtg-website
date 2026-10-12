/* HET STROOMTICKET TAK VOOR TAK (server/kern/stroomticket.js).

   Aanvulling op test/stroomticket.test.js. Wat dit bestand vasthoudt: elke
   weigering bij het samenstellen van een soort (bearer, transactie, lees en
   schrijf, maxGebruik), de standaardscope, de vorm-toets op rare invoer, een
   domein dat niets of geen lijst teruggeeft, een lege of ontbrekende code, een
   ingetrokken ticket, een ticket dat meermaals mag (Range-verzoeken van een
   <video>) en de binding die wel klopt. De klok is een vaste variabele. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ST = require('../server/kern/stroomticket');

function wereld(extra = {}) {
  let klok = Date.parse('2026-10-04T12:00:00.000Z');
  const nu = () => new Date(klok).toISOString();
  const bearer = require('../server/kern/bearercode')({ crypto, namespace: 'toets.stroomtak', nu });
  const db = {};
  const transactie = werk => { const k = JSON.parse(JSON.stringify(db)); const uit = werk(k);
    for (const x of Object.keys(db)) delete db[x]; Object.assign(db, k); return Promise.resolve(uit); };
  const opties = Object.assign({ bearer, nu, transactie, lees: (s, k) => s[k],
    schrijf: (s, k, rij) => { s[k] = rij; }, prefix: 'TAK', issuer: 'toets', doel: 'toets-stroomtak',
    scope: ['toets.stroomtak'], geldigMs: 30000, maxOpen: 3 }, extra);
  return { st: ST(opties), db, bearer, schuif: ms => { klok += ms; } };
}
const ja = () => true;

test('samenstellen: zonder volledige bearercode geen soort', () => {
  assert.throws(() => wereld({ bearer: null }), /bearercode/);
  assert.throws(() => wereld({ bearer: { maak() {}, vind() {} } }), /bearercode/);
  assert.throws(() => wereld({ bearer: { maak() {}, reden() {} } }), /bearercode/);
  assert.throws(() => wereld({ bearer: { vind() {}, reden() {} } }), /bearercode/);
});

test('samenstellen: lees en schrijf zijn verplicht, de geldigheid positief', () => {
  assert.throws(() => wereld({ lees: null }), /lees en schrijf/);
  assert.throws(() => wereld({ schrijf: 'nee' }), /lees en schrijf/);
  assert.throws(() => wereld({ geldigMs: 0 }), /kort/);
  assert.throws(() => wereld({ geldigMs: 'x' }), /kort/);
  assert.throws(() => wereld({ maxOpen: 1.5 }), /plafond/);
  assert.equal(wereld({ geldigMs: ST.MAX_GELDIG_MS }).st.GELDIG_MS, ST.MAX_GELDIG_MS);
});

test('samenstellen: maxGebruik is een geheel getal van 1 tot 1000', () => {
  for (const fout of [0, 1001, 2.5, '3', -1])
    assert.throws(() => wereld({ maxGebruik: fout }), /maxGebruik/, String(fout));
  assert.equal(wereld({ maxGebruik: 1000 }).st.MAX_OPEN, 3);
});

test('vorm: alleen voorvoegsel plus 32 hex, ongeacht spaties of kleine letters', () => {
  const { st } = wereld();
  assert.equal(st.vorm(' tak.' + 'a'.repeat(32) + ' '), true);
  assert.equal(st.vorm('TAK.' + 'G'.repeat(32)), false);
  assert.equal(st.vorm('ANDER.' + 'A'.repeat(32)), false);
  assert.equal(st.vorm(null), false);
  assert.equal(st.vorm(undefined), false);
});

test('levend: niets, ingetrokken of verlopen is niet levend', () => {
  const { st } = wereld();
  assert.equal(st.levend(null), false);
  assert.equal(st.levend({ expires_at: '2099-01-01T00:00:00Z' }), true);
  assert.equal(st.levend({ expires_at: '2099-01-01T00:00:00Z', ingetrokken_at: '2026-10-04T11:00:00Z' }), false);
  assert.equal(st.levend({ expires_at: '2020-01-01T00:00:00Z' }), false);
});

test('zonder scope: de soort krijgt een lege scope, en de bearercode weigert dan uit te geven', async () => {
  const w = wereld({ scope: undefined });
  await assert.rejects(async () => w.st.geef('a', () => ({ onderwerp: { a: 1 } })), /issuer, doel en scope/);
  assert.deepEqual(w.db, {}, 'er is niets geschreven');
  const v = wereld({ scope: 'toets.stroomtak' });
  const m = await v.st.geef('a', () => ({ onderwerp: { a: 1 } }));
  assert.deepEqual(v.db.a[0].scope, ['toets.stroomtak'], 'een losse scope wordt een lijst');
});

test('geef: een domein dat niets teruggeeft en een opslag die geen lijst is', async () => {
  const w = wereld({ lees: () => 'geen lijst' });
  const m = await w.st.geef('a', () => undefined);
  assert.equal(m.ok, true);
  assert.equal(w.db.a.length, 1);
  assert.deepEqual(w.db.a[0].onderwerp, {});
  /* Zonder onderwerp en zonder voor() bij de claim: een leeg onderwerp en geen binding. */
  const v = wereld();
  const n = await v.st.geef('a', () => null);
  assert.deepEqual(await v.st.claim('a', n.code, { hercontrole: ja }), { ok: true, onderwerp: {} });
});

test('geef met groep en plafond weigeren: alleen de eigen groep telt mee', async () => {
  const w = wereld({ maxOpen: 1, groep: o => o.p });
  assert.equal((await w.st.geef('a', () => ({ onderwerp: { p: '1' } }))).ok, true);
  assert.deepEqual(await w.st.geef('a', () => ({ onderwerp: { p: '1' } })), { vol: true });
  assert.equal((await w.st.geef('a', () => ({ onderwerp: { p: '2' } }))).ok, true);
  /* Zonder onderwerp valt de groep op een leeg object terug. */
  assert.equal((await w.st.geef('a', () => ({}))).ok, true);
  assert.deepEqual(await w.st.geef('a', () => ({})), { vol: true });
  assert.equal(w.db.a.length, 3);
});

test('claim: een lege, ontbrekende of onbekende code ruimt wel verlopen tickets op', async () => {
  const w = wereld();
  await w.st.geef('a', () => ({ onderwerp: {} }));
  w.schuif(30001);
  assert.deepEqual(await w.st.claim('a', null, { hercontrole: ja }), { ok: false, reden: 'onbekend' });
  assert.deepEqual(w.db.a, [], 'het verlopen ticket is weg');
  const v = wereld({ lees: () => null });
  assert.deepEqual(await v.st.claim('a', '   ', { hercontrole: ja }), { ok: false, reden: 'onbekend' });
  assert.deepEqual(await v.st.claim('a', 'TAK.' + 'F'.repeat(32), { voor: () => null, hercontrole: ja }),
    { ok: false, reden: 'onbekend' });
});

test('claim: een ingetrokken ticket opent niet en verdwijnt', async () => {
  const w = wereld();
  const m = await w.st.geef('a', () => ({ onderwerp: { a: 1 } }));
  w.db.a[0].ingetrokken_at = '2026-10-04T12:00:00.000Z';
  assert.deepEqual(await w.st.claim('a', m.code, { hercontrole: ja }), { ok: false, reden: 'ingetrokken' });
  assert.equal(w.db.a.length, 0);
  const n = await w.st.geef('a', () => ({ onderwerp: { a: 2 } }));
  assert.equal(w.db.a.length, 1);
  assert.equal((await w.st.claim('a', n.code, { hercontrole: ja })).ok, true);
});

test('maxGebruik 3: het ticket blijft staan tot zijn teller op is', async () => {
  const w = wereld({ maxGebruik: 3 });
  const m = await w.st.geef('v', () => ({ onderwerp: { les: 'L1' } }));
  assert.equal(w.db.v[0].max_gebruik, 3);
  for (let i = 1; i <= 3; i++) {
    const uit = await w.st.claim('v', m.code, { voor: () => ({ binding: { les: 'L1' } }), hercontrole: ja });
    assert.deepEqual(uit, { ok: true, onderwerp: { les: 'L1' } }, 'opening ' + i);
    assert.equal(w.db.v.length, i < 3 ? 1 : 0, 'na opening ' + i);
  }
  assert.deepEqual(await w.st.claim('v', m.code, { hercontrole: ja }), { ok: false, reden: 'onbekend' });
});

test('maxGebruik 2 met een binding die niet klopt: de poging telt toch', async () => {
  const w = wereld({ maxGebruik: 2 });
  const m = await w.st.geef('v', () => ({ onderwerp: { les: 'L1', klas: 'K' } }));
  assert.deepEqual(await w.st.claim('v', m.code, { voor: () => ({ binding: { les: 'L2' } }), hercontrole: ja }),
    { ok: false, reden: 'binding' });
  assert.equal(w.db.v[0].gebruik, 1);
  assert.deepEqual(await w.st.claim('v', m.code, { voor: () => ({ binding: { les: 'L1', klas: 'K' } }), hercontrole: ja }),
    { ok: true, onderwerp: { les: 'L1', klas: 'K' } });
  assert.deepEqual(w.db.v, []);
});

test('claim: een ticket van een ander doel heet verkeerd-doel', async () => {
  /* Beide soorten op dezelfde opslag: een ticket van soort b wordt bij soort a aangeboden. */
  const gedeeld = {};
  const tx = werk => Promise.resolve(werk(gedeeld));
  const crypto2 = require('node:crypto');
  const nu = () => '2026-10-04T12:00:00.000Z';
  const bearer = require('../server/kern/bearercode')({ crypto: crypto2, namespace: 'toets.stroomtak', nu });
  const basis = { bearer, nu, transactie: tx, lees: (s, k) => s[k], schrijf: (s, k, r) => { s[k] = r; },
    prefix: 'TAK', issuer: 'toets', scope: ['toets.stroomtak'], geldigMs: 30000, maxOpen: 3 };
  const soortA = ST({ ...basis, doel: 'doel-a' });
  const soortB = ST({ ...basis, doel: 'doel-b' });
  const m = await soortB.geef('x', () => ({ onderwerp: {} }));
  assert.deepEqual(await soortA.claim('x', m.code, { hercontrole: ja }), { ok: false, reden: 'verkeerd-doel' });
  assert.deepEqual(gedeeld.x, [], 'ook een verkeerd ticket verdwijnt');
});

test('bijVol oudste zonder groep: de oudste van de hele sleutel wijkt', async () => {
  const w = wereld({ bijVol: 'oudste', maxOpen: 2 });
  const eerste = await w.st.geef('g', () => ({ onderwerp: { n: 1 } }));
  await w.st.geef('g', () => ({ onderwerp: { n: 2 } }));
  await w.st.geef('g', () => ({ onderwerp: { n: 3 } }));
  assert.deepEqual(w.db.g.map(t => t.onderwerp.n), [2, 3]);
  assert.deepEqual(await w.st.claim('g', eerste.code, { hercontrole: ja }), { ok: false, reden: 'onbekend' });
  /* Een weigering bij de uitgifte schrijft niets weg. */
  const NEE = { status: 403 };
  assert.equal((await w.st.geef('g', () => ({ weiger: NEE }))).weiger, NEE);
  assert.equal(w.db.g.length, 2);
});

test('geef met verzegel: het onderwerp krijgt wat bij DIT ticket hoort, en null geeft geen ticket', async () => {
  const { st, db, bearer } = wereld();
  const m = await st.geef('k', () => ({ onderwerp: { a: 1 }, verzegel: h => ({ bij: h }) }));
  assert.equal(m.ok, true);
  assert.equal(db.k[0].onderwerp.bij, bearer.hash(m.code), 'de hash van het uitgegeven ticket zelf');
  assert.equal(db.k[0].onderwerp.a, 1);
  assert.deepEqual(await st.geef('k', () => ({ onderwerp: {}, verzegel: () => null })), { weiger: 'verzegel' });
  assert.equal(db.k.length, 1, 'een geweigerde zegel laat geen ticket achter');
});
