'use strict';
/* ============================================================================
   DRAAIT EEN DOMEIN OOK ECHT ALLEEN? -- de belofte van RTG_DOMAINS nagemeten.

   In server/opzet/routes.js staat sinds het begin dat een domein "later als
   eigen proces kan draaien", en RTG_DOMAINS is de schakelaar die dat zou doen.
   Die belofte was tot nu toe alleen een BELOFTE: er stond nergens een toets die
   opstartte met een deel van de domeinen en naging dat de rest er dan echt niet
   is. Zonder zo'n toets kan RTG_DOMAINS stilletjes stoppen met werken -- de lus
   die de domeinen kiest kan wegvallen, of een router kan buiten de keuze om
   worden opgehangen, en niets zou dat melden. Een schakelaar waar niemand aan
   trekt, is geen schakelaar (LAT.md regel 10).

   DRIE BEWERINGEN, EN DE DERDE IS DE TEGENPROEF.

   1. Het GEKOZEN domein is er: /api/member/apps geeft 401 (de route bestaat,
      hij wil alleen een sessie) en niet 404.
   2. De NIET-gekozen domeinen zijn er niet: supplier, office en auth geven 404.
   3. Met ALLE domeinen is supplier er wel. Zonder die derde bewering zou deze
      toets ook groen blijven als de server op alles 404 gaf -- dan zou hij
      bewijzen dat een kapotte server "goed begrensd" is.

   WAAROM /api/member/apps EN NIET /api/member/borden, want daar begon ik en het
   was fout. Met /api/member/borden bleef bewering 1 groen onder een mutatie die
   NUL domeinen ophangt -- en dat hoort onmogelijk te zijn. De reden: dat pad komt
   uit routes/borden.js, en dat bestand hangt in routes.js BUITEN de domeinkeuze
   om, net als ruim veertig andere. De assertie bewees dus niet "member draait"
   maar "borden.js draait", en dat is altijd waar. /api/member/apps staat alleen
   in routes/member.js en hangt wel aan de keuze.

   Dat is meteen de eerlijke maat van deze toets: RTG_DOMAINS schakelt de ACHT
   domeinen, niet de routers die er los naast hangen. Een member-proces sleept die
   veertig vandaag nog mee. Dat staat als schuld in TAKEN.md 5.14; hier staat het
   omdat een lezer anders meer uit deze groene toets zou lezen dan er is.

   En een vierde die er niet uitziet als een bewering maar het wel is: de
   infra-endpoints (/api/health) blijven ook met EEN domein 200 geven. Die
   zitten in de kern en niet in een domein; zou de domeinkeuze ze meenemen, dan
   is een domeinproces niet meer te bewaken.

   WAT DEZE TOETS NIET BEWIJST. Dat de acht domeinen ook los van elkaar kunnen
   draaien in de zin dat ze elkaars gegevens niet nodig hebben -- ze delen nog
   een database en een geheugen. Hij bewijst dat de BEDRADING scheidbaar is, wat
   de eerste van de twee stappen is; TAKEN.md 5.14 houdt de tweede bij.
   ========================================================================== */
const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function vraag(port, pad, methode) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pad, method: methode || 'GET',
      timeout: 5000, headers: { 'content-type': 'application/json' } }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (methode === 'POST') req.end('{}'); else req.end();
  });
}

async function wachtTotOp(port, uitInfo, tot = 25000) {
  const eind = Date.now() + tot;
  while (Date.now() < eind) {
    if (uitInfo.fataal) throw new Error('server crashte bij opstart:\n' + uitInfo.log.slice(-2000));
    try { const r = await vraag(port, '/'); if (r.status) return r; } catch (e) { /* nog niet op */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('server werd niet bereikbaar binnen ' + tot + 'ms\n' + uitInfo.log.slice(-2000));
}

function boot(port, dataDir, domeinen) {
  const env = Object.assign({}, process.env, {
    PORT: String(port), RTG_DATA_DIR: dataDir, RTG_CSP_NONCE: '0',
    NODE_ENV: 'test', RTG_DEMO: '1', ANTHROPIC_API_KEY: '', RTG_PG: '', RTG_STIL: '1'
  });
  if (domeinen) env.RTG_DOMAINS = domeinen; else delete env.RTG_DOMAINS;
  const kind = cp.spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const uitInfo = { log: '', fataal: false };
  const vang = d => { uitInfo.log += d; if (/uncaughtException|"fataal":true|is not a function/.test(String(d))) uitInfo.fataal = true; };
  kind.stdout.on('data', vang);
  kind.stderr.on('data', vang);
  return { kind, uitInfo };
}

/* Opstarten met een gokte poort, net als test/boot-smoke.test.js: de suite heeft
   tientallen servers naast elkaar en een botsing is geen breuk. */
async function opgestart(dataDir, domeinen) {
  for (let poging = 0; ; poging++) {
    const port = 36000 + Math.floor(Math.random() * 2000);
    const { kind, uitInfo } = boot(port, dataDir, domeinen);
    try { await wachtTotOp(port, uitInfo); return { kind, uitInfo, port }; }
    catch (e) {
      kind.kill('SIGKILL');
      if (poging < 3 && /EADDRINUSE/.test(String(e.message))) continue;
      throw e;
    }
  }
}

test('met RTG_DOMAINS=member draait alleen member -- de andere domeinen zijn er niet', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-alleen-'));
  let s = null;
  try {
    s = await opgestart(dataDir, 'member');

    const eigen = await vraag(s.port, '/api/member/apps', 'POST');
    assert.notEqual(eigen.status, 404,
      'de route van het GEKOZEN domein hoort te bestaan; 404 betekent dat member niet is opgehangen');
    assert.equal(eigen.status, 401,
      'zonder sessie hoort member/apps 401 te geven (route bestaat, sessie niet), kreeg ' + eigen.status);

    for (const pad of ['/api/supplier/login', '/api/office/login', '/api/auth/login']) {
      const r = await vraag(s.port, pad, 'POST');
      assert.equal(r.status, 404, pad + ' gaf ' + r.status +
        ' -- dat domein staat niet in RTG_DOMAINS en hoort er dus NIET te zijn');
    }

    /* De infra hoort er WEL te zijn: die zit in de kern, niet in een domein. Zou
       de domeinkeuze hem meenemen, dan is een domeinproces onbewaakbaar. */
    const gezond = await vraag(s.port, '/api/health');
    assert.equal(gezond.status, 200, '/api/health hoort altijd mee te draaien, ook met een enkel domein');

    /* De grens mag hier NIETS melden: member vraagt in deze opstart alleen wat in
       GRENZEN.json bij member staat. Een grensfout in de log zou betekenen dat de
       lijst een naam mist die pas bij een deelopstart nodig blijkt. */
    assert.ok(!/\[grens\]/.test(s.uitInfo.log),
      'de domeingrens meldde een overschrijding bij een deelopstart:\n' + s.uitInfo.log.slice(-1500));

    assert.equal(s.uitInfo.fataal, false, 'server logde een fatale fout:\n' + s.uitInfo.log.slice(-1500));
  } finally {
    if (s) s.kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('DE TEGENPROEF: zonder RTG_DOMAINS is supplier er wel', async () => {
  /* Zonder deze toets zou de bovenstaande ook groen blijven op een server die op
     alles 404 geeft, en dan bewijst hij dat kapot goed begrensd is. */
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-alles-'));
  let s = null;
  try {
    s = await opgestart(dataDir, null);
    const r = await vraag(s.port, '/api/supplier/login', 'POST');
    assert.notEqual(r.status, 404,
      'met alle domeinen hoort supplier/login te bestaan; 404 betekent dat de 404 hierboven niets zei over de domeinkeuze');
  } finally {
    if (s) s.kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
