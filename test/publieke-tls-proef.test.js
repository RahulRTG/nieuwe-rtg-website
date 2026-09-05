'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { spawnSync } = require('node:child_process');
const { maakCA } = require('../server/lib/ca');
const x509 = require('../server/lib/x509');
const {
  FORMAAT,
  keurAppUrl,
  keurHsts,
  keurRedirect,
  voerPubliekeTlsProef,
  valideerPubliekeTlsBewijs
} = require('../scripts/lib/publieke-tls-proef');

const ROOT = path.join(__dirname, '..');
const APP_URL = 'https://app.rtg.example.test';

function luister(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function sluit(server) {
  return new Promise(resolve => {
    try { if (server.closeAllConnections) server.closeAllConnections(); } catch (e) {}
    server.close(() => resolve());
  });
}

async function randFixture(opties) {
  opties = opties || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-publieke-tls-'));
  const autoriteit = maakCA({ dataDir: tmp, naam: 'RTG publieke-proef-CA' });
  const leaf = opties.selfSigned
    ? x509.selfSigned({ names: [opties.certHost || 'app.rtg.example.test'], days: opties.days || 90 })
    : autoriteit.geefUitServer({ names: [opties.certHost || 'app.rtg.example.test'], days: opties.days || 90 });
  const veilig = https.createServer({ key: leaf.keyPem, cert: leaf.chainPem || leaf.certPem }, (req, res) => {
    if (opties.hsts !== null) res.setHeader('Strict-Transport-Security',
      opties.hsts || 'max-age=31536000; includeSubDomains');
    res.statusCode = req.url === '/api/ready' ? (opties.readyStatus || 200) : (opties.rootStatus || 200);
    res.end('ok');
  });
  const plat = http.createServer((req, res) => {
    res.statusCode = opties.redirectStatus || 301;
    res.setHeader('Location', opties.location || 'https://app.rtg.example.test' + req.url);
    res.end();
  });
  const httpsPort = await luister(veilig);
  const httpPort = await luister(plat);
  return {
    tmp, autoriteit, veilig, plat, httpsPort, httpPort,
    async stop() { await Promise.all([sluit(veilig), sluit(plat)]); fs.rmSync(tmp, { recursive: true, force: true }); }
  };
}

async function proef(fixture, extra) {
  return voerPubliekeTlsProef(Object.assign({
    appUrl: APP_URL,
    connectHost: '127.0.0.1',
    httpsPort: fixture.httpsPort,
    httpPort: fixture.httpPort,
    trustAnchors: [fixture.autoriteit.caCertPem],
    timeoutMs: 3000
  }, extra || {}));
}

test('publieke TLS-proef bewijst trust, APP_URL-hostname, looptijd, HSTS en canonieke redirect', async () => {
  const f = await randFixture();
  try {
    const bewijs = await proef(f, { releaseCommit: 'a'.repeat(40), eisReleaseCommit: true });
    assert.equal(bewijs.formaat, FORMAAT);
    assert.equal(bewijs.geslaagd, true);
    assert.equal(bewijs.appUrl, 'https://app.rtg.example.test');
    assert.equal(bewijs.connectMode, 'loopback-met-publieke-SNI');
    assert.equal(bewijs.releaseCommit, 'a'.repeat(40));
    assert.equal(bewijs.tls.authorized, true);
    assert.match(bewijs.tls.subjectAltName, /DNS:app\.rtg\.example\.test/);
    assert.match(bewijs.tls.protocol, /^TLSv1\.[23]$/);
    assert.equal(bewijs.ready.status, 200);
    assert.equal(bewijs.ready.hsts.maxAge, 31536000);
    assert.equal(bewijs.https.status, 200);
    assert.deepEqual(bewijs.redirect, { status: 301,
      location: 'https://app.rtg.example.test/__rtg_tls_redirect_probe?bron=release' });
    assert.equal(valideerPubliekeTlsBewijs(bewijs, {
      appUrl: APP_URL,
      releaseCommit: 'a'.repeat(40),
      eisPubliekeDns: false
    }).ok, true);
    assert.throws(() => valideerPubliekeTlsBewijs({ ...bewijs, releaseCommit: 'b'.repeat(40) }, {
      appUrl: APP_URL, releaseCommit: 'a'.repeat(40), eisPubliekeDns: false
    }), /releasecommit/);
    assert.throws(() => valideerPubliekeTlsBewijs(bewijs, {
      appUrl: APP_URL, releaseCommit: 'a'.repeat(40)
    }), /loopbackproef/);
  } finally { await f.stop(); }
});

test('een onbekend self-signed certificaat faalt dicht', async () => {
  const f = await randFixture({ selfSigned: true });
  try {
    await assert.rejects(() => proef(f, { trustAnchors: [] }), /self-signed|certificate|verify|issuer/i);
  } finally { await f.stop(); }
});

test('een vertrouwde keten voor de verkeerde SAN/hostname faalt dicht', async () => {
  const f = await randFixture({ certHost: 'aanvaller.example.test' });
  try {
    await assert.rejects(() => proef(f), /altnames|hostname|certificate|app\.rtg\.example\.test/i);
  } finally { await f.stop(); }
});

test('een certificaat met minder dan veertien dagen marge blokkeert de release', async () => {
  const f = await randFixture({ days: 5 });
  try {
    await assert.rejects(() => proef(f), /minder dan 14 dagen/);
  } finally { await f.stop(); }
});

test('ontbrekende, korte en onvolledige HSTS blokkeren', async () => {
  for (const hsts of [null, 'max-age=60; includeSubDomains', 'max-age=31536000']) {
    const f = await randFixture({ hsts });
    try { await assert.rejects(() => proef(f), /Strict-Transport-Security|HSTS/); }
    finally { await f.stop(); }
  }
  assert.throws(() => keurHsts('max-age=31536000, max-age=31536000; includeSubDomains'), /meermaals/);
});

test('poort 80 moet permanent en exact naar dezelfde APP_URL-route sturen', async () => {
  for (const opties of [
    { redirectStatus: 302 },
    { location: 'https://aanvaller.example.test/' },
    { location: 'http://app.rtg.example.test/' }
  ]) {
    const f = await randFixture(opties);
    try { await assert.rejects(() => proef(f), /HTTP|doorsturen|dezelfde route/); }
    finally { await f.stop(); }
  }
  const url = keurAppUrl(APP_URL);
  assert.throws(() => keurRedirect({ status: 301, location: 'https://app.rtg.example.test/verkeerd' }, url, '/'), /dezelfde route/);
});

test('de lokale verbindingsomleiding kan hostname/trust nooit vervangen', async () => {
  await assert.rejects(() => voerPubliekeTlsProef({ appUrl: APP_URL, connectHost: '10.0.0.5' }), /uitsluitend naar loopback/);
  await assert.rejects(() => voerPubliekeTlsProef({ appUrl: APP_URL, eisReleaseCommit: true }), /releasecommit/);
  for (const url of ['http://app.rtg.example.test', 'https://127.0.0.1', 'https://localhost',
    'https://user:pass@app.rtg.example.test', 'https://app.rtg.example.test:444'])
    assert.throws(() => keurAppUrl(url), /APP_URL/);
});

test('deploy, containerhealth en publieke probe bevatten geen TLS-bypass meer', () => {
  const live = fs.readFileSync(path.join(ROOT, 'scripts/docker/live.sh'), 'utf8');
  const overlay = fs.readFileSync(path.join(ROOT, 'docker-compose.live.yml'), 'utf8');
  const cli = fs.readFileSync(path.join(ROOT, 'scripts/publieke-tls-proef.js'), 'utf8');
  const monitor = fs.readFileSync(path.join(ROOT, '.github/workflows/live-monitor.yml'), 'utf8');
  assert.doesNotMatch(live, /--insecure|curl\s+(?:-[^\s]*k\b|--insecure)/);
  assert.doesNotMatch(overlay, /rejectUnauthorized\s*:\s*false/);
  assert.doesNotMatch(cli, /--ca(?:=|\b)|rejectUnauthorized\s*:\s*false/);
  assert.match(live, /publieke-tls-proef\.js" "\$APP_URL"[\s\\]*--connect-host=127\.0\.0\.1/);
  assert.match(live, /--bewijs=\.release\/publieke-tls-bewijs\.json/);
  assert.match(live, /--eis-release-commit/);
  assert.match(live, /require\("\/app\/release-bewijs\.json"\)[\s\S]*RTG_RELEASE_COMMIT="\$probe_commit"/,
    'de echte DNS/TLS-proef moet aan de commit uit het draaiende image zijn gebonden');
  assert.match(overlay, /publieke-tls-proef\.js.*--env-file=\/run\/secrets\/rtg_env.*--readiness-only/);
  assert.match(monitor, /--eis-release-commit[\s\S]*RTG_RELEASE_COMMIT:.*RTG_LIVE_COMMIT/,
    'de onafhankelijke monitor moet zijn TLS-bewijs aan de uitgerolde commit binden');
});

test('de CLI bewaart ook een rode, niet als succes te verwarren proef', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tls-rood-'));
  try {
    const bewijsPad = path.join(tmp, 'tls.json');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/publieke-tls-proef.js'),
      'https://127.0.0.1', '--bewijs=' + bewijsPad, '--stil'], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const bewijs = JSON.parse(fs.readFileSync(bewijsPad, 'utf8'));
    assert.equal(bewijs.formaat, FORMAAT);
    assert.equal(bewijs.geslaagd, false);
    assert.equal(bewijs.foutcode, 'RTG_TLS_APP_URL');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
