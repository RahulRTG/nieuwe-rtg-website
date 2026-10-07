'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { zonderBootstrap } = require('../scripts/eigenaar-claim');
const { bereidVoor } = require('../scripts/motor-initialisatie');

const ROOT = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('live-compose ontsluit native HTTPS en schermt herstel af', () => {
  const basis = lees('docker-compose.yml');
  const live = lees('docker-compose.live.yml');
  const app = basis.match(/^  app:\n[\s\S]*?(?=^  sentinel:\n)/m)[0];
  assert.doesNotMatch(app, /^    ports:/m, 'de basis publiceert Node niet buiten Sentinel om');
  assert.match(live, /RTG_PUBLISH_PORT:-443.*RTG_CONTAINER_PORT:-443/);
  assert.match(live, /:80:80\/tcp/);
  assert.match(live, /PORT: 443/);
  assert.match(live, /publieke-tls-proef\.js.*--connect-host=127\.0\.0\.1.*--readiness-only/,
    'publieke container-readiness moet hostname en trustketen bewijzen');
  assert.doesNotMatch(live, /rejectUnauthorized\s*:\s*false|--insecure/,
    'een self-signed certificaat mag publieke readiness nooit groen maken');
  assert.match(live, /NET_BIND_SERVICE/);
  assert.match(live, /profiles: \["ops"\]/);
  assert.equal((live.match(/user: "1000:1000"/g) || []).length, 2);
  assert.match(live, /RTG_RESTORE_CONFIRM/);
  assert.match(live, /RTG_BACKUP_HOST_DIR:\?/);
  assert.match(live, /RTG_BACKUP_OFFSITE_HOST_DIR:\?/);
  assert.match(live, /backup_public_cert/);
  assert.match(live, /backup_private_key:ro/);
  const keurgolive = basis.match(/^  keurgolive:\n[\s\S]*?(?=^  keurredis:\n)/m)[0];
  const ownerproof = basis.match(/^  ownerproof:\n[\s\S]*?(?=^  # De echte productieconfiguratie)/m)[0];
  assert.match(ownerproof, /scripts\/docker\/start\.js", "owner-proof/);
  assert.match(ownerproof, /^      - data$/m,
    'alleen de smalle meetcontainer mag de echte PostgreSQL bereiken');
  assert.doesNotMatch(ownerproof, /^    volumes:|rtg-data|rtg-release|keurdata|edge/m,
    'de eigenaarsmeting krijgt geen productievolume, releasevolume of ander netwerk');
  assert.match(keurgolive, /- keurdata/);
  assert.match(keurgolive, /- keuruitgangen/,
    'alleen de go-live-keurtaak krijgt egress voor echte media- en alarmproeven');
  assert.doesNotMatch(keurgolive, /^\s+ports:/m, 'de providerproef publiceert geen ingang');
  const liveApp = live.match(/^  app:\n[\s\S]*?(?=^  keurgolive:\n)/m)[0];
  const liveKeurgolive = live.match(/^  keurgolive:\n[\s\S]*?(?=^  backup:\n)/m)[0];
  assert.match(liveApp, /RTG_PAPIEREN_FILE: \/run\/rtg-compliance\/papieren\.json/);
  assert.match(liveApp, /RTG_PAPIEREN_HOST_DIR[^\n]*:\/run\/rtg-compliance:rw/,
    'de productie-app moet het afzonderlijke compliancebestand kunnen bijwerken');
  assert.match(liveKeurgolive, /RTG_PAPIEREN_FILE: \/run\/rtg-compliance\/papieren\.json/);
  assert.match(liveKeurgolive, /RTG_PAPIEREN_HOST_DIR[^\n]*:\/run\/rtg-compliance:ro/,
    'de kandidaat mag hetzelfde ingevulde papier uitsluitend lezen');
  assert.doesNotMatch(liveKeurgolive, /rtg-data|\/app\/server\/data/,
    'voor papiercontrole mag de kandidaat nooit brede productie-appdata mounten');
  const uitgangenNet = basis.match(/^  keuruitgangen:\n[\s\S]*?(?=^  # Alleen ClamAV)/m)[0];
  assert.doesNotMatch(uitgangenNet, /internal:\s*true/,
    'het afgescheiden providerproefnetwerk moet de echte HTTPS-diensten kunnen bereiken');
});

test('live-, motorinit-, herstel- en backupscript zijn geldige shell en herstel is dubbel bevestigd', () => {
  for (const bestand of ['scripts/docker/live.sh', 'scripts/docker/motor-init.sh', 'scripts/docker/herstel.sh', 'scripts/docker/backup.sh']) {
    const r = spawnSync('sh', ['-n', path.join(ROOT, bestand)], { encoding: 'utf8' });
    assert.equal(r.status, 0, bestand + ': ' + r.stderr);
  }
  const herstel = lees('scripts/docker/herstel.sh');
  assert.match(herstel, /HERSTEL-\$RTG_RESTORE_STAMP/);
  assert.match(herstel, /sha256sum -c/);
  assert.match(herstel, /pg_restore --exit-on-error/);
  assert.match(herstel, /! -name backups/);
  assert.match(herstel, /onveilig bestandstype in app-archief/);
  assert.ok(herstel.indexOf('tar -tvzf "$app"') < herstel.indexOf('tar -xzf "$app"'),
    'links en speciale bestandstypen worden vóór extractie geweigerd');
  assert.match(lees('scripts/docker/backup.sh'), /RTG_BACKUP_ONCE/);
  assert.match(lees('scripts/docker/backup.sh'), /-aes-256-gcm/);
  assert.match(lees('scripts/docker/backup.sh'), /RTG_BACKUP_OFFSITE_DIR/);
  assert.doesNotMatch(lees('scripts/docker/backup.sh'), /find \/offsite[^\n]*-exec rm/,
    'de off-site boom is write-once en krijgt geen retentie-wisser');
  const liveScript = lees('scripts/docker/live.sh');
  assert.match(liveScript, /keur_compose run --rm --no-deps[\s\S]*keurgolive node scripts\/golive\.js --bewijs-stdout/);
  assert.match(liveScript, /--controle-bootstrap/,
    'de eerste eigenaar mag uitsluitend uit een exact gekeurd kandidaatimage ontstaan');
  assert.match(liveScript, /owner-init[\s\S]*ownerproof[\s\S]*eigenaar-claim\.js --sluit-offline/,
    'eerst schrijven, via een volume-loze SELECT-meting teruglezen, dan pas het eenmalige geheim sluiten');
  assert.match(liveScript, /RTG_OWNER_READBACK_JSON=[\s\S]*--owner-readback-bewijs[\s\S]*eigenaar-claim\.js --sluit-offline/,
    'de succesvolle procesexit alleen is onvoldoende: de host bewaart eerst het kandidaat-/DB-readbackbewijs');
  assert.match(liveScript, /rm -f[\s\S]*owner-readback-bewijs\.json[\s\S]*owner-kandidaatbinding[\s\S]*ownerproof/,
    'iedere latere go-live wist historisch bewijs en leest de eigenaar opnieuw uit productie');
  const golive = lees('scripts/golive.js');
  assert.match(golive, /process\.env\.RTG_ENV_FILE/);
  assert.match(golive, /RTG_POSTGRES_PASSWORD_FILE/);
  const eigenaarClaim = lees('scripts/eigenaar-claim.js');
  assert.match(eigenaarClaim, /controleerOwnerReadbackBestand[\s\S]*schrijfZonderBootstrap/,
    'direct --sluit-offline weigert zonder duurzaam readbackbewijs');
  assert.match(eigenaarClaim, /servername: domein/);
  assert.doesNotMatch(eigenaarClaim, /rejectUnauthorized\s*:\s*false/);
});

test('de offline back-upsleutel kan een AES-GCM CMS-set echt openen', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-backup-crypto-'));
  try {
    const sleutel = path.join(tmp, 'offline', 'private.pem');
    const cert = path.join(tmp, 'public.pem');
    const maak = spawnSync('sh', [path.join(ROOT, 'scripts/docker/backup-sleutel.sh'), sleutel, cert], { encoding: 'utf8' });
    assert.equal(maak.status, 0, maak.stderr);
    const bron = path.join(tmp, 'database.dump');
    const dicht = path.join(tmp, 'database.dump.cms');
    const open = path.join(tmp, 'terug.dump');
    fs.writeFileSync(bron, 'persoonlijke database-inhoud\n');
    let r = spawnSync('openssl', ['cms', '-encrypt', '-binary', '-aes-256-gcm', '-in', bron,
      '-out', dicht, '-outform', 'DER', cert], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(fs.readFileSync(dicht, 'latin1'), /persoonlijke database-inhoud/);
    r = spawnSync('openssl', ['cms', '-decrypt', '-binary', '-inform', 'DER', '-in', dicht,
      '-inkey', sleutel, '-out', open], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(open, 'utf8'), fs.readFileSync(bron, 'utf8'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('eigenaarsclaim verwijdert de eenmalige deur zonder overige geheimen te wijzigen', () => {
  const voor = 'RTG_SECRET_KEY=blijft\nRTG_OWNER_BOOTSTRAP=zeer-geheime-eenmalige-sleutel\nSMTP_URL=smtps://blijft\n';
  const na = zonderBootstrap(voor);
  assert.doesNotMatch(na, /^RTG_OWNER_BOOTSTRAP=/m);
  assert.match(na, /RTG_SECRET_KEY=blijft/);
  assert.match(na, /SMTP_URL=smtps:\/\/blijft/);
  assert.throws(() => zonderBootstrap(na), /ontbreekt/);
});

test('papierwerk --live schrijft en leest exact de gemounte compliance-opslag', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-live-papierwerk-'));
  try {
    const compliance = path.join(tmp, 'compliance');
    const liveEnv = path.join(tmp, 'live.env');
    fs.mkdirSync(compliance, { mode: 0o700 });
    fs.writeFileSync(path.join(compliance, 'papieren.json'),
      JSON.stringify({ antwoorden: {}, bijgewerkt: null }), { mode: 0o600 });
    fs.writeFileSync(liveEnv, 'RTG_PAPIEREN_HOST_DIR=' + compliance + '\n', { mode: 0o600 });
    const omgeving = { ...process.env, RTG_LIVE_ENV_FILE: liveEnv };
    let r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/papierwerk.js'), '--live'], {
      encoding: 'utf8', env: omgeving
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const invul = path.join(compliance, 'papierwerk-invullen.txt');
    assert.ok(fs.existsSync(invul), 'het invulvel hoort naast het live compliancebestand');
    fs.writeFileSync(invul, fs.readFileSync(invul, 'utf8')
      .replace('\nAntwoord:', '\nAntwoord: Rahul Travel Group B.V.'));
    r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/papierwerk.js'), '--live', '--lees'], {
      encoding: 'utf8', env: omgeving
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const bewaard = JSON.parse(fs.readFileSync(path.join(compliance, 'papieren.json'), 'utf8'));
    assert.equal(bewaard.antwoorden.verantwoordelijke.waarde, 'Rahul Travel Group B.V.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('live:init maakt stil een valide lokale-eerst en betalingen-uit configuratie', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livepakket-'));
  try {
    const envPad = path.join(tmp, '.env.productie');
    const pgPad = path.join(tmp, 'postgres_password');
    const motorSleutelPad = path.join(tmp, 'motor_state_key');
    const papierenPad = path.join(tmp, 'compliance', 'papieren.json');
    const maak = spawnSync(process.execPath, [path.join(ROOT, 'scripts/sleutels.js'),
      '--docker', '--schrijf', '--zonder-ai', '--zonder-betalen', '--zonder-sms', '--native-tls', '--stil',
      '--eigenaar=owner@example.test', '--url=https://app.rahultravelgroup.com',
      '--tls-email=tls@example.test', '--smtp-url=smtps://mail.example.test:465',
      '--doel=' + envPad, '--postgres-doel=' + pgPad,
      '--motor-sleutel-doel=' + motorSleutelPad,
      '--papieren-doel=' + papierenPad], { encoding: 'utf8' });
    assert.equal(maak.status, 0, maak.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(papierenPad, 'utf8')),
      { antwoorden: {}, bijgewerkt: null }, 'live:init maakt een eerlijk leeg compliancebestand');
    if (process.platform !== 'win32')
      assert.equal(fs.statSync(papierenPad).mode & 0o077, 0, 'het compliancebestand is niet leesbaar voor anderen');
    bereidVoor({ envPad, sleutelPad: motorSleutelPad });
    /* De publieke hostcontrole bewijst configuratie, niet de externe diensten
       zelf. Geef de fixture daarom expliciete niet-geheime testdoelen; de
       latere go-live-proeven moeten deze S3- en alarmuitgangen werkelijk
       aanraken voordat een release READY kan worden. */
    fs.appendFileSync(envPad, [
      'RTG_ANKERPOST_URL=https://anker.voorbeeld.test/',
      'ERR_WEBHOOK_URL=https://alarm.example.test/rtg',
      'RTG_MEDIA_BACKEND=s3',
      'RTG_MEDIA_S3_BUCKET=rtg-productie-media',
      'RTG_MEDIA_S3_KEY=fixture-access-key',
      'RTG_MEDIA_S3_SECRET=fixture-secret-key',
      'TURN_URL=turns:turn.rahultravelgroup.com:5349',
      'TURN_SECRET=T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
      ''
    ].join('\n'));
    const env = leesEnv(envPad);
    for (const [naam, waarde] of Object.entries({
      RTG_AI_UIT: '1', RTG_BETALEN_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1',
      RTG_ISOLATIE_AFDWINGEN: '1',
      RTG_TLS: '1', RTG_ACME: '1',
      RTG_TLS_DOMAIN: 'app.rahultravelgroup.com', RTG_PROXY_HOPS: '0'
    })) assert.equal(env[naam], waarde, naam);
    assert.equal(env.OFFICE_CODE, undefined,
      'live:init maakt geen gedeeld geheim voor een deur die productie weigert');
    assert.equal(env.OFFICE_TOTP_SECRET, undefined,
      'de eigen passkey van de medewerker is de productiefactor, niet een losse TOTP');
    assert.doesNotMatch(maak.stdout, new RegExp(env.RTG_ENC_KEY));

    const backupDir = path.join(tmp, 'backup');
    const offsiteDir = path.join(tmp, 'offsite');
    const privateKey = path.join(tmp, 'offline', 'private.pem');
    const publicCert = path.join(tmp, 'public.pem');
    fs.mkdirSync(backupDir); fs.mkdirSync(offsiteDir);
    const sleutel = spawnSync('sh', [path.join(ROOT, 'scripts/docker/backup-sleutel.sh'), privateKey, publicCert], { encoding: 'utf8' });
    assert.equal(sleutel.status, 0, sleutel.stderr);
    const livePad = path.join(tmp, 'live.env');
    fs.writeFileSync(livePad, [
      'RTG_PUBLISH_HOST=0.0.0.0', 'RTG_PUBLISH_PORT=443', 'RTG_CONTAINER_PORT=443',
      'RTG_PAPIEREN_HOST_DIR=' + path.dirname(papierenPad),
      'RTG_BACKUP_HOST_DIR=' + backupDir, 'RTG_BACKUP_OFFSITE_HOST_DIR=' + offsiteDir,
      'RTG_BACKUP_OFFSITE_IMMUTABLE=1', 'RTG_BACKUP_PUBLIC_CERT_FILE=' + publicCert,
      'RTG_IMAGE=rtg-app:live', ''
    ].join('\n'), { mode: 0o600 });
    const keur = spawnSync(process.execPath, [path.join(ROOT, 'scripts/docker/controle.js'), '--publiek'], {
      encoding: 'utf8',
      env: { ...process.env, RTG_ENV_FILE: envPad, RTG_POSTGRES_PASSWORD_FILE: pgPad,
        RTG_MOTOR_STATE_KEY_SECRET_FILE: motorSleutelPad, RTG_LIVE_ENV_FILE: livePad }
    });
    assert.equal(keur.status, 0, keur.stdout + keur.stderr);
    assert.match(keur.stdout, /versleutelde en off-site back-ups zijn afgedwongen/);

    if (process.platform !== 'win32') {
      const complianceLink = path.join(tmp, 'compliance-parent-link');
      fs.symlinkSync(tmp, complianceLink, 'dir');
      const gekoppeldeCompliance = path.join(complianceLink, 'compliance');
      const linkLivePad = path.join(tmp, 'live-link.env');
      fs.writeFileSync(linkLivePad, fs.readFileSync(livePad, 'utf8')
        .replace('RTG_PAPIEREN_HOST_DIR=' + path.dirname(papierenPad),
          'RTG_PAPIEREN_HOST_DIR=' + gekoppeldeCompliance), { mode: 0o600 });
      const gekoppeld = spawnSync(process.execPath, [path.join(ROOT, 'scripts/docker/controle.js'), '--publiek'], {
        encoding: 'utf8',
        env: { ...process.env, RTG_ENV_FILE: envPad, RTG_POSTGRES_PASSWORD_FILE: pgPad,
          RTG_MOTOR_STATE_KEY_SECRET_FILE: motorSleutelPad, RTG_LIVE_ENV_FILE: linkLivePad }
      });
      assert.equal(gekoppeld.status, 1, gekoppeld.stdout + gekoppeld.stderr);
      assert.match(gekoppeld.stdout, /symbolische koppeling/,
        'een symlink mag de smalle compliance-bind mount niet naar een ander hostpad verleggen');
    }

    fs.appendFileSync(envPad, 'RTG_ACME_STAGING=1\n');
    const staging = spawnSync(process.execPath, [path.join(ROOT, 'scripts/docker/controle.js'), '--publiek'], {
      encoding: 'utf8',
      env: { ...process.env, RTG_ENV_FILE: envPad, RTG_POSTGRES_PASSWORD_FILE: pgPad,
        RTG_MOTOR_STATE_KEY_SECRET_FILE: motorSleutelPad, RTG_LIVE_ENV_FILE: livePad }
    });
    assert.equal(staging.status, 1, staging.stdout + staging.stderr);
    assert.match(staging.stdout, /RTG_ACME_STAGING=1.*verboden voor livegang/);
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
