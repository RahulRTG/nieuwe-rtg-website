'use strict';
/* Uitsluitend door de optionele testprofiler te monteren. Geen SQL-tekst,
   parameters, routegegevens of payloads in de meting. Splits native SQLite-
   tijd in commit, begin, checkpoint en de bekende grote KV-schrijvers. */
module.exports = function meetSqlite(sqlite, nu = () => performance.now()) {
  const db = sqlite.DatabaseSync.prototype, stmt = sqlite.StatementSync.prototype;
  const origineel = { exec: db.exec, prepare: db.prepare, run: stmt.run, get: stmt.get };
  const statements = new WeakMap(), metingen = new Map();
  const verbindingen = new WeakMap(); let volgende = 0;
  function verbinding(db) {
    if (db === null || !['object', 'function'].includes(typeof db)) return 'other';
    if (!verbindingen.has(db)) verbindingen.set(db, volgende < 16 ? ++volgende : 'other');
    return verbindingen.get(db);
  }
  const collecties = new Set(['trustEvidence', 'betaalWaarheid', 'facturen', 'sessions', 'securityLog']);
  const grenzen = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  function meet(naam, connection, fn, owner, args, chars = 0) {
    const start = nu(); let gelukt = false;
    try { const uit = fn.apply(owner, args); gelukt = true; return uit; }
    finally {
      const ms = Math.max(0, nu() - start);
      const sleutel = connection + ':' + naam;
      const rij = metingen.get(sleutel) || { phase: naam, connection, count: 0, ms: 0, maxMs: 0,
        failures: 0, storedChars: 0, buckets: Array(grenzen.length + 1).fill(0) };
      rij.count++; rij.ms += ms; rij.maxMs = Math.max(rij.maxMs, ms);
      if (!gelukt) rij.failures++;
      if (gelukt) rij.storedChars += chars;
      const i = grenzen.findIndex(grens => ms < grens);
      rij.buckets[i < 0 ? grenzen.length : i]++;
      metingen.set(sleutel, rij);
    }
  }
  function exec(...args) {
    const tekst = typeof args[0] === 'string' ? args[0].trim().toUpperCase() : '';
    const phase = /^BEGIN(?: IMMEDIATE| DEFERRED| EXCLUSIVE)?;?$/.test(tekst) ? 'begin'
      : /^COMMIT;?$/.test(tekst) ? 'commit' : /^ROLLBACK;?$/.test(tekst) ? 'rollback' : 'other';
    return meet('exec.' + phase, verbinding(this), origineel.exec, this, args);
  }
  function prepare(...args) {
    const uit = origineel.prepare.apply(this, args);
    const tekst = typeof args[0] === 'string' ? args[0].trim().toUpperCase() : '';
    const checkpoint = /^PRAGMA WAL_CHECKPOINT\((PASSIVE|FULL|RESTART|TRUNCATE)\);?$/.exec(tekst);
    if (checkpoint) statements.set(uit, { phase: 'checkpoint.' + checkpoint[1], connection: verbinding(this) });
    else if (/^INSERT INTO KV\s*\(/.test(tekst)) statements.set(uit, { phase: 'kv.write', connection: verbinding(this) });
    return uit;
  }
  function run(...args) {
    const meting = statements.get(this);
    if (meting?.phase !== 'kv.write') return origineel.run.apply(this, args);
    const naam = collecties.has(args[0]) ? args[0] : 'other';
    const chars = typeof args[1] === 'string' ? args[1].length : 0;
    return meet('kv.write.' + naam, meting.connection, origineel.run, this, args, chars);
  }
  function get(...args) {
    const meting = statements.get(this);
    return meting?.phase.startsWith('checkpoint.')
      ? meet(meting.phase, meting.connection, origineel.get, this, args) : origineel.get.apply(this, args);
  }
  db.exec = exec; db.prepare = prepare; stmt.run = run; stmt.get = get;
  return {
    drain() {
      const rows = [...metingen.values()].sort((a, b) => b.ms - a.ms);
      metingen.clear(); return { bucketUpperMs: grenzen.slice(), rows };
    },
    restore() {
      if (db.exec === exec) db.exec = origineel.exec;
      if (db.prepare === prepare) db.prepare = origineel.prepare;
      if (stmt.run === run) stmt.run = origineel.run;
      if (stmt.get === get) stmt.get = origineel.get;
    }
  };
};
