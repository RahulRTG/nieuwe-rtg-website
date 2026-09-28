/* ACCOUNTMUTATIES IN PRODUCTIE: EEN WERKKOPIE DIE IN DE REQUESTCOMMIT LANDT.

   Tot 27 september 2026 gaf elke accountmutatie in productie 503
   (PG_ACCOUNTS_ATOMAIR_ONTBREEKT): registreren, wachtwoord herstellen, een pas
   toekennen. Nu schrijft een productieverzoek op een eigen SQLite-verbinding
   binnen een open transactie, en die werkkopie is DEELNEMER aan dezelfde
   PostgreSQL-commit als de collecties (server/db/deelnemers.js). Pas na COMMIT
   volgt de lokale cache.

   Deze proef draait de ECHTE keten: de responspoort (postgres-verzoeken.js),
   de echte commitVerzoek (pg/verzoektransactie.js) met een nagemaakte
   PostgreSQL-client, en de echte werkkopie op een echte SQLite in een
   wegwerpmap. Alleen de laatste stap -- de rijen in PostgreSQL zetten -- is
   vervangen door een opnemer; die staat apart beproefd in
   test/accounts-requestcommit.pg.test.js tegen een echte PostgreSQL.

   Draai los: node --test test/accounts-transactie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accounttx-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';
process.env.RTG_MAGNAAT_TEST = '1';
delete process.env.DATABASE_URL;
delete process.env.PG_URL;

const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const mirror = require('../server/accounts/mirror');
const transactie = require('../server/accounts/transactie');
const duurzaamheid = require('../server/accounts/duurzaamheid');
const achtergrond = require('../server/accounts/achtergrond');
const verzoekcontext = require('../server/db/verzoekcontext');
const web = require('../server/web');
const state = require('../server/db/state');
const maakGrens = require('../server/db/postgres-verzoeken');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Productie aan ALLEEN rond de handeling: de accountmodule is geladen zonder
   DATABASE_URL, dus de spiegel is inert en we kunnen zijn PostgreSQL-stap
   vervangen door een opnemer. */
function alsProductie(fn) {
  return async () => {
    const oud = { n: process.env.NODE_ENV, d: process.env.DATABASE_URL };
    const echt = mirror.commitAccountWijzigingen;
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://proef.invalid/rtg';
    try { await fn(); }
    finally {
      mirror.commitAccountWijzigingen = echt;
      transactie.resetVoorToets();
      if (oud.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud.n;
      if (oud.d === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oud.d;
    }
  };
}

/* Een nagemaakte PostgreSQL-pool die elke zin opschrijft. `faal` laat een
   bepaalde zin gooien, zodat we de terugweg kunnen beproeven. */
function nepPool(faal = {}) {
  const zinnen = [];
  return { zinnen, connect: async () => ({
    query: async (sql) => {
      zinnen.push(String(sql).trim().split(/\s+/)[0]);
      if (faal[sql]) throw faal[sql];
      return { rows: [] };
    },
    release() {}
  }) };
}

function echteCommit(pool) {
  return require('../server/pg/verzoektransactie')({ pool, uitStore: v => v, naarStore: v => v,
    toegepast: new Map(), laatsteJson: new Map(), laatsteGrootte: new Map(),
    laatsteLengte: new Map(), laatsteCheck: new Map() }).commitVerzoek;
}

async function server(route, pool) {
  state.setRuweData({});
  const motor = { commitVerzoek: echteCommit(pool), openstaandeWijzigingen: () => [],
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => ({}) };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  route(app);
  const srv = await new Promise((ja, nee) => { const s = app.listen(0, '127.0.0.1', () => ja(s)); s.on('error', nee); });
  return { basis: `http://127.0.0.1:${srv.address().port}`,
    stop: () => { grens.stop(); return new Promise(r => srv.close(r)); } };
}

const lidMet = async (email) => accounts.createUser({ email, password: 'geheim1234', tier: 'rtg', realName: 'Proef Lid' });
const resetVan = id => (S.db.prepare('SELECT reset_hash FROM users WHERE id = ?').get(id) || {}).reset_hash;

test('1. een accountmutatie in productie landt als deelnemer in de PostgreSQL-commit, en pas daarna lokaal', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('een@proef.test'); process.env.NODE_ENV = 'production';
  const opgenomen = [];
  mirror.commitAccountWijzigingen = async (_client, lijst) => { opgenomen.push(...lijst); return { geschreven: lijst.length }; };
  const pool = nepPool();
  const s = await server(app => app.post('/x', (_q, res) => {
    S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h1', u.id);
    assert.notEqual(resetVan(u.id), 'h1', 'de bevestigde cache ziet de werkkopie niet vóór COMMIT');
    res.json({ ok: true });
  }), pool);
  try {
    const r = await fetch(s.basis + '/x', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(pool.zinnen, ['BEGIN', 'COMMIT'], 'een transactie, zonder collecties');
    assert.equal(opgenomen.length, 1);
    assert.equal(opgenomen[0].tabel, 'users');
    assert.equal(opgenomen[0].id, Number(u.id));
    assert.equal(opgenomen[0].basis.reset_hash, null, 'de basis is de stand van vóór het verzoek');
    assert.equal(opgenomen[0].na.reset_hash, 'h1');
    assert.equal(resetVan(u.id), 'h1', 'na COMMIT volgt de lokale cache');
    assert.equal(transactie.bezet(), false, 'het schrijfslot is vrij');
  } finally { await s.stop(); }
}));

test('2. faalt PostgreSQL, dan geen 2xx en geen lokale wijziging', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('twee@proef.test'); process.env.NODE_ENV = 'production';
  mirror.commitAccountWijzigingen = async () => { throw Object.assign(new Error('PG weg'), { code: 'ECONNRESET' }); };
  const pool = nepPool();
  const s = await server(app => app.post('/x', (_q, res) => {
    S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h2', u.id);
    res.json({ ok: true });
  }), pool);
  try {
    const r = await fetch(s.basis + '/x', { method: 'POST' });
    assert.equal(r.status, 503);
    assert.ok(pool.zinnen.includes('ROLLBACK'));
    assert.equal(resetVan(u.id), null, 'de lokale cache bleef op de bevestigde stand');
    assert.equal(transactie.bezet(), false);
  } finally { await s.stop(); }
}));

test('3. een conflict in PostgreSQL wordt 409 en draait de werkkopie terug', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('drie@proef.test'); process.env.NODE_ENV = 'production';
  mirror.commitAccountWijzigingen = async () => {
    throw Object.assign(new Error('basis verouderd'), { code: 'PG_REQUEST_CONFLICT' });
  };
  const s = await server(app => app.post('/x', (_q, res) => {
    S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h3', u.id);
    res.json({ ok: true });
  }), nepPool());
  try {
    const r = await fetch(s.basis + '/x', { method: 'POST' });
    assert.equal(r.status, 409);
    assert.equal(resetVan(u.id), null);
  } finally { await s.stop(); }
}));

test('4. een 4xx na de mutatie commit niets en draait terug', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('vier@proef.test'); process.env.NODE_ENV = 'production';
  let gevraagd = 0;
  mirror.commitAccountWijzigingen = async () => { gevraagd++; return { geschreven: 1 }; };
  const pool = nepPool();
  const s = await server(app => app.post('/x', (_q, res) => {
    S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h4', u.id);
    res.status(400).json({ error: 'nee' });
  }), pool);
  try {
    const r = await fetch(s.basis + '/x', { method: 'POST' });
    assert.equal(r.status, 400);
    assert.equal(gevraagd, 0); assert.deepEqual(pool.zinnen, []);
    assert.equal(resetVan(u.id), null);
    assert.equal(transactie.bezet(), false);
  } finally { await s.stop(); }
}));

test('5. is de uitkomst van COMMIT onbekend, dan terug en de cache opnieuw uit PostgreSQL', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('vijf@proef.test'); process.env.NODE_ENV = 'production';
  mirror.commitAccountWijzigingen = async () => ({ geschreven: 1 });
  const echtHerstel = mirror.planAccountHerstel; let herstel = 0;
  mirror.planAccountHerstel = () => { herstel++; };
  const pool = nepPool({ COMMIT: Object.assign(new Error('verbinding weg tijdens COMMIT'), { code: 'ECONNRESET' }) });
  const s = await server(app => app.post('/x', (_q, res) => {
    S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h5', u.id);
    res.json({ ok: true });
  }), pool);
  try {
    const r = await fetch(s.basis + '/x', { method: 'POST' });
    assert.equal(r.status, 503);
    assert.equal(resetVan(u.id), null);
    assert.equal(herstel, 1, 'een onzekere COMMIT plant een volledige herbouw');
  } finally { mirror.planAccountHerstel = echtHerstel; await s.stop(); }
}));

test('6. een tweede schrijver wacht nooit: 503 terwijl de eerste nog open staat, zonder de loop vast te zetten', alsProductie(async () => {
  process.env.NODE_ENV = 'test';
  const a = await lidMet('zes-a@proef.test'); const b = await lidMet('zes-b@proef.test');
  process.env.NODE_ENV = 'production';
  mirror.commitAccountWijzigingen = async () => ({ geschreven: 1 });
  let laatGaan; const poort = new Promise(r => { laatGaan = r; });
  let binnen; const isBinnen = new Promise(r => { binnen = r; });
  const s = await server(app => {
    app.post('/a', async (_q, res) => {
      S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('ha', a.id);
      binnen(); await poort; res.json({ ok: true });
    });
    app.post('/b', (_q, res) => {
      try { S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('hb', b.id); }
      catch (e) { /* een legacy catch mag er geen 2xx van maken */ }
      res.json({ ok: true });
    });
  }, nepPool());
  try {
    const eerste = fetch(s.basis + '/a', { method: 'POST' });
    await isBinnen;
    const t0 = Date.now();
    assert.throws(() => S.db.prepare('UPDATE users SET reset_hash = ? WHERE id = ?').run('rauw', b.id),
      e => /busy|locked/i.test(String(e.message)), 'een rauwe schrijver op S.db krijgt meteen BUSY');
    const tweede = await fetch(s.basis + '/b', { method: 'POST' });
    assert.equal(tweede.status, 503, 'de tweede accountmutatie krijgt een herhaalbare 503');
    assert.ok(Date.now() - t0 < 1000, 'en niemand wachtte op een SQLite-slot');
    laatGaan();
    assert.equal((await eerste).status, 200);
    assert.equal(resetVan(a.id), 'ha');
    assert.equal(resetVan(b.id), null);
    assert.equal(S.db.prepare('PRAGMA busy_timeout').get().timeout, 5000, 'S.db wacht weer gewoon');
  } finally { laatGaan(); await s.stop(); }
}));

test('7. buiten een verzoek: een eigen transactie voor accounts, en nooit een collectie', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('zeven@proef.test'); process.env.NODE_ENV = 'production';
  const opgenomen = [];
  mirror.commitAccountWijzigingen = async (_c, lijst) => { opgenomen.push(...lijst); return { geschreven: lijst.length }; };
  const echtPool = mirror.accountPool; const pool = nepPool();
  mirror.accountPool = () => pool;
  try {
    await achtergrond.buitenVerzoek(() => S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h7', u.id));
    assert.deepEqual(pool.zinnen, ['BEGIN', 'COMMIT']);
    assert.equal(opgenomen.length, 1);
    assert.equal(resetVan(u.id), 'h7');
    state.setRuweData({ iets: [] });
    await assert.rejects(achtergrond.buitenVerzoek(() => {
      S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h7b', u.id);
      verzoekcontext.dataVoor(state.getRuweData()).iets = [1];
    }), e => e.code === 'PG_ACCOUNTS_ACHTERGROND_COLLECTIE');
    assert.equal(resetVan(u.id), 'h7', 'de geweigerde achtergrondmutatie liet niets achter');
    assert.equal(transactie.bezet(), false);
  } finally { mirror.accountPool = echtPool; }
}));

test('8. buiten een verzoek en zonder achtergrondweg: GEEN_REQUEST, en de cache blijft staan', alsProductie(async () => {
  process.env.NODE_ENV = 'test'; const u = await lidMet('acht@proef.test'); process.env.NODE_ENV = 'production';
  assert.throws(() => S.zin('UPDATE users SET reset_hash = ? WHERE id = ?').run('h8', u.id),
    e => e.code === 'PG_ACCOUNTS_GEEN_REQUEST');
  assert.equal(resetVan(u.id), null);
}));

test('9. de releasestand volgt de STRUCTUUR en niet een vlag', () => {
  assert.equal(duurzaamheid.releaseStand().gereed, true);
  assert.equal(duurzaamheid.releaseStand().code, 'PG_ACCOUNTS_ATOMAIR_BEVESTIGD');
  const echt = verzoekcontext.registreerDeelnemer;
  try {
    verzoekcontext.registreerDeelnemer = undefined;
    const r = duurzaamheid.releaseStand();
    assert.equal(r.gereed, false, 'zonder deelnemersprotocol is het weer de blokkade');
    assert.equal(r.code, 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT');
  } finally { verzoekcontext.registreerDeelnemer = echt; }
});
