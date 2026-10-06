'use strict';
/* De bediening en de productiekeuring van het auditboek. De CLI draait als echt
   proces tegen een echte PostgreSQL met write-once ankermappen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const { keurAuditboek } = require('../server/config/productie-auditboek');
const { Pool } = require('../server/pgwire');
const maakDb = require('./lib/living-world-pg-database');
const keuring = require('../server/config/productie');

const BRON = process.env.DATABASE_URL || process.env.PG_URL;
assert.ok(BRON, 'DATABASE_URL ontbreekt: draai dit via npm run test:pg');
const CLI = path.join(__dirname, '..', 'scripts', 'auditboek.js');

test('productiekeuring: PostgreSQL-productie eist twee externe ankers, een publieke sleutel en GEEN private sleutel in de app', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pk-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pub = path.join(dir, 'a.pub');
  fs.writeFileSync(pub, crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }));
  const f = env => { const x = []; keurAuditboek(env, x, dir); return x; };
  assert.deepEqual(f({}), [], 'zonder PostgreSQL geen boek en geen eis');
  const goed = { DATABASE_URL: 'postgresql://x', RTG_AUDIT_ANKER_DIRS: '/a,/b', RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: pub };
  assert.deepEqual(f(goed), []);
  assert.ok(f({ ...goed, RTG_AUDIT_ANKER_DIRS: '/a' }).some(x => /twee externe/.test(x)), 'een sink is te weinig');
  assert.deepEqual(f({ ...goed, RTG_AUDIT_ANKER_DIRS: '/a', RTG_AUDIT_ANKER_URLS: 'https://x.example/anker' }), [], 'map + https telt samen');
  assert.ok(f({ ...goed, RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: path.join(dir, 'weg.pub') }).some(x => /publieke ankersleutel/.test(x)));
  assert.ok(f({ ...goed, RTG_AUDIT_ANKER_SIGN_KEY: 'x' }).some(x => /ankerdienst/.test(x)), 'de app mag niet kunnen tekenen');
  assert.ok(f({ DATABASE_URL: 'postgresql://x' }).length >= 2);
  const echt = fs.readFileSync(path.join(__dirname, '..', 'server/config/productie.js'), 'utf8');
  assert.match(echt, /keurAuditboek\(env, fouten\)/, 'de keuring hangt aan de productiestart');
  assert.equal(typeof keuring.keur, 'function');
});

test('de ankersleutel hoort bij een vast publiek anker en een PRIVE-sleutel staat nergens in de repository', () => {
  const tekst = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'TRUST.md'), 'utf8');
  assert.match(tekst, /audit-anker\.pub/, 'deploy/TRUST.md beschrijft de ankersleutel');
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'deploy', 'audit-anker.key')));
});

let db, pool, dirs, env, sl;
function maakEnv(t) {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ab-'));
  t.after(() => fs.rmSync(basis, { recursive: true, force: true }));
  const k = crypto.generateKeyPairSync('ed25519');
  const pub = path.join(basis, 'audit-anker.pub');
  fs.writeFileSync(pub, k.publicKey.export({ type: 'spki', format: 'pem' }));
  dirs = [path.join(basis, 's1'), path.join(basis, 's2')];
  env = { PATH: process.env.PATH, NODE_ENV: 'test', DATABASE_URL: db.url, RTG_AUDIT_ANKER_DIRS: dirs.join(','), RTG_AUDIT_ANKER_MIN_SINKS: '2',
    RTG_AUDIT_ANKER_PUBLIC_KEY_FILE: pub, RTG_AUDIT_ANKER_SIGN_KEY: k.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
}
const cli = (...a) => { const r = cp.spawnSync(process.execPath, [CLI, ...a], { env, encoding: 'utf8' }); let j = null; try { j = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) {} return { status: r.status, j, ruw: r.stdout + r.stderr }; };

test('CLI: init -> anker -> verifieer is in orde (exit 0), en de uitvoer bevat geen geheimen', async t => {
  db = await maakDb(BRON); t.after(() => db.close());
  maakEnv(t);
  assert.equal(cli('init').status, 0);
  assert.equal(cli('anker').status, 0);
  const v = cli('verifieer', '--strikt');
  assert.equal(v.status, 0, v.ruw); assert.equal(v.j.uitslag, 'in-orde');
  assert.ok(!v.ruw.includes(env.RTG_AUDIT_ANKER_SIGN_KEY.split('\n')[1]), 'de private sleutel staat niet in de uitvoer');
  assert.ok(fs.readdirSync(dirs[0]).some(f => /^anker-\d{12}\.json$/.test(f)));
  pool = new Pool({ connectionString: db.url, max: 2 }); t.after(() => pool.end());
});

test('CLI NEGATIEF: een herschreven regel (exit 1), een verdwenen anker (exit 1), een onbereikbare sink (exit 2 -- niet groen)', async t => {
  db = await maakDb(BRON); t.after(() => db.close());
  maakEnv(t);
  cli('init'); cli('anker');
  assert.equal(cli('verifieer', '--strikt', '--zonder-regel').status, 0);
  // 1. de database wordt aangepast door iemand met beheerrechten
  const p = new Pool({ connectionString: db.url, max: 1 });
  await p.query('ALTER TABLE auditboek DISABLE TRIGGER USER');
  await p.query("UPDATE auditboek SET actor = 'lid:ander' WHERE nr = 1");
  await p.query('ALTER TABLE auditboek ENABLE TRIGGER USER');
  await p.end();
  const a = cli('verifieer', '--strikt', '--zonder-regel');
  assert.equal(a.status, 1, a.ruw); assert.ok(a.j.bevindingen.some(b => b.code === 'kolommenAfwijkend'));
});

test('CLI NEGATIEF: een onbereikbare ankerbestemming geeft exit 2, nooit 0', async t => {
  db = await maakDb(BRON); t.after(() => db.close());
  maakEnv(t);
  cli('init'); assert.equal(cli('anker').status, 0);
  /* Een bestand op de plek van de ankermap: onleesbaar voor ELKE gebruiker, ook root
     (rechten zeggen hier niets), dus deze toets hoeft zichzelf nooit over te slaan. */
  fs.rmSync(dirs[1], { recursive: true, force: true });
  fs.writeFileSync(dirs[1], 'geen map');
  const r = cli('verifieer', '--strikt', '--zonder-regel');
  assert.equal(r.status, 2, r.ruw); assert.equal(r.j.uitslag, 'niet-vast-te-stellen');
});

test('CLI: zonder ankersleutel of met te weinig bestemmingen faalt `anker` (exit 1); onbekend commando ook', async t => {
  db = await maakDb(BRON); t.after(() => db.close());
  maakEnv(t);
  cli('init');
  const sleutel = env.RTG_AUDIT_ANKER_SIGN_KEY;
  delete env.RTG_AUDIT_ANKER_SIGN_KEY;
  assert.equal(cli('anker').status, 1);
  env.RTG_AUDIT_ANKER_SIGN_KEY = sleutel; env.RTG_AUDIT_ANKER_DIRS = dirs[0];
  const r = cli('anker'); assert.equal(r.status, 1); assert.equal(r.j.fout, 'ANKER_TE_WEINIG_SINKS');
  assert.equal(cli('bestaatniet').status, 1);
});
