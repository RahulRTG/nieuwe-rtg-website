'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bereidVoor, CONTAINER_SLEUTEL } = require('../scripts/motor-initialisatie');
const keurOmgeving = require('../scripts/keur-omgeving');

const ROOT = path.join(__dirname, '..');
const lees = naam => fs.readFileSync(path.join(ROOT, naam), 'utf8');

function bestand(pad, inhoud, mode = 0o600) {
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  fs.writeFileSync(pad, inhoud, { mode });
  fs.chmodSync(pad, mode);
}

test('expliciete voorbereiding legt genesis eerst vast en een retry hergebruikt hem', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-motor-init-'));
  try {
    const envPad = path.join(map, '.env.productie');
    const sleutelPad = path.join(map, 'motor_state_key');
    bestand(envPad, 'NODE_ENV=production\n');
    bestand(sleutelPad, 'k-eerste:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n');
    const sleutelVoor = fs.readFileSync(sleutelPad, 'utf8');
    const eerste = bereidVoor({ envPad, sleutelPad, randomBytes: () => Buffer.alloc(16, 0xab) });
    assert.equal(eerste.genesisId, 'g-' + 'ab'.repeat(16));
    assert.equal(eerste.nieuw, true);
    const na = fs.readFileSync(envPad, 'utf8');
    assert.match(na, new RegExp('^RTG_MOTOR_STATE_KEY_FILE=' + CONTAINER_SLEUTEL + '$', 'm'));
    assert.match(na, new RegExp('^RTG_MOTOR_EXPECT_GENESIS=' + eerste.genesisId + '$', 'm'));
    assert.equal(fs.statSync(envPad).mode & 0o777, 0o600);

    const retry = bereidVoor({ envPad, sleutelPad, randomBytes: () => Buffer.alloc(16, 0xcd) });
    assert.equal(retry.genesisId, eerste.genesisId, 'retry verzint geen tweede genesis');
    assert.equal(retry.nieuw, false);
    assert.equal(fs.readFileSync(envPad, 'utf8'), na);
    assert.equal(fs.readFileSync(sleutelPad, 'utf8'), sleutelVoor, 'init roteert de sleutel niet');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('voorbereiding weigert brede sleutelrechten en een corrupte bestaande genesis', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-motor-init-rood-'));
  try {
    const envPad = path.join(map, '.env.productie');
    const sleutelPad = path.join(map, 'motor_state_key');
    bestand(envPad, 'NODE_ENV=production\n');
    bestand(sleutelPad, 'k-eerste:' + '1'.repeat(64) + '\n', 0o644);
    assert.throws(() => bereidVoor({ envPad, sleutelPad }), /rechten 600/);
    fs.chmodSync(sleutelPad, 0o600);
    bestand(envPad, 'RTG_MOTOR_EXPECT_GENESIS=g-VERKEERD\n');
    const voor = fs.readFileSync(envPad, 'utf8');
    assert.throws(() => bereidVoor({ envPad, sleutelPad }), /geen geldige/);
    assert.equal(fs.readFileSync(envPad, 'utf8'), voor, 'ongeldige waarheid wordt niet vervangen');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('releasekandidaat krijgt een afzonderlijke tijdelijke sleutel en vaste genesis', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keurmotor-init-'));
  try {
    const envPad = path.join(map, 'keur.env');
    const sleutelPad = path.join(map, 'keur.key');
    const resultaat = keurOmgeving.schrijf(envPad, sleutelPad);
    const env = fs.readFileSync(envPad, 'utf8');
    assert.match(env, /^RTG_MOTOR_STATE_KEY_FILE=\/run\/secrets\/rtg-keur-motor-state-key$/m);
    assert.match(env, /^RTG_MOTOR_EXPECT_GENESIS=g-[a-f0-9]{32}$/m);
    assert.match(fs.readFileSync(sleutelPad, 'utf8'), /^k-[a-f0-9]{16}:[a-f0-9]{64}\n$/);
    assert.match(resultaat.genesisId, /^g-[a-f0-9]{32}$/);
    assert.equal(fs.statSync(envPad).mode & 0o777, 0o600);
    assert.equal(fs.statSync(sleutelPad).mode & 0o777, 0o600);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('Compose en livegang initialiseren alleen via de expliciete operatorpaden', () => {
  const compose = lees('docker-compose.yml');
  const live = lees('scripts/docker/live.sh');
  const normaal = lees('scripts/docker/start.js');
  assert.match(compose, /motor_state_key:\n\s+file: \$\{RTG_MOTOR_STATE_KEY_SECRET_FILE/);
  assert.match(compose, /source: motor_state_key\n\s+target: rtg-motor-state-key/);
  assert.match(compose, /source: rtg_keur_motor_state_key\n\s+target: rtg-keur-motor-state-key/);
  assert.match(compose, /keur-motor-data:\/app\/motor-data/);
  assert.match(live, /keurmotor init-state[\s\S]*up -d --no-build --wait/);
  assert.match(lees('scripts/docker/motor-init.sh'), /motor init-state/);
  assert.doesNotMatch(normaal, /init-state|initialiseer/, 'gewone start of restart mag geen volume maken');
});
