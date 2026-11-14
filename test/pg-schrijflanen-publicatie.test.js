/* Pure SQL-protocolproef: echte schrijflanen + echte meetmerge, nagemaakte
   transactionele pool. Geen bewijs voor een echte PostgreSQL-crash. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakLanen = require('../server/pg/schrijflanen');
const { merge3 } = require('../server/db/merge');
const kloon = x => JSON.parse(JSON.stringify(x));
const sleutel = 'schaduwregels', regel = 'lidcontract.ontbreekt';
const meting = n => ({ [regel]: { id: regel, modus: 'SCHADUW', sinds: 1000, door: null,
  waarnemingen: n, zouTegenhouden: 0, voorbeelden: [], vrijstelling: null, verloop: [] } });

function proef() {
  let ver = 2, hook = () => {};
  const rows = new Map([[sleutel, { val: JSON.stringify(meting(1)), ver: 2, weg: false }]]);
  const data = { [sleutel]: meting(1) };
  const ctx = { merge3, uitStore: x => x, naarStore: x => x,
    toegepast: new Map([[sleutel, 1]]), laatsteJson: new Map([[sleutel, JSON.stringify(meting(0))]]) };
  const laatsteSchrijf = new Map();
  const queries = [];
  ctx.pool = { connect: async () => {
    let pending = new Map();
    return { release() {}, async query(sql, args = []) {
      queries.push(sql);
      await hook(sql, args);
      if (sql === 'BEGIN' || sql === 'ROLLBACK') pending = new Map();
      if (sql === 'COMMIT') { for (const [k, v] of pending) rows.set(k, v); pending = new Map(); }
      if (/^SELECT val, ver, weg FROM kv/.test(sql)) return { rows: rows.has(args[0]) ? [kloon(rows.get(args[0]))] : [] };
      if (/nextval/.test(sql)) return { rows: [{ v: ++ver }] };
      if (/^INSERT INTO kv/.test(sql)) pending.set(args[0], { val: args[1], ver: args[2], weg: false });
      return { rows: [] };
    } };
  } };
  const { schrijfLanen } = maakLanen(ctx, laatsteSchrijf);
  const schrijf = (snel = false) => schrijfLanen(data,
    Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]), snel ? new Set(Object.keys(data)) : null);
  return { data, ctx, rows, laatsteSchrijf, schrijf, queries, hook: fn => { hook = fn; } };
}

for (const snel of [false, true]) test('rollback laat lokale delta en caches intact; retry telt eenmaal: ' + snel, async () => {
  const p = proef(), voor = kloon(p.data);
  const caches = { basis: [...p.ctx.laatsteJson], versies: [...p.ctx.toegepast] };
  p.hook(sql => { if (sql === 'COMMIT') throw new Error('commit geweigerd'); });
  await assert.rejects(p.schrijf(snel), /commit geweigerd/);
  assert.deepEqual(p.data, voor, 'een ongeslaagde merge lekt niet naar levend RAM');
  assert.deepEqual({ basis: [...p.ctx.laatsteJson], versies: [...p.ctx.toegepast] }, caches);
  assert.equal(p.laatsteSchrijf.size, 0);
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 1);
  p.hook(() => {});
  assert.equal(await p.schrijf(snel), 1);
  assert.equal(p.data[sleutel][regel].waarnemingen, 2);
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 2, 'retry is geen derde meting');
});

test('een fout in de latere rijstrookcollectie publiceert ook de eerste niet', async () => {
  const p = proef(); p.data.zzLater = { nodig: true };
  const voor = kloon(p.data);
  p.hook((sql, args) => { if (/^INSERT/.test(sql) && args[0] === 'zzLater') throw new Error('tweede collectie geweigerd'); });
  await assert.rejects(p.schrijf(true), /tweede collectie geweigerd/);
  assert.deepEqual(p.data, voor);
  assert.equal(p.ctx.toegepast.get(sleutel), 1);
  assert.equal(p.laatsteSchrijf.size, 0);
  assert.equal(p.rows.has('zzLater'), false);
});

for (const snel of [false, true]) test('updates tijdens I/O blijven boven op de gecommitteerde basis staan: ' + snel, async () => {
  const p = proef();
  p.hook(sql => { if (sql === 'COMMIT') p.data[sleutel][regel].waarnemingen++; });
  await p.schrijf(snel);
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 2, 'eerste commit bevat alleen geselecteerde delta');
  assert.equal(JSON.parse(p.ctx.laatsteJson.get(sleutel))[regel].waarnemingen, 2);
  assert.equal(p.data[sleutel][regel].waarnemingen, 3, 'de extra lokale meting blijft openstaand');
  p.hook(() => {}); await p.schrijf(snel);
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 3);
});

test('een rollback verliest een tijdens I/O toegevoegde lokale meting niet', async () => {
  const p = proef();
  p.hook(sql => { if (sql === 'COMMIT') { p.data[sleutel][regel].waarnemingen++; throw new Error('rollback'); } });
  await assert.rejects(p.schrijf(), /rollback/);
  assert.equal(p.data[sleutel][regel].waarnemingen, 2, 'twee lokale metingen, geen ingelezen remote delta');
  p.hook(() => {}); await p.schrijf();
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 3);
});

test('een nieuwe grafsteen wordt pas na de hele geslaagde transactie gepubliceerd', async () => {
  const p = proef(); p.rows.set(sleutel, { val: '', ver: 2, weg: true });
  p.data.zzLater = { nodig: true };
  p.hook((sql, args) => { if (/^INSERT/.test(sql) && args[0] === 'zzLater') throw new Error('rollback'); });
  await assert.rejects(p.schrijf(true), /rollback/);
  assert.ok(p.data[sleutel], 'afgebroken transactie publiceert de grafsteen nog niet');
  assert.equal(p.ctx.toegepast.get(sleutel), 1);
  p.hook(() => {}); await p.schrijf(true);
  assert.equal(Object.hasOwn(p.data, sleutel), false);
  assert.equal(p.ctx.laatsteJson.has(sleutel), false);
  assert.equal(p.ctx.toegepast.get(sleutel), 2);
});

test('publicatieconflict na COMMIT blokkeert herschrijven totdat de bevestigde stand herladen is', async () => {
  const p = proef();
  p.hook(sql => { if (sql === 'COMMIT') p.data[sleutel][regel].modus = 'AFDWINGEN'; });
  await assert.rejects(p.schrijf(), { code: 'PG_REQUEST_CONFLICT' });
  const bevestigd = kloon(p.rows.get(sleutel)), aantalQueries = p.queries.length;
  assert.equal(JSON.parse(bevestigd.val)[regel].waarnemingen, 2, 'COMMIT was echt geslaagd');
  assert.equal(p.data[sleutel][regel].modus, 'AFDWINGEN', 'latere besturing wordt niet stil verworpen');
  assert.equal(p.queries.at(-1), 'COMMIT', 'geen schijnrollback van de geslaagde commit');
  p.hook(() => {});
  await assert.rejects(p.schrijf(), { code: 'PG_REQUEST_CONFLICT' });
  assert.equal(p.queries.length, aantalQueries, 'geen SQL-herhaling zolang publicatie conflicteert');
  assert.deepEqual(p.rows.get(sleutel), bevestigd);
  // De bestaande opslagherstelroute herlaadt waarde EN commitbasis uit PG.
  p.data[sleutel] = JSON.parse(bevestigd.val);
  p.ctx.laatsteJson.set(sleutel, bevestigd.val);
  p.ctx.toegepast.set(sleutel, bevestigd.ver);
  p.data[sleutel][regel].waarnemingen++;
  await p.schrijf();
  assert.equal(JSON.parse(p.rows.get(sleutel).val)[regel].waarnemingen, 3, 'alleen de nieuwe meting wordt nog geschreven');
});
