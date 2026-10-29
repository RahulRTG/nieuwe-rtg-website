'use strict';
/* Echte PG-requestcommit met twee opslaginstanties; geen HTTP-authenticatie-
   of procescrashclaim. Elke proef gebruikt een eigen wegwerpdatabase. */
const test = require('node:test'), assert = require('node:assert/strict');
const url = process.env.DATABASE_URL || process.env.PG_URL;
const skip = require('./infra').vereist('pg', !!url, 'inlog-appendmerge vereist echte PostgreSQL');
const { maakPg } = require('../server/pg');
const { merge3 } = require('../server/db/merge');
const kluis = require('../server/kluis'), keten = require('../server/lib/keten');
const kopie = x => structuredClone(x);
const keys = ['securityLog', 'sessions', 'supplierActivity'];
const audit = (b, id) => { const v = kopie(b); keten.noteerIn(v, { at: '2026-10-23T12:00:00Z', kanaal: 'zaak', ok: true, wie: id, ip: '127.0.0.1' }, 5000); return v; };
const activiteit = id => ({ who: id, text: id + ' logde in', at: '2026-10-23T12:00:00Z', soort: 'klok-inlog' });
function delta(b, id, inhoud = id) {
  const v = { securityLog: audit(b.securityLog, inhoud), sessions: { ...b.sessions, [id]: { role: 'supplier', code: 'AAA', at: '2026-10-23T12:00:00Z' } },
    supplierActivity: { AAA: [activiteit(inhoud), ...b.supplierActivity.AAA] } };
  return keys.map(sleutel => ({ sleutel, basisBestaat: true, basisJson: JSON.stringify(b[sleutel]), waardeBestaat: true, waardeJson: JSON.stringify(v[sleutel]) }));
}
test('PG inlogpakket: disjuncte race, overlap en late rollback', { skip, timeout: 60000 }, async t => {
  const iso = await require('./lib/living-world-pg-database')(url);
  const a = maakPg({ url: iso.url, merge3, kluis, log: { warn() {} } });
  const b = maakPg({ url: iso.url, merge3, kluis, log: { warn() {} } });
  const ruw = async () => (await a.pool.query('SELECT key,val,ver,weg FROM kv ORDER BY key')).rows;
  const lees = async () => Object.fromEntries((await ruw()).filter(r => !r.weg).map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))]));
  try {
    await a.schema();
    const begin = { securityLog: audit([], 'historie'), sessions: {}, supplierActivity: { AAA: [activiteit('historie')] } };
    await a.commitVerzoek({}, keys.map(sleutel => ({ sleutel, basisBestaat: false, basisJson: null, waardeBestaat: true, waardeJson: JSON.stringify(begin[sleutel]) })));

    await t.test('twee instanties wachten werkelijk op hetzelfde slot en behouden beide logins', async () => {
      const da = await a.laadAlles(), db = await b.laadAlles();
      assert.deepEqual(da, db);
      const wa = delta(da, 'A'), wb = delta(db, 'B');
      const slot = await a.pool.connect(); let werk, wachtte = false;
      try {
        await slot.query('BEGIN');
        await slot.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['securityLog']);
        werk = Promise.allSettled([a.commitVerzoek(da, wa), b.commitVerzoek(db, wb)]);
        const einde = Date.now() + 5000;
        while (Date.now() < einde) {
          const q = await a.pool.query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted
            AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
          if (q.rows[0].n >= 2) { wachtte = true; break; }
          await new Promise(r => setTimeout(r, 10));
        }
      } finally { await slot.query('ROLLBACK'); slot.release(); }
      const uit = await werk;
      assert.equal(wachtte, true, 'beide transacties moeten waarneembaar wachten');
      for (const r of uit) assert.equal(r.status, 'fulfilled', r.reason && r.reason.stack);
      const na = await lees();
      assert.deepEqual(Object.keys(na.sessions).sort(), ['A', 'B']);
      assert.deepEqual(na.securityLog.map(r => r.wie).sort(), ['A', 'B', 'historie']);
      assert.deepEqual(na.supplierActivity.AAA.map(r => r.who).sort(), ['A', 'B', 'historie']);
      assert.equal(keten.verifieer(na.securityLog).ok, true);
    });

    await t.test('ambigue gelijke toevoegingen: één commit, verliezer zonder deelsessie', async () => {
      const da = await a.laadAlles(), db = await b.laadAlles();
      const uit = await Promise.allSettled([a.commitVerzoek(da, delta(da, 'C', 'gelijk')), b.commitVerzoek(db, delta(db, 'D', 'gelijk'))]);
      assert.equal(uit.filter(r => r.status === 'fulfilled').length, 1);
      const fout = uit.find(r => r.status === 'rejected'); assert.equal(fout.reason.code, 'PG_REQUEST_CONFLICT');
      const na = await lees();
      assert.equal(['C', 'D'].filter(id => na.sessions[id]).length, 1);
      assert.equal(na.securityLog.filter(r => r.wie === 'gelijk').length, 1);
      assert.equal(na.supplierActivity.AAA.filter(r => r.who === 'gelijk').length, 1);
    });

    await t.test('trigger na sessions/securityLog schrijft niets gedeeltelijk en laat retry toe', async () => {
      const data = await a.laadAlles(), voor = await ruw(), lokaal = kopie(data);
      const caches = kopie({ toegepast: [...a._staat.toegepast], json: [...a._staat.laatsteJson] });
      await a.pool.query(`CREATE FUNCTION inlog_stop() RETURNS trigger AS $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM kv WHERE key='sessions' AND ver > ${Math.max(...voor.map(r => Number(r.ver)))}) THEN
          RAISE EXCEPTION 'sessionswrite niet bereikt';
        END IF;
        RAISE EXCEPTION 'late supplierActivitywrite geweigerd'; END $$ LANGUAGE plpgsql`);
      await a.pool.query(`CREATE TRIGGER inlog_fout BEFORE INSERT OR UPDATE ON kv FOR EACH ROW
        WHEN (NEW.key='supplierActivity') EXECUTE FUNCTION inlog_stop()`);
      const w = delta(data, 'rollback');
      try { await assert.rejects(a.commitVerzoek(data, w), /late supplierActivitywrite geweigerd/); }
      finally { await a.pool.query('DROP TRIGGER inlog_fout ON kv'); }
      assert.deepEqual(await ruw(), voor); assert.deepEqual(data, lokaal);
      assert.deepEqual({ toegepast: [...a._staat.toegepast], json: [...a._staat.laatsteJson] }, caches);
      await a.commitVerzoek(data, w);
      const na = await lees(); assert.ok(na.sessions.rollback);
      assert.equal(na.securityLog.filter(r => r.wie === 'rollback').length, 1);
      assert.equal(na.supplierActivity.AAA.filter(r => r.who === 'rollback').length, 1);
    });
  } finally {
    await Promise.allSettled([a.sluit(), b.sluit()]); await iso.close();
  }
});
