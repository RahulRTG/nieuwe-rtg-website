'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const contract = { aanvragen: 'lijst', ontvangsten: 'kaart' };
const ROOT = path.join(__dirname, '..');

function fixture(kv = new DatabaseSync(':memory:')) {
  kv.exec("CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,val TEXT,ver INTEGER,deleted INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v INTEGER); INSERT OR IGNORE INTO meta VALUES('ver',0)");
  const db = { data: {}, writable: true }, laatsteJson = new Map(), toegepast = new Map();
  const s = {
    bump: kv.prepare("UPDATE meta SET v=v+1 WHERE k='ver'"), huidig: kv.prepare("SELECT v FROM meta WHERE k='ver'"),
    lees: kv.prepare('SELECT val,ver,deleted FROM kv WHERE key=?'),
    up: kv.prepare('INSERT INTO kv VALUES(?,?,?,0) ON CONFLICT(key) DO UPDATE SET val=excluded.val,ver=excluded.ver,deleted=0')
  };
  const bewerk = require('../server/db/collectie-sqlite')({ db, verbinding: () => kv,
    statements: () => s, uitStore: x => x, naarStore: x => x, laatsteJson, toegepast,
    voorcheck: { vergeet() {} }, mutaties: { vergeet() {} } });
  return { kv, db, laatsteJson, toegepast, bewerk,
    rows: () => kv.prepare('SELECT * FROM kv ORDER BY key').all(),
    close: () => kv.close() };
}
function create(s, key = 'k') {
  if (s.ontvangsten[key]) return s.ontvangsten[key];
  const r = { id: key, at: '2026-10-22T00:00:00Z' };
  s.aanvragen.push(r); s.ontvangsten[key] = { id: key }; return s.ontvangsten[key];
}

test('SQLite: getypeerde lege containers, no-op en bestaande stringpoort', t => {
  const f = fixture(); t.after(f.close);
  f.bewerk(contract, s => { assert.deepEqual(s.aanvragen, []); assert.deepEqual(s.ontvangsten, {}); });
  assert.deepEqual(f.db.data, {}); assert.equal(f.rows().length, 0);
  assert.deepEqual(f.bewerk(contract, s => create(s)), { id: 'k' });
  assert.equal(f.rows().length, 2); assert.equal(f.db.data.aanvragen.length, 1);
  f.bewerk('legacy', s => { s.waarde = 1; }); assert.equal(f.db.data.legacy.waarde, 1);
  fixture(f.kv).bewerk(contract, (s, meta) => {
    assert.deepEqual(meta.bestaat, { aanvragen: true, ontvangsten: true });
    assert.ok(Object.isFrozen(meta.bestaat));
  });
});

test('SQLite: falende tweede KV-write rolt eerste write, versies en cache samen terug', t => {
  const f = fixture(); t.after(f.close);
  f.kv.exec("CREATE TRIGGER fout BEFORE INSERT ON kv WHEN NEW.key='ontvangsten' BEGIN SELECT CASE WHEN (SELECT count(*) FROM kv WHERE key='aanvragen')=1 THEN RAISE(ABORT,'tweede na eerste') ELSE RAISE(ABORT,'eerste niet gezien') END; END");
  assert.throws(() => f.bewerk(contract, s => create(s)), /tweede na eerste/);
  assert.equal(f.rows().length, 0); assert.deepEqual(f.db.data, {});
  assert.equal(f.laatsteJson.size, 0); assert.equal(f.toegepast.size, 0);
  assert.equal(f.kv.prepare("SELECT v FROM meta WHERE k='ver'").get().v, 0);
  f.kv.exec('DROP TRIGGER fout'); assert.deepEqual(f.bewerk(contract, s => create(s)), { id: 'k' });
  const rows = f.rows(), data = JSON.stringify(f.db.data);
  assert.throws(() => f.bewerk(contract, s => { create(s, 'later'); throw Error('callback'); }), /callback/);
  assert.deepEqual(f.rows(), rows); assert.equal(JSON.stringify(f.db.data), data);
});

test('SQLite: verse worker zonder cache bewaart andere worker en lokaal pendingwerk', t => {
  const f = fixture(), g = fixture(f.kv); t.after(f.close);
  f.bewerk(contract, s => create(s));
  assert.deepEqual(g.bewerk(contract, s => create(s)), { id: 'k' });
  assert.equal(g.db.data.aanvragen.length, 1);
  g.bewerk(contract, s => create(s, 'extern'));
  create(f.db.data, 'lokaal'); // bestaande synchrone schrijver heeft nog niet geflusht
  f.bewerk(contract, s => {
    assert.deepEqual(s.aanvragen.map(x => x.id).sort(), ['extern', 'k', 'lokaal']);
    create(s, 'nieuw');
  });
  const derde = fixture(f.kv);
  derde.bewerk(contract, s => {
    assert.deepEqual(s.aanvragen.map(x => x.id).sort(), ['extern', 'k', 'lokaal', 'nieuw']);
    assert.equal(Object.keys(s.ontvangsten).length, 4);
  });
});

test('SQLite: grafsteen en corrupte DB/live/callbackcontainers weigeren vóór publicatie', t => {
  const f = fixture(); t.after(f.close); f.bewerk(contract, s => create(s));
  const before = JSON.stringify(f.db.data); let calls = 0;
  f.kv.prepare("UPDATE kv SET deleted=1,val=NULL,ver=ver+100 WHERE key='ontvangsten'").run();
  const rows = f.rows();
  assert.throws(() => f.bewerk(contract, () => calls++), { code: 'COLLECTIE_VERWIJDERD' });
  assert.equal(calls, 0); assert.deepEqual(f.rows(), rows); assert.equal(JSON.stringify(f.db.data), before);
  f.kv.prepare("UPDATE kv SET deleted=0,val='[]' WHERE key='ontvangsten'").run();
  assert.throws(() => f.bewerk(contract, () => calls++), { code: 'COLLECTIE_TYPE' });
  f.kv.prepare("UPDATE kv SET val='{}' WHERE key='ontvangsten'").run();
  f.db.data.aanvragen = {};
  assert.throws(() => f.bewerk(contract, () => calls++), { code: 'COLLECTIE_TYPE' });
  assert.equal(calls, 0);
  const g = fixture(f.kv), rowsBefore = g.rows();
  assert.throws(() => g.bewerk(contract, s => { s.aanvragen = {}; }), { code: 'COLLECTIE_TYPE' });
  assert.deepEqual(g.rows(), rowsBefore); assert.deepEqual(g.db.data, {});
});

test('SQLite: bestaande nog ongeflushte lokale lijst commit mee met een nieuwe ontvangst', t => {
  const f = fixture(); t.after(f.close);
  f.db.data.aanvragen = [{ id: 'al-lokaal' }];
  f.bewerk(contract, s => {
    assert.equal(s.aanvragen[0].id, 'al-lokaal');
    s.ontvangsten.k = { id: s.aanvragen[0].id };
  });
  const rijen = f.rows();
  assert.equal(rijen.length, 2, 'geen duurzame receipt naar een nog alleen lokale lijst');
  assert.deepEqual(JSON.parse(rijen.find(r => r.key === 'aanvragen').val), [{ id: 'al-lokaal' }]);
});

function kind(code, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', code], { cwd: ROOT, env }); let out = '', err = '';
    p.stdout.on('data', x => { out += x; }); p.stderr.on('data', x => { err += x; });
    p.on('error', reject); p.on('exit', n => n === 0 ? resolve(JSON.parse(out.trim().split(/\r?\n/).at(-1))) : reject(Error(err || out)));
  });
}
test('SQLite: twee echte processen op dezelfde opslag creëren samen één effect en herstart replayt', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-multi-slot-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', RTG_DATA_DIR: dir, RTG_ENC_KEY: '' };
  const load = "const d=require('./server/db');d.load();";
  const init = spawnSync(process.execPath, ['-e', load], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  const code = load + "const r=d.bewerkCollectie({multiLijst:'lijst',multiBewijs:'kaart'},s=>{if(s.multiBewijs.k)return s.multiBewijs.k;const x={id:require('node:crypto').randomUUID()};s.multiLijst.push(x);s.multiBewijs.k=x;return x;});console.log(JSON.stringify(r));";
  const r = await Promise.all([kind(code, env), kind(code, env)]);
  assert.deepEqual(r[0], r[1]);
  assert.deepEqual(await kind(code, env), r[0]);
  const stand = await kind(load + "console.log(JSON.stringify(d.bewerkCollectie({multiLijst:'lijst',multiBewijs:'kaart'},s=>({n:s.multiLijst.length,m:Object.keys(s.multiBewijs).length}))));", env);
  assert.deepEqual(stand, { n: 1, m: 1 });
});
