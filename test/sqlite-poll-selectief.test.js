/* De echte SQLite-poll leest alleen gewijzigde externe waarden. De proef
   gebruikt twee verbindingen op een tijdelijke database; geen server of last.
   Een lokale hogere versie mag een externe lagere versie niet verbergen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function proef(t) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-poll-selectief-'));
  const oud = { ...process.env };
  Object.assign(process.env, { RTG_DATA_DIR: map, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', DATABASE_URL: '', PG_URL: '', REDIS_URL: '' });
  const server = path.join(__dirname, '..', 'server') + path.sep;
  for (const id of Object.keys(require.cache)) if (id.startsWith(server)) delete require.cache[id];
  let poll;
  t.mock.method(global, 'setInterval', fn => { poll = fn; return { unref() {} }; });
  const state = require('../server/db/state');
  const sqlite = require('../server/db/sqlite');
  state.db.data = { stil: [], groot: { tekst: 'a'.repeat(3 * 1024 * 1024) }, gedeeld: { links: 1, rechts: 1 }, sessions: { behouden: { userId: 'a' }, ingetrokken: { userId: 'b' } } };
  sqlite.saveSqlite(true);
  sqlite.startSqliteSync();
  const ander = new DatabaseSync(path.join(map, 'store.db'));
  const lees = naam => JSON.parse(ander.prepare('SELECT val FROM kv WHERE key=?').get(naam).val);
  const schrijfSamen = wijzigingen => {
    ander.exec('BEGIN IMMEDIATE');
    try {
      for (const [naam, waarde] of wijzigingen) {
        ander.exec("UPDATE meta SET v=v+1 WHERE k='ver'");
        const v = ander.prepare("SELECT v FROM meta WHERE k='ver'").get().v;
        ander.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver').run(naam, JSON.stringify(waarde), v);
      }
      ander.exec('COMMIT');
    } catch (error) { ander.exec('ROLLBACK'); throw error; }
  };
  t.after(() => {
    state.setExternCb(null);
    ander.close();
    for (const key of ['RTG_DATA_DIR', 'RTG_STORE', 'RTG_ENC_KEY', 'DATABASE_URL', 'PG_URL', 'REDIS_URL']) {
      if (oud[key] === undefined) delete process.env[key]; else process.env[key] = oud[key];
    }
    fs.rmSync(map, { recursive: true, force: true });
  });
  return { state, sqlite, poll: () => poll(), lees, schrijfSamen, schrijf: (naam, waarde) => schrijfSamen([[naam, waarde]]) };
}

test('een ongewijzigde grote collectie wordt niet uit SQLite naar JavaScript gekopieerd', t => {
  const p = proef(t);
  // Observeer de echte SQLite-resultaten, niet de spelling van de query.
  const controle = new DatabaseSync(':memory:');
  t.after(() => controle.close());
  const prototype = Object.getPrototypeOf(controle.prepare('SELECT 1'));
  const oldAll = prototype.all, oldGet = prototype.get;
  let ontvangenBytes = 0;
  const tel = rijen => { for (const rij of rijen) if (rij && typeof rij.val === 'string') ontvangenBytes += Buffer.byteLength(rij.val); };
  t.mock.method(prototype, 'all', function (...args) { const r = oldAll.apply(this, args); tel(r); return r; });
  t.mock.method(prototype, 'get', function (...args) { const r = oldGet.apply(this, args); tel([r]); return r; });
  p.poll(); p.poll();
  assert.equal(ontvangenBytes, 0, 'stilstaande polls laden geen al toegepaste payloads');
  assert.equal(p.state.db.data.groot.tekst.length, 3 * 1024 * 1024);
});

test('externe lagere versie blijft zichtbaar na een eigen hogere schrijfactie', t => {
  const p = proef(t);
  p.schrijf('gedeeld', { links: 1, rechts: 2 });
  p.state.db.data.lokaal = { nieuw: true };
  p.sqlite.saveSqlite(true);
  p.poll();
  assert.deepEqual(p.state.db.data.gedeeld, { links: 1, rechts: 2 });
  assert.deepEqual(p.lees('lokaal'), { nieuw: true });
});

test('openstaande lokale wijziging convergeert met extern werk en blijft bewaarbaar', t => {
  const p = proef(t);
  p.state.db.data.gedeeld.links = 2;
  p.schrijf('gedeeld', { links: 1, rechts: 3 });
  p.schrijf('nieuweCollectie', { ontvangen: true });
  p.poll();
  assert.deepEqual(p.state.db.data.gedeeld, { links: 2, rechts: 3 });
  assert.deepEqual(p.state.db.data.nieuweCollectie, { ontvangen: true });
  p.sqlite.saveSqlite(true);
  assert.deepEqual(p.lees('gedeeld'), { links: 2, rechts: 3 });
});

test('extern ingetrokken sessie verdwijnt en invalideert de sessie-index precies eenmaal', t => {
  const p = proef(t);
  let intrekkingen = 0;
  p.state.setExternCb(() => { intrekkingen++; });
  p.schrijf('sessions', { behouden: { userId: 'a' } });
  p.poll(); p.poll();
  assert.equal(p.state.db.data.sessions.ingetrokken, undefined);
  assert.deepEqual(p.state.db.data.sessions.behouden, { userId: 'a' });
  assert.equal(intrekkingen, 1);
});

test('een externe multicollectiecommit tussen payloadlezingen levert nooit een gemengde snapshot', t => {
  const p = proef(t);
  p.schrijfSamen([['gedeeld', { links: 2, rechts: 2 }], ['sessions', { behouden: { userId: 'a' } }]]);
  const controle = new DatabaseSync(':memory:');
  t.after(() => controle.close());
  const prototype = Object.getPrototypeOf(controle.prepare('SELECT 1'));
  const oldGet = prototype.get;
  let tussenLezingen = false;
  t.mock.method(prototype, 'get', function (...args) {
    const r = oldGet.apply(this, args);
    if (!tussenLezingen && args[0] === 'gedeeld') {
      tussenLezingen = true;
      p.schrijfSamen([['gedeeld', { links: 3, rechts: 3 }], ['sessions', {}]]);
    }
    return r;
  });
  p.poll();
  assert.equal(tussenLezingen, true, 'de tweede verbinding schreef tijdens de actieve poll');
  assert.deepEqual(p.state.db.data.gedeeld, { links: 2, rechts: 2 });
  assert.deepEqual(p.state.db.data.sessions, { behouden: { userId: 'a' } }, 'de hele vorige snapshot geldt nog');
  p.poll();
  assert.deepEqual(p.state.db.data.gedeeld, { links: 3, rechts: 3 });
  assert.deepEqual(p.state.db.data.sessions, {}, 'de volgende poll ziet de hele nieuwe commit');
});

test('een leesfout publiceert niets en rolt de transactie terug voor herstel', t => {
  const p = proef(t);
  p.schrijfSamen([['gedeeld', { links: 4, rechts: 4 }], ['sessions', {}]]);
  const controle = new DatabaseSync(':memory:');
  t.after(() => controle.close());
  const prototype = Object.getPrototypeOf(controle.prepare('SELECT 1'));
  const oldGet = prototype.get;
  let fout = true;
  const waarschuwingen = [];
  t.mock.method(console, 'warn', (...args) => waarschuwingen.push(args.join(' ')));
  t.mock.method(prototype, 'get', function (...args) {
    if (fout && args[0] === 'sessions') { fout = false; throw new Error('geisoleerde poll-leesfout'); }
    return oldGet.apply(this, args);
  });
  p.poll();
  assert.deepEqual(p.state.db.data.gedeeld, { links: 1, rechts: 1 }, 'eerder gelezen waarden blijven ongepubliceerd');
  assert.ok(p.state.db.data.sessions.ingetrokken);
  assert.deepEqual(waarschuwingen, ['[db] sqlite-sync mislukt: geisoleerde poll-leesfout']);
  p.poll();
  assert.deepEqual(p.state.db.data.gedeeld, { links: 4, rechts: 4 });
  assert.deepEqual(p.state.db.data.sessions, {});
  assert.equal(waarschuwingen.length, 1, 'herstel opent een nieuwe transactie zonder achtergebleven lock');
});
