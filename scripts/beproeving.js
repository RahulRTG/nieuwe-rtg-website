/* ============================================================================
   DE BEPROEVING -- één test om ze allemaal te beproeven.

   Dit is de standaard-megatest van RTG. Hij vervangt en verenigt de losse
   zware scripts van vroeger (mega65, mega65-storm, orkaan, chaos-soak, onnozel,
   spitsuur, keuken-/kassa-orkaan): één harnas dat de hele code tegelijk op de
   pijnbank legt, op mega volume, met de zwaarste, domste, meest onethische en
   onrealistische scenario's die te bedenken zijn -- en HARD ZAKT (exitcode 1)
   zodra één morele of technische grens breekt. Geen mooipraterij: hij benoemt
   wat hij NIET bewijst, is deterministisch (seeded) en rapporteert het slechtste
   geval.

   TWEE SCHALEN, ZELFDE OORDEEL:
   - Met DATABASE_URL  -> POSTGRES-modus: 100.000.000 leden in de ledengids (buiten
     het RAM) + een miljoenenlaag aan activiteit. De echte mega-beproeving.
   - Zonder DATABASE_URL -> SQLITE-modus: draait overal (ook in CI), zonder externe
     database, op een kleiner volume. Elke morele en technische lat is identiek.
     Zo is de zwaarste test tegelijk de standaard die iedereen kan draaien.

   DE FASEN (in deze volgorde, en dat is met opzet):
     0  KALIBRATIE   machine-ruis meten (de latentie-lat schaalt ermee mee).
     A  VOLUME       zaaien (100M dir + activiteit in Postgres) of vers booten
                     (sqlite); boot-tijd, RAM en schijf. Daarna "alles aan" op de
                     schakelkast zodat elke functie echt getoetst wordt.
     B  GELD         RTG Pay op de cent: opladen/sturen conserveert centen exact,
                     idempotentie schrijft nooit dubbel, en onrealistische
                     bedragen (negatief, gigantisch, NaN) worden geweigerd zonder
                     het saldo te raken.
     C  MISBRUIK     de morele lat. Elk dom/onethisch/onrealistisch scenario dat
                     het platform MOET weigeren, als harde assertie.
     D  DUURZAAMHEID herstart met de volle kast; geld en idempotentie overleven.
     E  GAUNTLET     de vernietigende storm KOMT NA de vaste asserties, want hij
                     fuzzt ook de schakelkast en zou anders de staat vergiftigen:
                     ELK endpoint uit de bron, juiste rol + elke verkeerde rol
                     (rol-scheiding), met rommel-invoer (emoji, gigastrings,
                     XSS/SQL/JNDI, diep genest). Percentielen, 5xx per endpoint,
                     dekking. EN ERNAAST: de goede verhalen (scripts/verhalen.js)
                     -- gewone mensen die gewone dingen doen, eerst een keer in
                     rust als ijking en daarna onafgebroken middenin de storm.
                     Want een server die op alles "400 nee" antwoordt haalt een
                     chaostest met vlag en wimpel en is volledig kapot.
     F  GEHEUGEN     lek-vloer over identieke lees-rondes (geen groei = geen lek).

   DE OORDELEN (elk een harde drempel; faalt er één, dan exitcode 1):
     ROBUUSTHEID   nul onverwachte 5xx (503 feature-uit en 429 tellen niet mee).
     ROL-SCHEIDING een verkeerd-rol token krijgt nooit 2xx op een beschermd pad.
     DEKKING       elk niet-uitgesloten endpoint minstens N keer geraakt.
     GELD          conservatie op de cent + idempotentie + weigering van onzin.
     MISBRUIK      elke morele beproeving gehaald.
     DUURZAAMHEID  geld en idempotentie overleven de herstart.
     GEHEUGEN      de RAM-vloer stijgt niet over identieke rondes.
     LATENTIE      p99 onder de (met machine-ruis geschaalde) SLO.
     VERHALEN      de goede verhalen lopen in rust EN tijdens de storm, en er
                   lukt er tijdens de storm ook echt minstens een -- anders is
                   "nul gefaald" vanzelf waar zodra De Wacht alles afwijst.

   Draai (standaard, overal):   node --experimental-sqlite scripts/beproeving.js
   Draai (mega, 100M Postgres):  DATABASE_URL=postgres://... \
                                node --max-old-space-size=8192 scripts/beproeving.js
   Knoppen (env): MEGA_LEDEN, MEGA_CHUNK, SOAK_MIN, STORM_WERKERS, MEGA_SEED,
                  SLO_P99_MS (2000), SLO_DEKKING (3), SLO_VLOER_MBMIN (40),
                  MEGA_PSQL, RUIS_UIT (=1: schaal de latentie-lat niet mee),
                  STRENG (=1: de lat 10x scherper -- dekking 30, lek-vloer 4,
                  latentie-SLO 200 ms, meer werkers, extra lek-ronde).
   ============================================================================ */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');
/* De goede verhalen (scripts/verhalen.js). De gauntlet bewijst dat er niets
   BREEKT; die bewijst niets over of het huis nog WERKT -- een server die op
   alles "400 nee" antwoordt haalt een chaostest met vlag en wimpel. Daarom
   lopen er tijdens de storm volledige, logische verhalen van echte mensen mee,
   met harde beweringen over geld, status en aankomst. */
const verhalen = require('./verhalen');
/* CPU, event-loop, database en het herstel na de storm. Eigen module: dit
   harnas stond al op 58 kB en die meters hebben elk hun eigen uitleg nodig. */
const belasting = require('./lib/belasting');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.MEGA_PORT || 4090);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beproeving-'));
const DB = process.env.DATABASE_URL || process.env.PG_URL || '';
const MODE = DB ? 'postgres' : 'sqlite';
const LEDEN = Number(process.env.MEGA_LEDEN || (MODE === 'postgres' ? 100000000 : 0));
const CHUNK = Number(process.env.MEGA_CHUNK || 5000000);
const N_ORDERS = Number(process.env.MEGA_ORDERS || (MODE === 'postgres' ? 1000000 : 0));
const N_BOEK = Number(process.env.MEGA_BOEK || (MODE === 'postgres' ? 300000 : 0));
const N_BETAAL = Number(process.env.MEGA_BETAAL || (MODE === 'postgres' ? 200000 : 0));
const N_VERZ = Number(process.env.MEGA_VERZ || (MODE === 'postgres' ? 100000 : 0));
const N_MELD = Number(process.env.MEGA_MELD || (MODE === 'postgres' ? 100000 : 0));
const N_REVIEW = Number(process.env.MEGA_REVIEW || (MODE === 'postgres' ? 60000 : 0));
/* STRENG=1: de standaardlat 10x scherper. Elke drempel die een echte regressie
   vangt gaat een orde strakker (dekking 3->30, lek-vloer 40->4 MB/min, latentie-
   SLO 2000->200 ms), met meer werkers (meer gelijktijdigheid = meer race-
   blootstelling), een langere storm en een extra lek-ronde. De machine-ruis
   schaalt de latentie-lat nog steeds mee, zodat het een echte, haalbare lat
   blijft die regressies vangt in plaats van een onmogelijke muur. */
const STRENG = process.env.STRENG === '1';
const TOKEN_VERS_MS = Number(process.env.TOKEN_VERS_MS || 10000);
const SOAK_MS = Number(process.env.SOAK_MIN || (MODE === 'postgres' ? 20 : 3)) * 60000;
const WERKERS = Number(process.env.STORM_WERKERS || (MODE === 'postgres' ? (STRENG ? 48 : 24) : (STRENG ? 24 : 12)));
/* De 10x-strenge latentie-lat (200 ms) geldt voor de in-memory sqlite-standaard
   (bewezen p99 ~55 ms). In postgres-modus dragen echte DB-heen-en-weertjes en de
   write-behind-flush onder 48-voudige schrijf-chaos het p99; die tegen een
   in-memory lat van 200 ms houden zou een onhaalbare, nietszeggende muur zijn.
   De mega-schaal houdt daarom de DB-realistische 2000 ms-lat -- de overige 10x-
   verscherpingen (dekking 30, lek-vloer 4, 48 werkers, extra lek-ronde) gelden er
   onverkort. */
const SLO_P99_MS = Number(process.env.SLO_P99_MS || ((STRENG && MODE !== 'postgres') ? 200 : 2000));
const SLO_DEKKING = Number(process.env.SLO_DEKKING || (STRENG ? 30 : 3));
const SLO_VLOER = Number(process.env.SLO_VLOER_MBMIN || (STRENG ? 4 : 40));
const LEK_MS = Number(process.env.LEK_MS || (MODE === 'postgres' ? 30000 : 15000));
const LEK_RONDES = Number(process.env.LEK_RONDES || (MODE === 'postgres' ? 3 : (STRENG ? 3 : 2)));

function vindPsql() {
  if (process.env.MEGA_PSQL) return process.env.MEGA_PSQL;
  for (const p of ['/usr/lib/postgresql/16/bin/psql', '/usr/bin/psql', 'psql']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch (e) {}
  }
  return 'psql';
}
const PSQL = MODE === 'postgres' ? vindPsql() : null;
const psql = sql => execFileSync(PSQL, [DB, '-tAc', sql], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

// deterministische PRNG (mulberry32): elke run met dezelfde seed is identiek
let RNGSTATE = (Number(process.env.MEGA_SEED) || 1234567) >>> 0;
function rng() { RNGSTATE |= 0; RNGSTATE = (RNGSTATE + 0x6D2B79F5) | 0; let t = Math.imul(RNGSTATE ^ (RNGSTATE >>> 15), 1 | RNGSTATE); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rint = n => Math.floor(rng() * n);
const rkeuze = a => a[rint(a.length)];

const nl = n => Number(n).toLocaleString('nl-NL');
const MB = b => (b / 1e6).toFixed(0);
function kop(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }
function rij(k, v) { console.log('  ' + String(k).padEnd(46) + ' \x1b[36m' + v + '\x1b[0m'); }

/* ---------- http ---------- */
const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
// lichte variant voor de soak: alleen status + latentie (leest de body weg)
function verzoek(method, pad, token, body, timeoutMs) {
  const t0 = Date.now();
  return new Promise(resolve => {
    const data = method === 'GET' ? null : JSON.stringify(body === undefined ? {} : body);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    let klaar = false;
    const af = s => { if (!klaar) { klaar = true; resolve({ status: s, ms: Date.now() - t0 }); } };
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      const st = res.statusCode; res.on('data', () => {}); res.on('end', () => af(st)); res.on('error', () => af(st)); res.on('close', () => af(st));
    });
    req.on('error', () => af(0));
    req.setTimeout(timeoutMs || 10000, () => { req.destroy(); af(0); });
    if (data) req.write(data); req.end();
  });
}
// volledige variant voor geld/misbruik: de body wordt geparsed teruggegeven
function haal(method, pad, token, body) {
  return new Promise(resolve => {
    const data = method === 'GET' ? null : JSON.stringify(body === undefined ? {} : body);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => { let d = {}; try { d = JSON.parse(buf); } catch (e) {} resolve({ status: res.statusCode, data: d }); });
    });
    req.on('error', () => resolve({ status: 0, data: {} }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, data: {} }); });
    if (data) req.write(data); req.end();
  });
}
const post = (pad, body, token) => haal('POST', pad, token, body);

/* ---------- alle routes + hun auth-rol uit de bron ---------- */
// De platformbrede schakelkast-endpoints (de "grote hendel" en per-functie
// regie) mag de storm WEL raken (dekking + input-robuustheid), maar niet met
// rommel die de hele kast uitzet en zo elke andere meting vergiftigt. Ze
// krijgen daarom in de storm een benigne body en tellen los mee.
const BEHEER_SCHAKEL = [
  '/api/office/boardroom/alles', '/api/office/boardroom/fase', '/api/office/boardroom/functie',
  '/api/office/boardroom/functie/zet', '/api/office/leveranciers', '/api/office/geld'
];
const isSchakel = pad => BEHEER_SCHAKEL.some(p => pad.startsWith(p));
function alleRoutes() {
  const files = [];
  (function loop(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) loop(p); else if (n.endsWith('.js')) files.push(p); } })(path.join(ROOT, 'server'));
  const re = /app\.(get|post|put|delete)\(\s*'(\/api\/[a-zA-Z0-9/_:-]+)'\s*,\s*(?:express\.[a-zA-Z]+\([^)]*\)\s*,\s*)?([a-zA-Z]+)/g;
  const rol = { auth: 'member', supplierAuth: 'supplier', officeAuth: 'office', techAuth: 'office' };
  const set = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8'); let m;
    while ((m = re.exec(txt))) {
      const method = m[1].toUpperCase(), pad = m[2];
      if (/\/stream|\/sse|events$/.test(pad) || pad.startsWith('/api/test/') || pad === '/api/health' || pad === '/api/ready') continue;
      const echt = pad.replace(/:([a-zA-Z0-9_]+)/g, 'x1');
      set.set(method + ' ' + echt, { method, pad: echt, rol: rol[m[3]] || 'open', schakel: isSchakel(echt) });
    }
  }
  return [...set.values()];
}

/* ---------- onnozele/onethische rommel-invoer (deterministisch) ---------- */
const EMO = '😀🎉💥🔥🤡🍕🚀💩👻🥶🦄🌈';
function emojiStr(n) { let s = ''; for (let i = 0; i < n; i++) s += EMO[rint(EMO.length)]; return s; }
function diep(n) { let o = {}, c = o; for (let i = 0; i < n; i++) { c.x = {}; c = c.x; } c.eind = 1; return o; }
function chaosWaarde(d) {
  if (d > 4) return rkeuze([1, 'x', true, null]);
  switch (rint(15)) {
    case 0: return emojiStr(rint(30) + 1);
    case 1: return '𝕏' + emojiStr(3) + ' <script>alert(1)</script>';
    case 2: return "'; DROP TABLE member_dir;-- " + emojiStr(2);
    case 3: return 'A'.repeat(rint(20000));
    case 4: return -rint(1e9) - 1;
    case 5: return Number.MAX_SAFE_INTEGER * (rng() > 0.5 ? 1 : -1);
    case 6: return rkeuze([null, true, false, '']);
    case 7: return diep(rint(60));
    case 8: return Array.from({ length: rint(50) }, () => chaosWaarde(d + 1));
    case 9: return { [emojiStr(2)]: chaosWaarde(d + 1), aantal: -rint(999), q: emojiStr(1) };
    case 10: return '2026-99-99';
    case 11: return '99:99';
    case 12: return '../../etc/passwd';
    case 13: return '{{7*7}}${jndi:ldap://x}';   // template/JNDI-injectie
    default: return chaosBody(d + 1);
  }
}
function chaosBody(d) {
  if (d > 3) return chaosWaarde(d);
  const velden = ['q', 'ref', 'code', 'id', 'aanbiederId', 'behandelingId', 'datum', 'tijd', 'bedrag', 'centen', 'aantal',
    'supplierCode', 'pakketId', 'text', 'tekst', 'medisch', 'naam', 'personen', 'token', 'staffId', 'pin', 'niveau', 'pad', 'bevestigd', 'aan', 'soort'];
  const body = {}; const k = rint(5);
  for (let i = 0; i < k; i++) body[rkeuze(velden)] = chaosWaarde(d + 1);
  return body;
}

/* ---------- latentie-histogram (geheugen-veilig) ---------- */
// Fibonacci-achtige fijne buckets onderin, en EXTRA fijn in de 500-2600 ms-zone
// waar de SLO (2000 ms) ligt: anders sprong het van 610 naar 1000 naar 1600 en
// werd een p99 van pakweg 1200 ms als "1600" gerapporteerd (een bucket-artefact,
// geen echte cliff). Nu leest de staart op ~150 ms nauwkeurig af.
const GRENZEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 500, 610, 750, 900, 1000, 1150, 1300, 1500, 1750, 2000, 2300, 2600, 3200, 4200, 5400, 6800, 8400, 10000, Infinity];
const hist = new Array(GRENZEN.length).fill(0);
let latN = 0, latMax = 0;
function noteerLat(ms) { latN++; if (ms > latMax) latMax = ms; for (let i = 0; i < GRENZEN.length; i++) if (ms <= GRENZEN[i]) { hist[i]++; return; } }
function pct(q) { let doel = q * latN, c = 0; for (let i = 0; i < GRENZEN.length; i++) { c += hist[i]; if (c >= doel) return GRENZEN[i] === Infinity ? '>' + GRENZEN[i - 1] : GRENZEN[i]; } return latMax; }
function pctMs(q) { let doel = q * latN, c = 0; for (let i = 0; i < GRENZEN.length; i++) { c += hist[i]; if (c >= doel) return GRENZEN[i] === Infinity ? latMax : GRENZEN[i]; } return latMax; }

/* ---------- de server ---------- */
let child = null;
const SRVLOG = path.join(TMP, 'server.log');
const GC_OUT = path.join(TMP, 'gc.json');
function rssMB(pid) { try { const m = fs.readFileSync('/proc/' + pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
async function heapNaGc(pid) {
  let laagst = Infinity;
  for (let i = 0; i < 4; i++) {
    let voor = 0; try { voor = fs.statSync(GC_OUT).mtimeMs; } catch (e) {}
    try { process.kill(pid, 'SIGUSR2'); } catch (e) {}
    for (let w = 0; w < 40; w++) {
      await new Promise(r => setTimeout(r, 100));
      try { const st = fs.statSync(GC_OUT); if (st.mtimeMs > voor) { const j = JSON.parse(fs.readFileSync(GC_OUT, 'utf8')); const mb = Math.round(j.heapUsed / 1048576); if (mb < laagst) laagst = mb; break; } } catch (e) {}
    }
  }
  return laagst === Infinity ? null : laagst;
}
/* Poortwacht: antwoordt er AL iets op de poort voordat wij onze server starten,
   dan is dat een achtergebleven server van een eerdere (afgebroken) run. Onze
   eigen server crasht dan stil op de bezette poort terwijl de ready-poll het
   antwoord van die oude, door een eerdere storm mishandelde server krijgt --
   en dan toetst de hele beproeving de verkeerde server. Hard weigeren dus. */
async function poortVrij() {
  const r = await verzoek('GET', '/api/ready', null, null, 2000).catch(() => ({ status: 0 }));
  if (r && r.status > 0) {
    throw new Error('poort ' + PORT + ' is al bezet (waarschijnlijk een achtergebleven server van een eerdere run). Ruim die eerst op, bijv.: pkill -f "gc-hook.js"');
  }
}
function boot() {
  return new Promise((resolve, reject) => {
    const logfd = fs.openSync(SRVLOG, 'a');
    const env = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '',
      ANTHROPIC_API_KEY: '', RTG_ENC_KEY: '', DEMO_SUPPLIER: 'KIKUNOI', LOG_LEVEL: 'error', RTG_GC_OUT: GC_OUT,
      NODE_OPTIONS: '--max-old-space-size=8192' };
    if (MODE === 'postgres') { env.DATABASE_URL = DB; env.RTG_STORE = 'postgres'; }
    child = spawn(process.execPath, ['--expose-gc', '-r', path.join(__dirname, 'gc-hook.js'), '--experimental-sqlite', 'server/server.js'],
      { cwd: ROOT, env, stdio: ['ignore', logfd, logfd] });
    child.on('exit', c => { if (c) reject(new Error('server stopte, code ' + c)); });
    (async () => {
      // wachten op READINESS, niet op liveness: pas als de duurzame opslag echt
      // geladen is (Postgres: gedeelde data + RAM-venster) mag de test erin --
      // anders toets je de verouderde lokale snapshot in plaats van de waarheid
      for (let i = 0; i < 300; i++) { const r = await verzoek('GET', '/api/ready', null, null, 3000); if (r.status === 200) return resolve(); await new Promise(r => setTimeout(r, 250)); }
      reject(new Error('server niet gereed (opslag laadt niet)'));
    })();
  });
}
function stop() { return new Promise(r => { if (!child) return r(); child.removeAllListeners('exit'); child.on('exit', () => r()); child.kill('SIGKILL'); child = null; }); }
// Nette (geplande) stop: SIGTERM laat de server zijn write-behind flushen
// (flushBijAfsluiten) voordat hij afsluit. Zo toetst de DUURZAAMHEID-fase een
// echte HERSTART/deploy -- niet een stroomstoring. Een harde crash (SIGKILL) kan
// bij write-behind-motoren (json en geheugen) juist bewust het laatste venster
// verliezen; dat is een andere, zwaardere garantie die we niet als herstart tellen.
function stopNet(ms) {
  return new Promise(r => {
    if (!child) return r();
    const kind = child; child = null; kind.removeAllListeners('exit');
    let klaar = false; const af = () => { if (!klaar) { klaar = true; r(); } };
    kind.on('exit', af); kind.kill('SIGTERM');
    setTimeout(() => { try { kind.kill('SIGKILL'); } catch (e) {} af(); }, ms || 8000);
  });
}

/* ---------- Postgres: 100M + activiteit zaaien (alleen mega-modus) ---------- */
async function zaaiPostgres() {
  const { Pool } = require('../server/pgwire');
  /* Controle-vlak schoonvegen (test-hygiene). Een HERGEBRUIKTE Postgres-DB kan
     uit een vorige run een GETRIPTE zekering dragen -- de chaos-storm fuzzt de
     schakelkast/techniek en kan bijv. de registratie-zekering uitzetten. Die
     staat blijft dan in kv staan en de volgende run start met "registreren
     uitgeschakeld" (503), waardoor Fase B/D omvallen op een spookoorzaak. We
     wissen daarom de vluchtige controle-vlak-sleutels; ze herstellen bij het
     opstarten naar de standaard (alles aan). De ledengids en de accounts raken
     we niet aan. (In CI draait dit tegen een wegwerp-DB en is het een no-op.) */
  try { psql("DELETE FROM kv WHERE key IN ('techniek','appregie','ledenregie','geldregie','leveranciersregie')"); } catch (e) {}
  psql('DROP INDEX IF EXISTS member_dir_codename_lower'); psql('DROP INDEX IF EXISTS member_dir_codename_trgm'); psql('TRUNCATE member_dir');
  for (let s = 1; s <= LEDEN; s += CHUNK) {
    const e = Math.min(s + CHUNK - 1, LEDEN); const tc = Date.now();
    psql("INSERT INTO member_dir(key,codename,tier,codename_lower) SELECT 'user-'||g,'Valk '||g,(CASE WHEN g%3=0 THEN 'business' ELSE 'rtg' END),lower('valk '||g) FROM generate_series(" + s + "," + e + ") g");
    process.stdout.write('  ' + ('member_dir +' + nl(e - s + 1)).padEnd(46) + ' \x1b[36m' + (Date.now() - tc) + ' ms\x1b[0m\n');
  }
  psql('CREATE INDEX member_dir_codename_lower ON member_dir(codename_lower)');
  // De trgm-gin (fuzzy zoeken) is de duurste index qua schijf en bouwtijd. Op de
  // echte 100M-schaal met een krappe schijf kun je hem overslaan (MEGA_TRGM=0);
  // de btree op codename_lower blijft de exacte-zoek/buiten-RAM-belofte bewijzen.
  if (process.env.MEGA_TRGM !== '0') {
    try { psql('CREATE EXTENSION IF NOT EXISTS pg_trgm'); psql('CREATE INDEX member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)'); } catch (e) {}
  }
  const pool = new Pool({ connectionString: DB, max: 4 });
  const NU = Date.now();
  const SUPS = ['KIKUNOI', 'PONTO', 'HOSHI', 'SAKURA', 'MKKX'];
  const naam = i => 'Valk ' + (i % LEDEN + 1), key = i => 'user-' + ((i % LEDEN) + 1);
  const grootboek = async (soort, bouw, n) => {
    await pool.query('DELETE FROM tx_ledger WHERE soort=$1', [soort]); const t0 = Date.now();
    for (let s = 0; s < n; s += 5000) {
      const e = Math.min(s + 5000, n); const vals = [], params = []; let p = 0;
      for (let i = s; i < e; i++) { const t = bouw(i); vals.push('($' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ',$' + (++p) + ')'); params.push(soort, t.ref, t.customerKey, t.supplierCode, !!t.paid, t.status, t.total != null ? t.total : t.price || 0, t.at, JSON.stringify(t)); }
      await pool.query('INSERT INTO tx_ledger(soort,ref,klant,zaak,paid,status,totaal,at,data) VALUES ' + vals.join(',') + ' ON CONFLICT(soort,ref) DO NOTHING', params);
    }
    rij('tx_ledger ' + soort, nl(n) + ' rijen - ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  };
  const schrijf = async (nm, bouw, n) => {
    const st = ['[']; for (let i = 0; i < n; i++) { st.push(JSON.stringify(bouw(i))); if (i < n - 1) st.push(','); } st.push(']');
    const json = st.join('');
    await pool.query("INSERT INTO kv(key,val,ver) VALUES($1,$2,nextval('kv_ver_seq')) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=nextval('kv_ver_seq')", [nm, json]);
    rij('kv ' + nm, nl(n) + ' - ' + MB(Buffer.byteLength(json)) + ' MB');
  };
  const bouwOrder = i => ({ ref: 'RTG-O-B' + i.toString(36), supplierCode: SUPS[i % 5], type: 'restaurant', customerTier: 'rtg', customerKey: key(i * 7), customerCodename: naam(i * 7), items: [{ id: 1, name: 'Gazpacho', qty: 1, price: 16 }], total: 16, status: i % 9 ? 'geserveerd' : 'klaar', paid: true, at: new Date(NU - (i % 7776000) * 1000).toISOString() });
  const bouwBoeking = i => ({ ref: 'RTG-B-B' + i.toString(36), kind: i % 2 ? 'ticket' : 'verblijf', supplierCode: SUPS[i % 5], customerKey: key(i * 3), customerCodename: naam(i * 3), datum: new Date(NU + (i % 30) * 86400000).toISOString().slice(0, 10), price: 40, paid: true, status: 'bevestigd', at: new Date(NU - (i % 5e6) * 1000).toISOString() });
  await grootboek('order', bouwOrder, N_ORDERS);
  await grootboek('boeking', bouwBoeking, N_BOEK);
  await schrijf('orders', bouwOrder, Math.min(N_ORDERS, 30000));
  await schrijf('boekingen', bouwBoeking, Math.min(N_BOEK, 50000));
  await schrijf('directBetalingen', i => ({ id: 'db' + i.toString(36), bedrag: 10 + i % 500, amount: 10 + i % 500, van: key(i * 5), aan: SUPS[i % 5], supplierCode: SUPS[i % 5], at: new Date(NU - (i % 4e6) * 1000).toISOString() }), N_BETAAL);
  await schrijf('betaalVerzoeken', i => ({ id: 'v' + i.toString(36), van: key(i), naar: key(i * 2), centen: 100 + (i % 9000), oms: 'Etentje', status: i % 3 ? 'open' : 'betaald', at: new Date(NU - (i % 3e6) * 1000).toISOString() }), N_VERZ);
  await schrijf('reviews', i => ({ id: 'r' + i.toString(36), supplierCode: SUPS[i % 5], rating: 1 + i % 5, text: 'Prima', codename: naam(i), at: new Date(NU - (i % 6e6) * 1000).toISOString() }), N_REVIEW);
  { const o = {}; for (let i = 0; i < N_MELD; i++) o[key(i)] = [{ icon: 'x', title: 'Melding', body: 'Iets', at: new Date(NU - i * 1000).toISOString(), read: false }]; const json = JSON.stringify(o); await pool.query("INSERT INTO kv(key,val,ver) VALUES($1,$2,nextval('kv_ver_seq')) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=nextval('kv_ver_seq')", ['notifications', json]); rij('kv notifications', nl(N_MELD)); }
  await pool.end();
}

/* ---------- rol-tokens ophalen + de schakelkast op "alles aan" ---------- */
async function tokens() {
  const mLid = (await post('/api/login', { tier: 'rtg' })).data.token;
  const mBus = (await post('/api/login', { tier: 'business' })).data.token;
  const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token;
  const sup = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  // de eigenaar: boardroom-besluiten (de schakelkast) lopen sinds de
  // boardroom-poort alleen nog via zijn eigen account; de anonieme
  // kantoorcode blijft de office-rol in de gauntlet (en hoort daar 403 te
  // krijgen op boardroom-paden). De eigenaar doet bewust NIET mee aan de
  // rol-scheidingstest: dat account is echt lid en kantoor tegelijk.
  const baasLid = (await post('/api/auth/login', { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran', pasApp: 'business' })).data.token;
  /* EN DAARNA DE KANTOOR-ROL AANZETTEN. Dit ontbrak, en het kostte twee volle
     runs aan zeggingskracht: het LEDEN-token van de eigenaar ging rechtstreeks
     naar een boardroom-pad, maar sinds de boardroom-poort komt daar alleen een
     KANTOOR-sessie in. Zonder deze stap viel de schakelkast terug op de
     anonieme kantoorcode, kreeg terecht 403, en stond er een regel
     'schakelkast "alles aan" -> status 403' in het rapport die eruitzag als een
     mededeling in plaats van als een probleem. Elke fase daarna draaide tegen
     de standaard-functiestand terwijl er stond dat alles aanstond. */
  const baasKantoor = baasLid ? (await post('/api/account/start', { rol: 'kantoor' }, baasLid)).data.token : null;
  const baas = baasKantoor || baasLid;
  return {
    member: [mLid, mBus].filter(Boolean), supplier: [sup].filter(Boolean),
    office: [office].filter(Boolean), open: [null], _lid: mLid, _office: office, _baas: baas || office
  };
}
// De grote hendel: elke functie bij iedereen aanzetten, zodat de asserties de
// echte logica raken en niet de feature-poort. Nodig na (her)start.
async function allesAan(office) { try { return (await post('/api/office/boardroom/alles', { aan: true }, office)).status; } catch (e) { return 0; } }

/* ============================================================================
   GELD-INTEGRITEIT -- op de cent, idempotent, en bestand tegen onzin.
   ============================================================================ */
// een 1x1 PNG als geldig "paspoort" voor de KYC-upload (de poort eist een echte
// afbeelding, niet de inhoud). Zo doorloopt het testlid dezelfde eenmalige
// identiteitsstap die een echt gratis lid bij het eerste RTG Pay-moment doet.
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
async function registreerAccount(merk) {
  const email = merk + '+' + Date.now().toString(36) + rint(1e6).toString(36) + '@beproeving.test';
  const ww = 'Geheim' + rint(1e6) + '!';
  const r = await post('/api/auth/register', { name: 'Beproeving ' + merk, email, phone: '06' + (10000000 + rint(8e7)), password: ww, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const token = r.data && r.data.token;
  // Een gratis RTG-lid laat eenmalig zijn paspoort zien voor het eerste RTG
  // Pay-moment (merkregel). Het testlid doorloopt diezelfde stap, anders toetst
  // Fase B niet het geld maar de KYC-poort (en zou vacuous slagen op 0 -> 0).
  let kyc = 'n/a';
  if (token) { const u = await post('/api/verify/upload', { image: KYC_PNG }, token); kyc = u.data && u.data.status || u.status; }
  return { email, ww, token, status: r.status, kyc };
}
async function saldoVan(token) { const r = await post('/api/pay/overzicht', {}, token); return { saldo: r.data && typeof r.data.saldo === 'number' ? r.data.saldo : null, codenaam: r.data && r.data.codenaam }; }

async function geldIntegriteit() {
  const fouten = [];
  const A = await registreerAccount('a'), B = await registreerAccount('b');
  if (!A.token || !B.token) return { fouten: ['registratie mislukte (A=' + A.status + ', B=' + B.status + ')'], A, B };
  const bCode = (await saldoVan(B.token)).codenaam;
  if (!bCode) return { fouten: ['B heeft geen codenaam (wallet onbereikbaar)'], A, B };

  const K1 = 'idem-oplaad-1';
  await post('/api/pay/oplaad', { centen: 500000, idem: K1 }, A.token);
  const naOplaad = (await saldoVan(A.token)).saldo;
  await post('/api/pay/oplaad', { centen: 500000, idem: K1 }, A.token);
  const naDubbel = (await saldoVan(A.token)).saldo;
  if (naDubbel !== naOplaad) fouten.push('idempotente oplaad boekte dubbel (' + naOplaad + ' -> ' + naDubbel + ')');

  const a0 = (await saldoVan(A.token)).saldo, b0 = (await saldoVan(B.token)).saldo;
  const totVoor = a0 + b0;
  for (let i = 0; i < 25; i++) await post('/api/pay/stuur', { aan: bCode, centen: 1000, oms: 'test', idem: 'stuur-' + i }, A.token);
  const a1 = (await saldoVan(A.token)).saldo, b1 = (await saldoVan(B.token)).saldo;
  if (a1 + b1 !== totVoor) fouten.push('interne overboeking lekte centen (' + totVoor + ' -> ' + (a1 + b1) + ')');
  if (b1 - b0 !== 25000) fouten.push('B ontving niet exact 25000 centen (kreeg ' + (b1 - b0) + ')');

  const KS = 'idem-stuur-stabiel';
  await post('/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'idem', idem: KS }, A.token);
  const a2 = (await saldoVan(A.token)).saldo, b2 = (await saldoVan(B.token)).saldo;
  await post('/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'idem', idem: KS }, A.token);
  const a3 = (await saldoVan(A.token)).saldo, b3 = (await saldoVan(B.token)).saldo;
  if (a3 !== a2 || b3 !== b2) fouten.push('idempotente overboeking boekte dubbel (A ' + a2 + '->' + a3 + ', B ' + b2 + '->' + b3 + ')');

  const aVoorOnzin = (await saldoVan(A.token)).saldo;
  const onzin = [-5000, 0, 1e18, Number.NaN, 'veel', null, 9999999999999];
  const stuk = [];
  for (const c of onzin) {
    const r = await post('/api/pay/stuur', { aan: bCode, centen: c, oms: 'onzin', idem: 'onzin-' + String(c) }, A.token);
    if (r.status >= 200 && r.status < 300) stuk.push(String(c) + '->2xx');
    if (r.status >= 500) stuk.push(String(c) + '->5xx');
  }
  const aNaOnzin = (await saldoVan(A.token)).saldo;
  if (stuk.length) fouten.push('onrealistische bedragen niet netjes geweigerd: ' + stuk.join(', '));
  if (aNaOnzin !== aVoorOnzin) fouten.push('onzin-bedragen raakten het saldo (' + aVoorOnzin + ' -> ' + aNaOnzin + ')');

  return { fouten, A, B, bCode, idemStuur: KS, saldoA: a3, saldoB: b3 };
}

/* ============================================================================
   DE MISBRUIK-BEPROEVING -- de morele lat.
   Elk scenario is een aanval die het platform MOET weigeren. We toetsen op ECHT
   gedrag tegen de draaiende server, niet op meningen.
   ============================================================================ */
async function misbruikBeproeving(tok) {
  const uit = [];
  const lid = tok._lid;

  // 1. De AI (het stuur) raakt de kluis en de infrastructuur NOOIT aan, ook al
  //    vraagt het lid er expliciet om. VERBODEN-paden geven 403, geen 2xx.
  {
    const infra = ['/api/account/rollen', '/api/auth/login', '/api/techniek/status', '/api/boardroom/state', '/api/doos/sleutel', '/api/office/login'];
    const stuk = [];
    for (const pad of infra) {
      const r = await post('/api/member/doe', { pad, body: {} }, lid);
      const uitgevoerd = r.status >= 200 && r.status < 300 && r.data && r.data.ok && r.data.status < 400;
      if (uitgevoerd) stuk.push(pad + '->uitgevoerd');
      else if (r.status !== 403 && r.status !== 400) stuk.push(pad + '->' + r.status);
    }
    uit.push({ naam: 'AI raakt kluis/infra niet', ok: stuk.length === 0, detail: stuk.length ? stuk.join(', ') : 'accounts/techniek/boardroom/doos/auth geweigerd (403)' });
  }

  // 2. De AI beweegt GEEN geld zonder bevestiging: een geld-pad zonder bevestigd
  //    geeft 428 (bevestigNodig). Mét bevestiging is dat 428 in elk geval weg.
  {
    const zonder = await post('/api/member/doe', { pad: '/api/pay/tik', body: { code: 'x', centen: 500 } }, lid);
    const met = await post('/api/member/doe', { pad: '/api/pay/tik', body: { code: 'x', centen: 500 }, bevestigd: true }, lid);
    const ok = zonder.status === 428 && zonder.data && zonder.data.bevestigNodig === true && met.status !== 428;
    uit.push({ naam: 'AI vraagt bevestiging voor geld', ok, detail: 'zonder=' + zonder.status + (zonder.data && zonder.data.bevestigNodig ? ' (bevestigNodig)' : '') + ', met=' + met.status });
  }

  // 3. Privacy by design: de identiteitskluis (echte naam bij een codenaam)
  //    blijft dicht voor niet-kantoor. Lid en gast (geen token) krijgen geen 2xx.
  {
    const alsLid = await post('/api/office/inzage', { kamer: 'directie', codenaam: 'Valk 1' }, lid);
    const zonder = await post('/api/office/inzage', { kamer: 'directie', codenaam: 'Valk 1' }, null);
    const ok = !(alsLid.status >= 200 && alsLid.status < 300) && !(zonder.status >= 200 && zonder.status < 300);
    uit.push({ naam: 'Identiteitskluis blijft dicht', ok, detail: 'lid=' + alsLid.status + ', geen-token=' + zonder.status });
  }

  // 4. Rol-scheiding, gericht en hard: een lid-token op een kantoor- en een
  //    leverancier-only pad krijgt nooit 2xx.
  {
    const proeven = [['/api/office/state', lid], ['/api/office/boardroom', lid], ['/api/supplier/backoffice', lid]];
    const lek = [];
    for (const [pad, tk] of proeven) { const r = await post(pad, {}, tk); if (r.status >= 200 && r.status < 300) lek.push(pad + '->' + r.status); }
    uit.push({ naam: 'Rol-scheiding (lid ziet geen kantoor)', ok: lek.length === 0, detail: lek.length ? lek.join(', ') : 'kantoor/leverancier gesloten voor het lid' });
  }

  // 5. Leeftijd, twee bereikbare poorten: een KIND (<15) komt het volwassen
  //    lidmaatschap niet in, en een 16-jarig lid (mag wel lid worden) mag geen
  //    18+-inhoud starten (Proost). De weigering noemt de leeftijd.
  {
    const jaar = new Date().getFullYear();
    const eml = m => m + Date.now().toString(36) + rint(1e6).toString(36) + '@beproeving.test';
    const reg = geb => post('/api/auth/register', { name: 'Leeftijdstest', email: eml('lft'), phone: '06' + (10000000 + rint(8e7)), password: 'Geheim' + rint(1e6) + '!', geboortedatum: geb, tier: 'rtg', pasApp: 'rtg' });
    const kind = await reg((jaar - 10) + '-04-01');                 // ~10 jaar: moet geweigerd
    const kindEruit = !(kind.status >= 200 && kind.status < 300) && !(kind.data && kind.data.token);
    const tiener = await reg((jaar - 16) + '-04-01');               // ~16 jaar: mag lid, geen 18+
    let proostDicht = true, d18 = '18+ niet apart getoetst (tiener-registratie ' + tiener.status + ')';
    if (tiener.data && tiener.data.token) {
      const p = await post('/api/member/spel/random', { soort: 'proost' }, tiener.data.token);
      proostDicht = !(p.status >= 200 && p.status < 300) && /18\+|volwassen/i.test((p.data && p.data.error) || '');
      d18 = 'proost door 16-jarige=' + p.status;
    }
    uit.push({ naam: 'Leeftijd: kind eruit, 18+ dicht', ok: kindEruit && proostDicht, detail: 'kind(' + kind.status + ') geweigerd=' + kindEruit + ', ' + d18 });
  }

  // 6. De stad meet dingen, geen mensen: het stadsbeeld bevat geen persoons- of
  //    camera-identificatie. We scannen de hele payload op verboden sleutels.
  {
    const r = await post('/api/stad/bewoner', {}, lid);
    const blob = JSON.stringify(r.data || {});
    const verboden = ['camera', 'gezicht', 'kenteken', 'persoonsnummer', 'bsn', 'gezichtsherkenning'];
    const gevonden = verboden.filter(w => new RegExp(w, 'i').test(blob));
    uit.push({ naam: 'Stad meet dingen, geen mensen', ok: gevonden.length === 0, detail: gevonden.length ? 'lek: ' + gevonden.join(', ') : 'geen persoons-/camera-velden in het stadsbeeld' });
  }

  return uit;
}

/* ============================================================================
   HOOFDLOOP
   ============================================================================ */
(async () => {
  kop('DE BEPROEVING - ' + MODE.toUpperCase() + '-modus - seed ' + RNGSTATE + (MODE === 'postgres' ? ' - ' + nl(LEDEN) + ' leden + activiteit' : ' - sqlite (standaard, draait overal)'));
  const routes = alleRoutes();
  const dekking = new Map(routes.map(r => [r.method + ' ' + r.pad, 0]));
  rij('endpoints uit de bron', nl(routes.length));
  if (MODE === 'postgres') rij('psql', PSQL);
  await poortVrij(); // nooit per ongeluk een oude, achtergebleven server toetsen

  /* IS DE DATABASE ER UBERHAUPT? Zonder deze controle zag een onbereikbare
     Postgres eruit als "server stopte, code 1" -- een melding waar niets in
     staat, terwijl de oorzaak in het serverlog van een tijdelijke map lag.
     Dat kostte een uur zoeken nadat Postgres tijdens een eerdere run door
     geheugendruk was omgevallen. Een harnas dat de helft van zijn eigen
     foutmeldingen niet verklaart, is zelf een blinde vlek. */
  if (MODE === 'postgres') {
    try { psql('SELECT 1'); }
    catch (e) {
      console.error('\n\x1b[31mPostgres is niet bereikbaar op de DATABASE_URL.\x1b[0m');
      console.error('  ' + String(e.message || e).split('\n')[0]);
      console.error('  \x1b[2mDraait hij nog? Een postmaster die door geheugendruk is omgevallen laat een\n'
        + '  logbestand achter dat eindigt zonder afsluitregel.\x1b[0m\n');
      process.exit(1);
    }
  }

  // ---------- FASE A: VOLUME ----------
  kop('FASE A: VOLUME (' + MODE + ')');
  if (MODE === 'postgres') {
    await boot(); await new Promise(r => setTimeout(r, 800)); await stop();
    const tSeed = Date.now(); await zaaiPostgres();
    rij('zaaien totaal', ((Date.now() - tSeed) / 1000).toFixed(0) + ' s');
  }
  const dbB = MODE === 'postgres' ? Number(psql('SELECT pg_database_size(current_database())')) : null;
  const t0 = Date.now(); await boot();
  rij('boot-tijd', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await new Promise(r => setTimeout(r, 2000));
  const rssNa = rssMB(child.pid);
  rij('server-RAM na laden', rssNa + ' MB');
  if (dbB) rij('Postgres op schijf', MB(dbB) + ' MB');
  const ledenN = MODE === 'postgres' ? Number(psql('SELECT count(*) FROM member_dir')) : 0;
  if (ledenN) rij('leden in de gids (buiten RAM)', nl(ledenN));

  const tok = await tokens();
  const tokVoor = { member: tok.member, supplier: tok.supplier, office: tok.office, open: tok.open };
  rij('tokens', 'member ' + tok.member.length + ' - supplier ' + tok.supplier.length + ' - office ' + tok.office.length);
  /* De grote hendel MOET overgaan. Ging hij niet over, dan draait alles hierna
     tegen de standaard-functiestand en meet deze beproeving minder dan ze
     beweert -- en dat is erger dan een gezakte drempel, want het ziet er groen
     uit. Dit is dus geen mededeling maar een oordeel (zie SCHAKELKAST). */
  const aan = await allesAan(tok._baas);
  const kastOpen = aan === 200;
  rij('schakelkast "alles aan"', kastOpen ? 'ja (elke functie beschikbaar)'
    : '\x1b[31mNEE (status ' + aan + ') - alles hierna draait tegen de standaardstand\x1b[0m');

  // ---------- FASE B: GELD (vaste asserties op schone staat) ----------
  kop('FASE B: GELD - RTG Pay op de cent, idempotent, bestand tegen onzin');
  const geld = await geldIntegriteit();
  if (geld.fouten.length === 0) rij('geld-integriteit', 'conservatie + idempotentie + onzin-weigering: in orde');
  else for (const f of geld.fouten) rij('  GELD-FOUT', f);

  // ---------- FASE C: MISBRUIK ----------
  kop('FASE C: MISBRUIK-BEPROEVING - de morele lat');
  const misbruik = await misbruikBeproeving(tok);
  for (const m of misbruik) console.log('  ' + (m.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m') + '  ' + m.naam.padEnd(38) + ' \x1b[2m' + m.detail + '\x1b[0m');

  // ---------- FASE D: DUURZAAMHEID NA HERSTART ----------
  kop('FASE D: DUURZAAMHEID - herstart met de volle kast');
  const duurFouten = [];
  // De duurzaamheid mag niet vacuous slagen: als Fase B geen echt geld bewoog
  // (saldo 0 -> 0), bewijst "overleefde de herstart" niets. Eis dus dat er echt
  // saldo stond voor we de persistentie ervan toetsen.
  if (geld.A && geld.A.token && geld.bCode && !(geld.saldoB > 0)) {
    duurFouten.push('Fase B bewoog geen echt geld (saldo B = ' + geld.saldoB + '); duurzaamheid zou vacuous slagen');
    rij('  DUURZAAMHEID', 'niet-toetsbaar: ' + duurFouten[0]);
  } else if (geld.A && geld.A.token && geld.bCode) {
    await stopNet(); const tB = Date.now(); await boot();   // nette herstart: de server flusht zijn write-behind
    rij('herstart-tijd', ((Date.now() - tB) / 1000).toFixed(1) + ' s');
    await new Promise(r => setTimeout(r, 1500));
    const baas2 = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran', pasApp: 'business' })).data.token; await allesAan(baas2);
    const herA = (await post('/api/auth/login', { login: geld.A.email, password: geld.A.ww })).data.token;
    const herB = (await post('/api/auth/login', { login: geld.B.email, password: geld.B.ww })).data.token;
    if (!herA || !herB) duurFouten.push('opnieuw inloggen na herstart mislukte');
    else {
      const sA = (await saldoVan(herA)).saldo, sB = (await saldoVan(herB)).saldo;
      if (sA !== geld.saldoA) duurFouten.push('saldo A overleefde de herstart niet (' + geld.saldoA + ' -> ' + sA + ')');
      if (sB !== geld.saldoB) duurFouten.push('saldo B overleefde de herstart niet (' + geld.saldoB + ' -> ' + sB + ')');
      await post('/api/pay/stuur', { aan: geld.bCode, centen: 7000, oms: 'idem', idem: geld.idemStuur }, herA);
      const sA2 = (await saldoVan(herA)).saldo;
      if (sA2 !== sA) duurFouten.push('idempotentie overleefde de herstart niet (A ' + sA + ' -> ' + sA2 + ')');
    }
    if (duurFouten.length === 0) rij('duurzaamheid', 'geld en idempotentie overleefden de herstart');
    else for (const f of duurFouten) rij('  DUURZAAMHEID-FOUT', f);
  } else { duurFouten.push('geen geld-context (Fase B viel om); duurzaamheid niet te toetsen'); rij('  DUURZAAMHEID', 'overgeslagen: ' + duurFouten[0]); }
  // na de herstart weer alle tokens vers ophalen voor de storm
  const tok2 = await tokens();
  tokVoor.member = tok2.member; tokVoor.supplier = tok2.supplier; tokVoor.office = tok2.office;
  await allesAan(tok2._baas);

  // ---------- machine-kalibratie (voor het LATENTIE-oordeel) ----------
  function spinBrok() { let x = 0; for (let i = 0; i < 4e6; i++) x = (x + i) % 9973; return x; }
  async function kalibreer(ms) {
    const duur = []; const tot = Date.now() + ms;
    while (Date.now() < tot) { const t0 = process.hrtime.bigint(); spinBrok(); duur.push(Number(process.hrtime.bigint() - t0) / 1e6); await new Promise(r => setImmediate(r)); }
    duur.sort((a, b) => a - b);
    const basis = duur[Math.floor(duur.length * 0.05)] || 1, p99 = duur[Math.floor(duur.length * 0.99)] || basis;
    return { basis, p99, factor: Math.max(1, p99 / basis), n: duur.length };
  }
  const kal = await kalibreer(6000);
  const machineFactor = process.env.RUIS_UIT === '1' ? 1 : Math.min(3, kal.factor);
  rij('machine-kalibratie (rust)', 'basis ' + kal.basis.toFixed(1) + ' ms - p99 ' + kal.p99.toFixed(1) + ' ms - ruisfactor ' + kal.factor.toFixed(2));

  /* De basislijn voor het HERSTEL-oordeel: hoe snel is een gewone aanroep als er
     niets aan de hand is. Hier gemeten en niet achteraf geschat, want achteraf
     is de server niet meer in rust en zou de drempel meebewegen met de schade
     die we juist willen meten. */
  let herstelBasisMs = 0, herstelBasisN = 0;
  {
    const metingen = [];
    for (let i = 0; i < 12; i++) {
      const tk = rkeuze(tokVoor.member.length ? tokVoor.member : tokVoor.office);
      const st = await verzoek('POST', '/api/state', tk, {});
      if (st.status >= 200 && st.status < 300) metingen.push(st.ms);
      await new Promise(r => setTimeout(r, 40));
    }
    metingen.sort((a, b) => a - b);
    herstelBasisN = metingen.length;
    herstelBasisMs = metingen.length ? metingen[Math.floor(metingen.length / 2)] : 50;   // mediaan
  }

  // ---------- FASE E: GAUNTLET (vernietigende storm, komt NA de asserties) ----------
  kop('FASE E: GAUNTLET - ~' + (SOAK_MS / 60000) + ' min - ' + WERKERS + ' werkers - elk endpoint, elke rol, rommel');
  const buckets = { ok: 0, herleid4xx: 0, r429: 0, r503: 0, s5xx: 0, stuk: 0 };
  const vijfxx = new Map(); const perEnd = new Map(); const rolLek = [];
  /* PER ROL, en niet alleen per endpoint. Een totaalpercentage verbergt dat een
     hele rol eruit ligt: honderd kapotte kantoor-endpoints verdwijnen in de ruis
     van duizend werkende lid-endpoints. Bij een verkeerde rol (kruis) is 4xx het
     GOEDE antwoord, dus die twee worden apart geteld -- ze door elkaar husselen
     maakt "foutpercentage" een getal zonder betekenis. */
  const perRol = new Map();
  /* En de EXACTE code erbij, niet alleen de klasse. "99,7% 4xx" is een hoop
     waarin drie totaal verschillende dingen zitten: 400 is rommel-invoer die
     terecht wordt geweigerd (gezond), 401 is een dood token (een meetfout), en
     403 is de rol-scheiding die werkt (ook gezond). Zonder deze splitsing is een
     laag 2xx-percentage niet te duiden en blijf je gissen. */
  const rolTel = (naam) => { let r = perRol.get(naam); if (!r) perRol.set(naam, r = { n: 0, ok: 0, c4xx: 0, c5xx: 0, r429: 0, r503: 0, stuk: 0, codes: new Map() }); return r; };
  const cpu = belasting.cpuMeter(child.pid);
  const lusMonsters = [];
  let totaal = 0; const rssReeks = [];
  let stormEind = Date.now() + SOAK_MS;
  async function raak(r, magKruisen) {
    const kruis = magKruisen && r.rol !== 'open' && rint(5) === 0;
    const rol = kruis ? rkeuze(['member', 'supplier', 'office'].filter(x => x !== r.rol)) : r.rol;
    const tk = rkeuze(tokVoor[rol].length ? tokVoor[rol] : tokVoor.member);
    // de platformbrede schakelkast krijgt een benigne body: fuzzen mag, maar niet
    // de hele kast uitzetten en zo elke andere endpoint-meting vergiftigen.
    const body = r.method === 'GET' ? null : (r.schakel ? { aan: true } : chaosBody(0));
    const st = await verzoek(r.method, r.pad, tk, body);
    totaal++; noteerLat(st.ms);
    const pe = perEnd.get(r.pad) || { n: 0, som: 0, max: 0, ok: 0, c4xx: 0, c5xx: 0, r429: 0, r503: 0, stuk: 0 };
    pe.n++; pe.som += st.ms; if (st.ms > pe.max) pe.max = st.ms; perEnd.set(r.pad, pe);
    const pr = rolTel(kruis ? r.rol + ' (verkeerde rol)' : r.rol); pr.n++;
    pr.codes.set(st.status, (pr.codes.get(st.status) || 0) + 1);
    if (rol === r.rol) dekking.set(r.method + ' ' + r.pad, (dekking.get(r.method + ' ' + r.pad) || 0) + 1);
    const s = st.status;
    if (s === 0) { buckets.stuk++; pe.stuk++; pr.stuk++; }
    else if (s === 503) { buckets.r503++; pe.r503++; pr.r503++; }
    else if (s === 429) { buckets.r429++; pe.r429++; pr.r429++; }
    else if (s >= 500) { buckets.s5xx++; pe.c5xx++; pr.c5xx++; vijfxx.set(r.pad, (vijfxx.get(r.pad) || 0) + 1); }
    else if (s >= 400) { buckets.herleid4xx++; pe.c4xx++; pr.c4xx++; }
    else { buckets.ok++; pe.ok++; pr.ok++; if (kruis && r.rol !== 'open') rolLek.push(r.method + ' ' + r.pad + ' [' + rol + '->' + s + ']'); }
    await new Promise(res => setTimeout(res, 1 + rint(4)));
  }
  async function werker(ix) {
    const mijnDeel = routes.filter((_, j) => j % WERKERS === ix);
    for (let ronde = 0; ronde < SLO_DEKKING; ronde++) for (const r of mijnDeel) { if (Date.now() >= stormEind) break; await raak(r, false); }
    while (Date.now() < stormEind) await raak(routes[rint(routes.length)], true);
  }
  /* ---- de goede verhalen: eerst in rust, daarna middenin de storm ----
     De ijking is niet optioneel. Een verhaal dat tijdens de storm faalt bewijst
     alleen iets als datzelfde verhaal in RUST wel loopt; zonder die kalme ronde
     weet je niet of je een regressie ziet of een kapotte test. */
  const verhaalDeur = verhalen.maakDeur({ host: '127.0.0.1', port: PORT });
  let podium = null, rustRapport = null, stormRapport = null, podiumFout = null;
  try { podium = await verhalen.bouwPodium(verhaalDeur); }
  catch (e) { podiumFout = e.message; }
  if (podium) {
    rustRapport = verhalen.versRapport();
    await verhalen.draaiRonde(verhaalDeur, podium, rustRapport);
    stormRapport = verhalen.versRapport();
  }

  const vloerVers = await heapNaGc(child.pid);
  cpu.start();
  const mon = setInterval(() => {
    const m = rssMB(child.pid); if (m) rssReeks.push(m);
    cpu.monster();
    /* De event-loop uit de server zelf, TIJDENS de storm. Van buiten gemeten
       zeggen onze eigen latenties niets over of de lus vaststaat: een verzoek
       dat 90 ms duurt omdat de lus 80 ms bezet was, ziet er van hier precies zo
       uit als een verzoek dat zelf 90 ms werk deed. */
    belasting.lusVanServer('127.0.0.1', PORT).then(v => { if (v) lusMonsters.push(v); }).catch(() => {});
  }, 3000);
  const stormStart = Date.now();
  stormEind = Date.now() + SOAK_MS;
  /* De verhalenloper draait NAAST de werkers, in hetzelfde tijdvenster: ronde na
     ronde zolang de storm duurt. Hij telt niet mee in de latentie- en
     dekkingscijfers van de gauntlet -- dat is een andere meting met een ander
     doel, en ze door elkaar husselen maakt allebei onleesbaar. */
  async function verhaalLoper() {
    while (Date.now() < stormEind) await verhalen.draaiRonde(verhaalDeur, podium, stormRapport);
  }

  /* ---- DE STORM LOGT ZICHZELF UIT ----
     De gauntlet bestookt ELK endpoint met een geldig token, en /api/logout is
     een endpoint. Dat trekt het token in -- terecht, dat is ooit expres zo
     gerepareerd. Gevolg: vanaf de eerste keer dat een werker daar langskomt,
     krijgt die rol alleen nog 401. In de eerste run met de rol-tabel was dat
     zichtbaar als member 0,3% 2xx tegen office 32,1%, en het DEKKING-oordeel
     bleef groen omdat dat hits telt en geen zinvolle antwoorden. Dekking die
     geen dekking is, nu in het stormharnas zelf.

     Uitzonderen van /api/logout zou de test verzwakken (juist die route hoort
     gefuzzt te worden). Daarom worden de tokens tijdens de storm ververst. */
  let tokenVersingen = 0;
  async function tokenVerser() {
    while (Date.now() < stormEind) {
      await new Promise(r => setTimeout(r, TOKEN_VERS_MS));
      if (Date.now() >= stormEind) break;
      try {
        const t = await tokens();
        if (t.member && t.member.length) tokVoor.member = t.member;
        if (t.supplier && t.supplier.length) tokVoor.supplier = t.supplier;
        if (t.office && t.office.length) tokVoor.office = t.office;
        tokenVersingen++;
      } catch (e) { /* een mislukte verversing is geen reden de storm te stoppen */ }
    }
  }
  await Promise.all([
    ...Array.from({ length: WERKERS }, (_, ix) => werker(ix)),
    ...(podium ? [verhaalLoper()] : []),
    tokenVerser()
  ]);
  clearInterval(mon);
  const stormDuurMs = Date.now() - stormStart;

  /* De schakelkast eerst terug aan. De gauntlet FUZZT die kast, dus na de storm
     kan er een functie uitstaan -- en dan meet de herstelfase hieronder niet of
     de server bijkomt, maar of de test zichzelf heeft uitgezet. Dat is een
     artefact van het harnas en geen productiescenario: in het echt zit er geen
     robot met een kantoortoken willekeurig hendels om te gooien. Mijn eerste
     versie stond hierna, en meldde daardoor zestig seconden lang "afgewezen"
     zonder te kunnen zeggen waarom. */
  await allesAan((await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token);

  /* ---------- HERSTEL NA DE STORM ----------
     Dit ontbrak volledig: de meting stopte precies wanneer de last stopte. Maar
     overleven is de halve vraag. Een server die de aanval doorstaat en er daarna
     niet meer uitkomt -- een wachtrij die vol blijft, een pool die niet
     vrijgeeft, geheugen dat blijft staan -- is in productie net zo stuk, en je
     merkt het pas op het slechtste moment.

     We meten wat een GEWONE gebruiker ervaart: POST /api/state met een
     ledentoken, de meest gewone aanroep die de app doet. Een antwoord dat geen
     2xx is telt als niet-hersteld en niet als "snel", want een gebruiker die
     wordt afgewezen is niet geholpen -- dat is precies het geval dat een
     latentiegemiddelde mooi maakt en de gebruiker niets oplevert.

     De basislijn komt uit dezelfde aanroep VOOR de storm, dus de drempel schaalt
     mee met de machine in plaats van een verzonnen vast getal te zijn. */
  kop('FASE E2: HERSTEL - komt de gewone gebruiker terug op zijn oude snelheid?');
  /* EEN VERS TOKEN, en dat is geen valsspelen. De storm heeft zichzelf uitgelogd
     (zie de tokenVerser hierboven); dat token is met opzet ingetrokken. De vraag
     hier is of een GEWONE gebruiker zijn snelheid terugkrijgt, en die stond niet
     met /api/logout te fuzzen. Meten met een moedwillig ingetrokken token zou
     altijd 401 opleveren en nooit iets over herstel zeggen. */
  const versTok = await tokens();
  if (versTok.member && versTok.member.length) tokVoor.member = versTok.member;
  const gewoonToken = () => rkeuze(tokVoor.member.length ? tokVoor.member : tokVoor.office);
  async function gewoneAanroep() {
    const st = await verzoek('POST', '/api/state', gewoonToken(), {});
    return { ms: (st.status >= 200 && st.status < 300) ? st.ms : Infinity, status: st.status };
  }
  const herstel = await belasting.herstelNaStorm({
    meet: gewoneAanroep, basisMs: Math.max(5, herstelBasisMs), factor: 2,
    venesterMs: Number(process.env.HERSTEL_VENSTER_MS || 60000), stapMs: 1000
  });
  const rssNaStorm = rssMB(child.pid);
  const lusNaStorm = await belasting.lusVanServer('127.0.0.1', PORT);
  rij('basislijn voor de storm', herstelBasisMs.toFixed(1) + ' ms (gewone aanroep, ' + herstelBasisN + 'x)');
  rij('hersteld binnen het venster', herstel.hersteld
    ? '\x1b[32mja, na ' + herstel.naSeconden + ' s\x1b[0m (grens ' + herstel.grensMs + ' ms)'
    : '\x1b[31mNEE\x1b[0m binnen ' + (Number(process.env.HERSTEL_VENSTER_MS || 60000) / 1000) + ' s (grens ' + herstel.grensMs + ' ms)');
  if (herstel.verloop.length)
    rij('  verloop (s: ms)', herstel.verloop.slice(0, 8).map(v => v.tSec + 's:' + (v.ms === Infinity ? String(v.status) : Math.round(v.ms))).join('  '));
  if (herstel.statussen && herstel.statussen.length)
    rij('  antwoorden tijdens het herstel', herstel.statussen.map(([st, n]) => st + ' x' + n).join(', '));

  // ---------- FASE F: GEHEUGEN (lek-vloer over identieke lees-rondes) ----------
  kop('FASE F: GEHEUGEN - lek-vloer over identieke lees-rondes');
  const leesPaden = [
    { m: 'POST', p: '/api/state', rol: 'member' }, { m: 'GET', p: '/api/notifications', rol: 'member' },
    { m: 'POST', p: '/api/verkoop/mijn', rol: 'member' }, { m: 'POST', p: '/api/boekingen/mijn', rol: 'member' },
    { m: 'POST', p: '/api/pay/overzicht', rol: 'member' }, { m: 'POST', p: '/api/office/state', rol: 'office' },
    { m: 'POST', p: '/api/supplier/backoffice', rol: 'supplier' }
  ];
  async function leesWerker() { while (Date.now() < stormEind) { const r = leesPaden[rint(leesPaden.length)]; const tk = rkeuze(tokVoor[r.rol].length ? tokVoor[r.rol] : tokVoor.member); const st = await verzoek(r.m, r.p, tk, r.m === 'GET' ? null : {}); if (st.status >= 500) { buckets.s5xx++; vijfxx.set(r.p, (vijfxx.get(r.p) || 0) + 1); } await new Promise(res => setTimeout(res, 1 + rint(4))); } }
  async function rustVloer() { await new Promise(r => setTimeout(r, 4000)); let l = Infinity; for (let i = 0; i < 3; i++) { const h = await heapNaGc(child.pid); if (h != null && h < l) l = h; await new Promise(r => setTimeout(r, 1200)); } return l === Infinity ? null : l; }
  async function lekRonde(ms) { stormEind = Date.now() + ms; await Promise.all(Array.from({ length: WERKERS }, leesWerker)); return rustVloer(); }
  const lekMin = LEK_MS / 60000;
  const vloers = [await rustVloer()];
  for (let i = 0; i < LEK_RONDES; i++) vloers.push(await lekRonde(LEK_MS));
  const ys = vloers.slice(1), xs = ys.map((_, i) => i * lekMin);
  const xm = xs.reduce((a, b) => a + b, 0) / xs.length, ym = ys.reduce((a, b) => a + b, 0) / ys.length;
  let tel = 0, noem = 0; for (let i = 0; i < xs.length; i++) { tel += (xs[i] - xm) * (ys[i] - ym); noem += (xs[i] - xm) ** 2; }
  const lekHelling = noem > 0 ? tel / noem : 0;

  // ---------- METING ----------
  kop('METING');
  rij('tokens ververst tijdens de storm', tokenVersingen + 'x \x1b[2m(de storm bestookt ook /api/logout en trekt zo zijn eigen token in)\x1b[0m');
  rij('stormduur (gemeten)', (stormDuurMs / 1000).toFixed(1) + ' s  \x1b[2m(ingesteld: ' + (SOAK_MS / 1000) + ' s)\x1b[0m');
  rij('afgehandelde calls (gauntlet)', nl(totaal) + '  (~' + Math.round(totaal / (stormDuurMs / 1000)) + '/s)');
  rij('  2xx / herleide 4xx', nl(buckets.ok) + ' / ' + nl(buckets.herleid4xx));
  rij('  429 / 503 (rate-limit / feature-uit)', nl(buckets.r429) + ' / ' + nl(buckets.r503));
  rij('  timeout/afgekapt', nl(buckets.stuk));
  rij('  5xx (SERVERFOUTEN)', buckets.s5xx === 0 ? '0' : '\x1b[31m' + buckets.s5xx + '\x1b[0m');
  if (vijfxx.size) for (const [p, n] of [...vijfxx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) rij('    5xx bij', p + ' (' + n + 'x)');
  rij('latentie p50/p95/p99/max', pct(0.5) + ' / ' + pct(0.95) + ' / ' + pct(0.99) + ' / ' + latMax + ' ms');
  // Waar zit de staart? De acht traagste endpoints (op piek-latentie), met hun
  // gemiddelde erbij zodat een eenmalige uitschieter zich onderscheidt van een
  // structureel traag pad. Dit is de kaart voor de volgende latentie-ronde.
  const traagste = [...perEnd.entries()].filter(([, e]) => e.n >= 3).sort((a, b) => b[1].max - a[1].max).slice(0, 8);
  if (traagste.length) { rij('traagste endpoints', 'piek / gemiddeld (aantal)'); for (const [pad, e] of traagste) rij('  ' + pad, e.max + ' / ' + Math.round(e.som / e.n) + ' ms  (' + nl(e.n) + 'x)'); }

  /* ---- FOUTEN PER ENDPOINT ----
     Een totaalpercentage verbergt dat een handjevol routes helemaal stuk is. Een
     5xx is altijd fout; een 4xx tijdens deze storm is meestal GOED (de invoer
     was rommel), dus die staan apart en 4xx wordt alleen gemeld waar hij
     opvallend hoog is bij een route die met de JUISTE rol wordt aangeroepen. */
  const met5xx = [...perEnd.entries()].filter(([, e]) => e.c5xx > 0).sort((a, b) => b[1].c5xx - a[1].c5xx).slice(0, 10);
  rij('endpoints met serverfouten (5xx)', met5xx.length ? nl(met5xx.length) + ' -- hieronder' : '\x1b[32mgeen\x1b[0m');
  for (const [pad, e] of met5xx)
    rij('  ' + pad, e.c5xx + ' van ' + nl(e.n) + ' (' + (100 * e.c5xx / e.n).toFixed(1) + '%)');
  const afgewezen = [...perEnd.entries()].filter(([, e]) => e.n >= 10 && e.ok === 0)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  rij('endpoints die NOOIT 2xx gaven', afgewezen.length ? nl(afgewezen.length) + ' (>=10 pogingen)' : '\x1b[32mgeen\x1b[0m');
  for (const [pad, e] of afgewezen)
    rij('  ' + pad, nl(e.n) + 'x, alles ' + (e.c4xx ? '4xx' : e.r503 ? '503' : e.r429 ? '429' : 'geweigerd'));

  /* ---- FOUTEN PER ROL ----
     Bij een VERKEERDE rol is 4xx het goede antwoord; die regel meet dus of de
     rol-scheiding werkt, niet of er iets stuk is. Ze door elkaar husselen maakt
     "foutpercentage" een getal zonder betekenis, en daarom staan ze los. */
  rij('per rol', '2xx / 4xx / 5xx / 429 / 503  (aantal)');
  for (const [naam, r] of [...perRol.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const p = (x) => (100 * x / r.n).toFixed(1) + '%';
    rij('  ' + naam, p(r.ok) + ' / ' + p(r.c4xx) + ' / ' +       (r.c5xx ? '\x1b[31m' + p(r.c5xx) + '\x1b[0m' : p(r.c5xx)) + ' / ' + p(r.r429) + ' / ' + p(r.r503) + '  (' + nl(r.n) + ')');
    const top = [...r.codes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    rij('    codes', top.map(([c, n]) => c + ': ' + p(n)).join('  '));
  }
  /* De duiding hoort erbij, want dit is de regel waar je anders naar zit te
     staren. 400 = invoer geweigerd (dat is de bedoeling van een fuzztest),
     403 = rechten (de rol-scheiding werkt), 401 = niet ingelogd -- en dat
     laatste hoort bij een levend token bijna nul te zijn. */
  console.log('  \x1b[2m400 = rommel geweigerd (gezond) - 403 = rechten (gezond) - 401 = token dood (meetfout)\x1b[0m');

  /* ---- CPU, EVENT-LOOP, DATABASE ---- */
  const cpuUit = cpu.lees();
  rij('CPU van de server tijdens de storm', cpuUit
    ? cpuUit.gemiddeld + '% gemiddeld, piek ' + cpuUit.piek + '% \x1b[2m(100% = een volle kern van ' + os.cpus().length + ')\x1b[0m'
    : 'niet te meten');
  if (lusMonsters.length) {
    const maxLus = Math.max(...lusMonsters.map(v => v.max || 0));
    const p99Lus = Math.max(...lusMonsters.map(v => v.p99 || 0));
    rij('event-loop-vertraging tijdens de storm', 'p99 ' + p99Lus.toFixed(1) + ' ms, max ' + maxLus.toFixed(1) + ' ms  \x1b[2m(' + lusMonsters.length + ' monsters)\x1b[0m');
  } else rij('event-loop-vertraging tijdens de storm', 'niet gelezen (metrics-deur dicht?)');
  if (lusNaStorm) rij('event-loop na de storm', 'p99 ' + lusNaStorm.p99 + ' ms, max ' + lusNaStorm.max + ' ms');
  const dbNa = belasting.dbBelasting(TMP, MODE === 'postgres' ? (process.env.DATABASE_URL || process.env.PG_URL) : null);
  rij('database (' + dbNa.stand + ')', dbNa.schijfKB != null ? nl(dbNa.schijfKB) + ' kB op schijf' : 'niet te meten');
  if (dbNa.verbindingen != null) rij('  verbindingen', dbNa.verbindingen + ' van ' + dbNa.maxVerbindingen + ' (commits ' + nl(dbNa.commits) + ', rollbacks ' + nl(dbNa.rollbacks) + ')');
  if (rssNaStorm != null) rij('RAM na de storm', rssNaStorm + ' MB \x1b[2m(piek onder last was ' + Math.max(...rssReeks, 0) + ' MB)\x1b[0m');
  const dal = rssReeks.length ? Math.min(...rssReeks) : rssNa, piek = rssReeks.length ? Math.max(...rssReeks) : rssNa;
  rij('RAM (RSS) dal/piek onder last', dal + ' / ' + piek + ' MB');
  rij('heapUsed vers -> opgewarmd (na GC)', vloerVers + ' -> ' + vloers[0] + ' MB');
  rij('heapUsed lek-vloeren per ronde', vloers.join(' -> ') + ' MB (' + lekHelling.toFixed(1) + ' MB/min)');
  const onbereikt = [...dekking.entries()].filter(([, n]) => n < SLO_DEKKING);
  rij('endpoints < ' + SLO_DEKKING + 'x geraakt', nl(onbereikt.length) + ' / ' + nl(routes.length));

  /* ---- de goede verhalen ---- */
  let rustSom = null, stormSom = null;
  if (podiumFout) {
    rij('goede verhalen', '\x1b[31mhet podium kwam niet klaar: ' + podiumFout.slice(0, 90) + '\x1b[0m');
  } else {
    rustSom = verhalen.schrijfRapport(rustRapport, 'GOEDE VERHALEN - IJKING IN RUST (voor de storm)');
    stormSom = verhalen.schrijfRapport(stormRapport, 'GOEDE VERHALEN - MIDDENIN DE STORM');
    const pogingen = stormSom.gelukt + stormSom.afgewezen + stormSom.gefaald;
    /* SLAAGPERCENTAGE, want de aantallen alleen zeggen niets over de prijs van
       de aanval. "99,8% in rust tegen 83% in de storm" is een kwaliteitsmaat;
       "1771 gelukt" is een getal waar je niets mee kunt zonder de noemer. */
    const slaag = (som) => { const n = som.gelukt + som.afgewezen + som.gefaald; return n ? (100 * som.gelukt / n) : 0; };
    const rustPct = slaag(rustSom), stormPct = slaag(stormSom);
    rij('verhalen in rust', rustSom.gelukt + ' gelukt / ' + rustSom.afgewezen + ' afgewezen / ' + rustSom.gefaald + ' gefaald  \x1b[1m(' + rustPct.toFixed(1) + '% slaagt)\x1b[0m');
    rij('verhalen tijdens de storm', stormSom.gelukt + ' gelukt / ' + stormSom.afgewezen + ' afgewezen / ' + stormSom.gefaald + ' gefaald  \x1b[1m(' + stormPct.toFixed(1) + '% slaagt)\x1b[0m');
    rij('  wat de aanval kost aan bruikbaarheid', (rustPct - stormPct).toFixed(1) + ' procentpunt \x1b[2m(' + rustPct.toFixed(1) + '% -> ' + stormPct.toFixed(1) + '%)\x1b[0m');
    rij('  waarvan afgewezen op', stormSom.af429 + 'x snelheidslimiet (429), ' + stormSom.af503 + 'x dicht (503: De Wacht, functie uit of zekering)');
    rij('  doorkomstpercentage', pogingen ? (100 * stormSom.gelukt / pogingen).toFixed(1) + '% van de verhalen kwam er tijdens de storm doorheen' : 'n.v.t.');
    /* WAAROM de deur dichtging, met de woorden van de server zelf. Dit cijfer
       zonder die reden is misleidend: een lage doorkomst omdat De Wacht last
       afwerpt is iets heel anders dan een lage doorkomst omdat de automatische
       noodrem de registratiezekering eruit heeft gehaald -- en dat laatste is
       geen storing maar de beveiliging die precies doet wat hij hoort te doen,
       want een storm die met rommel op de inlogpaden beukt IS brute force.
       En bij de snelheidslimiet hoort er nog een kanttekening bij: die telt per
       IP, en hier komen de storm en de verhalen van hetzelfde adres. */
    const alleRedenen = new Map();
    for (const r of stormRapport.values())
      for (const [t, n] of r.redenen) alleRedenen.set(t, (alleRedenen.get(t) || 0) + n);
    for (const [t, n] of [...alleRedenen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3))
      rij('  de server zei', '"' + t.slice(0, 70) + '" (' + nl(n) + 'x)');
    if (stormSom.af429 > stormSom.af503)
      console.log('  \x1b[2m' + 'vooral snelheidslimiet, en die telt per IP: storm en verhalen komen hier van'
        + '\n  hetzelfde adres en delen dus een emmer. Dat is de opstelling, niet productie.\x1b[0m');
  }

  // ---------- HET OORDEEL ----------
  kop('HET OORDEEL (drempels; faalt er een, dan exitcode 1)');
  const verdicten = [];
  const v = (naam, ok, detail) => { verdicten.push(ok); console.log('  ' + (ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m') + '  ' + naam.padEnd(16) + ' \x1b[2m' + detail + '\x1b[0m'); };
  /* SCHAKELKAST. Deze staat bewust bovenaan: zakt hij, dan zijn alle oordelen
     eronder minder waard dan ze lijken, want dan is de helft van de functies
     nooit aangeraakt. Een meting die stilletjes minder doet dan ze zegt is
     gevaarlijker dan een meting die zakt. */
  v('SCHAKELKAST', kastOpen, kastOpen ? 'elke functie stond aan tijdens de hele run'
    : 'de hendel ging niet over (status ' + aan + '): de run draaide tegen de standaardstand');
  v('ROBUUSTHEID', buckets.s5xx === 0, buckets.s5xx + ' onverwachte serverfouten');
  v('ROL-SCHEIDING', rolLek.length === 0, rolLek.length ? rolLek.slice(0, 8).join(', ') : 'geen verkeerd-rol token kreeg 2xx');
  v('DEKKING', onbereikt.length === 0, onbereikt.length + ' endpoints te weinig geraakt' + (onbereikt.length ? ': ' + onbereikt.slice(0, 6).map(e => e[0]).join(', ') : ''));
  v('GELD', geld.fouten.length === 0, geld.fouten.length ? geld.fouten.join(' | ') : 'op de cent, idempotent, onzin geweigerd');
  const misbruikStuk = misbruik.filter(m => !m.ok);
  v('MISBRUIK', misbruikStuk.length === 0, misbruikStuk.length ? misbruikStuk.map(m => m.naam).join(', ') : misbruik.length + ' morele beproevingen gehaald');
  v('DUURZAAMHEID', duurFouten.length === 0, duurFouten.length ? duurFouten.join(' | ') : 'geld + idempotentie overleefden de herstart');
  v('GEHEUGEN', lekHelling <= SLO_VLOER, 'vloer-helling ' + lekHelling.toFixed(1) + ' MB/min (drempel ' + SLO_VLOER + ')');
  const sloEff = Math.round(SLO_P99_MS * machineFactor);
  v('LATENTIE', pctMs(0.99) <= sloEff, 'p99 = ' + pct(0.99) + ' ms (drempel ' + sloEff + (machineFactor > 1 ? ' = SLO x ' + machineFactor.toFixed(2) : '') + ')');
  /* VERHALEN. Drie eisen, en de derde is de belangrijkste: er moet tijdens de
     storm ook echt iets GELUKT zijn. Zonder die eis is "nul gefaald" waar zodra
     De Wacht alles afwijst -- en dan staat er een groene regel boven een
     platform waar geen klant meer binnenkomt. Een bewering over een lege
     verzameling is vanzelf waar; die val is in dit huis vaak genoeg dichtgeslagen. */
  /* HERSTEL. Overleven is de halve vraag; eruit komen is de andere helft. Zonder
     dit oordeel is de herstelmeting een mooi lijstje zonder gevolgen -- precies
     het soort meter dat niet kan zakken. */
  v('HERSTEL', herstel.hersteld,
    herstel.hersteld
      ? 'gewone aanroep terug op ' + herstel.grensMs + ' ms binnen ' + herstel.naSeconden + ' s (basislijn ' + herstelBasisMs.toFixed(1) + ' ms)'
      : 'NIET hersteld binnen het venster; de gewone gebruiker bleef traag of afgewezen na de storm');
  v('VERHALEN',
    !podiumFout && rustSom.gefaald === 0 && stormSom.gefaald === 0 && stormSom.gelukt > 0,
    podiumFout ? 'podium kwam niet klaar: ' + podiumFout.slice(0, 80)
      : 'in rust ' + rustSom.gefaald + ' gefaald; tijdens de storm ' + stormSom.gelukt + ' gelukt, '
        + stormSom.afgewezen + ' afgewezen aan een dichte deur, ' + stormSom.gefaald + ' gefaald');

  kop('WAT DEZE TEST NIET BEWIJST (eerlijk)');
  for (const l of [
    'Eén node, ' + (MODE === 'postgres' ? 'één Postgres, fsync uit (laadsnelheid/gedrag, geen duurzaamheidsgarantie op schijf)' : 'sqlite in een tijdelijke map (geen echte productie-opslag)') + '.',
    'De activiteit is rechtstreeks gezaaid, niet via de echte schrijfpaden; chaos toetst robuustheid, geen functionele juistheid.',
    'De goede verhalen zijn een dwarsdoorsnede (lid worden, bestellen, betalen, rit, onderweg, verbinden, geld) -- zeven verhalen, geen functionele dekking van ' + nl(routes.length) + ' endpoints.',
    'De misbruik-beproeving dekt de zwaarste morele regels af, niet elke denkbare misbruikvorm.',
    'Latentie/doorvoer gelden voor DEZE machine en dit werkpunt; geen capaciteitsgarantie.',
    MODE === 'sqlite' ? 'Dit is de sqlite-standaard; de volle mega-schaal (100M) draai je met DATABASE_URL.' : 'Dit is de mega-schaal; de morele lat is identiek aan de sqlite-standaard.'
  ]) console.log('  \x1b[2m- ' + l + '\x1b[0m');

  kop('SAMENVATTING');
  rij('modus / schaal', MODE + (ledenN ? ' - ' + nl(ledenN) + ' leden' : ' - standaard'));
  rij('server-RAM', rssNa + ' MB na laden, ' + piek + ' MB piek onder last');
  if (dbB) rij('opslag (Postgres, schijf)', MB(dbB) + ' MB');
  rij('endpoints bestookt', nl(routes.length) + ' (waarvan ' + nl(routes.length - onbereikt.length) + ' voldoende gedekt)');
  const gezakt = verdicten.filter(x => !x).length;
  rij('OORDEEL', gezakt === 0 ? '\x1b[32mALLES PASS - de code doorstaat De Beproeving\x1b[0m' : '\x1b[31m' + gezakt + ' DREMPEL(S) GEZAKT\x1b[0m');

  await stop();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exitCode = gezakt === 0 ? 0 : 1;
  console.log('\nklaar (exit ' + process.exitCode + ')');
})().catch(async e => { console.error('FOUT:', e && e.stack || e); await stop(); process.exit(2); });
