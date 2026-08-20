'use strict';
/* ============================================================================
   DE HELE SERVER MET RTG_TLS=1 -- de bewering waar de cameraklacht op eindigde.

   WAAROM DIT BESTAAT. De klacht was "alle camera's doen het nergens, op mijn
   telefoon doet niks het". De gemeten oorzaak was niet de code maar het adres:
   buiten https en localhost geeft een browser `navigator.mediaDevices` niet
   vrij, dus op http://192.168.x.x werkt geen enkel camerascherm. De oplossing is
   TLS, en die staat er (server/lokaal-tls.js, opzet/luister.js).

   Wat er NIET stond, is een toets die de hele server met die schakelaar
   opstart. Er is veel over TLS gedekt -- een echte handshake
   (test/lokaal-tls.test.js), de native laag (tls-native), de ACME-weg
   (tls-acme), en de opstartmelding (veiligadres) -- maar dat zijn alle vijf de
   MODULES. De samenvoeging "zet RTG_TLS=1 en de app praat https" had ik met de
   hand nagekeken en niemand hield hem vast. Een schakelaar waar geen toets aan
   trekt, is geen schakelaar (LAT.md regel 10).

   DRIE BEWERINGEN, EN DE DERDE IS DE TEGENPROEF.

   1. Met RTG_TLS=1 antwoordt /api/health over https.
   2. Gewone http op diezelfde poort komt er NIET door. Dat is niet dezelfde
      bewering: een server die beide spreekt zou de eerste halen en de telefoon
      alsnog op een onveilige verbinding laten landen.
   3. ZONDER de schakelaar is het omgekeerd: http werkt en https niet. Zonder die
      derde zou deze toets ook groen blijven op een server die altijd https doet,
      en dan zegt hij niets over RTG_TLS.

   En een vierde die de klacht rechtstreeks raakt: de opstartmelding moet met TLS
   de WEGWIJZER geven ("dat is https, dus camera, microfoon en locatie werken
   daar") en niet de waarschuwing. Dat is de regel waar iemand met een telefoon
   op afgaat, en die had zonder toets stil van tekst kunnen veranderen.
   ========================================================================== */
const { test } = require('node:test');
const { opstartGeduld } = require('./helper');
const assert = require('node:assert');
const cp = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
/* De vrije-poortkiezer van test/helper.js, en niet een gok uit een bereik.
   Die helper is er precies voor dit: hij bindt op 0, leest de poort die het
   besturingssysteem toewijst en geeft hem weer vrij. In de kop daar staat dat
   een gegokte poort "de oude oorzaak van sporadische fetch failed" was -- en
   deze toets gokte er nog een, met als gevolg een rood dat niets over de code
   zei ("Poort 39340 is al in gebruik"). Een toets die om een andere reden dan
   zijn onderwerp kan zakken, kost precies het vertrouwen dat hij moet leveren. */
const { vrijePoort } = require('./helper');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function vraag(mod, port, pad) {
  return new Promise((resolve, reject) => {
    const req = mod.get({ host: '127.0.0.1', port, path: pad, timeout: 6000,
      rejectUnauthorized: false }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

function boot(port, dataDir, tls) {
  const env = Object.assign({}, process.env, {
    PORT: String(port), RTG_DATA_DIR: dataDir, RTG_CSP_NONCE: '0',
    NODE_ENV: 'test', RTG_DEMO: '1', ANTHROPIC_API_KEY: '', RTG_PG: ''
  });
  if (tls) env.RTG_TLS = '1'; else delete env.RTG_TLS;
  const kind = cp.spawn(process.execPath, ['server/server.js'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const uitInfo = { log: '', fataal: false };
  const vang = d => { uitInfo.log += d; if (/uncaughtException|"fataal":true/.test(String(d))) uitInfo.fataal = true; };
  kind.stdout.on('data', vang);
  kind.stderr.on('data', vang);
  return { kind, uitInfo };
}

/* Wachten op "hij praat", en met de JUISTE module -- anders wacht een https-start
   het hele tijdvenster af op een http-verzoek dat nooit lukt.

   Het geduld komt uit ./helper.js (`opstartGeduld`) en niet uit een getal hier:
   dit was de derde kopie van dezelfde regel (LAT.md regel 4), en een vast
   venster is op een bezette machine te krap zonder dat er iets stuk is. Een
   GESTOPT kindproces breekt meteen af -- dan valt er niets meer af te wachten. */
async function wachtTotOp(mod, port, uitInfo, kind, tot) {
  const geduld = opstartGeduld(30000);
  const budget = tot || geduld.ms;
  const gestart = Date.now();
  const eind = gestart + budget;
  while (Date.now() < eind) {
    if (uitInfo.fataal) throw new Error('server crashte bij opstart:\n' + uitInfo.log.slice(-2000));
    if (kind && kind.exitCode != null)
      throw new Error('server stopte tijdens opstarten (exit ' + kind.exitCode + ') na ' +
        (Date.now() - gestart) + 'ms\n' + uitInfo.log.slice(-2000));
    try { const r = await vraag(mod, port, '/api/health'); if (r.status) return r; } catch (e) { /* nog niet op */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('server werd niet bereikbaar binnen ' + budget + 'ms (' +
    (kind && kind.exitCode == null ? 'het kindproces LEEFDE nog' : 'het kindproces was gestopt') +
    ', belasting ' + geduld.druk.toFixed(2) + ' per kern, geduld x' + geduld.extra + ')\n' +
    uitInfo.log.slice(-2000));
}

async function opgestart(dataDir, tls, mod) {
  for (let poging = 0; ; poging++) {
    const port = await vrijePoort();
    const { kind, uitInfo } = boot(port, dataDir, tls);
    try { await wachtTotOp(mod, port, uitInfo, kind); return { kind, uitInfo, port }; }
    catch (e) {
      kind.kill('SIGKILL');
      if (poging < 3 && /EADDRINUSE/.test(String(e.message))) continue;
      throw e;
    }
  }
}

test('met RTG_TLS=1 praat de hele server https, en http komt er niet door', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tlsboot-'));
  let s = null;
  try {
    s = await opgestart(dataDir, true, https);

    const veilig = await vraag(https, s.port, '/api/health');
    assert.equal(veilig.status, 200, 'https gaf ' + veilig.status + ' in plaats van 200');

    /* Gewone http op dezelfde poort hoort te MISLUKKEN. Een TLS-server die een
       platte http-regel binnenkrijgt, verbreekt of antwoordt met een
       protocolfout; wat hij niet mag doen is netjes 200 geven, want dan landt
       een telefoon alsnog onbeveiligd en zijn camera en microfoon weer weg. */
    let plat = null, platFout = null;
    try { plat = await vraag(http, s.port, '/api/health'); } catch (e) { platFout = e; }
    assert.ok(platFout || (plat && plat.status !== 200),
      'platte http kreeg status ' + (plat && plat.status) + ' terwijl de server TLS termineert');

    /* De regel waar iemand met een telefoon op afgaat -- en let op WELKE regel.

       Hier stond eerst `match(/https:\/\//)` over het hele log, en een mutatie
       liet zien dat die assertie niets waard was: de veiligadres-melding zet zelf
       al een https-adres in het log ("Op een telefoon in hetzelfde netwerk:
       https://..."), dus hij bleef groen terwijl de HOOFDREGEL "RTG-portaal
       draait op http://..." zei. Dat is de regel die iemand als eerste leest en
       intypt, dus die moet het zeggen. */
    assert.match(s.uitInfo.log, /RTG-portaal draait op https:\/\//,
      'de hoofdregel van de opstartmelding noemt geen https, dus wie hem intypt landt op http:\n' +
      s.uitInfo.log.slice(-1200));
    assert.ok(!/werken camera, microfoon en locatie daar NIET/.test(s.uitInfo.log),
      'met TLS aan hoort de waarschuwing te zwijgen; hij stond er wel:\n' + s.uitInfo.log.slice(-1200));

    assert.equal(s.uitInfo.fataal, false, 'server logde een fatale fout:\n' + s.uitInfo.log.slice(-1500));
  } finally {
    if (s) s.kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('npm run telefoon: de POORTWACHTER termineert https, en dat is het commando dat iemand intypt', async () => {
  /* WAAROM DEZE ERBIJ MOEST. `npm start` draait niet server.js maar
     server/trio.js -- de poortwachter met drie werkers -- en die heeft zijn eigen
     schakelaar: RTG_LOKAAL_TLS=1, verpakt als `npm run telefoon`. Dat is dus het
     commando dat iemand gebruikt om met een telefoon te testen, en juist dat pad
     was niet end-to-end gedekt: test/lokaal-tls.test.js bouwt voor zijn
     handshake een EIGEN https.createServer met het certificaat, dus die toetst
     het cert en niet de poortwachter.

     WAT DEZE TOETS NIET DOET, en dat stond hier eerst wel. Ik had er een
     assertie bij over x-forwarded-proto -- de kop die de werkers vertelt dat het
     buiten wel beveiligd was -- maar die assertie was `status === 404 || status
     === 200` en dat sluit vrijwel niets uit. Een vulling met een grote belofte
     erboven is erger dan geen assertie, want de belofte wordt gelezen en de
     vulling niet. Die kop is trouwens al grondig gedekt in
     test/proxykop.test.js (punt 5: "hetzelfde voor protocol en host: rechts
     telt"), dus er was ook niets te winnen. Deze toets doet één ding: de
     poortwachter praat https. */
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-telefoon-'));
  let kind = null;
  try {
    /* Twee losse vrije poorten: een voor de poortwachter zelf en een als basis
       voor de drie werkers erachter. Ze uit elkaar halen scheelt de aanname dat
       poort+10 ook vrij zou zijn. */
    const port = await vrijePoort();
    const trioBasis = await vrijePoort();
    const env = Object.assign({}, process.env, {
      RTG_LOKAAL_TLS: '1', PORT: String(port), RTG_TRIO_BASIS: String(trioBasis),
      RTG_DATA_DIR: dataDir, NODE_ENV: 'test', RTG_DEMO: '1', ANTHROPIC_API_KEY: '', RTG_PG: ''
    });
    kind = cp.spawn(process.execPath, ['server/trio.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const uitInfo = { log: '', fataal: false };
    const vang = d => { uitInfo.log += d; if (/lokale https lukte niet/.test(String(d))) uitInfo.fataal = true; };
    kind.stdout.on('data', vang);
    kind.stderr.on('data', vang);

    await wachtTotOp(https, port, uitInfo, kind, 60000);
    const r = await vraag(https, port, '/api/health');
    assert.equal(r.status, 200, 'de poortwachter gaf ' + r.status + ' over https');
    assert.equal(uitInfo.fataal, false,
      'de poortwachter kon geen lokaal certificaat maken:\n' + uitInfo.log.slice(-1200));
  } finally {
    if (kind) kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('DE TEGENPROEF: zonder RTG_TLS is het omgekeerd -- http werkt, https niet', async () => {
  /* Zonder deze toets zou de bovenstaande ook groen blijven op een server die
     ALTIJD https doet, en dan bewijst hij niets over de schakelaar. */
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tlsboot-uit-'));
  let s = null;
  try {
    s = await opgestart(dataDir, false, http);
    const plat = await vraag(http, s.port, '/api/health');
    assert.equal(plat.status, 200, 'zonder de schakelaar hoort gewone http te werken');
    let veilig = null, veiligFout = null;
    try { veilig = await vraag(https, s.port, '/api/health'); } catch (e) { veiligFout = e; }
    assert.ok(veiligFout || (veilig && veilig.status !== 200),
      'https kreeg status ' + (veilig && veilig.status) + ' terwijl de server geen TLS termineert');
  } finally {
    if (s) s.kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
