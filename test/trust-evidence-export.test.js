'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { hash } = require('../server/kern/bewijsvlak/canon');
const watermerk = require('../server/kern/bewijsvlak/capacity-watermark');
const exporter = require('../server/kern/bewijsvlak/runtime-evidence-export');
const sourceReader = require('../server/kern/bewijsvlak/runtime-evidence-source');

const ROOT = path.join(__dirname, '..');
const GEHEIM = 'UITSLUITEND-IN-HET-VERSLEUTELDE-ARTEFACT';
const RAW_ID = 'evidence_INTERNE_IDENTIFIER_123';

function laadKluis(sleutel) {
  const oud = process.env.RTG_ENC_KEY;
  process.env.RTG_ENC_KEY = sleutel;
  delete require.cache[require.resolve('../server/kluis')];
  const kluis = require('../server/kluis');
  delete require.cache[require.resolve('../server/kluis')];
  if (oud == null) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  return kluis;
}

function mappen(t) {
  const basis = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rtg-evidence-export-'));
  const data = path.join(basis, 'data'), archief = path.join(basis, 'archive');
  fs.mkdirSync(data, { mode: 0o700 }); fs.mkdirSync(archief, { mode: 0o700 });
  t.after(() => fs.rmSync(basis, { recursive: true, force: true }));
  return { basis, data, archief };
}

function legeV3(overrides) {
  return { evidence: {}, claims: {}, decisions: {}, conflicts: {}, reconciliations: {}, ...(overrides || {}) };
}

function veiligeState() {
  return { ledger: [{ evidenceRecordId: 'record_test', hash: 'a'.repeat(64) }],
    blobs: { [RAW_ID]: { schemaVersion: 2, evidenceId: RAW_ID,
      digest: 'b'.repeat(64), contentDigest: 'b'.repeat(64),
      metadata: { kind: 'test', metadataDigest: 'c'.repeat(64) } } },
    outbox: [{ id: 'event_private', payload: { secret: GEHEIM } }], inbox: [], metrics: {},
    v3: legeV3({ evidence: { e1: { evidenceId: 'e1', valueDigest: 'd'.repeat(64) } } }) };
}

function sha(bestand) {
  return crypto.createHash('sha256').update(fs.readFileSync(bestand)).digest('hex');
}

test('watermerken waarschuwen vóór de harde stop en export lost de debt niet op', () => {
  const root = { ledger: Array.from({ length: 7 }, (_, i) => ({ i })),
    blobs: Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['b' + i, {}])),
    v3: legeV3({ evidence: Object.fromEntries(Array.from({ length: 19 }, (_, i) => ['e' + i, {}])),
      claims: Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['c' + i, {}])) }) };
  const report = watermerk.meet(root, { limits: { v2: { records: 10, evidence: 10 },
    v3: { evidence: 20, claims: 10, decisions: 10, conflicts: 10, reconciliations: 10 } } });
  assert.equal(report.collections['v2.records'].status, 'OK');
  assert.equal(report.collections['v2.evidence'].status, 'WARNING');
  assert.equal(report.collections['v3.evidence'].status, 'CRITICAL');
  assert.equal(report.collections['v3.claims'].status, 'BLOCKED');
  assert.equal(report.highestStatus, 'BLOCKED');
  assert.equal(report.capacityFreedByExport, false);
  assert.deepEqual(report.evidenceDebt.map(x => x.resolvedByExport), [false, false, false]);
});

test('export is naamgebonden versleuteld, content-addressed, verifieerbaar en herhaalbaar', t => {
  const { basis, data, archief } = mappen(t), kluis = laadKluis('1'.repeat(64));
  const source = { store: 'sqlite', sourceRevision: 17, trustEvidence: veiligeState() };
  const planA = exporter.maakPlan(source, { now: '2026-10-01T10:00:00.000Z' });
  const receiptA = exporter.archiveer({ plan: planA, kluis, directory: archief, dataDirectory: data });
  const artifact = path.join(archief, receiptA.archiveFile);
  const receiptFile = path.join(archief, receiptA.archiveId + '.receipt.json');
  assert.equal(fs.statSync(archief).mode & 0o777, 0o700);
  assert.equal(fs.statSync(artifact).mode & 0o777, 0o400);
  assert.equal(fs.statSync(receiptFile).mode & 0o777, 0o400);
  assert.equal(fs.readFileSync(artifact).subarray(0, 7).toString(), 'RTGENC2');
  assert.equal(fs.readFileSync(artifact).includes(Buffer.from(GEHEIM)), false);
  assert.equal(fs.readFileSync(artifact).includes(Buffer.from(RAW_ID)), false);
  const openbaar = fs.readFileSync(receiptFile, 'utf8');
  assert.equal(openbaar.includes(GEHEIM), false); assert.equal(openbaar.includes(RAW_ID), false);
  assert.equal(openbaar.includes(archief), false); assert.equal(openbaar.includes(data), false);
  assert.equal(receiptA.productionMutated, false); assert.equal(receiptA.pruned, false);
  assert.equal(receiptA.capacityFreed, false); assert.equal(receiptA.retention.worm, false);
  assert.equal(receiptA.retention.offsite, false);
  assert.equal(exporter.verifieer({ archiveId: receiptA.archiveId, kluis,
    directory: archief, dataDirectory: data }).receiptDigest, receiptA.receiptDigest);

  const voor = { artifact: sha(artifact), receipt: sha(receiptFile), files: fs.readdirSync(archief).sort() };
  const planB = exporter.maakPlan(source, { now: '2026-10-01T11:00:00.000Z' });
  const receiptB = exporter.archiveer({ plan: planB, kluis, directory: archief, dataDirectory: data });
  assert.deepEqual(receiptB, receiptA, 'dezelfde inhoud hergebruikt het geverifieerde content-address');
  assert.deepEqual({ artifact: sha(artifact), receipt: sha(receiptFile), files: fs.readdirSync(archief).sort() }, voor);

  assert.throws(() => kluis.ontsleutelBestand(fs.readFileSync(artifact), 'andere-naam.rtge'));
  const verkeerdeKluis = laadKluis('2'.repeat(64));
  assert.throws(() => exporter.verifieer({ archiveId: receiptA.archiveId, kluis: verkeerdeKluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_VERIFY_FAILED');

  const origineel = fs.readFileSync(artifact), geknoeid = Buffer.from(origineel);
  geknoeid[geknoeid.length - 1] ^= 1;
  fs.chmodSync(artifact, 0o600); fs.writeFileSync(artifact, geknoeid); fs.chmodSync(artifact, 0o400);
  assert.throws(() => exporter.verifieer({ archiveId: receiptA.archiveId, kluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_VERIFY_FAILED');
  fs.chmodSync(artifact, 0o600); fs.writeFileSync(artifact, origineel); fs.chmodSync(artifact, 0o400);

  const extra = path.join(basis, 'extra-hardlink.rtge');
  fs.linkSync(artifact, extra);
  assert.throws(() => exporter.verifieer({ archiveId: receiptA.archiveId, kluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_FILE_UNSAFE');
  fs.unlinkSync(extra);

  const echt = artifact + '.echt'; fs.renameSync(artifact, echt); fs.symlinkSync(echt, artifact);
  assert.throws(() => exporter.verifieer({ archiveId: receiptA.archiveId, kluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_FILE_UNSAFE');
  fs.unlinkSync(artifact); fs.renameSync(echt, artifact);

  const receiptLink = path.join(basis, 'extra-receipt-hardlink.json');
  fs.linkSync(receiptFile, receiptLink);
  assert.throws(() => exporter.verifieer({ archiveId: receiptA.archiveId, kluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_FILE_UNSAFE');
  fs.unlinkSync(receiptLink);
});

test('exportmap weigert symlinks/overlap en legacy raw evidence faalt vóór schrijven', t => {
  const { basis, data, archief } = mappen(t), kluis = laadKluis('3'.repeat(64));
  const link = path.join(basis, 'archive-link'); fs.symlinkSync(archief, link);
  assert.throws(() => exporter.veiligeMap(link, data), error => error.code === 'EVIDENCE_EXPORT_PATH_UNSAFE');
  assert.throws(() => exporter.veiligeMap(data, data), error => error.code === 'EVIDENCE_EXPORT_NOT_SEPARATE');
  const inhoud = { geheim: GEHEIM }, id = 'evidence_' + 'e'.repeat(64);
  const legacy = { ledger: [], blobs: { [id]: { evidenceId: id, digest: hash(inhoud),
    metadata: { kind: 'test' }, content: inhoud } } };
  assert.throws(() => exporter.maakPlan({ store: 'sqlite', sourceRevision: 1,
    trustEvidence: legacy }), error => error.code === 'LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION');
  assert.equal(fs.readdirSync(archief).length, 0);
});

test('een zelf opnieuw gehashte maar inhoudelijk leugenachtige receipt faalt tegen het artefact', t => {
  const { data, archief } = mappen(t), kluis = laadKluis('7'.repeat(64));
  const receipt = exporter.archiveer({ source: { store: 'json', sourceRevision: 'a'.repeat(64),
    trustEvidence: veiligeState() }, kluis, directory: archief, dataDirectory: data });
  const bestand = path.join(archief, receipt.archiveId + '.receipt.json');
  const leugen = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  leugen.capacity.collections['v2.records'].used = 999;
  const basis = { ...leugen }; delete basis.receiptDigest;
  leugen.receiptDigest = hash(basis);
  fs.chmodSync(bestand, 0o600); fs.writeFileSync(bestand, JSON.stringify(leugen) + '\n'); fs.chmodSync(bestand, 0o400);
  assert.throws(() => exporter.verifieer({ archiveId: receipt.archiveId, kluis,
    directory: archief, dataDirectory: data }), error => error.code === 'EVIDENCE_EXPORT_RECEIPT_INVALID');
});

test('PostgreSQL-bronadapter voert uitsluitend één SELECT uit en sluit zijn pool', async () => {
  const kluis = laadKluis('4'.repeat(64)), root = veiligeState(), queries = [];
  let gesloten = false;
  class FakePool {
    on() {}
    async query(sql, parameters) {
      queries.push({ sql, parameters });
      return { rows: [{ val: kluis.versleutel(JSON.stringify(root)), ver: '41', weg: false }] };
    }
    async end() { gesloten = true; }
  }
  const uit = await sourceReader.leesPostgres({ DATABASE_URL: 'postgres://localhost/test' }, kluis,
    { Pool: FakePool });
  assert.equal(uit.store, 'postgres'); assert.equal(uit.sourceRevision, 41);
  assert.deepEqual(uit.trustEvidence, root); assert.equal(gesloten, true);
  assert.equal(queries.length, 1); assert.match(queries[0].sql, /^SELECT /);
  assert.deepEqual(queries[0].parameters, ['trustEvidence']);
  assert.doesNotMatch(queries[0].sql, /CREATE|ALTER|INSERT|UPDATE|DELETE/i);
});

test('JSON-bronadapter leest de versleutelde snapshot zonder één byte te wijzigen', t => {
  const { data } = mappen(t), kluis = laadKluis('8'.repeat(64));
  const bestand = path.join(data, 'db.json'), root = veiligeState();
  fs.writeFileSync(bestand, kluis.versleutel(JSON.stringify({ __schema: 1, trustEvidence: root })),
    { mode: 0o600 });
  const voor = sha(bestand), uit = sourceReader.leesJson(data, kluis);
  assert.equal(uit.store, 'json'); assert.deepEqual(uit.trustEvidence, root);
  assert.equal(uit.sourceRevision, voor); assert.equal(sha(bestand), voor);
});

test('CLI leest SQLite byte-ongewijzigd, archiveert veilig en lekt geen identifiers of paden', t => {
  const { data, archief } = mappen(t), sleutel = '5'.repeat(64), kluis = laadKluis(sleutel);
  const root = veiligeState(), storeFile = path.join(data, 'store.db');
  const db = new DatabaseSync(storeFile);
  db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0)');
  db.prepare('INSERT INTO kv(key,val,ver,deleted) VALUES(?,?,?,0)')
    .run('trustEvidence', kluis.versleutel(JSON.stringify(root)), 73);
  db.close();
  const voorDigest = sha(storeFile), voorBestanden = fs.readdirSync(data).sort();
  const env = { ...process.env, RTG_STORE: 'sqlite', RTG_DATA_DIR: data,
    RTG_ENC_KEY: sleutel, RTG_EVIDENCE_EXPORT_DIR: archief, DATABASE_URL: '', PG_URL: '' };

  let run = spawnSync(process.execPath, ['scripts/trust-evidence-export.js', '--status'],
    { cwd: ROOT, env: { ...env, RTG_EVIDENCE_EXPORT_DIR: '' }, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const status = JSON.parse(run.stdout.trim());
  assert.equal(status.mode, 'status'); assert.equal(status.capacity.highestStatus, 'OK');
  assert.equal(JSON.stringify(status).includes(GEHEIM), false);
  assert.equal(JSON.stringify(status).includes(RAW_ID), false);
  assert.equal(sha(storeFile), voorDigest); assert.equal(fs.readdirSync(archief).length, 0);

  run = spawnSync(process.execPath, ['scripts/trust-evidence-export.js'],
    { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 64); assert.equal(fs.readdirSync(archief).length, 0);

  const args = ['scripts/trust-evidence-export.js', '--execute',
    '--confirm=EXPORT-RUNTIME-TRUST-EVIDENCE'];
  run = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal((run.stdout + run.stderr).includes(GEHEIM), false);
  assert.equal((run.stdout + run.stderr).includes(RAW_ID), false);
  assert.equal((run.stdout + run.stderr).includes(archief), false);
  assert.equal((run.stdout + run.stderr).includes(data), false);
  const antwoord = JSON.parse(run.stdout.trim());
  assert.equal(antwoord.verified, true); assert.equal(antwoord.receipt.source.revision, 73);
  assert.equal(sha(storeFile), voorDigest, 'de SQLite-productiebron bleef byte-ongewijzigd');
  assert.deepEqual(fs.readdirSync(data).sort(), voorBestanden, 'de bronmap kreeg geen hulpbestanden');
  assert.equal(fs.readdirSync(archief).length, 2);

  run = spawnSync(process.execPath,
    ['scripts/trust-evidence-export.js', '--verify=' + antwoord.receipt.archiveId],
    { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout.trim()).receipt.receiptDigest, antwoord.receipt.receiptDigest);
  assert.equal(sha(storeFile), voorDigest);

  run = spawnSync(process.execPath,
    ['scripts/trust-evidence-export.js', '--verify=' + antwoord.receipt.archiveId],
    { cwd: ROOT, env: { ...env, RTG_ENC_KEY: '6'.repeat(64) }, encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /EVIDENCE_EXPORT_VERIFY_FAILED/);
  assert.equal((run.stdout + run.stderr).includes(archief), false);
});
