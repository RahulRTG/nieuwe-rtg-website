'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { hash } = require('../server/kern/bewijsvlak/canon');
const migration = require('../server/kern/bewijsvlak/legacy-v2-migration');
const archive = require('../server/kern/bewijsvlak/legacy-archive');

const URL = process.env.DATABASE_URL || process.env.PG_URL;

function laadKluis(sleutel) {
  const oud = process.env.RTG_ENC_KEY; process.env.RTG_ENC_KEY = sleutel;
  delete require.cache[require.resolve('../server/kluis')];
  const kluis = require('../server/kluis'); delete require.cache[require.resolve('../server/kluis')];
  if (oud == null) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  return kluis;
}
if (!URL) {
  test('trust-evidence V2 PostgreSQL-migratie vereist DATABASE_URL', { skip: true }, () => {});
} else {
  test('PostgreSQL migreert de collectie atomair en rolt een gooiende bewerker terug', async t => {
    const { maakPg } = require('../server/pg'), { merge3 } = require('../server/db');
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
