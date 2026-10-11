/* ACCOUNTS EN COLLECTIES IN EEN POSTGRESQL-TRANSACTIE -- tegen een echte
   PostgreSQL.

   test/accounts-transactie.test.js beproeft de orkestratie met een nagemaakte
   client. Deze proef beproeft wat daar vervangen was: dat de accountrijen
   ECHT in dezelfde PostgreSQL-transactie landen als de kv-collecties, dat een
   verouderde basis en een unieke botsing als 409 terugkomen, en dat een gedode
   backend vóór COMMIT niets achterlaat -- niet in PostgreSQL, niet in de
   collecties en niet in de lokale accountcache.

   Draai via `npm run test:pg` (eigen database per bestand). */
'use strict';
const test = require('node:test');
const { vereist } = require('./infra');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = vereist('pg', !!URL, 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accountpg-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';

test('accountmutatie en collectie landen samen of niet, tegen echte PostgreSQL',
  { skip: OVERSLAAN, timeout: 120000 }, async (t) => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const store = maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    for (const zin of ['DROP TABLE IF EXISTS kv', 'DROP SEQUENCE IF EXISTS kv_ver_seq',
      'DROP TABLE IF EXISTS supplier_staff', 'DROP TABLE IF EXISTS users', 'DROP SEQUENCE IF EXISTS rtg_id_seq'])
      await store.pool.query(zin);
    await store.schema();

    const accounts = require('../server/accounts');
    accounts.init();
    const S = require('../server/accounts/state');
    const mirror = require('../server/accounts/mirror');
    const transactie = require('../server/accounts/transactie');
    await accounts.startPostgres();

    const context = require('../server/db/verzoekcontext');
    const maakGrens = require('../server/db/postgres-verzoeken');
    const web = require('../server/web');
    let raw = {};
    const db = {};
    Object.defineProperty(db, 'data', { get: () => context.dataVoor(raw), set: v => { if (!context.zetWortel(v)) raw = v; } });
    const state = { db, getRuweData: () => raw, setRuweData: v => { raw = v; } };
    let keten = Promise.resolve();
    const slot = fn => { const r = keten.then(fn, fn); keten = r.catch(() => {}); return r; };
    const grens = maakGrens({ store: 'postgres', db, state, motor: () => store, slot, basisKlaar: () => true });
    grens.gestart();
    const app = web(); app.use(grens.middleware()); app.use(web.json());
    let tussendoor = null;
    app.post('/registreer', async (req, res) => {
      const u = await accounts.createUser({ email: req.body.email, password: 'geheim1234', tier: 'rtg', realName: 'Proef' });
      db.data.bewijs = (db.data.bewijs || []).concat([{ id: 'reg-' + u.id }]); context.noteerSave();
      if (tussendoor) await tussendoor(u);
      res.json({ id: u.id });
    });
    app.post('/reset', async (req, res) => {
      S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run(String(req.body.h), Number(req.body.id));
      if (tussendoor) await tussendoor({ id: Number(req.body.id) });
      res.json({ ok: true });
    });
    const srv = await new Promise((ja, nee) => { const s = app.listen(0, '127.0.0.1', () => ja(s)); s.on('error', nee); });
    const basis = `http://127.0.0.1:${srv.address().port}`;
    const post = (p, body) => fetch(basis + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const pgRij = async id => (await store.pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0] || null;
    const lokaal = id => S.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
    const echteCommit = mirror.commitAccountWijzigingen;

    const oudNode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await t.test('1. registratie: gebruiker en collectie in dezelfde commit, daarna lokaal', async () => {
        const r = await post('/registreer', { email: 'een@proef.test' });
        assert.equal(r.status, 200);
        const { id } = await r.json();
        const rij = await pgRij(id);
        assert.ok(rij, 'de gebruiker staat in PostgreSQL');
        assert.ok(lokaal(id), 'en in de lokale cache');
        const kv = await store.pool.query("SELECT val FROM kv WHERE key = 'bewijs'");
        assert.ok(kv.rows.length, 'de collectie landde in dezelfde commit');
        assert.equal(transactie.bezet(), false);
      });

      await t.test('2. verouderde basis: 409, en de lokale cache blijft op de bevestigde stand', async () => {
        const { id } = await (await post('/registreer', { email: 'twee@proef.test' })).json();
        tussendoor = async () => { await store.pool.query("UPDATE users SET reset_hash = 'ander' WHERE id = $1", [id]); };
        const r = await post('/reset', { id, h: 'mijn' });
        tussendoor = null;
        assert.equal(r.status, 409);
        assert.equal((await pgRij(id)).reset_hash, 'ander', 'de andere schrijver wint en blijft staan');
        assert.notEqual(lokaal(id).reset_hash, 'mijn', 'onze verworpen werkkopie staat nergens');
      });

      await t.test('3. unieke botsing met een rij die alleen PostgreSQL kent: 409 en niets lokaal', async () => {
        const email = 'drie@proef.test';
        const { id } = await (await post('/registreer', { email })).json();
        const hash = (await pgRij(id)).email_hash;
        /* De lokale cache vergeet de rij; PostgreSQL niet. Een tweede registratie
           op hetzelfde adres komt lokaal dus langs de unieke index en moet in
           PostgreSQL stranden -- de waarheid, niet de cache, beslist. */
        S.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        const r = await post('/registreer', { email });
        assert.equal(r.status, 409);
        assert.equal(S.db.prepare('SELECT COUNT(*) AS n FROM users WHERE email_hash = ?').get(hash).n, 0);
        assert.equal((await store.pool.query('SELECT COUNT(*)::int AS n FROM users WHERE email_hash = $1', [hash])).rows[0].n, 1);
      });

      await t.test('4. backend gedood tijdens de accountstap: 503, en noch PostgreSQL noch de cache noch de collectie', async () => {
        const kvVoor = (await store.pool.query("SELECT val FROM kv WHERE key = 'bewijs'")).rows[0].val;
        mirror.commitAccountWijzigingen = async (client) => {
          await client.query('SELECT pg_terminate_backend(pg_backend_pid())').catch(() => {});
          throw Object.assign(new Error('backend weg'), { code: 'ECONNRESET' });
        };
        const pgVoor = (await store.pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
        const lokaalVoor = S.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
        const r = await post('/registreer', { email: 'vier@proef.test' });
        mirror.commitAccountWijzigingen = echteCommit;
        assert.equal(r.status, 503);
        assert.equal((await store.pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n, pgVoor, 'geen rij in PostgreSQL');
        assert.equal(S.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, lokaalVoor, 'geen rij in de cache');
        const kvNa = (await store.pool.query("SELECT val FROM kv WHERE key = 'bewijs'")).rows[0].val;
        assert.equal(kvNa, kvVoor, 'ook de collectie van dit verzoek landde niet');
        assert.equal(transactie.bezet(), false);
      });
    } finally {
      mirror.commitAccountWijzigingen = echteCommit;
      process.env.NODE_ENV = oudNode;
      grens.stop();
      await new Promise(r => { srv.close(r); if (srv.closeAllConnections) srv.closeAllConnections(); });
      try { await accounts.flushBijAfsluiten(); } catch (e) {}
      try { await store.sluit(); } catch (e) {}
      fs.rmSync(TMP, { recursive: true, force: true });
    }
  });
