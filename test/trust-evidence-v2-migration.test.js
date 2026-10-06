'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { hash } = require('../server/kern/bewijsvlak/canon');
const migration = require('../server/kern/bewijsvlak/legacy-v2-migration');
const archive = require('../server/kern/bewijsvlak/legacy-archive');

const ROOT = path.join(__dirname, '..');
const GEHEIM = 'ruwe-persoonsinhoud-die-nooit-in-output-mag';

function legacy(id, content, metadata) {
  return { evidenceId: id, digest: hash(content), metadata: metadata || {}, content };
}

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
  const basis = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rtg-evidence-migration-'));
  const data = path.join(basis, 'data'), archief = path.join(basis, 'archive');
  fs.mkdirSync(data, { mode: 0o700 }); fs.mkdirSync(archief, { mode: 0o700 });
  t.after(() => fs.rmSync(basis, { recursive: true, force: true }));
  return { basis, data, archief };
}

test('plan bindt en valideert oude payload, maar bewaart centraal alleen digests', () => {
  const id = 'evidence_' + 'a'.repeat(64), content = { persoon: GEHEIM };
  const root = { blobs: { [id]: legacy(id, content, { kind: 'capacity',
    subjectRef: { domain: 'member', id: 'LID-GEHEIM' }, privateNote: GEHEIM }) } };
  const voor = JSON.stringify(root), plan = migration.maakPlan(root,
    { sourceStore: 'sqlite', now: '2026-10-01T10:00:00.000Z' });
  assert.equal(plan.needed, true); assert.equal(plan.count, 1);
  assert.equal(JSON.stringify(root), voor, 'plannen muteert de bron niet');
  assert.equal(plan.descriptors[id].content, undefined);
  assert.equal(JSON.stringify(plan.descriptors).includes(GEHEIM), false);
  assert.equal(JSON.stringify(plan.descriptors).includes('LID-GEHEIM'), false);
  assert.equal(plan.archive.entries[0].blob.content.persoon, GEHEIM,
    'uitsluitend het aparte archiefplan behoudt de exacte legacy-inhoud');
  const stuk = structuredClone(root); stuk.blobs[id].content.persoon = 'geknoeid';
  assert.throws(() => migration.maakPlan(stuk), error => error.code === 'LEGACY_CONTENT_DIGEST_MISMATCH');
});

test('archief is naamgebonden versleuteld, verifieert vóór gebruik en is crash-herhaalbaar', t => {
  const { data, archief } = mappen(t), id = 'evidence_' + 'b'.repeat(64);
  const root = { blobs: { [id]: legacy(id, { persoon: GEHEIM }, { kind: 'capacity' }) } };
  const planA = migration.maakPlan(root, { sourceStore: 'sqlite', now: '2026-10-01T10:00:00.000Z' });
  const kluis = laadKluis('a'.repeat(64));
  const eerste = archive.archiveer({ plan: planA, kluis, directory: archief, dataDirectory: data });
  const bestand = path.join(archief, eerste.fileName), cipher = fs.readFileSync(bestand);
  assert.equal(cipher.subarray(0, 7).toString(), 'RTGENC2');
  assert.equal(cipher.includes(Buffer.from(GEHEIM)), false);
  assert.throws(() => kluis.ontsleutelBestand(cipher, 'verkeerde-naam.rtga'));

  /* Simuleer crash na archive en vóór DB-commit: een nieuw plan heeft een
     ander tijdstip, maar exact dezelfde bron en moet hetzelfde bestand veilig
     hergebruiken in plaats van het te overschrijven. */
  const planB = migration.maakPlan(root, { sourceStore: 'sqlite', now: '2026-10-01T11:00:00.000Z' });
  const tweede = archive.archiveer({ plan: planB, kluis, directory: archief, dataDirectory: data });
  assert.equal(tweede.fileName, eerste.fileName);
  assert.equal(tweede.cipherDigest, eerste.cipherDigest);
  assert.equal(fs.readdirSync(archief).length, 1);

  const verkeerdeKluis = laadKluis('b'.repeat(64));
  assert.throws(() => archive.archiveer({ plan: planB, kluis: verkeerdeKluis,
    directory: archief, dataDirectory: data }), error => error.code === 'LEGACY_ARCHIVE_VERIFY_FAILED');

  fs.linkSync(bestand, path.join(archief, 'extra-hardlink.rtga'));
  assert.throws(() => archive.archiveer({ plan: planB, kluis, directory: archief,
    dataDirectory: data }), error => error.code === 'LEGACY_ARCHIVE_FILE_UNSAFE');
});

test('archief weigert symlinks en iedere overlap met de primaire datastore', t => {
  const { basis, data, archief } = mappen(t), link = path.join(basis, 'archive-link');
  fs.symlinkSync(archief, link);
  assert.throws(() => archive.veiligeDoelmap(link, data), error => error.code === 'LEGACY_ARCHIVE_SYMLINK');
  assert.throws(() => archive.veiligeDoelmap(data, data), error => error.code === 'LEGACY_ARCHIVE_NOT_SEPARATE');
  assert.throws(() => archive.veiligeDoelmap(path.join(data, 'onder'), data),
    error => error.code === 'LEGACY_ARCHIVE_NOT_SEPARATE');
});

test('stale bron faalt gesloten; een gecommitte migratie is idempotent', async () => {
  const id = 'evidence_' + 'c'.repeat(64), root = { blobs: {
    [id]: legacy(id, { persoon: GEHEIM }, { kind: 'capacity' }) } };
  const plan = migration.maakPlan(root, { sourceStore: 'postgres', now: '2026-10-01T10:00:00.000Z' });
  const archiefbewijs = { verified: true, archiveId: 'legacy_archive_test', fileName: 'legacy_archive_test.rtga',
    legacySetDigest: plan.legacySetDigest, payloadDigest: hash(plan.archive), cipherDigest: 'd'.repeat(64) };
  const tweedeId = 'evidence_' + 'e'.repeat(64);
  const stale = structuredClone(root);
  stale.blobs[tweedeId] = legacy(tweedeId, { later: true }, { kind: 'capacity' });
  const voor = JSON.stringify(stale);
  await assert.rejects(() => migration.voerUit({ plan, archive: archiefbewijs,
    bewerkCollectie: async (sleutel, werk) => werk(stale) }), error => error.code === 'LEGACY_MIGRATION_STALE');
  assert.equal(JSON.stringify(stale), voor);

  let state = structuredClone(root);
  const bewerkCollectie = async (sleutel, werk) => {
    const kopie = structuredClone(state), resultaat = werk(kopie); state = kopie; return resultaat;
  };
  const eerste = await migration.voerUit({ plan, archive: archiefbewijs, bewerkCollectie,
    completedAt: '2026-10-01T10:01:00.000Z' });
  assert.equal(eerste.changed, true); assert.equal(migration.legacyEntries(state).length, 0);
  assert.equal(JSON.stringify(state).includes(GEHEIM), false);
  const nogmaals = await migration.voerUit({ plan, archive: archiefbewijs, bewerkCollectie,
    completedAt: '2026-10-01T12:00:00.000Z' });
  assert.equal(nogmaals.changed, false); assert.deepEqual(nogmaals.receipt, eerste.receipt);
  assert.equal(Object.hasOwn(nogmaals.receipt, 'archivePath'), false);
});

test('offline CLI migreert een echte SQLite-collectie atomair en lekt niets naar output', t => {
  const { data, archief } = mappen(t), sleutel = 'f'.repeat(64);
  const id = 'evidence_' + '1'.repeat(64), content = { persoon: GEHEIM };
  const raw = { ledger: [], blobs: { [id]: legacy(id, content,
    { kind: 'capacity', subjectRef: { id: 'LID-CLI-GEHEIM' } }) } };
  const env = { ...process.env, RTG_STORE: 'sqlite', RTG_DATA_DIR: data,
    RTG_ENC_KEY: sleutel, RTG_EVIDENCE_ARCHIVE_DIR: archief, DATABASE_URL: '', PG_URL: '',
    TX_LEDGER_SQLITE: '0' };
  const seedCode = "const fs=require('node:fs'),d=require('./server/db');d.load();" +
    "const x=JSON.parse(fs.readFileSync(0,'utf8'));d.bewerkCollectie('trustEvidence',r=>Object.assign(r,x));";
  let run = spawnSync(process.execPath, ['-e', seedCode], { cwd: ROOT, env, input: JSON.stringify(raw), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);

  run = spawnSync(process.execPath, ['scripts/trust-evidence-v2-migrate.js'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 64); assert.equal(fs.readdirSync(archief).length, 0);

  const args = ['scripts/trust-evidence-v2-migrate.js', '--execute', '--offline',
    '--confirm=ARCHIVE-AND-MIGRATE-LEGACY-TRUST-EVIDENCE'];
  run = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal((run.stdout + run.stderr).includes(GEHEIM), false);
  assert.equal((run.stdout + run.stderr).includes('LID-CLI-GEHEIM'), false);
  assert.equal((run.stdout + run.stderr).includes(archief), false, 'absoluut archiefpad blijft uit output');
  const bestanden = fs.readdirSync(archief); assert.equal(bestanden.length, 1);
  assert.equal(fs.readFileSync(path.join(archief, bestanden[0])).includes(Buffer.from(GEHEIM)), false);

  const readCode = "const d=require('./server/db');d.load();" +
    "const p=require('./server/kern/bewijsvlak').maakPlane({state:d.db.data.trustEvidence});p.snapshot();" +
    "process.stdout.write('STATE:'+JSON.stringify(d.db.data.trustEvidence));";
  run = spawnSync(process.execPath, ['-e', readCode], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const state = JSON.parse(run.stdout.slice(run.stdout.lastIndexOf('STATE:') + 6));
  assert.equal(migration.legacyEntries(state).length, 0);
  assert.equal(JSON.stringify(state).includes(GEHEIM), false);
  assert.equal(state.migrations[migration.MIGRATION_ID].migratedCount, 1);

  run = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const herhaald = JSON.parse(run.stdout.trim());
  assert.equal(herhaald.changed, false); assert.equal(herhaald.archiveVerified, true);
  assert.equal(fs.readdirSync(archief).length, 1, 'herhaling maakt geen tweede archief');

  const bestand = path.join(archief, bestanden[0]), tijdelijk = bestand + '.weg';
  fs.renameSync(bestand, tijdelijk);
  run = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /LEGACY_ARCHIVE_MISSING/);
  assert.equal((run.stdout + run.stderr).includes(GEHEIM), false);
  fs.renameSync(tijdelijk, bestand);
});

test('SQLite collectiepoort rolt een gooiende evidencebewerking volledig terug', t => {
  const { data } = mappen(t), env = { ...process.env, RTG_STORE: 'sqlite', RTG_DATA_DIR: data,
    RTG_ENC_KEY: '9'.repeat(64), DATABASE_URL: '', PG_URL: '', TX_LEDGER_SQLITE: '0' };
  const code = "const d=require('./server/db');d.load();" +
    "d.bewerkCollectie('trustEvidence',r=>{r.blobs={oud:{content:{x:1}}}});" +
    "const voor=JSON.stringify(d.db.data.trustEvidence);let code='';" +
    "try{d.bewerkCollectie('trustEvidence',r=>{delete r.blobs.oud.content;r.receipt={ok:true};throw Object.assign(new Error('stop'),{code:'TEST_STOP'})})}catch(e){code=e.code}" +
    "process.stdout.write(JSON.stringify({code,zelfde:JSON.stringify(d.db.data.trustEvidence)===voor,raw:!!d.db.data.trustEvidence.blobs.oud.content,receipt:!!d.db.data.trustEvidence.receipt}));";
  const run = spawnSync(process.execPath, ['-e', code], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { code: 'TEST_STOP', zelfde: true, raw: true, receipt: false });
});
