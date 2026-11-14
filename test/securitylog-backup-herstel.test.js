'use strict';
// Echte backupfabriek, echte WAL en een nieuw proces op een andere datamap.
// nieuw proces op een andere datamap. Geen nagebouwde backupbestandenlijst.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomBytes } = require('node:crypto'), { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');
const keten = require('../server/lib/keten');
for (const metLezer of [false, true]) test('versleutelde security-rijen: backup/herstel' +
    (metLezer ? ' met oude WAL-lezer' : ' na checkpoint'), t => {
  const p = proef(t, { securityLog: [] }, randomBytes(32).toString('hex'));
  const spoor = require('../server/kern/identiteit/inlogherkomst').maakInlogspoor({
    db: p.db, save: p.save, schoon: v => v });
  spoor.logInlog('account', true, 'eerste', {});
  let lezer = false;
  const terug = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-security-herstel-'));
  t.after(() => fs.rmSync(terug, { recursive: true, force: true }));
  try {
    if (metLezer) {
      p.conn.exec('BEGIN'); lezer = true;
      assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_rij WHERE naam='securityLog'").get().n, 1);
    }
    spoor.logInlog('account', true, 'tweede', {});
    spoor.logInlog('account', false, 'derde', {});
    // De oude lezer is bewust niet de waarheidsbron voor de nieuwe rijen.
    const voor = JSON.parse(JSON.stringify(p.db.data.securityLog));
    assert.equal(voor.length, 3); assert.equal(keten.verifieer(voor).ok, true);
    const backup = require('../server/opzet/backup')({ fs, path, DATA_DIR: p.dir, db: p.db,
      accounts: { checkpoint() {} }, checkpointSqlite: p.checkpointSqlite, checkpointGrootboek() {} });
    backup.backupData();
    const dagen = fs.readdirSync(backup.BACKUP_DIR).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
    assert.equal(dagen.length, 1);
    const dag = path.join(backup.BACKUP_DIR, dagen[0]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dag, '.complete'))).dag, dagen[0]);
    if (metLezer) assert.ok(fs.statSync(path.join(dag, 'store.db-wal')).size > 0,
      'de werkelijk geblokkeerde checkpoint bewaart gegevens via de gekopieerde WAL');
    else assert.equal(fs.statSync(path.join(dag, 'store.db-wal')).size, 0,
      'normaal is het echte TRUNCATE-checkpoint uitgevoerd');
    fs.cpSync(dag, terug, { recursive: true });
    // De levende database loopt door; herstel mag niet heimelijk die lezen.
    spoor.logInlog('account', true, 'alleen-na-backup', {});
    const kind = spawnSync(process.execPath, ['-e', `
      const assert=require('node:assert/strict'),p=require('./server/db');
      p.db.data=require('./server/db/sqlite').loadSqlite();
      const voor=JSON.parse(JSON.stringify(p.db.data.securityLog));
      const s=require('./server/kern/identiteit/inlogherkomst').maakInlogspoor({db:p.db,save:p.save,schoon:v=>v});
      s.logInlog('account',true,'na-herstel',{});
      console.log(JSON.stringify({voor,na:p.db.data.securityLog,keten:s.securityLogKeten()}));
    `], { cwd: path.join(__dirname, '..'), env: { ...process.env, RTG_DATA_DIR: terug }, encoding: 'utf8' });
    assert.equal(kind.status, 0, kind.stderr);
    const uit = JSON.parse(kind.stdout);
    assert.deepEqual(uit.voor, voor); assert.deepEqual(uit.na.slice(1), voor);
    assert.equal(uit.na[0].wie, 'na-herstel'); assert.equal(uit.na[0].vorige, voor[0].hash);
    assert.equal(uit.na[0].nr, voor[0].nr + 1); assert.equal(uit.keten.ok, true);
    const lees = new DatabaseSync(path.join(terug, 'store.db'));
    try {
      assert.equal(lees.prepare("SELECT COUNT(*) n FROM kv WHERE key='securityLog'").get().n, 0);
      const rows = lees.prepare("SELECT waarde FROM audit_rij WHERE naam='securityLog'").all();
      assert.equal(rows.length, 4);
      for (const r of rows) { assert.match(r.waarde, /^RTGENC1:/); assert.ok(!r.waarde.includes('na-herstel')); }
    } finally { lees.close(); }
  } finally { if (lezer) p.conn.exec('ROLLBACK'); }
});
