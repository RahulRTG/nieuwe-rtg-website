'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { zonderBootstrap } = require('../scripts/eigenaar-claim');

const ROOT = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('live-compose ontsluit native HTTPS en schermt herstel af', () => {
  const basis = lees('docker-compose.yml');
  const live = lees('docker-compose.live.yml');
  assert.match(basis, /RTG_CONTAINER_PORT:-3000/);
  assert.match(live, /:80:80\/tcp/);
  assert.match(live, /port:443/);
  assert.match(live, /NET_BIND_SERVICE/);
  assert.match(live, /profiles: \["ops"\]/);
  assert.equal((live.match(/user: "1000:1000"/g) || []).length, 2);
  assert.match(live, /RTG_RESTORE_CONFIRM/);
  assert.match(live, /RTG_BACKUP_HOST_DIR:\?/);
});

test('live-, herstel- en backupscript zijn geldige shell en herstel is dubbel bevestigd', () => {
  for (const bestand of ['scripts/docker/live.sh', 'scripts/docker/herstel.sh', 'scripts/docker/backup.sh']) {
    const r = spawnSync('sh', ['-n', path.join(ROOT, bestand)], { encoding: 'utf8' });
    assert.equal(r.status, 0, bestand + ': ' + r.stderr);
  }
  const herstel = lees('scripts/docker/herstel.sh');
  assert.match(herstel, /HERSTEL-\$RTG_RESTORE_STAMP/);
  assert.match(herstel, /sha256sum -c/);
  assert.match(herstel, /pg_restore --exit-on-error/);
  assert.match(herstel, /! -name backups/);
  assert.match(lees('scripts/docker/backup.sh'), /RTG_BACKUP_ONCE/);
  const liveScript = lees('scripts/docker/live.sh');
  assert.match(liveScript, /compose exec -T app node scripts\/golive\.js/);
  assert.match(liveScript, /node scripts\/eigenaar-claim\.js/);
  const golive = lees('scripts/golive.js');
  assert.match(golive, /process\.env\.RTG_ENV_FILE/);
  assert.match(golive, /RTG_POSTGRES_PASSWORD_FILE/);
  const eigenaarClaim = lees('scripts/eigenaar-claim.js');
  assert.match(eigenaarClaim, /servername: domein/);
  assert.doesNotMatch(eigenaarClaim, /rejectUnauthorized\s*:\s*false/);
});

test('eigenaarsclaim verwijdert de eenmalige deur zonder overige geheimen te wijzigen', () => {
  const voor = 'RTG_SECRET_KEY=blijft\nRTG_OWNER_BOOTSTRAP=zeer-geheime-eenmalige-sleutel\nSMTP_URL=smtps://blijft\n';
  const na = zonderBootstrap(voor);
  assert.doesNotMatch(na, /^RTG_OWNER_BOOTSTRAP=/m);
  assert.match(na, /RTG_SECRET_KEY=blijft/);
  assert.match(na, /SMTP_URL=smtps:\/\/blijft/);
  assert.throws(() => zonderBootstrap(na), /ontbreekt/);
});

test('live:init maakt stil een valide lokale-eerst en betalingen-uit configuratie', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livepakket-'));
  try {
    const envPad = path.join(tmp, '.env.productie');
    const pgPad = path.join(tmp, 'postgres_password');
    const maak = spawnSync(process.execPath, [path.join(ROOT, 'scripts/sleutels.js'),
      '--docker', '--schrijf', '--zonder-ai', '--zonder-betalen', '--native-tls', '--stil',
      '--eigenaar=owner@example.test', '--url=https://app.example.test',
      '--tls-email=tls@example.test', '--smtp-url=smtps://mail.example.test:465',
      '--doel=' + envPad, '--postgres-doel=' + pgPad], { encoding: 'utf8' });
    assert.equal(maak.status, 0, maak.stderr);
    const env = leesEnv(envPad);
    for (const [naam, waarde] of Object.entries({
      RTG_AI_UIT: '1', RTG_BETALEN_UIT: '1', RTG_TLS: '1', RTG_ACME: '1',
      RTG_TLS_DOMAIN: 'app.example.test', RTG_PROXY_HOPS: '0'
    })) assert.equal(env[naam], waarde, naam);
    assert.ok(env.OFFICE_TOTP_SECRET.length >= 16);
    assert.doesNotMatch(maak.stdout, new RegExp(env.RTG_ENC_KEY));

    const livePad = path.join(tmp, 'live.env');
    fs.writeFileSync(livePad, [
      'RTG_PUBLISH_HOST=0.0.0.0', 'RTG_PUBLISH_PORT=443', 'RTG_CONTAINER_PORT=443',
      'RTG_BACKUP_HOST_DIR=' + tmp, 'RTG_IMAGE=rtg-app:live', ''
    ].join('\n'), { mode: 0o600 });
    const keur = spawnSync(process.execPath, [path.join(ROOT, 'scripts/docker/controle.js'), '--publiek'], {
      encoding: 'utf8',
      env: { ...process.env, RTG_ENV_FILE: envPad, RTG_POSTGRES_PASSWORD_FILE: pgPad, RTG_LIVE_ENV_FILE: livePad }
    });
    assert.equal(keur.status, 0, keur.stdout + keur.stderr);
    assert.match(keur.stdout, /Native HTTPS, betalingen-uit en externe back-up zijn afgedwongen/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function leesEnv(pad) {
  const uit = {};
  for (const regel of fs.readFileSync(pad, 'utf8').split(/\r?\n/)) {
    const i = regel.indexOf('=');
    if (i > 0 && !regel.startsWith('#')) uit[regel.slice(0, i)] = regel.slice(i + 1);
  }
  return uit;
}
