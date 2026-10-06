'use strict';

/* PostgreSQL-cases worden door pg.test.js geregistreerd nadat diens ene
   DATABASE_URL-poort is geopend. Daardoor bestaan er niet twee extra tests die
   zichzelf in de gewone suite groen overslaan, terwijl test:pg exact dezelfde
   integratiecases blijft uitvoeren. */
function laadKluis(sleutel) {
  const oud = process.env.RTG_ENC_KEY; process.env.RTG_ENC_KEY = sleutel;
  delete require.cache[require.resolve('../server/kluis')];
  const kluis = require('../server/kluis'); delete require.cache[require.resolve('../server/kluis')];
  if (oud == null) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  return kluis;
}

function registreerTrustEvidencePg({ test, assert, URL, maakPg, merge3 }) {
  test('PostgreSQL runtime-export leest trustEvidence zonder de autoritatieve rij te wijzigen', async t => {
    const { Pool } = require('../server/pgwire'), pool = new Pool({ connectionString: URL, max: 1 });
    t.after(async () => { await pool.end(); });
    await pool.query('DROP TABLE IF EXISTS kv');
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
    const sourceReader = require('../server/kern/bewijsvlak/runtime-evidence-source');
    const gelezen = await sourceReader.lees({ env: { ...process.env, RTG_STORE: 'postgres',
      DATABASE_URL: URL, PG_URL: '' }, kluis });
    const na = (await pool.query('SELECT val, ver, weg, bijgewerkt FROM kv WHERE key=$1',
      ['trustEvidence'])).rows[0];
    assert.equal(gelezen.store, 'postgres'); assert.equal(gelezen.sourceRevision, 91);
    assert.deepEqual(gelezen.trustEvidence, root);
    assert.deepEqual(na, voor, 'read-only export veranderde waarde, versie, grafsteen noch tijdstip');
  });

  test('PostgreSQL migreert V2-evidence atomair en rolt een gooiende bewerker terug', async t => {
    const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
    const { hash } = require('../server/kern/bewijsvlak/canon');
    const migration = require('../server/kern/bewijsvlak/legacy-v2-migration');
    const archive = require('../server/kern/bewijsvlak/legacy-archive');
    const kluis = laadKluis('8'.repeat(64));
    const pg = maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    t.after(async () => { await pg.sluit(); });
    await pg.pool.query('DROP TABLE IF EXISTS kv'); await pg.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
    await pg.schema();
    const id = 'evidence_' + '2'.repeat(64), inhoud = { geheim: 'PG-LEGACY-GEHEIM' };
    const root = { ledger: [], blobs: { [id]: { evidenceId: id, digest: hash(inhoud),
      metadata: { kind: 'payment', subjectRef: { id: 'PG-SUBJECT' } }, content: inhoud } } };
    const data = { trustEvidence: structuredClone(root) };
    await pg.flush(data, true);
    const basis = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rtg-evidence-pg-'));
    const datamap = path.join(basis, 'data'), archiefmap = path.join(basis, 'archive');
    fs.mkdirSync(datamap, { mode: 0o700 }); fs.mkdirSync(archiefmap, { mode: 0o700 });
    t.after(() => fs.rmSync(basis, { recursive: true, force: true }));
    const plan = migration.maakPlan(root, { sourceStore: 'postgres' });
    const bewijs = archive.archiveer({ plan, kluis, directory: archiefmap, dataDirectory: datamap });
    const bewerkCollectie = (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk);
    const uit = await migration.voerUit({ plan, archive: bewijs, bewerkCollectie });
    assert.equal(uit.changed, true);
    let vers = await pg.laadAlles();
    assert.equal(migration.legacyEntries(vers.trustEvidence).length, 0);
    assert.equal(JSON.stringify(vers.trustEvidence).includes('PG-LEGACY-GEHEIM'), false);
    const voor = JSON.stringify(vers.trustEvidence);
    await assert.rejects(() => pg.bewerkCollectie('trustEvidence', vers, state => {
      state.blobs[id].metadata.kind = 'geknoeid'; state.fouteReceipt = true;
      throw Object.assign(new Error('bewuste rollback'), { code: 'TEST_ROLLBACK' });
    }), error => error.code === 'TEST_ROLLBACK');
    vers = await pg.laadAlles();
    assert.equal(JSON.stringify(vers.trustEvidence), voor);
  });
}

module.exports = { registreerTrustEvidencePg };
