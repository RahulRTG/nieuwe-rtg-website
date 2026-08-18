/* De self-hosted voordeur: geheimen mogen niet in Compose lekken, een private
   beta mag nooit publiek worden, en het installatiecommando mag bestaande
   sleutels niet stil vervangen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { leesEnv, bouwOmgeving } = require('../scripts/docker/start');
const { valideer } = require('../server/config');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-selfhost-'));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('het Docker-geheimenbestand wordt letterlijk gelezen, nooit als shell', () => {
  const marker = path.join(TMP, 'mag-niet-bestaan');
  const waarden = leesEnv('GOED=waarde=met=tekens\nLETTERLIJK=$(touch ' + marker + ')\nexport QUOTED="abc def"\n');
  assert.equal(waarden.GOED, 'waarde=met=tekens');
  assert.match(waarden.LETTERLIJK, /^\$\(touch /);
  assert.equal(waarden.QUOTED, 'abc def');
  assert.equal(fs.existsSync(marker), false, 'er is niets uitgevoerd');
});

test('de startwikkel bouwt de database-URL uit een apart geheim en bewaart expliciete overrides', () => {
  const envPad = path.join(TMP, 'rtg.env');
  const pgPad = path.join(TMP, 'pg.secret');
  fs.writeFileSync(envPad, 'RTG_OWNER_EMAIL=bestand@voorbeeld.test\nRTG_MOTOR_TOKEN=' + 'm'.repeat(32) + '\n');
  fs.writeFileSync(pgPad, 'een wachtwoord/met tekens\n');
  const env = { RTG_ENV_FILE: envPad, RTG_POSTGRES_PASSWORD_FILE: pgPad, RTG_OWNER_EMAIL: 'orchestrator@voorbeeld.test' };
  bouwOmgeving(env);
  assert.equal(env.RTG_OWNER_EMAIL, 'orchestrator@voorbeeld.test', 'de orchestrator wint');
  assert.equal(env.REDIS_URL, 'redis://redis:6379');
  assert.match(env.DATABASE_URL, /een%20wachtwoord%2Fmet%20tekens/);
});

function veiligeBasis(extra) {
  return Object.assign({
    NODE_ENV: 'production', RTG_ENC_KEY: 'e'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64),
    RTG_SECRET_KEY: 's'.repeat(64), RTG_OWNER_EMAIL: 'eigenaar@voorbeeld.test',
    OFFICE_CODE: 'KANTOOR-CODE-12', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
    DATABASE_URL: 'postgresql://rtg:test@postgres/rtg',
    REDIS_URL: 'redis://redis:6379', RTG_PRIVATE_BETA: '1'
  }, extra || {});
}

test('private beta is alleen op localhost, .local of een privaat LAN-adres toegestaan', () => {
  for (const url of ['http://127.0.0.1:3000', 'http://rtg-mini.local:3000', 'http://192.168.1.10:3000']) {
    const r = valideer(veiligeBasis({ APP_URL: url }));
    assert.equal(r.fouten.length, 0, url + ': ' + r.fouten.join('; '));
    assert.ok(r.waarschuwingen.some(w => /PRIVATE_BETA/.test(w)));
  }
  const publiek = valideer(veiligeBasis({ APP_URL: 'https://app.rtg.example' }));
  assert.ok(publiek.fouten.some(f => /nooit per ongeluk publiek/.test(f)));
});

test('selfhost:init maakt alle Docker-geheimen en overschrijft ze niet stil', () => {
  const envPad = path.join(TMP, '.env.productie');
  const pgPad = path.join(TMP, '.rtg-secrets', 'postgres_password');
  const args = ['scripts/sleutels.js', '--docker', '--prive-beta', '--schrijf',
    '--eigenaar=eigenaar@voorbeeld.test', '--doel=' + envPad, '--postgres-doel=' + pgPad];
  const eerste = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(eerste.status, 0, eerste.stderr);
  const envEerst = fs.readFileSync(envPad, 'utf8');
  const pgEerst = fs.readFileSync(pgPad, 'utf8');
  assert.match(envEerst, /RTG_PRIVATE_BETA=1/);
  assert.match(envEerst, /RTG_MOTOR_TOKEN=[a-f0-9]{64}/);
  assert.doesNotMatch(envEerst, /VUL-IN/);
  assert.equal(fs.statSync(envPad).mode & 0o777, 0o600);
  assert.equal(fs.statSync(pgPad).mode & 0o777, 0o600);

  const tweede = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.notEqual(tweede.status, 0, 'bestaande geheimen horen de tweede run te blokkeren');
  assert.equal(fs.readFileSync(envPad, 'utf8'), envEerst);
  assert.equal(fs.readFileSync(pgPad, 'utf8'), pgEerst);
});

test('Compose sluit de data-laag af en geeft geheimen niet als environment door', () => {
  const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
  const app = compose.match(/^  app:\n[\s\S]*?(?=^  sentinel:\n)/m)[0];
  const sentinel = compose.match(/^  sentinel:\n[\s\S]*?(?=^  motor:\n)/m)[0];
  assert.doesNotMatch(app, /^    ports:/m, 'Node heeft bewust geen hostpoort');
  assert.match(sentinel, /RTG_SENTINEL_BIND:-127\.0\.0\.1/,
    'alleen Sentinel publiceert standaard op loopback');
  assert.match(app, /RTG_CAPABILITY_RUST_BIN: \/app\/rtg-motor/);
  assert.match(app, /RTG_CAPABILITY_RUST_MODE: \$\{RTG_CAPABILITY_RUST_MODE:-uit\}/);
  assert.match(app, /RTG_RUST_ALLES_UIT: \$\{RTG_RUST_ALLES_UIT:-0\}/);
  assert.match(compose, /data:\n\s+internal: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\n\s+- ALL/);
  assert.match(compose, /file: \$\{RTG_ENV_FILE:-\.env\.productie\}/);
  assert.equal((compose.match(/^secrets:/gm) || []).length, 1,
    'Compose heeft exact één top-level geheimenregister');
  assert.match(compose, /sentinel_token:\n\s+file: \$\{RTG_SENTINEL_TOKEN_FILE:-\.sentinel-token\}/);
  assert.doesNotMatch(compose, /^\s+RTG_VAULT_KEY:/m);
  assert.doesNotMatch(compose, /POSTGRES_PASSWORD:\s*\$\{/);
  assert.match(compose, /service_healthy/);
  assert.match(compose, /scripts\/docker\/backup\.sh/);
  assert.match(compose, /clamav\/clamav:1\.5\.3-debian13-slim/);
  assert.match(compose, /RTG_CLAMD_HOST: clamav/);
  assert.doesNotMatch(compose, /^\s+ports:\s*\n(?:.|\n){0,120}3310/m,
    'de ClamAV-poort mag nooit op de Docker-host worden gepubliceerd');
});
