/* Volledige, herhaalbare RTG-stagingrepetitie zonder externe dependencies.

   De proef start de echte lokale veiligheidsketen op vrije loopbackpoorten,
   speelt een synthetisch dossier, zet de economie één dag vooruit, belast de
   drie app-instanties, doodt gecontroleerd één instantie en beproeft daarna
   Sentinel restrict/isolate/restore plus de auditketen. Alle runtimegegevens
   leven in een tijdelijke map en worden na afloop verwijderd. */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { pak } = require('./afbouw-slot');

const ROOT = path.join(__dirname, '..');
const geefAfbouwSlotVrij = pak('stagingrepetitie');
const RELEASE = path.join(ROOT, '.release');
const RAPPORT = path.join(RELEASE, 'staging-bewijs.json');
const LAATSTE_LOG = path.join(RELEASE, 'staging-laatste.log');
const TMP_ROOT = fs.realpathSync(os.tmpdir());
const TIJDELIJK = fs.mkdtempSync(path.join(TMP_ROOT, 'rtg-staging-'));
const RUWE_LOG = path.join(TIJDELIJK, 'staging.log');

let proces = null;
let logStroom = null;
let poorten = null;
let resultaat = {
  formaat: 'rtg-staging-bewijs-v1',
  gestart: new Date().toISOString(),
  geslaagd: false,
  omgeving: { afhankelijkheden: 0, opslag: 'geisoleerde-json-staging', bind: '127.0.0.1' },
  controles: {}
};

function meld(tekst) { console.log('[staging] ' + tekst); }
function eis(voorwaarde, tekst) { if (!voorwaarde) throw new Error(tekst); }
function wacht(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function pctl(waarden, p) {
  if (!waarden.length) return 0;
  const rij = waarden.slice().sort((a, b) => a - b);
  return Math.round(rij[Math.min(rij.length - 1, Math.ceil(rij.length * p) - 1)] * 10) / 10;
}

function luister(poort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(poort, '127.0.0.1', () => resolve(server));
  });
}

async function sluit(server) {
  if (!server) return;
  await new Promise(resolve => server.close(resolve));
}

async function vrijePoorten() {
  for (let basis = 41000; basis <= 59000; basis += 37) {
    const kandidaten = [basis, basis + 10, basis + 20, basis + 21, basis + 22, basis + 23, basis + 91];
    if (kandidaten.some(p => p > 65535)) break;
    const gereserveerd = [];
    try {
      for (const p of kandidaten) gereserveerd.push(await luister(p));
      return {
        publiek: basis, motor: basis + 10, intern: basis + 20,
        trio: [basis + 21, basis + 22, basis + 23], beheer: basis + 91
      };
    } catch (e) {
      // Deze reeks is al in gebruik; de volgende volledige reeks wordt beproefd.
    } finally {
      for (const server of gereserveerd) await sluit(server);
    }
  }
  throw new Error('Geen vrije, aaneengesloten stagingpoorten gevonden.');
}

async function verzoek(pad, opties = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('http://127.0.0.1:' + poorten.publiek + pad, {
      ...opties, signal: controller.signal
    });
    const tekst = await response.text();
    let data = null;
    try { data = tekst ? JSON.parse(tekst) : null; } catch (e) { data = null; }
    return { status: response.status, headers: response.headers, tekst, data };
  } finally {
    clearTimeout(timer);
  }
}

async function directVerzoek(poort, pad = '/api/health', timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('http://127.0.0.1:' + poort + pad, { signal: controller.signal });
    const tekst = await response.text();
    let data = null;
    try { data = JSON.parse(tekst); } catch (e) { data = null; }
    return { status: response.status, data };
  } finally { clearTimeout(timer); }
}

function jsonOpties(body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  return { method: 'POST', headers, body: JSON.stringify(body || {}) };
}

async function post(pad, body, token, timeoutMs) {
  return verzoek(pad, jsonOpties(body, token), timeoutMs);
}

async function wachtOpGezond(timeoutMs = 90000) {
  const einde = Date.now() + timeoutMs;
  let laatste = null;
  while (Date.now() < einde) {
    if (proces && proces.exitCode !== null) throw new Error('De stagingketen stopte tijdens het opstarten (code ' + proces.exitCode + ').');
    try {
      const r = await verzoek('/api/ready', {}, 1500);
      if (r.status === 200) return r;
      laatste = 'HTTP ' + r.status;
    } catch (e) { laatste = e.message; }
    await wacht(250);
  }
  throw new Error('De stagingketen werd niet gereed: ' + laatste);
}

async function wachtTot(werk, timeoutMs, omschrijving) {
  const einde = Date.now() + timeoutMs;
  let laatste;
  while (Date.now() < einde) {
    try {
      const waarde = await werk();
      if (waarde) return waarde;
    } catch (e) { laatste = e; }
    await wacht(100);
  }
  throw new Error(omschrijving + (laatste ? ': ' + laatste.message : ''));
}

function startOmgeving() {
  const sleutel = crypto.randomBytes(32).toString('hex');
  const data = path.join(TIJDELIJK, 'data');
  const motor = path.join(TIJDELIJK, 'motor');
  const sentinel = path.join(TIJDELIJK, 'sentinel');
  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  fs.mkdirSync(motor, { recursive: true, mode: 0o700 });
  fs.mkdirSync(sentinel, { recursive: true, mode: 0o700 });
  const env = {
    ...process.env,
    NODE_ENV: 'staging', RTG_DEMO: '1', RTG_BIND: '127.0.0.1',
    RTG_STORE: 'sqlite', RTG_DATA_DIR: data,
    RTG_ENC_KEY: sleutel, RTG_SECRET_KEY: sleutel, RTG_VAULT_KEY: sleutel,
    PORT: String(poorten.publiek), RTG_TRIO_BASIS: String(poorten.intern + 1),
    RTG_SENTINEL_APP_PORT: String(poorten.intern),
    RTG_SENTINEL_ADDR: '127.0.0.1:' + poorten.publiek,
    RTG_SENTINEL_CONTROL_ADDR: '127.0.0.1:' + poorten.beheer,
    RTG_MOTOR_ADDR: '127.0.0.1:' + poorten.motor,
    RTG_SENTINEL_DATA: sentinel,
    RTG_MOTOR_DATA: path.join(motor, 'state.json'),
    RTG_MOTOR_GIDS: path.join(motor, 'gids.bin'),
    RTG_KLUIS_KEY_FILE: path.join(motor, 'secret.key'),
    RTG_KLUIS_DATA: path.join(motor, 'kluis.json')
  };
  logStroom = fs.createWriteStream(RUWE_LOG, { flags: 'w', mode: 0o600 });
  proces = spawn(process.execPath, [path.join(ROOT, 'scripts', 'start-met-motor.js')], {
    cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  proces.stdout.pipe(logStroom);
  proces.stderr.pipe(logStroom);
}

async function statischeProef() {
  const paden = ['/api/health', '/api/ready', '/apps/magnaat.html',
    '/apps/magnaat-kantoor.html', '/apps/personeel.html'];
  const uit = {};
  for (const pad of paden) {
    const r = await verzoek(pad);
    eis(r.status === 200, pad + ' gaf HTTP ' + r.status + '.');
    eis(r.headers.get('x-content-type-options') === 'nosniff', pad + ' mist nosniff.');
    eis(!!r.headers.get('content-security-policy'), pad + ' mist Content-Security-Policy.');
    if (pad.endsWith('.html')) eis(r.tekst.length > 1000, pad + ' is onverwacht leeg.');
    uit[pad] = { status: r.status, bytes: Buffer.byteLength(r.tekst) };
  }
  return uit;
}

async function logIn(tier) {
  const r = await post('/api/login', { tier, pasApp: tier });
  eis(r.status === 200 && r.data && r.data.token, 'Demo-login voor ' + tier + ' is mislukt.');
  return r.data.token;
}

function formulierInvoer(stap) {
  return Object.fromEntries((stap.velden || []).map(veld => {
    let waarde = 'Volledige synthetische RTG-trainingsnotitie voor overdracht en controle.';
    if (veld.type === 'vink') waarde = true;
    else if (Array.isArray(veld.opties) && veld.opties.length) waarde = veld.opties[0];
    else if (veld.min) waarde = waarde.padEnd(Number(veld.min), '.');
    return [veld.id, waarde];
  }));
}

async function speelDossier(token) {
  let r = await post('/api/member/magnaat/taak/start', { functieId: 'member', apparaat: 'computer' }, token);
  eis(r.status === 200 && r.data && r.data.taak, 'Het trainingsdossier kon niet starten.');
  const taakId = r.data.taak.id;
  let rondes = 0;
  while (r.data.taak.status === 'bezig' && rondes++ < 20) {
    const stap = r.data.taak.huidig;
    eis(stap, 'Het actieve dossier heeft geen huidige stap.');
    if (stap.soort === 'software') {
      r = await post('/api/member/magnaat/taak/handeling', { taakId, handeling: stap.doel }, token);
    } else if (stap.soort === 'formulier') {
      r = await post('/api/member/magnaat/taak/actie', { taakId, invoer: formulierInvoer(stap) }, token);
    } else {
      r = await post('/api/member/magnaat/taak/antwoord', { taakId, keuze: 0 }, token);
    }
    eis(r.status === 200 && r.data && r.data.taak, 'Dossierstap is mislukt (HTTP ' + r.status + ').');
  }
  eis(r.data.taak.status === 'klaar', 'Het trainingsdossier is niet binnen 20 stappen voltooid.');
  eis(r.data.taak.omgeving === 'trainingskopie' && r.data.taak.dossier.synthetisch === true,
    'Het dossier stond niet aantoonbaar in een synthetische trainingskopie.');
  return { taakId, functie: r.data.taak.functieId, stappen: r.data.taak.stappen,
    punten: r.data.taak.punten, status: r.data.taak.status, synthetisch: true };
}

async function economieProef(token) {
  const voor = await post('/api/member/magnaat/overzicht', {}, token);
  eis(voor.status === 200 && voor.data && voor.data.economie, 'Economisch beginbeeld ontbreekt.');
  const dagVoor = voor.data.economie.dag;
  const r = await post('/api/member/magnaat/economie/volgende-dag', {
    commandoId: 'staging-dag-' + crypto.randomUUID()
  }, token, 10000);
  eis(r.status === 200 && r.data, 'De economische dagtik is mislukt.');
  eis(r.data.dag === dagVoor + 1, 'De economische klok ging niet precies één dag vooruit.');
  eis(r.data.serverAuthoritatief === true, 'De economie is niet server-authoritatief gemarkeerd.');
  eis(r.data.grootboek && r.data.grootboek.controle && r.data.grootboek.controle.inBalans === true,
    'Het economische grootboek is niet in balans.');
  return { dagVoor, dagNa: r.data.dag, serverAuthoritatief: true,
    deterministisch: r.data.deterministisch === true, grootboekInBalans: true };
}

async function spelersProef(tokens) {
  const beelden = [];
  for (const token of tokens) {
    const r = await post('/api/member/magnaat/overzicht', {}, token, 10000);
    eis(r.status === 200 && r.data && r.data.speler, 'Een spelersprofiel kon niet laden.');
    beelden.push(r.data);
  }
  eis(new Set(tokens).size === tokens.length, 'De drie spelers kregen geen afzonderlijke sessies.');
  eis(Math.max(...beelden.map(x => x.wereld.online)) >= tokens.length,
    'De gedeelde wereld zag niet alle gelijktijdige spelers.');
  return { afzonderlijkeSessies: tokens.length, gedeeldeWereldOnline: Math.max(...beelden.map(x => x.wereld.online)) };
}

async function belastingProef(tokens, aantal = 300, parallel = 24) {
  let volgende = 0;
  const tijden = [];
  let fouten = 0;
  const begin = performance.now();
  async function werker() {
    while (true) {
      const i = volgende++;
      if (i >= aantal) return;
      const start = performance.now();
      try {
        const r = await post('/api/member/magnaat/overzicht', {}, tokens[i % tokens.length], 12000);
        if (r.status !== 200 || !r.data || !r.data.wereld) fouten += 1;
      } catch (e) { fouten += 1; }
      tijden.push(performance.now() - start);
    }
  }
  await Promise.all(Array.from({ length: parallel }, () => werker()));
  const duurMs = performance.now() - begin;
  const uit = {
    verzoeken: aantal, parallel, fouten, duurMs: Math.round(duurMs),
    perSeconde: Math.round((aantal / duurMs) * 10000) / 10,
    p50Ms: pctl(tijden, .50), p95Ms: pctl(tijden, .95),
    p99Ms: pctl(tijden, .99), maxMs: pctl(tijden, 1)
  };
  eis(fouten === 0, 'De belastingproef had ' + fouten + ' fouten.');
  eis(uit.p95Ms < 2500, 'De p95 van ' + uit.p95Ms + ' ms overschrijdt de staginggrens van 2500 ms.');
  return uit;
}

async function failoverProef() {
  const voor = await verzoek('/api/health');
  eis(voor.status === 200 && voor.data, 'Gezondheid voor failover ontbreekt.');
  const nummer = Number(voor.data.server);
  const pid = Number(voor.data.pid);
  eis([1, 2, 3].includes(nummer) && Number.isSafeInteger(pid) && pid > 1,
    'De actieve trio-instantie kon niet veilig worden vastgesteld.');
  const directePoort = poorten.trio[nummer - 1];
  const direct = await directVerzoek(directePoort);
  eis(direct.status === 200 && direct.data && Number(direct.data.pid) === pid && direct.data.active === true,
    'PID en actieve directe trio-instantie komen niet overeen; afbreken zonder signaal.');

  process.kill(pid, 'SIGKILL');
  const start = performance.now();
  let fouten = 0;
  let eersteGezondMs = null;
  const einde = Date.now() + 9000;
  while (Date.now() < einde) {
    try {
      const r = await verzoek('/api/health', {}, 1500);
      if (r.status === 200) {
        if (eersteGezondMs === null) eersteGezondMs = Math.round(performance.now() - start);
      } else fouten += 1;
    } catch (e) { fouten += 1; }
    await wacht(75);
  }
  const herstart = await wachtTot(async () => {
    const r = await directVerzoek(directePoort);
    return r.status === 200 && r.data && Number(r.data.pid) !== pid ? r.data : null;
  }, 9000, 'De gedode trio-instantie is niet herstart');
  eis(eersteGezondMs !== null && eersteGezondMs <= 3000,
    'Failover duurde langer dan 3 seconden.');
  eis(fouten <= 2, 'Failover gaf ' + fouten + ' mislukte gebruikersprobes.');
  return { gedodeInstantie: nummer, oudePid: pid, nieuwePid: Number(herstart.pid),
    eersteGezondeReactieMs: eersteGezondMs, mislukteProbes: fouten };
}

function sentinel(woorden) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'sentinel-beheer.js'), ...woorden], {
    cwd: ROOT, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, RTG_SENTINEL_CONTROL_ADDR: '127.0.0.1:' + poorten.beheer,
      RTG_SENTINEL_TOKEN_FILE: path.join(ROOT, '.sentinel-token'),
      RTG_SENTINEL_DATA: path.join(TIJDELIJK, 'sentinel') }
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('Sentinel ' + woorden[0] + ' mislukte: ' + String(r.stderr || r.stdout || '').trim().slice(-600));
}

async function sentinelProef() {
  let herstelNodig = false;
  const uit = {};
  try {
    sentinel(['restrict', '/api/member/magnaat/economie', 'Gecontroleerde staging-beperking']);
    herstelNodig = true;
    const pagina = await verzoek('/apps/magnaat.html');
    const economie = await post('/api/member/magnaat/economie/volgende-dag', { commandoId: 'geblokkeerd' }, null);
    eis(pagina.status === 200 && economie.status === 503,
      'Sentinel restrict scheidde de pagina en economische route niet correct.');
    uit.restrict = { pagina: pagina.status, begrensdeRoute: economie.status };

    sentinel(['isolate', 'Gecontroleerde staging-isolatie', 'ISOLEER RTG']);
    const gezondheid = await verzoek('/api/health');
    const geisoleerd = await verzoek('/apps/magnaat.html');
    eis(gezondheid.status === 503 && geisoleerd.status === 503,
      'Sentinel-isolatie sloot de openbare voordeur niet volledig.');
    uit.isolate = { gezondheid: gezondheid.status, pagina: geisoleerd.status };

    sentinel(['scan']);
    uit.releaseScan = 'groen';
    sentinel(['restore', 'Gecontroleerd staging-herstel', 'HERSTEL RTG']);
    herstelNodig = false;
    const hersteld = await verzoek('/api/health');
    eis(hersteld.status === 200, 'Sentinel-herstel bracht de voordeur niet terug.');
    uit.restore = { gezondheid: hersteld.status };
    sentinel(['verify-audit']);
    uit.auditketen = 'geldig';
    return uit;
  } finally {
    if (herstelNodig) {
      try { sentinel(['scan']); } catch (e) { /* beste veilige herstelpoging */ }
      try { sentinel(['restore', 'Automatisch herstel na mislukte stagingproef', 'HERSTEL RTG']); } catch (e) { /* proces wordt hierna gestopt */ }
    }
  }
}

async function stopOmgeving() {
  if (proces && proces.exitCode === null) {
    proces.kill('SIGINT');
    await Promise.race([
      new Promise(resolve => proces.once('exit', resolve)),
      wacht(10000)
    ]);
    if (proces.exitCode === null) {
      proces.kill('SIGKILL');
      await Promise.race([new Promise(resolve => proces.once('exit', resolve)), wacht(3000)]);
    }
  }
  if (logStroom) await new Promise(resolve => logStroom.end(resolve));
}

function kopieerLog() {
  fs.mkdirSync(RELEASE, { recursive: true, mode: 0o700 });
  if (fs.existsSync(RUWE_LOG)) fs.copyFileSync(RUWE_LOG, LAATSTE_LOG);
  if (fs.existsSync(LAATSTE_LOG)) fs.chmodSync(LAATSTE_LOG, 0o600);
}

function wisTijdelijk() {
  const echt = fs.realpathSync(TIJDELIJK);
  eis(path.dirname(echt) === TMP_ROOT && path.basename(echt).startsWith('rtg-staging-'),
    'Weiger onveilige tijdelijke cleanup: ' + echt);
  fs.rmSync(echt, { recursive: true, force: true });
  eis(!fs.existsSync(echt), 'De tijdelijke stagingdata kon niet volledig worden verwijderd.');
}

function schrijfRapport() {
  fs.mkdirSync(RELEASE, { recursive: true, mode: 0o700 });
  const tijdelijk = RAPPORT + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(resultaat, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, RAPPORT);
  fs.chmodSync(RAPPORT, 0o600);
}

async function hoofd() {
  let fout = null;
  try {
    poorten = await vrijePoorten();
    meld('geïsoleerde veiligheidsketen starten');
    startOmgeving();
    await wachtOpGezond();

    meld('schermen, routes en securityheaders controleren');
    resultaat.controles.schermen = await statischeProef();

    meld('drie spelers, echte UI-missie en servereconomie beproeven');
    const tokens = await Promise.all(['business', 'lifestyle', 'rtg'].map(logIn));
    resultaat.controles.spelers = await spelersProef(tokens);
    resultaat.controles.gameplay = await speelDossier(tokens[0]);
    resultaat.controles.economie = await economieProef(tokens[0]);

    meld('300 verzoeken over 24 gelijktijdige spelers uitvoeren');
    resultaat.controles.belasting = await belastingProef(tokens);

    meld('actieve app-instantie gecontroleerd uitschakelen en failover meten');
    resultaat.controles.failover = await failoverProef();

    meld('Sentinel restrict, isolate, scan, restore en audit beproeven');
    resultaat.controles.sentinel = await sentinelProef();

    const bewijsPad = path.join(RELEASE, 'release-bewijs.json');
    const bewijs = JSON.parse(fs.readFileSync(bewijsPad, 'utf8'));
    resultaat.release = { inhoudSha256: bewijs.inhoudSha256, bestanden: bewijs.bestandAantal };
    resultaat.geslaagd = true;
  } catch (e) {
    fout = e;
    resultaat.fout = e.message;
  } finally {
    await stopOmgeving();
    kopieerLog();
    try {
      wisTijdelijk();
      resultaat.tijdelijkeDataVerwijderd = true;
    } catch (e) {
      resultaat.tijdelijkeDataVerwijderd = false;
      resultaat.geslaagd = false;
      resultaat.fout = resultaat.fout || e.message;
      fout = fout || e;
    }
    resultaat.afgerond = new Date().toISOString();
    schrijfRapport();
    geefAfbouwSlotVrij();
  }
  if (fout) throw fout;
  meld('GESLAAGD · bewijs: .release/staging-bewijs.json');
  const b = resultaat.controles.belasting;
  meld('belasting: ' + b.verzoeken + ' verzoeken, 0 fouten, p95 ' + b.p95Ms + ' ms, ' + b.perSeconde + ' req/s');
  const f = resultaat.controles.failover;
  meld('failover: eerste gezonde reactie ' + f.eersteGezondeReactieMs + ' ms, ' + f.mislukteProbes + ' mislukte probes');
}

hoofd().catch(e => {
  console.error('[staging] MISLUKT · ' + e.message);
  console.error('[staging] details: .release/staging-laatste.log');
  process.exitCode = 1;
});
