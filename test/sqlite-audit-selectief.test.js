'use strict';
/* Gerichte auditopslag blijft dezelfde synchrone transactie, zonder bij ieder
   spoor twee keer alle andere domeinen te serialiseren. Echte tijdelijke SQLite,
   geen belastingproef en geen productiegegevens. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { EventEmitter } = require('node:events');

function proef(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-audit-selectief-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', DATABASE_URL: '', PG_URL: '', REDIS_URL: '' };
  const oud = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const prefix = path.join(__dirname, '..', 'server') + path.sep;
  for (const k of Object.keys(require.cache)) if (k.startsWith(prefix)) delete require.cache[k];
  const opslag = require('../server/db');
  opslag.db.data = { handelingLog: [], apiSpoor: {}, ander: { waarde: 1 } };
  opslag.save();
  const conn = new DatabaseSync(path.join(dir, 'store.db'));
  const lees = key => {
    const meta = conn.prepare('SELECT * FROM audit_meta WHERE naam=?').get(key);
    if (!meta) return JSON.parse(conn.prepare('SELECT val FROM kv WHERE key=?').get(key).val);
    const lijst = conn.prepare('SELECT waarde FROM audit_rij WHERE naam=? ORDER BY nr').all(key).map(r => JSON.parse(r.waarde));
    if (key === 'handelingLog') return lijst.reverse();
    return { ...JSON.parse(meta.extra), commandJournaal: lijst, commandJournaalTotaal: meta.totaal };
  };
  t.after(() => {
    conn.close();
    for (const [k, v] of Object.entries(oud)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { ...opslag, conn, lees, dir };
}

test('beide echte auditmiddlewares bewaren hun keten zonder vreemde collecties te lezen', t => {
  const p = proef(t);
  let gelezen = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { gelezen++; return { waarde: this.waarde }; }, configurable: true });
  const handeling = require('../server/lib/handelingsspoor')({ db: p.db, save: p.save });
  const audit = require('../server/opzet/auditspoor').maakAuditspoor({ db: p.db, save: p.save });
  const req = { method: 'POST', path: '/api/documenten/zet', body: { tekst: 'privé' }, session: { key: 'actor' } };
  const res = new EventEmitter(); res.statusCode = 200;
  handeling.middleware(req, res, () => {}); audit.middleware()(req, res, () => {});
  res.emit('finish');
  assert.equal(gelezen, 0, 'auditopslag serialiseert geen andere domeinen');
  assert.equal(p.lees('handelingLog').length, 1);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
  assert.equal(handeling.ketenstand().ok, true);
  assert.equal(audit.stand().keten.heel, true);
  assert.ok(!JSON.stringify(p.lees('handelingLog')).includes('privé'));
  assert.ok(!JSON.stringify(p.lees('apiSpoor')).includes('privé'));
  p.db.data.ander.waarde = 2;
  p.save();
  assert.ok(gelezen > 0, 'gewone save behoudt de volledige scan');
  assert.equal(p.lees('ander').waarde, 2);
});

test('expliciete auditopslag stelt grote bestaande collecties niet uit', t => {
  const p = proef(t);
  p.db.data.apiSpoor = { tekst: 'a'.repeat(600000), nummer: 1 };
  p.save.sleutels(['apiSpoor']);
  p.db.data.apiSpoor.nummer = 2;
  p.save.sleutels(['apiSpoor', 'apiSpoor']);
  assert.equal(p.lees('apiSpoor').nummer, 2);
  for (const keys of [null, [], ['ontbreekt'], [42]]) assert.throws(() => p.save.sleutels(keys), /bestaande collecties/);
});

test('selectieve save houdt foutinjectie en de gewone duurzame bundel intact', async t => {
  const p = proef(t), verraad = require('../server/lib/verraadfase');
  const fout = t.mock.method(verraad, 'sla', name => name === 'schrijf-faalt');
  p.db.data.apiSpoor = { nummer: 1 };
  assert.throws(() => p.save.sleutels(['apiSpoor']), /schrijf-faalt/);
  assert.deepEqual(p.lees('apiSpoor'), {});
  fout.mock.restore();
  await p.bijeen(() => {
    p.save.sleutels(['apiSpoor']);
    p.db.data.ander.waarde = 3;
    p.save();
    assert.deepEqual(p.lees('apiSpoor'), {}, 'de bundel commit pas aan het eind');
  });
  assert.equal(p.lees('apiSpoor').nummer, 1);
  assert.equal(p.lees('ander').waarde, 3);
});

test('mislukte SQLite-commit publiceert geen cacheversie die een retry verliest', t => {
  const p = proef(t), proto = DatabaseSync.prototype, exec = proto.exec;
  let fail = true;
  t.mock.method(proto, 'exec', function (sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('geïsoleerde commitfout'); }
    return exec.call(this, sql);
  });
  p.db.data.apiSpoor = { nummer: 2 };
  p.db.data.handelingLog.push({ id: 'een' });
  assert.throws(() => p.save.sleutels(['apiSpoor', 'handelingLog']), /commitfout/);
  assert.deepEqual(p.lees('apiSpoor'), {});
  assert.deepEqual(p.lees('handelingLog'), []);
  p.save.sleutels(['apiSpoor', 'handelingLog']);
  assert.equal(p.lees('apiSpoor').nummer, 2);
  assert.deepEqual(p.lees('handelingLog'), [{ id: 'een' }]);
});

test('een expliciet opgeslagen spoor overleeft een onderbroken schrijfproces', t => {
  const p = proef(t);
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath, ['-e', `
    const opslag = require('./server/db');
    opslag.db.data = require('./server/db/sqlite').loadSqlite();
    opslag.db.data.apiSpoor = { commandJournaalTotaal: 1, commandJournaal: [{ id: 'duurzaam' }] };
    opslag.save.sleutels(['apiSpoor']);
    process.kill(process.pid, 'SIGKILL');
  `], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
  const herstart = spawnSync(process.execPath, ['-e', `
    const data = require('./server/db/sqlite').loadSqlite();
    console.log(JSON.stringify(data.apiSpoor));
  `], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(herstart.status, 0, herstart.stderr);
  assert.deepEqual(JSON.parse(herstart.stdout), p.lees('apiSpoor'));
});
