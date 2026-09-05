'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const web = require('../server/web');
const state = require('../server/db/state');
const accountState = require('../server/accounts/state');
const duurzaamheid = require('../server/accounts/duurzaamheid');
const maakGrens = require('../server/db/postgres-verzoeken');
const accountschrijvers = require('../scripts/lib/accountschrijvers');

async function luister(app) {
  const srv = await new Promise((ja, nee) => {
    const s = app.listen(0, '127.0.0.1', () => ja(s)); s.on('error', nee);
  });
  return { basis: `http://127.0.0.1:${srv.address().port}`,
    stop: () => new Promise(r => srv.close(r)) };
}

test('accountwrites zijn in productie vóór SQLite dicht en een ingeslikte fout wordt nooit 2xx', async () => {
  const oudNode = process.env.NODE_ENV, oudUrl = process.env.DATABASE_URL;
  let sqliteWrites = 0, commits = 0;
  try {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://productie.invalid/rtg';
    accountState.db = { prepare: () => ({
      run() { sqliteWrites++; return { changes: 1 }; }, get() { return null; }, all() { return []; }
    }) };

    const zin = accountState.zin('UPDATE users SET reset_hash = NULL WHERE id = ?');
    assert.throws(() => zin.run(1), e => e && e.code === 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT');
    assert.equal(sqliteWrites, 0, 'de lokale cache wijzigde vóór de productiegrendel');
    duurzaamheid.internePublicatie(() => zin.run(1));
    assert.equal(sqliteWrites, 1, 'autoritatieve PG-replicatie mag de lokale leescache bijwerken');

    state.setRuweData({ bewijs: [] });
    const motor = { commitVerzoek: async () => { commits++; },
      pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => ({}),
      openstaandeWijzigingen: () => [] };
    const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
      slot: fn => fn(), basisKlaar: () => true });
    grens.gestart();
    const app = web(); app.use(grens.middleware());
    app.post('/api/auth/reset', (_req, res) => {
      try { zin.run(1); } catch (e) { /* nabootsing van een legacy catch */ }
      res.json({ ok: true });
    });
    const s = await luister(app);
    try {
      const r = await fetch(s.basis + '/api/auth/reset', { method: 'POST' });
      assert.equal(r.status, 503);
      assert.match((await r.json()).error, /opslag|duurzaam/i);
      assert.equal(sqliteWrites, 1); assert.equal(commits, 0);
    } finally { grens.stop(); await s.stop(); }
  } finally {
    accountState.db = null;
    if (oudNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oudNode;
    if (oudUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oudUrl;
  }
});

test('CTE en gequote accounttabellen kunnen de productiegrendel niet omzeilen', () => {
  for (const sql of [
    'WITH doel AS (SELECT 1) UPDATE "users" SET actief = 0 WHERE id = 1',
    'DELETE FROM [supplier_staff] WHERE id = 1',
    'INSERT OR REPLACE INTO main.`users` (id) VALUES (1)',
    'WITH oud AS (SELECT id FROM users) DELETE FROM "users" WHERE id IN (SELECT id FROM oud)'
  ]) assert.equal(duurzaamheid.isAccountSchrijfzin(sql), true, sql);
  assert.equal(duurzaamheid.isAccountSchrijfzin('SELECT * FROM users'), false);
  assert.equal(duurzaamheid.isAccountSchrijfzin('UPDATE andere_tabel SET naam = ?'), false);
});

test('interne cachepublicatie is strikt synchroon en kan geen Promise-bypass laten ontsnappen', () => {
  assert.throws(() => duurzaamheid.internePublicatie(async () => true),
    e => e && e.code === 'PG_ACCOUNTS_INTERNE_ASYNC');
  assert.throws(() => duurzaamheid.internePublicatie(() => Promise.resolve(true)),
    e => e && e.code === 'PG_ACCOUNTS_INTERNE_ASYNC');
});

test('broncensus vindt alle accountwrites achter S.zin en faalt op een directe CTE-write', () => {
  const echt = accountschrijvers.controleer(path.join(__dirname, '..'));
  assert.equal(echt.ok, true, JSON.stringify(echt.onbewaakt));
  assert.ok(echt.bewaakteSchrijfzinnen >= 30, 'een lege of ingekorte scan mag niet groen zijn');
  assert.equal(echt.internePublicaties, 4);
  assert.equal(echt.explicieteUitzonderingen.length, 1);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-accountscan-'));
  try {
    const map = path.join(tmp, 'server', 'accounts');
    fs.mkdirSync(map, { recursive: true });
    fs.writeFileSync(path.join(map, 'lek.js'),
      `db.prepare('WITH x AS (SELECT 1) UPDATE "users" SET actief=0').run();\n`);
    const lek = accountschrijvers.controleer(tmp);
    assert.equal(lek.ok, false);
    assert.ok(lek.onbewaakt.length >= 1);
    assert.ok(lek.onbewaakt.some(x => x.bestand === 'server/accounts/lek.js'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('accountstatus blijft machineleesbaar BLOCKED tot gedeelde requesttransacties bestaan', () => {
  assert.deepEqual(duurzaamheid.releaseStand(), {
    code: 'PG_ACCOUNTS_ATOMAIR_ONTBREEKT', gereed: false, transactioneel: false,
    productieMutaties: 'gesloten', vereist: 'gedeelde-pg-requesttransactie'
  });
});

test('accountcensus en accountstatus zitten beide in de releaseketen', () => {
  const root = path.join(__dirname, '..');
  const poort = fs.readFileSync(path.join(root, 'scripts', 'release-gate.js'), 'utf8');
  const oordeel = fs.readFileSync(path.join(root, 'scripts', 'lib', 'productie-oordeel.js'), 'utf8');
  const golive = fs.readFileSync(path.join(root, 'scripts', 'golive.js'), 'utf8');
  assert.match(poort, /\['Accountschrijfgrens',[\s\S]*scripts\/accountschrijvers\.js/);
  assert.match(oordeel, /golive\.accounts[\s\S]*transactioneel === true[\s\S]*productieMutaties === 'duurzaam'/);
  assert.match(golive, /accounts: accountStand/);
});
