'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const maak = require('../server/db/collectie-bewerken');
const contract = { aanvragen: 'lijst', ontvangsten: 'kaart' };
function fixture(data = {}, save = () => {}) {
  const db = { data, writable: true };
  return { db, bewerk: maak({ db, store: 'memory', save }) };
}
function voegToe(s) { s.aanvragen.push({ id: 'a' }); s.ontvangsten.x = 'a'; return { ok: true }; }

test('getypeerde lijst en kaart delen één save; de stringinterface blijft gelijk', () => {
  let saves = 0; const f = fixture({}, () => saves++);
  assert.deepEqual(f.bewerk(contract, voegToe), { ok: true });
  assert.deepEqual(f.db.data, { aanvragen: [{ id: 'a' }], ontvangsten: { x: 'a' } });
  assert.equal(saves, 1);
  f.bewerk('legacy', s => { s.x = 1; });
  assert.deepEqual(f.db.data.legacy, { x: 1 }); assert.equal(saves, 2);
});

test('typed bestaanscontext onderscheidt nieuw van bestaand leeg en is onveranderlijk', () => {
  const f = fixture({ ontvangsten: {} });
  f.bewerk(contract, (s, meta) => {
    assert.deepEqual(meta.bestaat, { aanvragen: false, ontvangsten: true });
    assert.ok(Object.isFrozen(meta)); assert.ok(Object.isFrozen(meta.bestaat));
    assert.throws(() => { meta.bestaat.ontvangsten = false; }, TypeError);
  });
  f.bewerk('oud', function () { assert.equal(arguments.length, 1); });
});

test('no-op maakt geen lege collecties; callback/save-fout herstelt ook ontbrekende sleutels', () => {
  const f = fixture(); f.bewerk(contract, () => ({ ok: true }));
  assert.deepEqual(f.db.data, {});
  assert.throws(() => f.bewerk(contract, s => { voegToe(s); throw Error('callback'); }), /callback/);
  assert.deepEqual(f.db.data, {});
  const g = fixture({}, () => { throw Error('disk'); });
  assert.throws(() => g.bewerk(contract, voegToe), /disk/); assert.deepEqual(g.db.data, {});
});

test('descriptor weigert ongeldige eigen sleutels, accessors en containertypen', () => {
  const f = fixture(); let geraakt = 0;
  const accessor = {}; Object.defineProperty(accessor, 'aanvragen', { enumerable: true, get() { geraakt++; return 'lijst'; } });
  for (const d of [{}, ['aanvragen'], { aanvragen: 'array' }, { ' a': 'kaart' },
    { constructor: 'kaart' }, { toString: 'kaart' }, { hasOwnProperty: 'lijst' }, JSON.parse('{"__proto__":"kaart"}'),
    { [Symbol('s')]: 'kaart', aanvragen: 'lijst' }, accessor, Object.create({ aanvragen: 'lijst' })])
    assert.throws(() => f.bewerk(d, () => { geraakt++; }), { code: 'COLLECTIE_CONTRACT' });
  assert.equal(geraakt, 0); assert.deepEqual(f.db.data, {});
});

test('corrupt bestaande waarden en ongeldige callbackuitvoer schrijven niets', () => {
  for (const waarde of [null, undefined, {}, 'lijst', 1]) {
    const f = fixture({ aanvragen: waarde });
    assert.throws(() => f.bewerk(contract, voegToe), { code: 'COLLECTIE_TYPE' });
    assert.equal(f.db.data.aanvragen, waarde); assert.equal(Object.hasOwn(f.db.data, 'ontvangsten'), false);
  }
  for (const werk of [s => { s.aanvragen = {}; }, s => { delete s.ontvangsten; },
    s => { s.extra = {}; }, s => { s.aanvragen.ontvangst = { x: 1 }; },
    s => { s.ontvangsten = new Date(); }, s => { s.ontvangsten.x = undefined; },
    s => { s.ontvangsten.x = () => 1; }, s => { s.ontvangsten.x = NaN; },
    s => { s.aanvragen.length = 2; }, s => { s.ontvangsten.x = s.ontvangsten; },
    async s => { voegToe(s); }]) {
    const f = fixture(); assert.throws(() => f.bewerk(contract, werk)); assert.deepEqual(f.db.data, {});
  }
});

// Een gecontroleerde PG-commitbarrière toetst de orchestration; de afzonderlijke
// .pg.test.js toetst echte locks/rollback. Deze fake is geen databasebewijs.
function pgFixture(bijLezen = () => {}) {
  const calls = [], data = {}, maps = Object.fromEntries(['toegepast','laatsteJson','laatsteGrootte','laatsteLengte','laatsteCheck'].map(k => [k,new Map()]));
  let los, begonnen; const poort = new Promise(r => { los = r; }); const wacht = new Promise(r => { begonnen = r; });
  let fail = false, versie = 0;
  const client = { release() {}, async query(sql, args) {
    calls.push([sql, args]);
    if (sql.startsWith('SELECT val')) bijLezen(data, args[0]);
    if (sql === 'COMMIT') { begonnen(); await poort; if (fail) throw Error('commit faalt'); }
    if (sql.includes('nextval')) return { rows: [{ v: ++versie }] };
    return { rows: [] };
  } };
  const schrijver = { sorteer: x => x, schrijfIn: async () => { calls.push(['AUDIT']); return [{ ok: true }]; },
    publiceer: () => { calls.push(['PUBLICATIE_AUDIT']); } };
  const pg = require('../server/pg/collectietransactie')({ pool: { connect: async () => client },
    uitStore: x => x, naarStore: x => x, ...maps }, schrijver);
  return { data, calls, maps, pg, wacht, los: () => los(), faal: () => { fail = true; } };
}

test('PG sorteert domein- en auditsloten; publiceert geen collectie vóór gezamenlijke commit', async () => {
  const f = pgFixture(), spoor = { wijzigingen: [{ sleutel: 'zzAudit' }, { sleutel: 'aaAudit' }] };
  const p = f.pg.bewerkCollectie({ ontvangsten: 'kaart', aanvragen: 'lijst' }, f.data, voegToe, spoor);
  await f.wacht;
  assert.deepEqual(f.data, {}); assert.equal(f.maps.laatsteJson.size, 0);
  assert.equal(spoor.geschreven, false);
  const sloten = f.calls.filter(([sql]) => sql.includes('pg_advisory_xact_lock')).map(([, args]) => args[0]);
  assert.deepEqual(sloten, ['aaAudit', 'aanvragen', 'ontvangsten', 'zzAudit']);
  assert.equal(f.calls.filter(([sql]) => sql.startsWith('INSERT INTO kv')).length, 2);
  assert.equal(f.calls.some(([sql]) => sql === 'PUBLICATIE_AUDIT'), false);
  f.los(); assert.deepEqual(await p, { ok: true });
  assert.equal(spoor.geschreven, true); assert.equal(f.data.aanvragen.length, 1);
  assert.deepEqual(f.data.ontvangsten, { x: 'a' });
});

test('PG commitfout publiceert noch domeincollectie noch audit/cache', async () => {
  const f = pgFixture(), spoor = { wijzigingen: [{ sleutel: 'audit' }] };
  const p = f.pg.bewerkCollectie(contract, f.data, voegToe, spoor);
  await f.wacht; f.faal(); f.los(); await assert.rejects(p, /commit faalt/);
  assert.deepEqual(f.data, {}); assert.equal(f.maps.laatsteJson.size, 0); assert.equal(spoor.geschreven, false);
  assert.equal(f.calls.some(([sql]) => sql === 'PUBLICATIE_AUDIT'), false);
  assert.equal(f.calls.some(([sql]) => sql === 'ROLLBACK'), true);
});

test('PG kopieert lokale collecties samen na alle SELECTs en bewaart later onafhankelijk werk', async () => {
  const f = pgFixture((data, k) => {
    if (k === 'ontvangsten') { data.aanvragen = [{ id: 'lokaal' }]; data.ontvangsten = { lokaal: 'lokaal' }; }
  });
  const p = f.pg.bewerkCollectie(contract, f.data, s => {
    assert.equal(s.aanvragen.length, 1); assert.equal(s.ontvangsten.lokaal, 'lokaal');
    voegToe(s);
  });
  await f.wacht;
  f.data.aanvragen.push({ id: 'later' }); f.data.ontvangsten.later = 'later';
  f.los(); await p;
  assert.deepEqual(f.data.aanvragen.map(x => x.id).sort(), ['a', 'later', 'lokaal']);
  assert.deepEqual(f.data.ontvangsten, { lokaal: 'lokaal', x: 'a', later: 'later' });
  assert.equal(JSON.parse(f.maps.laatsteJson.get('aanvragen')).length, 2, 'cachebasis is commit, niet later lokaal werk');
});

test('PG commit lokale beginstand zonder KV-rij mee met een nieuwe receipt', async () => {
  const f = pgFixture(); f.data.aanvragen = [{ id: 'al-lokaal' }];
  const p = f.pg.bewerkCollectie(contract, f.data, s => { s.ontvangsten.k = { id: s.aanvragen[0].id }; });
  await f.wacht;
  const writes = f.calls.filter(([sql]) => sql.startsWith('INSERT INTO kv')).map(([, args]) => args[0]);
  assert.deepEqual(writes, ['aanvragen', 'ontvangsten']);
  f.los(); await p;
});
