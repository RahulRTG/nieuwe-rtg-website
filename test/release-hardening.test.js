'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('alle Docker- en deployinvoer telt als releasecode', () => {
  const { isCodePad } = require('../scripts/lib/stempel');
  for (const rel of ['Dockerfile', '.dockerignore', 'docker-compose.yml',
    'docker-compose.live.yml', 'docker-compose.nood.yaml', 'deploy/live.env.example',
    '.github/workflows/release-image.yml']) assert.equal(isCodePad(rel), true, rel);
});

test('de releasepoort weigert servicebevoegdheden zonder echte lezer', () => {
  const bron = lees('scripts/release-gate.js');
  assert.match(bron, /scripts\/servicecaps\.js', '--controle'/);
  assert.ok(bron.indexOf('scripts/servicecaps.js') > bron.indexOf('scripts/check.js'));
  assert.ok(bron.indexOf('scripts/servicecaps.js') < bron.indexOf('scripts/mutatiepoort.js'));
});

test('de releasepoort en READY-uitspraak vereisen het actuele codecredentialregister', () => {
  const poort = lees('scripts/release-gate.js');
  const oordeel = lees('scripts/lib/productie-oordeel.js');
  assert.match(poort,
    /\['Codecredentialregister', process\.execPath, \['scripts\/codecredentials\.js', '--bewijs'\]\]/);
  assert.ok(poort.indexOf('scripts/codecredentials.js') < poort.indexOf('scripts/release-bewijs.js'));
  assert.match(oordeel, /'Codecredentialregister'/,
    'PRODUCTION_STATUS kan een releasegate zonder credentialpoort nog vertrouwen');
});

test('de oude bouwende productieroute is gesloten en wijst naar de kandidaatpromotie', () => {
  const bron = lees('scripts/uitrol.js');
  assert.match(bron, /oude bouw-en-uitrolroute is gesloten/);
  assert.doesNotMatch(bron, /compose\(\['build'/,
    'scripts/uitrol.js kan nog na READY een ander image herbouwen');
  const pakket = JSON.parse(lees('package.json'));
  assert.equal(pakket.scripts['deploy:productie'], 'npm run live:deploy');
});

test('de volledige afbouw eindigt met een aparte READY-uitspraak', () => {
  const pakket = JSON.parse(lees('package.json'));
  assert.match(pakket.scripts['afbouw:software'], /schermsuite:bewijs/,
    'de 203 .e2e.js-bestanden ontbreken in de productie-afbouw');
  assert.match(pakket.scripts['afbouw:alles'], /live:golive.*productie:status/,
    'PostgreSQL/Redis wordt niet vers in exact de geïsoleerde CI-kandidaat bewezen');
  assert.match(pakket.scripts['afbouw:alles'], /live:golive.*productie:status/,
    'golive kan groen eindigen zonder de P0-P3-bewijzen samen te voegen');
  const status = lees('scripts/productie-status.js') + lees('scripts/lib/productie-vrijgave.js');
  for (const bron of ['SUITE.json', 'schermsuite-bewijs.json', 'release-gate-bewijs.json', 'staging-bewijs.json',
    'golive-bewijs.json', 'release-bewijs.json', 'pg-bewijs.json', 'external-release.json'])
    assert.match(status, new RegExp(bron.replace('.', '\\.')));
  assert.match(status, /PRODUCTION_STATUS/);
  assert.match(lees('scripts/test-runner.js'), /code === 0 && !zonderStilte.*code = 1/,
    'een volle unitronde met skips, todo of ontbrekende TAP mag exitcode nul houden');
});

test('live:deploy eist READY en wisselt uitsluitend naar het bewezen immutable image', () => {
  const live = lees('scripts/docker/live.sh');
  const deploy = live.slice(live.indexOf('  deploy)'), live.indexOf('  status)'));
  const eerstePoort = deploy.indexOf('node scripts/live-vrijgave.js');
  const eersteDocker = deploy.indexOf('docker/controle.js --publiek');
  const wissel = deploy.indexOf('compose up -d --no-build');
  assert.ok(eerstePoort >= 0 && eerstePoort < eersteDocker && eersteDocker < wissel);
  assert.doesNotMatch(deploy, /docker build/, 'live:deploy bouwt na READY opnieuw uit onbewezen bron');
  assert.match(deploy, /IMAGE="\$kandidaat"/);
  assert.match(deploy, /BACKUP_IMAGE="\$kandidaat_backup"/);
  assert.match(deploy, /docker image inspect --format='\{\{\.Id\}\}' "\$kandidaat"/);
  assert.ok(deploy.indexOf('node scripts/live-vrijgave.js', eerstePoort + 1) > eersteDocker,
    'de bron en bewijsset worden vlak vóór de wissel niet opnieuw gecontroleerd');
  const keuring = live.slice(live.indexOf('  golive)'), live.indexOf('  probe)'));
  assert.doesNotMatch(keuring, /docker build|--build-arg/,
    'de productiehost mag geen lokaal alternatief voor de ondertekende CI-kandidaat bouwen');
  assert.match(keuring, /docker pull "\$kandidaat"/);
  assert.match(keuring, /--controle --eis-kandidaat[\s\S]*--sbom=\.release\/sbom\.json/);
  assert.ok(keuring.indexOf('node scripts/imageherkomst.js --controle --eis-kandidaat') <
    keuring.indexOf('docker run --rm --entrypoint node "$kandidaat_registry"'),
  'code uit het kandidaatimage draait voordat de vaste signer en registrydigest zijn bewezen');
  assert.match(keuring, /up -d --no-build --wait[\s\S]*keurmotor keurapp/,
    'het kandidaatimage wordt niet als echte geïsoleerde app gestart');
  assert.match(keuring, /exec -T keurapp node scripts\/sonde\.js/,
    'het gestarte kandidaatproces doorloopt geen readiness/probereis');
  assert.match(keuring, /keurapp node scripts\/pgtoetsen\.js --bewijs-stdout/,
    'PostgreSQL/Redis wordt niet opnieuw in exact het kandidaatimage bewezen');
  assert.match(keuring, /keur_compose run --rm --no-deps[\s\S]*keurgolive node scripts\/golive\.js --bewijs-stdout/);
  const dockerfile = lees('Dockerfile');
  assert.match(dockerfile, /ARG RTG_RELEASE_COMMIT/);
  assert.equal((dockerfile.match(/^FROM [^\n]+@sha256:[a-f0-9]{64}/gm) || []).length, 3,
    'iedere Dockerfile-base hoort aan een immutable multiarch digest vast te staan');
  assert.doesNotMatch(dockerfile, /^COPY \. \.$/m, 'ongekende contextbestanden belanden nog in het image');
  assert.doesNotMatch(lees('docker-compose.live.yml'), /scripts\/docker\/(?:backup|herstel)\.sh:/,
    'een hostscript kan de getekende backupimage na READY nog overschrijven');
});

test('de kandidaat gebruikt een eigen project en uitsluitend vluchtige keurinfra', () => {
  const live = lees('scripts/docker/live.sh');
  const keuring = live.slice(live.indexOf('  golive)'), live.indexOf('  probe)'));
  assert.match(live, /docker compose --project-name "\$KEUR_PROJECT"/);
  assert.match(keuring, /up -d --no-build --wait[\s\S]*keurpostgres keurredis keurclamav keurmotor keurapp/);
  assert.doesNotMatch(keuring, /--wait\s+(?:postgres|redis|clamav|motor|app)(?:\s|$)/,
    'kandidaatkeuring mag geen productiedienst starten of recreëren');

  const compose = lees('docker-compose.yml');
  const blok = naam => {
    const begin = compose.indexOf('\n  ' + naam + ':');
    assert.ok(begin >= 0, naam + ' ontbreekt');
    const volgende = /^  [A-Za-z][A-Za-z0-9_-]*:\s*$/gm;
    volgende.lastIndex = begin + 4;
    const raak = volgende.exec(compose);
    const einde = raak ? raak.index - 1 : compose.length;
    return compose.slice(begin, einde < 0 ? compose.length : einde);
  };
  for (const naam of ['keurmotor', 'keurapp', 'keurredis', 'keurpostgres', 'keurclamav']) {
    const service = blok(naam);
    assert.doesNotMatch(service, /\brtg_env\b/, naam + ' leest nog productieconfiguratie');
    assert.doesNotMatch(service, /\brtg-(?:data|pg|redis|motor|clamav|sentinel):/, naam + ' koppelt een live volume');
    assert.doesNotMatch(service, /^\s+- (?:data|edge)$/m, naam + ' hangt aan een live netwerk');
  }
  const app = blok('keurapp');
  assert.doesNotMatch(app, /@postgres:5432|redis:\/\/redis:6379|depends_on:[\s\S]*(?:^\s{6}(?:postgres|redis|motor|clamav):)/m);
  assert.match(blok('keurpostgres'), /tmpfs:[\s\S]*\/tmp\/pgdata/);
  assert.match(blok('keurredis'), /tmpfs:[\s\S]*\/data/);
  assert.match(compose, /keurdata:\n\s+internal: true/);
  assert.match(blok('keurgolive'), /RTG_ENV_FILE: \/run\/secrets\/rtg_env/,
    'alleen de eenmalige niet-serverkeuring mag liveconfig read-only beoordelen');
});

test('container-golive draagt papieren en gebruikt een geverifieerd imagebewijs', () => {
  const ignore = lees('.dockerignore');
  assert.match(ignore, /!VERWERKINGSREGISTER\.md/);
  assert.match(ignore, /!DATALEK\.md/);
  assert.match(lees('scripts/golive.js'), /runtime-release-stempel/);
  const bewijs = lees('scripts/release-bewijs.js');
  assert.match(bewijs, /filter\(n => n\.endsWith\('\.json'\)\)/,
    'rootregisters vallen nog buiten het imagebewijs');
  assert.match(lees('scripts/lib/live-kandidaat.js'), /live-kandidaat-runtime-bewijs\.json/);
  assert.match(lees('scripts/lib/live-kandidaat.js'), /bron-release-bewijs\.json/);
  assert.match(lees('scripts/lib/live-kandidaat.js'), /image-release-bewijs\.json/);
  assert.doesNotMatch(lees('scripts/lib/live-kandidaat.js'), /motor\/target\/release\/rtg-motor.*rtg-motor/s,
    'een verse checkout wordt nog ten onrechte met lokale Rust-buildbytes vergeleken');
  assert.match(lees('docker-compose.yml'), /test: \["CMD", "node", "scripts\/motor-health\.js"\]/,
    'motor-health leunt nog op kale /api/leeft-liveness');
  assert.match(lees('scripts/lib/motor-proef.js'), /snapshotGeldig[\s\S]*api\/bank\/status/,
    'geld-readiness bewijst niet beide grootboeken en de snapshotstatus');
  assert.match(lees('scripts/lib/productie-oordeel.js') + lees('server/config/external-release.js'), /deploymentRollback/,
    'de geïsoleerde readinessreis mag de echte externe rollbackrepetitie niet vervangen');
  assert.doesNotMatch(lees('docker-compose.yml'), /RTG_MOTOR_GELD:\s*\$\{/,
    'Compose overschrijft de gekeurde motorautoriteit uit het productiesecret');
  assert.doesNotMatch(lees('scripts/docker/controle.js'), /RTG_BETALEN_UIT !== '1'/,
    'de hostcheck maakt een volwaardige geldrelease structureel onmogelijk');
});

test('rollback herstelt app, motor, sentinel, backup en de vorige bewijs-pin', () => {
  const live = lees('scripts/docker/live.sh');
  assert.match(live, /vorig_backup/);
  assert.match(live, /vorige_pin/);
  assert.match(live, /IMAGE="\$vorig"[\s\S]*BACKUP_IMAGE="\$vorig_backup"[\s\S]*RTG_RELEASE_BEWIJS_SHA256="\$vorige_pin"/);
  assert.match(live, /compose up -d --no-build motor app sentinel backup/);
  assert.match(live, /RTG_EERSTE_UITROL.*BEVESTIGD-ZONDER-ROLLBACK/,
    'een eerste uitrol zonder hersteldoel gebeurt nog stilzwijgend');
});

test('de imageworkflow publiceert alleen een getekende kandidaat en geen officiële release', () => {
  const bron = lees('.github/workflows/release-image.yml');
  const afbouw = bron.indexOf('npm run afbouw:software');
  const pg = bron.indexOf('node scripts/pgtoetsen.js');
  const sleutel = bron.indexOf('imageherkomst.js --sleutelcontrole');
  const kandidaat = bron.indexOf('docker push "$RTG_CANDIDATE_IMAGE"');
  const teken = bron.indexOf('imageherkomst.js --binden --eis-handtekening');
  const controle = bron.indexOf('imageherkomst.js --controle');
  assert.ok(afbouw >= 0 && afbouw < kandidaat, 'de volledige software-afbouw staat niet vóór het kandidaatimage');
  assert.ok(pg > afbouw && pg < kandidaat && /postgres:16-alpine/.test(bron) && /redis:7-alpine/.test(bron),
    'het kandidaatimage kan ontstaan zonder PostgreSQL/Redis-duurzaamheidsbewijs');
  assert.ok(sleutel > afbouw && sleutel < kandidaat,
    'de ondertekeningssleutel wordt niet vóór publicatie tegen het vertrouwensanker bewezen');
  assert.ok(teken > kandidaat, 'de kandidaatdigest wordt niet verplicht getekend');
  assert.ok(controle > teken, 'de verplichte handtekening wordt niet teruggecontroleerd');
  assert.doesNotMatch(bron, /docker (?:tag|push) "\$RTG_RELEASE_IMAGE"/,
    'CI kan nog een officiële releasetag maken zonder container-golive, rollback en READY');
  assert.doesNotMatch(bron, /RTG_RELEASE_IMAGE=/,
    'een kandidaatworkflow hoort geen officiële release-identiteit te claimen');
  assert.match(bron, /--image="\$RTG_CANDIDATE_IMAGE" --digest="\$digest"/,
    'de handtekening noemt niet het kandidaatimage dat werkelijk is gebouwd');
  assert.doesNotMatch(bron, /Zeg het hardop als de release ongetekend is/,
    'de oude waarschuwingsuitweg voor ongetekende releases bestaat nog');
  assert.match(bron, /ci-suite\.json[\s\S]*ci-schermsuite-bewijs\.json[\s\S]*ci-pg-bewijs\.json/,
    'CI-uitvoering wordt niet als vaste provenance-invoer bewaard');
  assert.match(lees('scripts/imageherkomst.js'), /uitvoeringHashes[\s\S]*CI-uitvoeringsbewijs/,
    'signed provenance bindt unit-, scherm- en PG-bewijs niet');
});

test('live deploy vereist een aparte handmatig ondertekende productiepromotie', () => {
  const vrijgave = lees('scripts/live-vrijgave.js');
  const promotie = lees('scripts/lib/productie-promotie.js');
  assert.match(vrijgave, /productie-promotie.*controleer/);
  assert.match(promotie, /RTG_PROMOTION_SIGN_KEY/);
  assert.match(promotie, /deploy\/promotie-sleutel\.pub/);
  assert.match(promotie, /bewijskaart/);
  assert.match(promotie, /live-kandidaat.*controleer/);
  assert.doesNotMatch(lees('package.json').match(/"afbouw:alles"[^\n]*/)[0], /promotie:teken/,
    'de appcode mag zichzelf na afbouw automatisch autoriseren');
});
