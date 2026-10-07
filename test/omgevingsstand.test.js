'use strict';
/* CONFIG P1-1 en P1-2: de stand van de installatie en de basis van een link.

   P1-1. `NODE_ENV === 'production'` is de vraag waar de hele productiekeuring
   aan hangt. Een waarde die daar net naast zit (`prod`, `Production`,
   `staging`) was stil ONTWIKKELING: geen inlogrem, geen versleuteling, de
   gedeelde kantoorcode en de demo-inlog open. En `test` opende de
   toetsachterdeuren op elk adres waar de server luisterde.

   P1-2. Buiten productie nam appUrl() de Origin- of Host-kop over, dus een
   herstelmail kon een link naar het domein van een aanvaller dragen. En
   RTG_DEV_LINKS=1 zette op een niet aantoonbaar lokaal adres de herstellink in
   het antwoord, met alleen een waarschuwing.

   Alles hier draait tegen het echte startpad (`node server/server.js`) of een
   echte server: een keuring die alleen als functie is getoetst, bewijst niet
   dat de start ook stopt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { spawn } = require('child_process');
const { startServer, stop, vrijePoort } = require('./helper');
const config = require('../server/config');
const { luisterHost } = require('../server/config/omgeving');
const { basisUitVerzoek } = require('../server/lib/linkbasis');
const { adresSoort, installatieSoort } = require('../server/config/openbaar');

const SERVER = path.join(__dirname, '..', 'server', 'server.js');

/* Start het echte startpad met een kale omgeving en wacht tot het proces
   stopt of luistert. Geeft { code, uit } terug; code null = hij draaide. */
async function start(extra) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-omgeving-'));
  const poort = await vrijePoort();
  const env = { PATH: process.env.PATH, HOME: map, PORT: String(poort), RTG_DATA_DIR: map, STUN_UIT: '1', ...extra };
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let uit = '';
  kind.stdout.on('data', d => { uit += d; });
  kind.stderr.on('data', d => { uit += d; });
  const code = await new Promise(klaar => {
    const t = setTimeout(() => klaar(null), 60000);
    kind.on('exit', c => { clearTimeout(t); klaar(c); });
    const kijk = setInterval(() => { if (/draait op|klaar op poort/.test(uit)) { clearInterval(kijk); clearTimeout(t); klaar(null); } }, 100);
    kind.on('exit', () => clearInterval(kijk));
  });
  try { kind.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  return { code, uit, poort };
}

/* ---------------------------- P1-1: NODE_ENV ---------------------------- */

for (const waarde of ['prod', 'Production', 'staging']) {
  test('P1-1: NODE_ENV=' + waarde + ' start niet, en zegt waarom', async () => {
    const r = await start({ NODE_ENV: waarde });
    assert.equal(r.code, 1, 'de server hoort te weigeren in plaats van stil als ontwikkelserver te draaien:\n' + r.uit.slice(-600));
    assert.match(r.uit, new RegExp('NODE_ENV="' + waarde + '" is geen stand'));
  });
}

test('P1-1: NODE_ENV=test op een netwerkadres start niet', async () => {
  const r = await start({ NODE_ENV: 'test', RTG_BIND: '0.0.0.0' });
  assert.equal(r.code, 1, 'de toetsdeuren horen nooit op een netwerk:\n' + r.uit.slice(-600));
  assert.match(r.uit, /NODE_ENV=test met RTG_BIND=0\.0\.0\.0/);
});

test('P1-1: de toetsstand zonder RTG_BIND luistert alleen op de loopback', async () => {
  assert.equal(luisterHost({ NODE_ENV: 'test' }, ''), '127.0.0.1');
  assert.equal(luisterHost({ NODE_ENV: 'test', RTG_BIND: '::1' }, ''), '::1');
  assert.throws(() => luisterHost({ NODE_ENV: 'test', RTG_BIND: '192.168.1.5' }, ''), /toetsstand/);
  assert.equal(luisterHost({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000' }, ''), '',
    'een bewezen lokale ontwikkelserver luistert waar hij wil');
  assert.equal(luisterHost({}, '127.0.0.1'), '127.0.0.1');

  /* En over het echte startpad: geen netwerkadres van deze machine geeft
     antwoord, de loopback wel. */
  const srv = await startServer({ env: { SMTP_URL: '', RTG_BIND: '' } });   // de helper zet anders zelf de loopback
  try {
    const poort = new URL(srv.base).port;
    const ok = await fetch('http://127.0.0.1:' + poort + '/api/health');
    assert.equal(ok.status, 200);
    const buiten = Object.values(os.networkInterfaces()).flat()
      .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
    for (const adres of buiten) {
      const r = await fetch('http://' + adres + ':' + poort + '/api/health', { signal: AbortSignal.timeout(3000) })
        .then(x => x.status, () => 'dicht');
      assert.equal(r, 'dicht', 'de toetsserver antwoordt op ' + adres);
    }
  } finally { stop(srv); }
});

test('P1-1: de officiele standen blijven gewoon werken', () => {
  for (const e of [{}, { NODE_ENV: '' }, { NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'test', RTG_BIND: '127.0.0.1' }])
    assert.deepEqual(config.valideer(e).hardeFouten.filter(f => /NODE_ENV/.test(f)), [], JSON.stringify(e));
});

/* ---------------------------- P1-2: RTG_DEV_LINKS ---------------------------- */

test('P1-2: RTG_DEV_LINKS=1 op een niet aantoonbaar lokaal adres start niet', async () => {
  const r = await start({ RTG_DEV_LINKS: '1' });
  assert.equal(r.code, 1, 'zonder bewijs van een lokale installatie geen herstellinks in het antwoord:\n' + r.uit.slice(-600));
  assert.match(r.uit, /RTG_DEV_LINKS=1 terwijl niet vast te stellen is/);
  for (const APP_URL of ['https://rtg-intern', 'https://rtg.example.com']) {
    assert.ok(config.valideer({ RTG_DEV_LINKS: '1', APP_URL }).hardeFouten.some(f => /RTG_DEV_LINKS/.test(f)), APP_URL);
  }
  /* Met een poortwachter ervoor bewijst een loopback-bind niets. */
  assert.ok(config.valideer({ RTG_DEV_LINKS: '1', RTG_BIND: '127.0.0.1', RTG_CLUSTER_KEY: 'x'.repeat(32) })
    .hardeFouten.some(f => /RTG_DEV_LINKS/.test(f)));
  for (const lokaal of [{ APP_URL: 'http://localhost:3000' }, { RTG_BIND: '127.0.0.1' }, { NODE_ENV: 'test' }])
    assert.deepEqual(config.valideer({ RTG_DEV_LINKS: '1', ...lokaal }).hardeFouten.filter(f => /RTG_DEV_LINKS/.test(f)), [],
      JSON.stringify(lokaal));
});

/* ---------------------------- P1-2: de basis van een link ---------------------------- */

const verzoek = (koppen, protocol) => ({ headers: koppen, protocol: protocol || 'http',
  get: n => koppen[String(n).toLowerCase()] });

test('P1-2: een kop levert alleen een LOKALE basis', () => {
  const dev = { NODE_ENV: 'development' };
  assert.equal(basisUitVerzoek(verzoek({ origin: 'https://kwaad.example', host: '127.0.0.1:3000' }), dev), '');
  assert.equal(basisUitVerzoek(verzoek({ host: 'kwaad.example' }), dev), '');
  assert.equal(basisUitVerzoek(verzoek({ origin: 'http://[2a00:1450::1]:3000' }), dev), '');
  assert.equal(basisUitVerzoek(verzoek({ origin: 'http://localhost:3000' }), dev), 'http://localhost:3000');
  assert.equal(basisUitVerzoek(verzoek({ host: '192.168.1.9:3000' }), dev), 'http://192.168.1.9:3000');
  assert.equal(basisUitVerzoek(verzoek({ origin: 'http://[::1]:3000' }), dev), 'http://[::1]:3000');
  assert.equal(basisUitVerzoek(verzoek({ origin: 'https://kwaad.example' }), { NODE_ENV: 'test' }), 'https://kwaad.example',
    'de toetsstand luistert alleen op de loopback en houdt zijn wisselende poorten');
});

function post(base, pad, body, koppen) {
  const u = new URL(base + pad);
  const data = JSON.stringify(body || {});
  return new Promise((klaar, stuk) => {
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(koppen || {}) } }, (res) => {
      let t = ''; res.on('data', d => { t += d; }); res.on('end', () => {
        let b = {}; try { b = JSON.parse(t); } catch (e) {}
        klaar({ status: res.statusCode, body: b });
      });
    });
    r.on('error', stuk); r.end(data);
  });
}
const outbox = (map) => {
  const d = path.join(map, 'outbox');
  try { return fs.readdirSync(d).map(n => fs.readFileSync(path.join(d, n), 'utf8')).join('\n'); } catch (e) { return ''; }
};

test('P1-2: een herstelmail draagt nooit het adres uit de Origin- of Host-kop', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkbasis-'));
  /* Ontwikkelstand, geen APP_URL: precies de server uit de melding. */
  const srv = await startServer({ env: { NODE_ENV: 'development', RTG_DATA_DIR: map, SMTP_URL: '', RTG_ENC_KEY: '',
    RTG_DEV_LINKS: '', RTG_BIND: '127.0.0.1', APP_URL: '' } });
  try {
    const email = 'linkbasis' + Date.now() + '@x.nl';
    const reg = await post(srv.base, '/api/auth/register', { name: 'Link Basis', email, password: 'geheim123',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.equal(reg.status, 200, 'op een lokaal adres registreren kan: ' + JSON.stringify(reg.body).slice(0, 200));

    const viaOrigin = await post(srv.base, '/api/auth/forgot', { email }, { Origin: 'https://kwaad.example' });
    assert.equal(viaOrigin.status, 503, 'met een vreemde Origin geen herstelmail: ' + JSON.stringify(viaOrigin.body));
    assert.equal(viaOrigin.body.code, 'app-url-ontbreekt');
    assert.match(viaOrigin.body.error, /APP_URL ontbreekt/);
    const viaHost = await post(srv.base, '/api/auth/forgot', { email }, { Host: 'kwaad.example', 'X-Forwarded-Proto': 'https' });
    assert.equal(viaHost.status, 503, 'met een vreemde Host evenmin');

    const lokaal = await post(srv.base, '/api/auth/forgot', { email });
    assert.equal(lokaal.status, 200, 'op een lokaal adres werkt herstellen: ' + JSON.stringify(lokaal.body));
    let inhoud = '';
    for (let i = 0; i < 50 && !/reset=/.test(inhoud); i++) { await new Promise(r => setTimeout(r, 100)); inhoud = outbox(map); }
    assert.match(inhoud, /http:\/\/127\.0\.0\.1:\d+\/apps\/app\.html\?pas=rtg&reset=/, 'de lokale herstelmail staat in de outbox');
    assert.doesNotMatch(inhoud, /kwaad\.example/, 'en nergens het adres van de aanvaller');
  } finally { stop(srv); try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
});

/* ---------------------------- P2: de soort van een installatie ---------------------------- */

test('P2: een publiek certificaat en een publiek IPv6-adres maken een installatie openbaar', () => {
  assert.equal(installatieSoort({ RTG_ACME: '1', RTG_TLS_DOMAIN: 'app.rtg-publiek.nl' }).soort, 'openbaar');
  assert.equal(installatieSoort({ RTG_ACME: '1', RTG_TLS_DOMAIN: 'app.rtg-publiek.nl', APP_URL: 'http://localhost:3000' }).soort, 'openbaar',
    'een lokaal APP_URL naast een publiek certificaat: de openbare kant telt');
  assert.equal(installatieSoort({ RTG_TLS_DOMAIN: 'app.rtg-publiek.nl' }).soort, 'onbekend', 'zonder ACME is het geen opgave');
  assert.equal(installatieSoort({ RTG_DOMAINS: 'member,social' }).soort, 'onbekend', 'RTG_DOMAINS draagt codedomeinen, geen hostnamen');
  assert.equal(adresSoort('2a00:1450:4001::64'), 'openbaar');
  assert.equal(installatieSoort({ APP_URL: 'http://[2a00:1450:4001::64]:3000' }).soort, 'openbaar');
  for (const h of ['::1', '[::1]', 'fd12::1', 'fe80::1', '127.0.0.2']) assert.equal(adresSoort(h), 'lokaal', h);
  for (const h of ['2001:db8::1', '::']) assert.equal(adresSoort(h), 'onbekend', h);
  /* En het gevolg: Magnaat Test op zo'n installatie start niet. */
  assert.ok(config.valideer({ RTG_MAGNAAT_TEST: '1', RTG_ACME: '1', RTG_TLS_DOMAIN: 'app.rtg-publiek.nl' })
    .hardeFouten.some(f => /RTG_MAGNAAT_TEST/.test(f)));
});

/* ---------------------------- A-P1-02: publiek bereikbaar -> productiebeveiliging ---------------------------- */

/* DE OORSPRONKELIJKE REPRODUCTIES, met hun uitslag van VOOR deze reparatie.
   `voor` is gemeten met config.valideer() op release/v1-hardening a1ec1629 (het
   aantal harde fouten); `na` is wat deze tak hoort te geven. Elke rij hier gaf
   toen nul harde fouten en startte dus -- als ontwikkelserver, op een adres waar
   de wereld bij kon. */
const REPRODUCTIES = [
  { naam: 'NODE_ENV=prod zonder APP_URL', env: { NODE_ENV: 'prod' }, voor: 0 },
  { naam: 'NODE_ENV=Production zonder APP_URL', env: { NODE_ENV: 'Production' }, voor: 0 },
  { naam: 'publiek IPv6-adres als APP_URL', env: { APP_URL: 'http://[2a00:1450:4001::64]:3000' }, voor: 0 },
  { naam: 'ACME-domein zonder APP_URL', env: { RTG_ACME: '1', RTG_TLS: '1', RTG_TLS_DOMAIN: 'app.rtg-publiek.nl', RTG_TLS_EMAIL: 'x@rtg-publiek.nl' }, voor: 0 },
  { naam: 'publieke naam in RTG_DOMAINS zonder APP_URL', env: { RTG_DOMAINS: 'app.rtg-publiek.nl' }, voor: 0 },
  { naam: 'niet-loopback bind zonder lokaal adres', env: { RTG_BIND: '0.0.0.0' }, voor: 0 },
  { naam: 'NODE_ENV=test op een netwerkadres', env: { NODE_ENV: 'test', RTG_BIND: '0.0.0.0' }, voor: 0 },
  { naam: 'RTG_DEV_LINKS zonder bewijs van lokaal', env: { RTG_DEV_LINKS: '1' }, voor: 0 }
];

test('A-P1-02: elke oorspronkelijke reproductie gaat van nul harde fouten naar een startweigering', () => {
  for (const r of REPRODUCTIES) {
    const na = config.valideer(r.env).hardeFouten.length;
    assert.equal(r.voor, 0, r.naam + ': de vastgelegde voor-uitslag');
    assert.ok(na > 0, r.naam + ': hoort de start te weigeren, gaf ' + na + ' harde fouten');
  }
});

test('A-P1-02: een ontwikkelserver luistert standaard op de loopback, en alleen bewezen lokaal of bevestigd daarbuiten', () => {
  const { bindBesluit } = require('../server/config/omgeving');
  assert.deepEqual(bindBesluit({}, ''), { host: '127.0.0.1', verengd: true }, 'geen RTG_BIND en geen bewijs: de loopback, niet alle interfaces');
  assert.equal(bindBesluit({ APP_URL: 'http://192.168.1.5:3000' }, '').host, '', 'een lokaal LAN-adres als APP_URL: alle interfaces mag');
  assert.equal(bindBesluit({ RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: 'BEVESTIGD' }, '').host, '0.0.0.0', 'bevestigd: mag');
  assert.ok(bindBesluit({ RTG_BIND: '0.0.0.0', RTG_LOKAAL_NETWERK: 'ja' }, '').fout, 'een ander woord dan BEVESTIGD bevestigt niets');
  assert.equal(bindBesluit({ NODE_ENV: 'production' }, '').host, '', 'productie: de productiekeuring beslist');
  assert.equal(bindBesluit({ RTG_CLUSTER_KEY: 'x' }, '127.0.0.1').host, '127.0.0.1', 'een kind van de poortwachter blijft op de loopback');
});

test('A-P1-02: een ontwikkelserver met RTG_BIND=0.0.0.0 en zonder lokaal adres start niet', async () => {
  const r = await start({ RTG_BIND: '0.0.0.0' });
  assert.equal(r.code, 1, r.uit.slice(-600));
  assert.match(r.uit, /RTG_BIND=0\.0\.0\.0 buiten productie/);
});
