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
   - Met DATABASE_URL  -> POSTGRES-modus: 65.000.000 leden in de ledengids (buiten
     het RAM) + een miljoenenlaag aan activiteit. De echte mega-beproeving.
   - Zonder DATABASE_URL -> SQLITE-modus: draait overal (ook in CI), zonder externe
     database, op een kleiner volume. Elke morele en technische lat is identiek.
     Zo is de zwaarste test tegelijk de standaard die iedereen kan draaien.

   DE FASEN:
     0  KALIBRATIE   machine-ruis meten (de latentie-lat schaalt ermee mee).
     A  VOLUME       zaaien (65M dir + activiteit in Postgres) of vers booten
                     (sqlite); boot-tijd, RAM en schijf.
     B  GAUNTLET     ELK endpoint uit de bron, met het JUISTE rol-token, met elk
                     VERKEERDE rol-token (rol-scheiding), en met rommel-invoer
                     (emoji, gigastrings, XSS/SQL, diep genest). Percentielen,
                     5xx per endpoint, dekking.
     C  GELD         RTG Pay op de cent: opladen/sturen conserveert centen exact,
                     idempotentie schrijft nooit dubbel, en onrealistische
                     bedragen (negatief, gigantisch, NaN) worden geweigerd zonder
                     het saldo te raken.
     D  MISBRUIK     de morele beproeving. Elk dom/onethisch/onrealistisch
                     scenario dat het platform MOET weigeren, als harde assertie
                     (zie DE MISBRUIK-BEPROEVING hieronder).
     E  DUURZAAMHEID herstart de server met de volgeschreven kast en bewijst dat
                     het geld de herstart overleeft en idempotentie standhoudt.
     F  GEHEUGEN     lek-vloer over identieke lees-rondes (geen groei = geen lek).

   DE OORDELEN (elk een harde drempel; faalt er één, dan exitcode 1):
     ROBUUSTHEID   nul onverwachte 5xx (503 feature-uit en 429 tellen niet mee).
     ROL-SCHEIDING een verkeerd-rol token krijgt nooit 2xx op een beschermd pad.
     DEKKING       elk niet-uitgesloten endpoint minstens N keer geraakt.
     GELD          conservatie op de cent + idempotentie + weigering van onzin.
     MISBRUIK      elke morele beproeving gehaald (de AI raakt de kluis/infra
                   niet, beweegt geen geld zonder bevestiging, de identiteitskluis
                   blijft dicht, 18+ blijft 18+, de stad meet dingen geen mensen).
     DUURZAAMHEID  geld en idempotentie overleven de herstart.
     GEHEUGEN      de RAM-vloer stijgt niet over identieke rondes.
     LATENTIE      p99 onder de (met machine-ruis geschaalde) SLO.

   Draai (standaard, overal):   node --experimental-sqlite scripts/beproeving.js
   Draai (mega, 65M Postgres):  DATABASE_URL=postgres://... \
                                node --max-old-space-size=8192 scripts/beproeving.js
   Knoppen (env): MEGA_LEDEN, MEGA_CHUNK, SOAK_MIN, STORM_WERKERS, MEGA_SEED,
                  SLO_P99_MS (2000), SLO_DEKKING (3), SLO_VLOER_MBMIN (40),
                  MEGA_PSQL, RUIS_UIT (=1: schaal de latentie-lat niet mee).
   ============================================================================ */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.MEGA_PORT || 4090);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beproeving-'));
const DB = process.env.DATABASE_URL || process.env.PG_URL || '';
const MODE = DB ? 'postgres' : 'sqlite';
// In Postgres draaien we op mega volume; in sqlite blijft de ledengids in het
// proces (embedded-max) dus houden we het volume bewust klein maar reeel.
const LEDEN = Number(process.env.MEGA_LEDEN || (MODE === 'postgres' ? 65000000 : 0));
const CHUNK = Number(process.env.MEGA_CHUNK || 5000000);
const N_ORDERS = Number(process.env.MEGA_ORDERS || (MODE === 'postgres' ? 1000000 : 0));
const N_BOEK = Number(process.env.MEGA_BOEK || (MODE === 'postgres' ? 300000 : 0));
const N_BETAAL = Number(process.env.MEGA_BETAAL || (MODE === 'postgres' ? 200000 : 0));
const N_VERZ = Number(process.env.MEGA_VERZ || (MODE === 'postgres' ? 100000 : 0));
const N_MELD = Number(process.env.MEGA_MELD || (MODE === 'postgres' ? 100000 : 0));
const N_REVIEW = Number(process.env.MEGA_REVIEW || (MODE === 'postgres' ? 60000 : 0));
const SOAK_MS = Number(process.env.SOAK_MIN || (MODE === 'postgres' ? 20 : 3)) * 60000;
const WERKERS = Number(process.env.STORM_WERKERS || (MODE === 'postgres' ? 24 : 12));
const SLO_P99_MS = Number(process.env.SLO_P99_MS || 2000);
const SLO_DEKKING = Number(process.env.SLO_DEKKING || 3);
const SLO_VLOER = Number(process.env.SLO_VLOER_MBMIN || 40);
const LEK_MS = Number(process.env.LEK_MS || (MODE === 'postgres' ? 30000 : 15000));
const LEK_RONDES = Number(process.env.LEK_RONDES || (MODE === 'postgres' ? 3 : 2));

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
const GRENZEN = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 1000, 1600, 2600, 4200, 6800, 10000, Infinity];
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
// echte vloer meten: forceer een GC (SIGUSR2 -> gc-hook) en lees heapUsed
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
      for (let i = 0; i < 300; i++) { const r = await verzoek('GET', '/api/health', null, null, 3000); if (r.status === 200) return resolve(); await new Promise(r => setTimeout(r, 250)); }
      reject(new Error('server niet gezond'));
    })();
  });
}
function stop() { return new Promise(r => { if (!child) return r(); child.removeAllListeners('exit'); child.on('exit', () => r()); child.kill('SIGKILL'); child = null; }); }

/* ---------- Postgres: 65M + activiteit zaaien (alleen mega-modus) ---------- */
async function zaaiPostgres() {
  const { Pool } = require('pg');
  psql('DROP INDEX IF EXISTS member_dir_codename_lower'); psql('DROP INDEX IF EXISTS member_dir_codename_trgm'); psql('TRUNCATE member_dir');
  for (let s = 1; s <= LEDEN; s += CHUNK) {
    const e = Math.min(s + CHUNK - 1, LEDEN); const tc = Date.now();
    psql("INSERT INTO member_dir(key,codename,tier,codename_lower) SELECT 'user-'||g,'Valk '||g,(CASE WHEN g%3=0 THEN 'business' ELSE 'rtg' END),lower('valk '||g) FROM generate_series(" + s + "," + e + ") g");
    process.stdout.write('  ' + ('member_dir +' + nl(e - s + 1)).padEnd(46) + ' \x1b[36m' + (Date.now() - tc) + ' ms\x1b[0m\n');
  }
  psql('CREATE INDEX member_dir_codename_lower ON member_dir(codename_lower)');
  try { psql('CREATE EXTENSION IF NOT EXISTS pg_trgm'); psql('CREATE INDEX member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)'); } catch (e) {}
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

/* ---------- rol-tokens ophalen ---------- */
async function tokens() {
  const mLid = (await post('/api/login', { tier: 'rtg' })).data.token;
  const mBus = (await post('/api/login', { tier: 'business' })).data.token;
  const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token;
  const sup = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  return {
    member: [mLid, mBus].filter(Boolean), supplier: [sup].filter(Boolean),
    office: [office].filter(Boolean), open: [null], _lid: mLid
  };
}

/* ============================================================================
   DE MISBRUIK-BEPROEVING -- de morele lat.
   Elk scenario is een aanval die het platform MOET weigeren. Elke functie geeft
   { naam, ok, detail } terug; ok=false laat het hele oordeel zakken. We toetsen
   op ECHT gedrag tegen de draaiende server, niet op meningen.
   ============================================================================ */
async function misbruikBeproeving(tok) {
  const uit = [];
  const lid = tok._lid;

  // 1. De AI (het stuur) raakt de kluis en de infrastructuur NOOIT aan -- ook al
  //    vraagt het lid er expliciet om. VERBODEN-paden geven 403, niet 2xx.
  {
    const infra = ['/api/account/rollen', '/api/auth/login', '/api/techniek/status', '/api/boardroom/state', '/api/doos/sleutel', '/api/office/login'];
    const stuk = [];
    for (const pad of infra) {
      const r = await post('/api/member/doe', { pad, body: {} }, lid);
      // het stuur hoort dit botweg te weigeren (403), nooit uit te voeren (2xx)
      if (r.status >= 200 && r.status < 300 && r.data && r.data.ok && r.data.status < 400) stuk.push(pad + '->uitgevoerd');
      else if (r.status !== 403 && r.status !== 400) stuk.push(pad + '->' + r.status);
    }
    uit.push({ naam: 'AI raakt kluis/infra niet', ok: stuk.length === 0, detail: stuk.length ? stuk.join(', ') : 'accounts/techniek/boardroom/doos/auth geweigerd (403)' });
  }

  // 2. De AI beweegt GEEN geld zonder bevestiging: een geld-pad zonder bevestigd
  //    geeft 428 (bevestigNodig). Mét bevestiging is het 428 in elk geval weg.
  {
    const zonder = await post('/api/member/doe', { pad: '/api/pay/tik', body: { code: 'x', centen: 500 } }, lid);
    const met = await post('/api/member/doe', { pad: '/api/pay/tik', body: { code: 'x', centen: 500 }, bevestigd: true }, lid);
    const ok = zonder.status === 428 && zonder.data && zonder.data.bevestigNodig === true && met.status !== 428;
    uit.push({ naam: 'AI vraagt bevestiging voor geld', ok, detail: 'zonder=' + zonder.status + (zonder.data && zonder.data.bevestigNodig ? ' (bevestigNodig)' : '') + ', met=' + met.status });
  }

  // 3. Privacy by design: de identiteitskluis (echte naam bij een codenaam)
  //    blijft dicht voor niet-kantoor. Lid-token en gast (geen token) op
  //    /api/office/inzage krijgen nooit 2xx.
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

  // 5. 18+ blijft 18+: een lid zonder geverifieerde volwassen leeftijd kan het
  //    18+-spel Proost niet starten (403), en de weigering noemt de leeftijd.
  {
    const r = await post('/api/member/spel/nieuw', { soort: 'proost' }, lid);
    const tekst = (r.data && r.data.error) || '';
    const ok = !(r.status >= 200 && r.status < 300) && /18\+|volwassen|leeftijd/i.test(tekst);
    uit.push({ naam: '18+ blijft 18+ (Proost)', ok, detail: r.status + ' ' + (tekst.slice(0, 48) || '(geen leeftijd-reden)') });
  }

  // 6. De stad meet dingen, geen mensen: het stadsbeeld bevat geen persoons- of
  //    camera-identificatie. We scannen de hele payload op verboden sleutels.
  {
    const r = await post('/api/stad/bewoner', {}, lid);
    const blob = JSON.stringify(r.data || {});
    const verboden = ['camera', 'gezicht', 'kenteken', 'persoonsnummer', 'bsn', 'gezichtsherkenning', 'volgnummerpersoon'];
    const gevonden = verboden.filter(w => new RegExp(w, 'i').test(blob));
    // de route mag ook dicht zijn (gast) -- dat is geen lek; alleen echte
    // persoons-tracking in het beeld is fout.
    const ok = gevonden.length === 0;
    uit.push({ naam: 'Stad meet dingen, geen mensen', ok, detail: gevonden.length ? 'lek: ' + gevonden.join(', ') : 'geen persoons-/camera-velden in het stadsbeeld' });
  }

  return uit;
}

/* ============================================================================
   GELD-INTEGRITEIT -- op de cent, idempotent, en bestand tegen onzin.
   Twee verse leden-accounts (stabiele codenaam, dus ook na de herstart te
   herkennen); opladen en sturen conserveert centen exact; dezelfde idem-sleutel
   boekt nooit dubbel; en onrealistische bedragen worden geweigerd zonder het
   saldo te raken.  Geeft { fouten:[...], A, B, idemStuur } terug voor Fase E.
   ============================================================================ */
async function registreerAccount(merk) {
  const email = merk + '+' + Date.now().toString(36) + rint(1e6).toString(36) + '@beproeving.test';
  const ww = 'Geheim' + rint(1e6) + '!';
  const r = await post('/api/auth/register', { name: 'Beproeving ' + merk, email, phone: '06' + (10000000 + rint(8e7)), password: ww, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  return { email, ww, token: r.data && r.data.token, status: r.status };
}
async function saldoVan(token) { const r = await post('/api/pay/overzicht', {}, token); return { saldo: r.data && typeof r.data.saldo === 'number' ? r.data.saldo : null, codenaam: r.data && r.data.codenaam }; }

async function geldIntegriteit() {
  const fouten = [];
  const A = await registreerAccount('a'), B = await registreerAccount('b');
  if (!A.token || !B.token) { return { fouten: ['registratie mislukte (A=' + A.status + ', B=' + B.status + ')'], A, B }; }
  const bCode = (await saldoVan(B.token)).codenaam;
  if (!bCode) return { fouten: ['B heeft geen codenaam (wallet onbereikbaar)'], A, B };

  // opladen (5000 euro), met idem-sleutel
  const K1 = 'idem-oplaad-1';
  await post('/api/pay/oplaad', { centen: 500000, idem: K1 }, A.token);
  const naOplaad = (await saldoVan(A.token)).saldo;
  // DEZELFDE idem opnieuw: mag NIET dubbel opladen
  await post('/api/pay/oplaad', { centen: 500000, idem: K1 }, A.token);
  const naDubbel = (await saldoVan(A.token)).saldo;
  if (naDubbel !== naOplaad) fouten.push('idempotente oplaad boekte dubbel (' + naOplaad + ' -> ' + naDubbel + ')');

  // totaal in de twee wallets vóór het interne sturen
  const a0 = (await saldoVan(A.token)).saldo, b0 = (await saldoVan(B.token)).saldo;
  const totVoor = a0 + b0;
  // N kleine overboekingen A -> B (intern; moet centen exact conserveren)
  for (let i = 0; i < 25; i++) await post('/api/pay/stuur', { aan: bCode, centen: 1000, oms: 'test', idem: 'stuur-' + i }, A.token);
  const a1 = (await saldoVan(A.token)).saldo, b1 = (await saldoVan(B.token)).saldo;
  if (a1 + b1 !== totVoor) fouten.push('interne overboeking lekte centen (' + totVoor + ' -> ' + (a1 + b1) + ')');
  if (b1 - b0 !== 25000) fouten.push('B ontving niet exact 25000 centen (kreeg ' + (b1 - b0) + ')');

  // idempotente overboeking: dezelfde idem-sleutel opnieuw -> geen dubbele boeking
  const KS = 'idem-stuur-stabiel';
  await post('/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'idem', idem: KS }, A.token);
  const a2 = (await saldoVan(A.token)).saldo, b2 = (await saldoVan(B.token)).saldo;
  await post('/api/pay/stuur', { aan: bCode, centen: 7000, oms: 'idem', idem: KS }, A.token);
  const a3 = (await saldoVan(A.token)).saldo, b3 = (await saldoVan(B.token)).saldo;
  if (a3 !== a2 || b3 !== b2) fouten.push('idempotente overboeking boekte dubbel (A ' + a2 + '->' + a3 + ', B ' + b2 + '->' + b3 + ')');

  // ONREALISTISCHE bedragen: negatief, nul, gigantisch, NaN, string -> nette 4xx,
  // nooit 2xx, nooit 5xx, en het saldo van A blijft ongemoeid.
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
   HOOFDLOOP
   ============================================================================ */
(async () => {
  kop('DE BEPROEVING - ' + MODE.toUpperCase() + '-modus - seed ' + RNGSTATE + (MODE === 'postgres' ? ' - ' + nl(LEDEN) + ' leden + activiteit' : ' - sqlite (standaard, draait overal)'));
  const routes = alleRoutes();
  const dekking = new Map(routes.map(r => [r.method + ' ' + r.pad, 0]));
  rij('endpoints uit de bron', nl(routes.length));
  if (MODE === 'postgres') rij('psql', PSQL);

  // ---------- FASE A: VOLUME ----------
  kop('FASE A: VOLUME (' + MODE + ')');
  if (MODE === 'postgres') {
    await boot(); await new Promise(r => setTimeout(r, 800)); await stop();  // schema klaar
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

  // ---------- FASE B: GAUNTLET (endpoint-storm + chaos + rol-scheiding) ----------
  kop('FASE B: GAUNTLET - ~' + (SOAK_MS / 60000) + ' min - ' + WERKERS + ' werkers - elk endpoint, elke rol, rommel');
  const buckets = { ok: 0, herleid4xx: 0, r429: 0, r503: 0, s5xx: 0, stuk: 0 };
  const vijfxx = new Map(); const perEnd = new Map(); const rolLek = [];
  let totaal = 0; const rssReeks = [];
  let stormEind = Date.now() + SOAK_MS;
  async function raak(r, magKruisen) {
    const kruis = magKruisen && r.rol !== 'open' && rint(5) === 0;
    const rol = kruis ? rkeuze(['member', 'supplier', 'office'].filter(x => x !== r.rol)) : r.rol;
    const tk = rkeuze(tokVoor[rol].length ? tokVoor[rol] : tokVoor.member);
    const st = await verzoek(r.method, r.pad, tk, r.method === 'GET' ? null : chaosBody(0));
    totaal++; noteerLat(st.ms);
    const pe = perEnd.get(r.pad) || { n: 0, som: 0, max: 0 }; pe.n++; pe.som += st.ms; if (st.ms > pe.max) pe.max = st.ms; perEnd.set(r.pad, pe);
    if (rol === r.rol) dekking.set(r.method + ' ' + r.pad, (dekking.get(r.method + ' ' + r.pad) || 0) + 1);
    const s = st.status;
    if (s === 0) buckets.stuk++;
    else if (s === 503) buckets.r503++;
    else if (s === 429) buckets.r429++;
    else if (s >= 500) { buckets.s5xx++; vijfxx.set(r.pad, (vijfxx.get(r.pad) || 0) + 1); }
    else if (s >= 400) buckets.herleid4xx++;
    else { buckets.ok++; if (kruis && r.rol !== 'open') rolLek.push(r.method + ' ' + r.pad + ' [' + rol + '->' + s + ']'); }
    await new Promise(res => setTimeout(res, 1 + rint(4)));
  }
  async function werker(ix) {
    const mijnDeel = routes.filter((_, j) => j % WERKERS === ix);
    for (let ronde = 0; ronde < SLO_DEKKING; ronde++) for (const r of mijnDeel) { if (Date.now() >= stormEind) break; await raak(r, false); }
    while (Date.now() < stormEind) await raak(routes[rint(routes.length)], true);
  }
  const vloerVers = await heapNaGc(child.pid);
  const mon = setInterval(() => { const m = rssMB(child.pid); if (m) rssReeks.push(m); }, 3000);
  stormEind = Date.now() + SOAK_MS;
  await Promise.all(Array.from({ length: WERKERS }, (_, ix) => werker(ix)));
  clearInterval(mon);

  // ---------- FASE C: GELD ----------
  kop('FASE C: GELD - RTG Pay op de cent, idempotent, bestand tegen onzin');
  const geld = await geldIntegriteit();
  if (geld.fouten.length === 0) rij('geld-integriteit', 'conservatie + idempotentie + onzin-weigering: in orde');
  else for (const f of geld.fouten) rij('  GELD-FOUT', f);

  // ---------- FASE D: MISBRUIK ----------
  kop('FASE D: MISBRUIK-BEPROEVING - de morele lat');
  const misbruik = await misbruikBeproeving(tok);
  for (const m of misbruik) console.log('  ' + (m.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m') + '  ' + m.naam.padEnd(38) + ' \x1b[2m' + m.detail + '\x1b[0m');

  // ---------- FASE E: DUURZAAMHEID NA HERSTART ----------
  kop('FASE E: DUURZAAMHEID - herstart met de volle kast');
  const duurFouten = [];
  if (geld.A && geld.A.token && geld.bCode) {
    await stop(); const tB = Date.now(); await boot();
    rij('herstart-tijd', ((Date.now() - tB) / 1000).toFixed(1) + ' s');
    await new Promise(r => setTimeout(r, 1500));
    const herA = (await post('/api/auth/login', { login: geld.A.email, password: geld.A.ww })).data.token;
    const herB = (await post('/api/auth/login', { login: geld.B.email, password: geld.B.ww })).data.token;
    if (!herA || !herB) duurFouten.push('opnieuw inloggen na herstart mislukte');
    else {
      const sA = (await saldoVan(herA)).saldo, sB = (await saldoVan(herB)).saldo;
      if (sA !== geld.saldoA) duurFouten.push('saldo A overleefde de herstart niet (' + geld.saldoA + ' -> ' + sA + ')');
      if (sB !== geld.saldoB) duurFouten.push('saldo B overleefde de herstart niet (' + geld.saldoB + ' -> ' + sB + ')');
      // idempotentie over de herstart heen: dezelfde idem-sleutel opnieuw
      await post('/api/pay/stuur', { aan: geld.bCode, centen: 7000, oms: 'idem', idem: geld.idemStuur }, herA);
      const sA2 = (await saldoVan(herA)).saldo;
      if (sA2 !== sA) duurFouten.push('idempotentie overleefde de herstart niet (A ' + sA + ' -> ' + sA2 + ')');
    }
    if (duurFouten.length === 0) rij('duurzaamheid', 'geld en idempotentie overleefden de herstart');
    else for (const f of duurFouten) rij('  DUURZAAMHEID-FOUT', f);
  } else { duurFouten.push('geen geld-context (Fase C viel om); duurzaamheid niet te toetsen'); rij('  DUURZAAMHEID', 'overgeslagen: ' + duurFouten[0]); }

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
  rij('afgehandelde calls (gauntlet)', nl(totaal) + '  (~' + Math.round(totaal / (SOAK_MS / 1000)) + '/s)');
  rij('  2xx / herleide 4xx', nl(buckets.ok) + ' / ' + nl(buckets.herleid4xx));
  rij('  429 / 503 (rate-limit / feature-uit)', nl(buckets.r429) + ' / ' + nl(buckets.r503));
  rij('  timeout/afgekapt', nl(buckets.stuk));
  rij('  5xx (SERVERFOUTEN)', buckets.s5xx === 0 ? '0' : '\x1b[31m' + buckets.s5xx + '\x1b[0m');
  if (vijfxx.size) for (const [p, n] of [...vijfxx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) rij('    5xx bij', p + ' (' + n + 'x)');
  rij('latentie p50/p95/p99/max', pct(0.5) + ' / ' + pct(0.95) + ' / ' + pct(0.99) + ' / ' + latMax + ' ms');
  const dal = rssReeks.length ? Math.min(...rssReeks) : rssNa, piek = rssReeks.length ? Math.max(...rssReeks) : rssNa;
  rij('RAM (RSS) dal/piek onder last', dal + ' / ' + piek + ' MB');
  rij('heapUsed vers -> opgewarmd (na GC)', vloerVers + ' -> ' + vloers[0] + ' MB');
  rij('heapUsed lek-vloeren per ronde', vloers.join(' -> ') + ' MB (' + lekHelling.toFixed(1) + ' MB/min)');
  const onbereikt = [...dekking.entries()].filter(([, n]) => n < SLO_DEKKING);
  rij('endpoints < ' + SLO_DEKKING + 'x geraakt', nl(onbereikt.length) + ' / ' + nl(routes.length));

  // ---------- HET OORDEEL ----------
  kop('HET OORDEEL (drempels; faalt er een, dan exitcode 1)');
  const verdicten = [];
  const v = (naam, ok, detail) => { verdicten.push(ok); console.log('  ' + (ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m') + '  ' + naam.padEnd(16) + ' \x1b[2m' + detail + '\x1b[0m'); };
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

  kop('WAT DEZE TEST NIET BEWIJST (eerlijk)');
  for (const l of [
    'Eén node, ' + (MODE === 'postgres' ? 'één Postgres, fsync uit (laadsnelheid/gedrag, geen duurzaamheidsgarantie op schijf)' : 'sqlite in een tijdelijke map (geen echte productie-opslag)') + '.',
    'De activiteit is rechtstreeks gezaaid, niet via de echte schrijfpaden; chaos toetst robuustheid, geen functionele juistheid.',
    'De misbruik-beproeving dekt de zwaarste morele regels af, niet elke denkbare misbruikvorm.',
    'Latentie/doorvoer gelden voor DEZE machine en dit werkpunt; geen capaciteitsgarantie.',
    MODE === 'sqlite' ? 'Dit is de sqlite-standaard; de volle mega-schaal (65M) draai je met DATABASE_URL.' : 'Dit is de mega-schaal; de morele lat is identiek aan de sqlite-standaard.'
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
