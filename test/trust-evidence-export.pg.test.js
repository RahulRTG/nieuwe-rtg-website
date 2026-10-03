'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sourceReader = require('../server/kern/bewijsvlak/runtime-evidence-source');

const URL = process.env.DATABASE_URL || process.env.PG_URL;

function laadKluis(sleutel) {
  const oud = process.env.RTG_ENC_KEY; process.env.RTG_ENC_KEY = sleutel;
  delete require.cache[require.resolve('../server/kluis')];
  const kluis = require('../server/kluis'); delete require.cache[require.resolve('../server/kluis')];
  if (oud == null) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  return kluis;
}

if (!URL) {
  test('runtime evidence-export PostgreSQL-poort vereist DATABASE_URL', { skip: true }, () => {});
} else {
  test('PostgreSQL runtime-export leest trustEvidence zonder de autoritatieve rij te wijzigen', async t => {
    const { Pool } = require('../server/pgwire'), pool = new Pool({ connectionString: URL, max: 1 });
    t.after(async () => { await pool.end(); });
    await pool.query(`CREATE TABLE kv (
      key TEXT PRIMARY KEY, val TEXT NOT NULL, ver BIGINT NOT NULL DEFAULT 0,
      bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now(), weg BOOLEAN NOT NULL DEFAULT false)`);
    const kluis = laadKluis('7'.repeat(64));
    const root = { ledger: [], blobs: {}, v3: { evidence: {}, claims: {}, decisions: {},
      conflicts: {}, reconciliations: {} } };
    const waarde = kluis.versleutel(JSON.stringify(root));
    await pool.query('INSERT INTO kv(key,val,ver,weg) VALUES($1,$2,$3,false)',
      ['trustEvidence', waarde, 91]);
    const voor = (await pool.query('SELECT val, ver, weg, bijgewerkt FROM kv WHERE key=$1',
      ['trustEvidence'])).rows[0];
    const gelezen = await sourceReader.lees({ env: { ...process.env, RTG_STORE: 'postgres',
      DATABASE_URL: URL, PG_URL: '' }, kluis });
    const na = (await pool.query('SELECT val, ver, weg, bijgewerkt FROM kv WHERE key=$1',
      ['trustEvidence'])).rows[0];
    assert.equal(gelezen.store, 'postgres'); assert.equal(gelezen.sourceRevision, 91);
    assert.deepEqual(gelezen.trustEvidence, root);
    assert.deepEqual(na, voor, 'read-only export veranderde waarde, versie, grafsteen noch tijdstip');
  });
}
