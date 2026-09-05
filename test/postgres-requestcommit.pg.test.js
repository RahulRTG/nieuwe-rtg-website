/* Echte PostgreSQL failure-injection: een backend wordt gedood terwijl de
   request op zijn eerste collectieslot wacht. Er mag geen 200 en geen halve
   collectiecommit ontstaan; een tweede app-instance kan daarna exact eenmaal
   retryen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const web = require('../server/web');
const context = require('../server/db/verzoekcontext');
const maakGrens = require('../server/db/postgres-verzoeken');
const { maakPg } = require('../server/pg');
const { merge3 } = require('../server/db/merge');
const kluis = require('../server/kluis');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist echte PostgreSQL';
const wacht = ms => new Promise(r => setTimeout(r, ms));
function begrens(belofte, naam, ms = 5000) {
  let timer;
  const teLaat = new Promise((_ja, nee) => {
    timer = setTimeout(() => nee(new Error('fase-timeout: ' + naam)), ms);
  });
  return Promise.race([Promise.resolve(belofte), teLaat]).finally(() => clearTimeout(timer));
}

function maakStaat(begin) {
  let raw = begin;
  const db = { writable: true };
  Object.defineProperty(db, 'data', {
    get: () => context.dataVoor(raw),
    set: v => { if (!context.zetWortel(v)) raw = v; }
  });
  return { db, getRuweData: () => raw, setRuweData: v => { raw = v; } };
}

async function appVoor(pg, begin) {
  const state = maakStaat(begin);
  let keten = Promise.resolve();
  const slot = fn => { const r = keten.then(fn, fn); keten = r.catch(() => {}); return r; };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => pg,
    slot, basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware()); app.use(web.json());
  app.post('/api/proef', (req, res) => {
    const id = String(req.body.id || '');
    if (!state.db.data.bewijs.some(x => x.id === id)) state.db.data.bewijs.push({ id });
    state.db.data.bewijsMeta[id] = (state.db.data.bewijsMeta[id] || 0) + 1;
    context.noteerSave();
    res.json({ ok: true, id });
  });
  app.post('/api/rol', (req, res) => {
    state.db.data.rechten.rol = String(req.body.rol || '');
    context.noteerSave(); res.json({ ok: true });
  });
  app.get('/api/ready', (_req, res) => res.status(grens.klaar() ? 200 : 503).json(grens.stand()));
  const server = await new Promise((ja, nee) => {
    const s = app.listen(0, '127.0.0.1', () => ja(s)); s.on('error', nee);
  });
  return { state, grens, basis: `http://127.0.0.1:${server.address().port}`,
    stop: async () => {
      const klaar = new Promise(r => server.close(r));
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await begrens(klaar, 'HTTP-server sluiten', 2000).catch(() => {});
    } };
}

test('PG-backend kill vóór commit: geen 200, geen halve staat, multi-instance retry exact eenmaal',
  { skip: OVERSLAAN, timeout: 60000 }, async (t) => {
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const a = nieuw(), b = nieuw();
    const stap = async (naam, belofte, ms) => {
      t.diagnostic('start ' + naam);
      const uit = await begrens(belofte, naam, ms);
      t.diagnostic('klaar ' + naam); return uit;
    };
    let A, B, houder, aanvraagAbort;
    try {
      await stap('oude economische tabel wissen', a.pool.query('DROP TABLE IF EXISTS economische_boekingen'));
      await stap('oude kv wissen', a.pool.query('DROP TABLE IF EXISTS kv'));
      await stap('oude sequence wissen', a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq'));
      await stap('schema', a.schema());
      await stap('seed', a.flush({ bewijs: [], bewijsMeta: {}, rechten: { rol: 'lid', taal: 'nl' } }, true), 10000);
      const beginA = await stap('instance A laden', a.laadAlles());
      const beginB = await stap('instance B laden', b.laadAlles());
      A = await stap('HTTP A luisteren', appVoor(a, beginA));
      B = await stap('HTTP B luisteren', appVoor(b, beginB));

      /* Houd het eerste alfabetische slot vast. De request kan daardoor nog
         geen enkele kv-rij wijzigen wanneer zijn backend wordt beëindigd. */
      houder = await stap('slothouder verbinden', b.pool.connect());
      await stap('slothouder BEGIN', houder.query('BEGIN'));
      await stap('slothouder lock', houder.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['bewijs']));

      let ontvangen = false;
      aanvraagAbort = new AbortController();
      const eerste = fetch(A.basis + '/api/proef', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'een' }),
        signal: aanvraagAbort.signal })
        .then(async r => ({ status: r.status, body: await r.json() })).finally(() => { ontvangen = true; });

      let pid = null;
      for (let i = 0; i < 80 && !pid; i++) {
        const q = await stap('lock-wachter zoeken ' + i, b.pool.query(
          `SELECT pid FROM pg_stat_activity
           WHERE wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'
           ORDER BY query_start DESC LIMIT 1`), 2000);
        pid = q.rows[0] && Number(q.rows[0].pid);
        if (!pid) await wacht(25);
      }
      assert.ok(pid, 'de request bereikte zijn PostgreSQL-slot niet');
      assert.equal(ontvangen, false, 'HTTP antwoordde terwijl COMMIT nog onmogelijk was');
      const dood = await stap('geblokkeerde backend doden', b.pool.query('SELECT pg_terminate_backend($1) AS ok', [pid]));
      assert.equal(dood.rows[0].ok, true);
      const mislukt = await stap('503-antwoord na backendkill', eerste, 5000);
      assert.equal(mislukt.status, 503, 'een verbroken commit werd als succes bevestigd');
      await stap('slothouder rollback', houder.query('ROLLBACK')); houder.release(); houder = null;

      let waar = await stap('rollbackstaat lezen', b.pool.query("SELECT key,val FROM kv WHERE key IN ('bewijs','bewijsMeta')"));
      let data = Object.fromEntries(waar.rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))]));
      assert.deepEqual(data, { bewijs: [], bewijsMeta: {} }, 'rollback liet een halve request achter');

      const retry = await stap('retry op instance B', fetch(B.basis + '/api/proef', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'een' }) }), 10000);
      assert.equal(retry.status, 200);
      waar = await stap('retrystaat lezen', b.pool.query("SELECT key,val FROM kv WHERE key IN ('bewijs','bewijsMeta')"));
      data = Object.fromEntries(waar.rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))]));
      assert.deepEqual(data.bewijs, [{ id: 'een' }]);
      assert.deepEqual(data.bewijsMeta, { een: 1 });

      await stap('instance A volledige resync', A.grens.herstelNu(), 10000);
      assert.equal((await fetch(A.basis + '/api/ready')).status, 200,
        'instance heropende niet na een aantoonbare volledige resync');

      /* Beide instances lazen rol=lid. A trekt eerst in; B mag zijn stale
         werkkopie daarna niet als een geldige laatste schrijver terugzetten. */
      const intrek = await stap('rol intrekken op A', fetch(A.basis + '/api/rol', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rol: 'ingetrokken' }) }), 10000);
      assert.equal(intrek.status, 200);
      const stale = await stap('stale rol op B', fetch(B.basis + '/api/rol', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rol: 'beheer' }) }), 10000);
      assert.equal(stale.status, 409, 'een stale rolwijziging overschreef een intrekking');
      const rechtRij = await stap('rollenstaat lezen', b.pool.query("SELECT val FROM kv WHERE key='rechten'"));
      assert.deepEqual(JSON.parse(kluis.ontsleutel(rechtRij.rows[0].val)), { rol: 'ingetrokken', taal: 'nl' });
      assert.equal((await fetch(B.basis + '/api/ready')).status, 200,
        'een inhoudsconflict mag de database-health niet sluiten');
    } finally {
      if (aanvraagAbort) aanvraagAbort.abort();
      if (houder) { try { await houder.query('ROLLBACK'); } catch (e) {} try { houder.release(); } catch (e) {} }
      if (A) { A.grens.stop(); await A.stop(); }
      if (B) { B.grens.stop(); await B.stop(); }
      await begrens(a.sluit(), 'pool A sluiten', 2000).catch(() => {});
      await begrens(b.sluit(), 'pool B sluiten', 2000).catch(() => {});
    }
  });
