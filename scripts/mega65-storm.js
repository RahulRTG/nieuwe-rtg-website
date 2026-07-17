/* MEGA65-STORM -- een oordeel-harnas, geen printer van groene tabellen.
   Doel: eerlijk vaststellen of het platform onder schaal + rommel breekt, en
   HARD ZAKKEN (niet-nul exitcode) als een drempel wordt overschreden. Geen
   mooipraterij: de test rapporteert het slechtste geval, benoemt wat hij NIET
   bewijst, en is deterministisch (seeded) zodat een run reproduceerbaar is.

   Opzet:
   - 65M in de ledengids (Postgres, buiten het RAM) + een activiteitslaag in het
     werkgeheugen (orders/boekingen/betalingen/verzoeken/reviews/meldingen).
   - Systematische dekking: ELK endpoint (uit de bron) wordt geraakt, met het
     JUISTE rol-token en met elk VERKEERDE rol-token (rol-scheiding), plus
     rommel-invoer (emoji's, gigastrings, diep genest, verkeerde types, XSS/SQL).
   - Meting: per verzoek de latentie (histogram -> p50/p95/p99/p999/max), de
     doorvoer, elk 5xx-endpoint, en het RAM over de tijd (vloer na GC = lek-maat).

   OORDEEL (elk een harde drempel; faalt er een, dan exitcode 1):
   - ROBUUSTHEID : nul onverwachte 5xx (503 feature-uit en 429 tellen niet als fout).
   - ROL-SCHEIDING: een verkeerd-rol token krijgt nooit 2xx op een beschermd endpoint.
   - DEKKING     : elk niet-uitgesloten endpoint minstens N keer geraakt.
   - GEHEUGEN    : de RAM-vloer (minimum na GC) stijgt niet (geen lek).
   - LATENTIE    : p99 onder de SLO. (Deze mag falen -- dan is er een echte grens.)

   Vereist een draaiende Postgres met DATABASE_URL en psql op het pad.
   Draai:  DATABASE_URL=postgres://... node --max-old-space-size=8192 scripts/mega65-storm.js
   Knoppen: MEGA_LEDEN, MEGA_ORDERS, SOAK_MIN, STORM_WERKERS, MEGA_SEED,
            SLO_P99_MS (2000), SLO_DEKKING (3), SLO_VLOER_MBMIN (40), MEGA_PSQL. */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');
const { Pool } = require('pg');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.MEGA_PORT || 4097);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-storm-'));
const LEDEN = Number(process.env.MEGA_LEDEN || 65000000);
const CHUNK = Number(process.env.MEGA_CHUNK || 5000000);
const N_ORDERS = Number(process.env.MEGA_ORDERS || 1000000);
const N_BOEK = Number(process.env.MEGA_BOEK || 300000);
const N_BETAAL = Number(process.env.MEGA_BETAAL || 200000);
const N_MELD = Number(process.env.MEGA_MELD || 100000);
const N_VERZ = Number(process.env.MEGA_VERZ || 100000);
const N_REVIEW = Number(process.env.MEGA_REVIEW || 60000);
const SOAK_MS = Number(process.env.SOAK_MIN || 30) * 60000;
const WERKERS = Number(process.env.STORM_WERKERS || 24);
// drempels (SLO's) waarop de test hard zakt
const SLO_P99_MS = Number(process.env.SLO_P99_MS || 2000);
const SLO_DEKKING = Number(process.env.SLO_DEKKING || 3);       // elk endpoint >= N keer
const SLO_VLOER = Number(process.env.SLO_VLOER_MBMIN || 40);     // MB/min stijgende vloer tussen rondes = lek
const LEK_MS = Number(process.env.LEK_MS || 30000);             // duur van elke lek-controle-ronde
const LEK_RONDES = Number(process.env.LEK_RONDES || 3);         // aantal herhaalde lek-rondes na de opwarming
const DB = process.env.DATABASE_URL || process.env.PG_URL;
if (!DB) { console.error('DATABASE_URL ontbreekt (een draaiende Postgres is nodig).'); process.exit(2); }
function vindPsql() {
  if (process.env.MEGA_PSQL) return process.env.MEGA_PSQL;
  for (const p of ['/usr/lib/postgresql/16/bin/psql', '/usr/bin/psql', 'psql']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch (e) {}
  }
  return 'psql';
}
const PSQL = vindPsql();
const psql = sql => execFileSync(PSQL, [DB, '-tAc', sql], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

// deterministische PRNG (mulberry32): elke run met dezelfde seed is identiek
let RNGSTATE = (Number(process.env.MEGA_SEED) || 1234567) >>> 0;
function rng() { RNGSTATE |= 0; RNGSTATE = (RNGSTATE + 0x6D2B79F5) | 0; let t = Math.imul(RNGSTATE ^ (RNGSTATE >>> 15), 1 | RNGSTATE); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rint = n => Math.floor(rng() * n);
const rkeuze = a => a[rint(a.length)];

const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
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
async function postJson(pad, body, token) {
  return new Promise(resolve => {
    const data = JSON.stringify(body || {});
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, agent }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { resolve({}); } });
    });
    req.on('error', () => resolve({})); if (data) req.write(data); req.end();
  });
}
const nl = n => Number(n).toLocaleString('nl-NL');
const MB = b => (b / 1e6).toFixed(0);
function kop(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }
function rij(k, v) { console.log('  ' + String(k).padEnd(46) + ' \x1b[36m' + v + '\x1b[0m'); }

// latentie-histogram (geheugen-veilig, exacte percentielen op bucket-niveau)
const GRENZEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 1000, 1600, 2600, 4200, 6800, 10000, Infinity];
const hist = new Array(GRENZEN.length).fill(0);
let latN = 0, latMax = 0;
function noteerLat(ms) { latN++; if (ms > latMax) latMax = ms; for (let i = 0; i < GRENZEN.length; i++) if (ms <= GRENZEN[i]) { hist[i]++; return; } }
function pct(q) { let doel = q * latN, c = 0; for (let i = 0; i < GRENZEN.length; i++) { c += hist[i]; if (c >= doel) return GRENZEN[i] === Infinity ? '>' + GRENZEN[i - 1] : GRENZEN[i]; } return latMax; }

/* ---------- alle routes + hun auth-rol uit de bron ---------- */
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
      set.set(method + ' ' + echt, { method, pad: echt, rol: rol[m[3]] || 'open' });
    }
  }
  return [...set.values()];
}

/* ---------- onnozele invoer (deterministisch via rng) ---------- */
const EMO = '😀🎉💥🔥🤡🍕🚀💩👻🥶🦄🌈';
function emojiStr(n) { let s = ''; for (let i = 0; i < n; i++) s += EMO[rint(EMO.length)]; return s; }
function diep(n) { let o = {}, c = o; for (let i = 0; i < n; i++) { c.x = {}; c = c.x; } c.eind = 1; return o; }
function chaosWaarde(d) {
  if (d > 4) return rkeuze([1, 'x', true, null]);
  switch (rint(14)) {
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
    default: return chaosBody(d + 1);
  }
}
function chaosBody(d) {
  if (d > 3) return chaosWaarde(d);
  const velden = ['q', 'ref', 'code', 'id', 'aanbiederId', 'behandelingId', 'datum', 'tijd', 'bedrag', 'aantal',
    'supplierCode', 'pakketId', 'text', 'tekst', 'medisch', 'naam', 'personen', 'token', 'staffId', 'pin', 'niveau'];
  const body = {}; const k = rint(5);
  for (let i = 0; i < k; i++) body[rkeuze(velden)] = chaosWaarde(d + 1);
  return body;
}

/* ---------- de server ---------- */
let child = null;
const SRVLOG = path.join(TMP, 'server.log');
function rssMB(pid) { try { const m = fs.readFileSync('/proc/' + pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
// Echte vloer meten: forceer een volledige GC in de server (SIGUSR2 ->
// gc-hook.js) en lees het LEVENDE geheugen (heapUsed) dat het haakje wegschrijft.
// Waarom niet de RSS: V8 geeft vrijgekomen pagina's niet terug aan de OS, ook
// niet na een major GC -- de RSS blijft dan hoog terwijl de heap grotendeels
// leeg is (gemeten: 200 MB vrijgemaakt gaf maar ~38 MB RSS-daling). heapUsed na
// GC is de eerlijke lek-maat. We nemen meerdere metingen en houden de laagste.
const GC_OUT = path.join(TMP, 'gc.json');
async function heapNaGc(pid) {
  let laagst = Infinity;
  for (let i = 0; i < 4; i++) {
    let voor = 0; try { voor = fs.statSync(GC_OUT).mtimeMs; } catch (e) {}
    try { process.kill(pid, 'SIGUSR2'); } catch (e) {}
    // wacht tot het haakje een verse meting schreef (event-loop kan even vastzitten)
    for (let w = 0; w < 40; w++) {
      await new Promise(r => setTimeout(r, 100));
      try { const st = fs.statSync(GC_OUT); if (st.mtimeMs > voor) { const j = JSON.parse(fs.readFileSync(GC_OUT, 'utf8')); const mb = Math.round(j.heapUsed / 1048576); if (mb < laagst) laagst = mb; break; } } catch (e) {}
    }
  }
  return laagst === Infinity ? null : laagst;
}
function boot() {
  return new Promise((resolve, reject) => {
    const logfd = fs.openSync(SRVLOG, 'a');
    // --expose-gc + het gc-haakje: zo kan de harnas via SIGUSR2 een echte GC
    // forceren en de vloer (levend geheugen na opruimen) eerlijk meten.
    child = spawn(process.execPath, ['--expose-gc', '-r', path.join(__dirname, 'gc-hook.js'), '--experimental-sqlite', 'server/server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '',
        DATABASE_URL: DB, RTG_STORE: 'postgres', ANTHROPIC_API_KEY: '', RTG_ENC_KEY: '',
        NODE_OPTIONS: '--max-old-space-size=8192', DEMO_SUPPLIER: 'KIKUNOI', LOG_LEVEL: 'error',
        RTG_GC_OUT: GC_OUT },
      stdio: ['ignore', logfd, logfd]
    });
    child.on('exit', c => { if (c) reject(new Error('server stopte, code ' + c)); });
    (async () => {
      for (let i = 0; i < 300; i++) { const r = await verzoek('GET', '/api/health', null, null, 3000); if (r.status === 200) return resolve(); await new Promise(r => setTimeout(r, 250)); }
      reject(new Error('server niet gezond'));
    })();
  });
}
function stop() { return new Promise(r => { if (!child) return r(); child.removeAllListeners('exit'); child.on('exit', () => r()); child.kill('SIGKILL'); }); }

async function zaaiActiviteit(pool) {
  const NU = Date.now();
  const SUPS = ['KIKUNOI', 'PONTO', 'HOSHI', 'SAKURA', 'MKKX'];
  const naam = i => 'Valk ' + (i % LEDEN + 1), key = i => 'user-' + ((i % LEDEN) + 1);
  const schrijf = async (nm, bouw, n) => {
    const st = ['[']; for (let i = 0; i < n; i++) { st.push(JSON.stringify(bouw(i))); if (i < n - 1) st.push(','); } st.push(']');
    const json = st.join('');
    await pool.query("INSERT INTO kv(key,val,ver) VALUES($1,$2,nextval('kv_ver_seq')) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=nextval('kv_ver_seq')", [nm, json]);
    rij('kv ' + nm, nl(n) + ' - ' + MB(Buffer.byteLength(json)) + ' MB');
  };
  await schrijf('orders', i => ({ ref: 'RTG-O-S' + i.toString(36), pickup: 'T' + (i % 46656).toString(36), supplierCode: SUPS[i % 5], supplierName: SUPS[i % 5], type: 'restaurant', customerTier: 'rtg', customerKey: key(i * 7), customerCodename: naam(i * 7), items: [{ id: 1, name: 'Gazpacho', qty: 1, price: 16 }], total: 16, betaalMoment: 'vooraf', status: i % 9 ? 'geserveerd' : 'klaar', paid: true, at: new Date(NU - (i % 7776000) * 1000).toISOString() }), N_ORDERS);
  await schrijf('boekingen', i => ({ ref: 'RTG-B-S' + i.toString(36), kind: i % 2 ? 'ticket' : 'verblijf', supplierCode: SUPS[i % 5], customerKey: key(i * 3), customerCodename: naam(i * 3), service: { name: 'Dienst', soort: 'ticket' }, datum: new Date(NU + (i % 30) * 86400000).toISOString().slice(0, 10), tijd: '10:00', personen: 1 + i % 4, code: (i % 46656).toString(36), price: 40, paid: true, status: 'bevestigd', at: new Date(NU - (i % 5e6) * 1000).toISOString() }), N_BOEK);
  await schrijf('directBetalingen', i => ({ id: 'db' + i.toString(36), bedrag: 10 + i % 500, amount: 10 + i % 500, van: key(i * 5), aan: SUPS[i % 5], supplierCode: SUPS[i % 5], at: new Date(NU - (i % 4e6) * 1000).toISOString() }), N_BETAAL);
  await schrijf('betaalVerzoeken', i => ({ id: 'v' + i.toString(36), van: key(i), naar: key(i * 2), centen: 100 + (i % 9000), oms: 'Etentje', status: i % 3 ? 'open' : 'betaald', at: new Date(NU - (i % 3e6) * 1000).toISOString() }), N_VERZ);
  await schrijf('reviews', i => ({ id: 'r' + i.toString(36), supplierCode: SUPS[i % 5], rating: 1 + i % 5, text: 'Prima', codename: naam(i), at: new Date(NU - (i % 6e6) * 1000).toISOString() }), N_REVIEW);
  { const o = {}; for (let i = 0; i < N_MELD; i++) o[key(i)] = [{ icon: 'x', title: 'Melding', body: 'Iets', at: new Date(NU - i * 1000).toISOString(), read: false }]; const json = JSON.stringify(o); await pool.query("INSERT INTO kv(key,val,ver) VALUES($1,$2,nextval('kv_ver_seq')) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=nextval('kv_ver_seq')", ['notifications', json]); rij('kv notifications', nl(N_MELD) + ' - ' + MB(Buffer.byteLength(json)) + ' MB'); }
}

(async () => {
  kop('MEGA65-STORM (oordeel-harnas) - seed ' + RNGSTATE + ' - ' + nl(LEDEN) + ' leden + activiteit + chaos');
  const routes = alleRoutes();
  const dekking = new Map(routes.map(r => [r.method + ' ' + r.pad, 0]));
  rij('psql', PSQL);
  rij('endpoints uit de bron', nl(routes.length));

  // schema + zaaien
  kop('FASE A: schema + zaaien');
  await boot(); await new Promise(r => setTimeout(r, 800)); await stop();
  const pool = new Pool({ connectionString: DB, max: 4 });
  const tSeed = Date.now();
  psql('DROP INDEX IF EXISTS member_dir_codename_lower'); psql('DROP INDEX IF EXISTS member_dir_codename_trgm'); psql('TRUNCATE member_dir');
  for (let s = 1; s <= LEDEN; s += CHUNK) { const e = Math.min(s + CHUNK - 1, LEDEN); const tc = Date.now(); psql("INSERT INTO member_dir(key,codename,tier,codename_lower) SELECT 'user-'||g,'Valk '||g,(CASE WHEN g%3=0 THEN 'business' ELSE 'rtg' END),lower('valk '||g) FROM generate_series(" + s + "," + e + ") g"); process.stdout.write('  ' + ('member_dir +' + nl(e - s + 1)).padEnd(46) + ' \x1b[36m' + (Date.now() - tc) + ' ms\x1b[0m\n'); }
  psql('CREATE INDEX member_dir_codename_lower ON member_dir(codename_lower)');
  try { psql('CREATE EXTENSION IF NOT EXISTS pg_trgm'); psql('CREATE INDEX member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)'); } catch (e) {}
  await zaaiActiviteit(pool); await pool.end();
  rij('zaaien totaal', ((Date.now() - tSeed) / 1000).toFixed(0) + ' s');
  const ledenN = Number(psql('SELECT count(*) FROM member_dir'));
  const dbB = Number(psql('SELECT pg_database_size(current_database())'));

  // boot met de volle kast
  kop('FASE B: boot met ' + nl(ledenN) + ' leden + activiteit');
  const t0 = Date.now(); await boot();
  rij('boot-tijd', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await new Promise(r => setTimeout(r, 2500));
  const rssNa = rssMB(child.pid);
  rij('server-RAM na laden', rssNa + ' MB');
  rij('Postgres op schijf', MB(dbB) + ' MB');

  // tokens per rol
  const mLid = (await postJson('/api/login', { tier: 'rtg' })).token;
  const mBus = (await postJson('/api/login', { tier: 'business' })).token;
  const office = (await postJson('/api/office/login', { code: 'RTG-OFFICE' })).token;
  const sup = (await postJson('/api/supplier/login', { username: 'rahul', password: 'Imran' })).token;
  const tokVoor = { member: [mLid, mBus].filter(Boolean), supplier: [sup].filter(Boolean), office: [office].filter(Boolean), open: [null] };
  rij('tokens', 'member ' + tokVoor.member.length + ' - supplier ' + tokVoor.supplier.length + ' - office ' + tokVoor.office.length);

  // ---------- de chaos-soak ----------
  kop('FASE C: chaos-soak ~' + (SOAK_MS / 60000) + ' min - ' + WERKERS + ' werkers');
  const buckets = { ok: 0, herleid4xx: 0, r429: 0, r503: 0, s5xx: 0, stuk: 0 };
  const vijfxx = new Map();
  const perEnd = new Map();
  const rolLek = [];         // verkeerd-rol token dat 2xx kreeg op een beschermd endpoint
  let totaal = 0;
  const rssReeks = [];
  let stormEind = Date.now() + SOAK_MS;   // wordt per ronde gezet (hoofd-soak + lek-rondes)
  async function werker() {
    while (Date.now() < stormEind) {
      const r = routes[rint(routes.length)];
      // 1 op 5: bewust een verkeerd-rol token (rol-scheiding toetsen); anders het juiste
      const kruis = r.rol !== 'open' && rint(5) === 0;
      const rol = kruis ? rkeuze(['member', 'supplier', 'office'].filter(x => x !== r.rol)) : r.rol;
      const tk = rkeuze(tokVoor[rol].length ? tokVoor[rol] : tokVoor.member);
      const st = await verzoek(r.method, r.pad, tk, r.method === 'GET' ? null : chaosBody(0));
      totaal++; noteerLat(st.ms);
      // per-endpoint latentie (om de echte trage paden te vinden, niet te gokken)
      const pe = perEnd.get(r.pad) || { n: 0, som: 0, max: 0 }; pe.n++; pe.som += st.ms; if (st.ms > pe.max) pe.max = st.ms; perEnd.set(r.pad, pe);
      if (rol === r.rol) dekking.set(r.method + ' ' + r.pad, (dekking.get(r.method + ' ' + r.pad) || 0) + 1);
      const s = st.status;
      // Volgorde is cruciaal en eerlijk: 503 is de conventie voor "functie uit"
      // (geen serverfout) en 429 is rate-limiting -- die MOETEN vóór de generieke
      // >=500-check, anders telt een nette 503 ten onrechte als serverfout.
      if (s === 0) buckets.stuk++;
      else if (s === 503) buckets.r503++;
      else if (s === 429) buckets.r429++;
      else if (s >= 500) { buckets.s5xx++; vijfxx.set(r.pad, (vijfxx.get(r.pad) || 0) + 1); }
      else if (s >= 400) buckets.herleid4xx++;
      else { buckets.ok++; if (kruis && r.rol !== 'open') rolLek.push(r.method + ' ' + r.pad + ' [' + rol + '->' + s + ']'); }
      await new Promise(r => setTimeout(r, 1 + rint(4)));
    }
  }
  // Vloer bij een verse, rustige server (geforceerde GC -> heapUsed).
  const vloerVers = await heapNaGc(child.pid);
  const mon = setInterval(() => { const m = rssMB(child.pid); if (m) rssReeks.push(m); }, 3000);
  stormEind = Date.now() + SOAK_MS;
  await Promise.all(Array.from({ length: WERKERS }, werker));
  clearInterval(mon);

  // ---------- lek-check: meerdere IDENTIEKE rondes, vloer na elke ronde ----------
  // Eerlijk meten kan alleen als de last STOPT en de server uitademt: anders
  // meet je in-flight O(N)-responses die nog bereikbaar zijn (geen lek). En de
  // eenmalige opwarming (caches/afgeleide staat die bij eerste toegang vollopen)
  // is GEEN lek. Daarom: neem de vloer NA een opwarm-ronde als basis en herhaal
  // hetzelfde werk nog een paar rondes. Keert de vloer telkens terug naar
  // hetzelfde niveau, dan is er geen lek; loopt hij ronde na ronde door, wel.
  // We meten de helling met een kleinste-kwadraten-fit over alle rondes, zodat de
  // ~enkele % ruis (de heap 'ademt') uitmiddelt in plaats van een korte ronde te
  // laten exploderen. De vloer zelf is het MINIMUM over een venster (de diepste
  // GC), niet een enkele meting.
  async function rustVloer() {
    await new Promise(r => setTimeout(r, 5000));   // last uitademen
    let laagst = Infinity;
    for (let i = 0; i < 3; i++) { const h = await heapNaGc(child.pid); if (h != null && h < laagst) laagst = h; await new Promise(r => setTimeout(r, 1500)); }
    return laagst === Infinity ? null : laagst;
  }
  // De lek-rondes gebruiken bewust ALLEEN zware LEES-endpoints (de O(N)-paden waar
  // een lek zich zou verstoppen). Cruciaal en eerlijk: lezen voegt GEEN data toe,
  // dus een oplopende vloer kan dan niet "meer orders opgeslagen" zijn -- alleen
  // een echt lek. (Bij de gemengde hoofd-soak groeit de werkset legitiem doordat
  // chaos schrijft; dat is geen lek en zou de meting vertroebelen.)
  const leesPaden = [
    { m: 'POST', p: '/api/verkoop/mijn', rol: 'member' }, { m: 'POST', p: '/api/boekingen/mijn', rol: 'member' },
    { m: 'GET', p: '/api/notifications', rol: 'member' }, { m: 'POST', p: '/api/state', rol: 'member' },
    { m: 'POST', p: '/api/supplier/backoffice', rol: 'supplier' }, { m: 'POST', p: '/api/supplier/menu', rol: 'supplier' },
    { m: 'POST', p: '/api/supplier/state', rol: 'supplier' }, { m: 'POST', p: '/api/office/state', rol: 'office' },
    { m: 'POST', p: '/api/office/boardroom', rol: 'office' }, { m: 'POST', p: '/api/office/ontmoetingen', rol: 'office' }
  ];
  async function leesWerker() {
    while (Date.now() < stormEind) {
      const r = leesPaden[rint(leesPaden.length)];
      const tk = rkeuze(tokVoor[r.rol].length ? tokVoor[r.rol] : tokVoor.member);
      const st = await verzoek(r.m, r.p, tk, r.m === 'GET' ? null : {});
      if (st.status >= 500) { buckets.s5xx++; vijfxx.set(r.p, (vijfxx.get(r.p) || 0) + 1); }
      await new Promise(res => setTimeout(res, 1 + rint(4)));
    }
  }
  async function lekRonde(ms) { stormEind = Date.now() + ms; await Promise.all(Array.from({ length: WERKERS }, leesWerker)); return rustVloer(); }
  const lekMin = LEK_MS / 60000;
  const vloers = [await rustVloer()];            // vloer na de hoofd-soak (opgewarmd)
  for (let i = 0; i < LEK_RONDES; i++) vloers.push(await lekRonde(LEK_MS));
  const vloer1 = vloers[0];
  // kleinste-kwadraten-helling (MB per minuut) over ALLEEN de identieke lek-rondes.
  // De eerste vloer (na de langere, zwaardere hoofd-soak) laten we buiten de fit:
  // die draagt nog opwarming en is geen gelijke ronde. Zo meet de helling puur of
  // hetzelfde werk telkens naar dezelfde vloer terugkeert (geen lek) of doorloopt.
  const ys = vloers.slice(1);                       // de identieke rondes
  const xs = ys.map((_, i) => i * lekMin);
  const xm = xs.reduce((a, b) => a + b, 0) / xs.length, ym = ys.reduce((a, b) => a + b, 0) / ys.length;
  let tel = 0, noem = 0; for (let i = 0; i < xs.length; i++) { tel += (xs[i] - xm) * (ys[i] - ym); noem += (xs[i] - xm) ** 2; }
  const lekHelling = noem > 0 ? tel / noem : 0;

  // ---------- meting ----------
  kop('FASE D: meting');
  rij('afgehandelde calls', nl(totaal) + '  (~' + Math.round(totaal / (SOAK_MS / 1000)) + '/s)');
  rij('  2xx / herleide 4xx', nl(buckets.ok) + ' / ' + nl(buckets.herleid4xx));
  rij('  429 (rate-limit) / 503 (feature-uit)', nl(buckets.r429) + ' / ' + nl(buckets.r503));
  rij('  timeout/afgekapt (>10s)', nl(buckets.stuk));
  rij('  5xx (SERVERFOUTEN)', buckets.s5xx === 0 ? '0' : '\x1b[31m' + buckets.s5xx + '\x1b[0m');
  if (vijfxx.size) for (const [p, n] of [...vijfxx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) rij('    5xx bij', p + ' (' + n + 'x)');
  rij('latentie p50/p95/p99/p999/max', pct(0.5) + ' / ' + pct(0.95) + ' / ' + pct(0.99) + ' / ' + pct(0.999) + ' / ' + latMax + ' ms');
  const traag = [...perEnd.entries()].filter(([, v]) => v.n >= 5).map(([p, v]) => ({ p, gem: v.som / v.n, max: v.max, n: v.n })).sort((a, b) => b.gem - a.gem).slice(0, 12);
  console.log('  \x1b[2mtraagste endpoints (gem ms, max, n):\x1b[0m');
  for (const t of traag) console.log('    ' + String(Math.round(t.gem)).padStart(5) + ' ms  (max ' + String(t.max).padStart(5) + ', n ' + t.n + ')  ' + t.p);
  const dal = Math.min(...rssReeks), piek = Math.max(...rssReeks), med = [...rssReeks].sort((a, b) => a - b)[rssReeks.length >> 1];
  rij('RAM (RSS) dal/mediaan/piek', dal + ' / ' + med + ' / ' + piek + ' MB');
  rij('heapUsed vers / opgewarmd (na GC)', vloerVers + ' -> ' + vloer1 + ' MB (eenmalige opwarming ' + (vloer1 - vloerVers) + ' MB)');
  rij('heapUsed lek-vloeren per ronde', vloers.join(' -> ') + ' MB (' + lekHelling.toFixed(1) + ' MB/min fit)');
  const onbereikt = [...dekking.entries()].filter(([, n]) => n < SLO_DEKKING);
  rij('endpoints < ' + SLO_DEKKING + 'x geraakt (juiste rol)', nl(onbereikt.length) + ' / ' + nl(routes.length));

  // ---------- OORDEEL (hard) ----------
  kop('OORDEEL (drempels; faalt er een, dan exitcode 1)');
  const verdicten = [];
  const v = (naam, ok, detail) => { verdicten.push(ok); console.log('  ' + (ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m') + '  ' + naam.padEnd(30) + ' \x1b[2m' + detail + '\x1b[0m'); };
  v('ROBUUSTHEID (0 x 5xx)', buckets.s5xx === 0, buckets.s5xx + ' onverwachte serverfouten');
  v('ROL-SCHEIDING', rolLek.length === 0, rolLek.length ? rolLek.slice(0, 8).join(', ') : 'geen verkeerd-rol token kreeg 2xx');
  v('DEKKING (>= ' + SLO_DEKKING + 'x elk endpoint)', onbereikt.length === 0, onbereikt.length + ' endpoints te weinig geraakt' + (onbereikt.length ? ': ' + onbereikt.slice(0, 6).map(e => e[0]).join(', ') : ''));
  v('GEHEUGEN (geen lek)', lekHelling <= SLO_VLOER, 'vloer-helling over ' + LEK_RONDES + ' identieke rondes ' + lekHelling.toFixed(1) + ' MB/min (drempel ' + SLO_VLOER + '); eenmalige opwarming ' + (vloer1 - vloerVers) + ' MB telt niet mee');
  v('LATENTIE (p99 <= ' + SLO_P99_MS + 'ms)', pctMs(0.99) <= SLO_P99_MS, 'p99 = ' + pct(0.99) + ' ms');

  kop('WAT DEZE TEST NIET BEWIJST (eerlijk)');
  for (const l of [
    'Meet de ledengids op schaal (65M buiten RAM) + een activiteitslaag; GEEN echte productie-workload.',
    'Een node, een Postgres, fsync UIT (dat meet laadsnelheid en gedrag, niet duurzaamheid).',
    'De activiteit is rechtstreeks in de kv-opslag gezaaid, niet via de echte schrijfpaden.',
    'Chaos = rommel-invoer: dit toetst robuustheid (geen crash), NIET functionele juistheid.',
    'Latentie/doorvoer gelden voor DEZE machine en dit ene werkpunt; geen capaciteitsgarantie.'
  ]) console.log('  \x1b[2m- ' + l + '\x1b[0m');

  kop('SAMENVATTING');
  rij('leden in de gids (buiten RAM)', nl(ledenN));
  rij('server-RAM', rssNa + ' MB na laden, ' + med + ' MB mediaan / ' + piek + ' MB piek onder last');
  rij('opslag (Postgres, schijf)', MB(dbB) + ' MB');
  rij('endpoints bestookt', nl(routes.length) + ' (waarvan ' + nl(routes.length - onbereikt.length) + ' voldoende gedekt)');
  const gezakt = verdicten.filter(x => !x).length;
  rij('OORDEEL', gezakt === 0 ? '\x1b[32mALLES PASS\x1b[0m' : '\x1b[31m' + gezakt + ' DREMPEL(S) GEZAKT\x1b[0m');

  await stop();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exitCode = gezakt === 0 ? 0 : 1;
  console.log('\nklaar (exit ' + (process.exitCode) + ')');
})().catch(async e => { console.error('FOUT:', e.message); await stop(); process.exit(2); });

// exacte-ms percentiel voor de SLO-vergelijking (bovengrens van de bucket)
function pctMs(q) { let doel = q * latN, c = 0; for (let i = 0; i < GRENZEN.length; i++) { c += hist[i]; if (c >= doel) return GRENZEN[i] === Infinity ? latMax : GRENZEN[i]; } return latMax; }
