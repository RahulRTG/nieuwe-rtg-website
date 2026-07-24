/* ============================================================================
   TOT CRASH -- de escalerende bug-jager op weg naar 100 miljoen.

   Anders dan de Beproeving (die op één vast volume harde drempels toetst) draait
   dit harnas de echte server op en DRAAIT DE DRUK STEEDS VERDER OP, ronde na ronde:
   meer gelijktijdige werkers, grotere en gemenere rommel-invoer, tegen ELK endpoint
   uit de bron, met de juiste én verkeerde rol. Het stopt bij het EERSTE echte breken
   en wijst de plek aan -- zodat je de bug fixt, opnieuw draait, en de volgende vindt.
   Zo trek je richting 100M alle bugs eruit.

   WAT TELT ALS "BREKEN" (harde stop, exitcode 1):
     1. de server valt om          (het proces stopt onverwacht)
     2. de server hangt            (/api/ready antwoordt niet meer)
     3. het geld klopt niet meer   (/api/pay/gezond of de bank sluit niet -> som!=0)
     4. een onafgevangen fout       (Uncaught/unhandledRejection in het serverlog)
     5. een geheugenlek            (heap-na-GC blijft klimmen -> OOM op schaal)

   WAT HET RAPPORTEERT (ook zonder harde crash): elk endpoint dat ooit 5xx gaf, met
   een voorbeeld van de rommel die het brak -- de kandidaat-bugs om te harden.

   Deterministisch (seeded), zonder externe database (sqlite), draait overal.
   Draai: node scripts/tot-crash.js   (env: TOTCRASH_RONDES, TOTCRASH_RONDE_MS,
   TOTCRASH_WERKERS, TOTCRASH_MAX_WERKERS, TOTCRASH_SEED, TOTCRASH_PORT). */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TOTCRASH_PORT || 4091);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-totcrash-'));
const RONDES = Number(process.env.TOTCRASH_RONDES || 14);
const RONDE_MS = Number(process.env.TOTCRASH_RONDE_MS || 9000);
const BASIS = Number(process.env.TOTCRASH_WERKERS || 8);
const MAX_WERKERS = Number(process.env.TOTCRASH_MAX_WERKERS || 1500);
const SRVLOG = path.join(TMP, 'server.log');
const GC_OUT = path.join(TMP, 'gc.json');

let RNG = (Number(process.env.TOTCRASH_SEED) || 987654321) >>> 0;
function rng() { RNG |= 0; RNG = (RNG + 0x6D2B79F5) | 0; let t = Math.imul(RNG ^ (RNG >>> 15), 1 | RNG); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rint = n => Math.floor(rng() * n);
const rkeuze = a => a[rint(a.length)];
const nl = n => Number(n).toLocaleString('nl-NL');
function kop(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }
function rij(k, v) { console.log('  ' + String(k).padEnd(40) + ' \x1b[36m' + v + '\x1b[0m'); }

/* ---------- http ---------- */
const agent = new http.Agent({ keepAlive: true, maxSockets: 4096 });
function verzoek(method, pad, token, body, timeoutMs) {
  return new Promise(resolve => {
    let data = null;
    try { data = method === 'GET' ? null : JSON.stringify(body === undefined ? {} : body); }
    catch (e) { data = '{}'; } // niet-serialiseerbare rommel: stuur leeg, het pad telt nog
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    let klaar = false;
    const af = s => { if (!klaar) { klaar = true; resolve({ status: s }); } };
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      const st = res.statusCode; res.on('data', () => {}); res.on('end', () => af(st)); res.on('error', () => af(st));
    });
    req.on('error', () => af(0));
    req.setTimeout(timeoutMs || 12000, () => { req.destroy(); af(0); });
    if (data) req.write(data); req.end();
  });
}
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

/* ---------- alle routes + hun rol uit de bron (zelfde ontdekking als de Beproeving) ---------- */
const SCHAKEL = ['/api/office/boardroom/alles', '/api/office/boardroom/fase', '/api/office/boardroom/functie', '/api/office/leveranciers', '/api/office/geld'];
const isSchakel = p => SCHAKEL.some(s => p.startsWith(s));
function alleRoutes() {
  const files = [];
  (function loop(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const s = fs.statSync(p); if (s.isDirectory()) loop(p); else if (n.endsWith('.js')) files.push(p); } })(path.join(ROOT, 'server'));
  const re = /app\.(get|post|put|delete)\(\s*'(\/api\/[a-zA-Z0-9/_:-]+)'\s*,\s*(?:express\.[a-zA-Z]+\([^)]*\)\s*,\s*)?([a-zA-Z]+)/g;
  const rol = { auth: 'member', supplierAuth: 'supplier', officeAuth: 'office', techAuth: 'office' };
  const set = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8'); let m;
    while ((m = re.exec(txt))) {
      const method = m[1].toUpperCase(); let pad = m[2];
      if (/\/stream|\/sse|events$/.test(pad) || pad.startsWith('/api/test/') || pad === '/api/health' || pad === '/api/ready') continue;
      pad = pad.replace(/:([a-zA-Z0-9_]+)/g, 'x1');
      set.set(method + ' ' + pad, { method, pad, rol: rol[m[3]] || 'open', schakel: isSchakel(pad) });
    }
  }
  return [...set.values()];
}

/* ---------- rommel-invoer, schaalt mee met de ronde ---------- */
const EMO = '😀🎉💥🔥🤡🍕🚀💩👻🥶🦄🌈';
const emoji = n => { let s = ''; for (let i = 0; i < n; i++) s += EMO[rint(EMO.length)]; return s; };
const diep = n => { let o = {}, c = o; for (let i = 0; i < n; i++) { c.x = {}; c = c.x; } c.eind = 1; return o; };
function waarde(d, sch) {
  if (d > 4) return rkeuze([1, 'x', true, null]);
  switch (rint(15)) {
    case 0: return emoji(rint(30) + 1);
    case 1: return '𝕏' + emoji(3) + ' <script>alert(1)</script>';
    case 2: return "'; DROP TABLE member_dir;-- " + emoji(2);
    case 3: return 'A'.repeat(Math.min(2000000, 2000 * (sch + 1) * (1 + rint(4)))); // gigastring groeit per ronde
    case 4: return -rint(1e9) - 1;
    case 5: return Number.MAX_SAFE_INTEGER * (rng() > 0.5 ? 1 : -1);
    case 6: return rkeuze([null, true, false, '', NaN, Infinity]);
    case 7: return diep(Math.min(400, 20 + sch * 12)); // nesting groeit per ronde
    case 8: return Array.from({ length: Math.min(4000, 20 + sch * 12) }, () => waarde(d + 1, sch));
    case 9: return { [emoji(2)]: waarde(d + 1, sch), aantal: -rint(999), q: emoji(1) };
    case 10: return '2026-99-99';
    case 11: return '../../etc/passwd';
    case 12: return '{{7*7}}${jndi:ldap://x}';
    default: return body(d + 1, sch);
  }
}
function body(d, sch) {
  if (d > 3) return waarde(d, sch);
  const velden = ['q', 'ref', 'code', 'id', 'datum', 'tijd', 'bedrag', 'centen', 'aantal', 'supplierCode', 'text', 'tekst', 'naam', 'personen', 'token', 'staffId', 'pin', 'niveau', 'iban', 'vanIban', 'naarIban', 'aan', 'soort'];
  const o = {}; const k = 1 + rint(6);
  for (let i = 0; i < k; i++) o[rkeuze(velden)] = waarde(d + 1, sch);
  return o;
}

/* ---------- de server ---------- */
let child = null, gestopt = null, logOffset = 0;
function boot() {
  return new Promise((resolve, reject) => {
    const logfd = fs.openSync(SRVLOG, 'a');
    const env = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '',
      ANTHROPIC_API_KEY: '', RTG_ENC_KEY: '', DEMO_SUPPLIER: 'KIKUNOI', LOG_LEVEL: 'error', RTG_GC_OUT: GC_OUT,
      NODE_OPTIONS: '--max-old-space-size=2048' }; // bewust krap: een lek slaat sneller toe (dat is de bedoeling)
    child = spawn(process.execPath, ['--expose-gc', '-r', path.join(__dirname, 'gc-hook.js'), '--experimental-sqlite', 'server/server.js'],
      { cwd: ROOT, env, stdio: ['ignore', logfd, logfd] });
    child.on('exit', (c, s) => { gestopt = { code: c, signal: s }; });
    (async () => {
      for (let i = 0; i < 300; i++) { if (gestopt) return reject(new Error('server stopte bij het opstarten (code ' + gestopt.code + ')')); const r = await verzoek('GET', '/api/ready', null, null, 3000); if (r.status === 200) return resolve(); await new Promise(r => setTimeout(r, 250)); }
      reject(new Error('server niet gereed'));
    })();
  });
}
function stop() { return new Promise(r => { if (!child) return r(); child.removeAllListeners('exit'); child.on('exit', () => r()); try { child.kill('SIGKILL'); } catch (e) {} child = null; }); }
function rssMB() { try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
async function heapNaGc() {
  let laag = Infinity;
  for (let i = 0; i < 3; i++) {
    let voor = 0; try { voor = fs.statSync(GC_OUT).mtimeMs; } catch (e) {}
    try { process.kill(child.pid, 'SIGUSR2'); } catch (e) {}
    for (let w = 0; w < 40; w++) { await new Promise(r => setTimeout(r, 100)); try { const st = fs.statSync(GC_OUT); if (st.mtimeMs > voor) { const mb = Math.round(JSON.parse(fs.readFileSync(GC_OUT, 'utf8')).heapUsed / 1048576); if (mb < laag) laag = mb; break; } } catch (e) {} }
  }
  return laag === Infinity ? null : laag;
}
// nieuwe onafgevangen fouten in het serverlog sinds de vorige ronde
function nieuweFouten() {
  let txt = ''; try { const b = fs.readFileSync(SRVLOG); txt = b.slice(logOffset).toString('utf8'); logOffset = b.length; } catch (e) { return []; }
  return txt.split('\n').filter(l => /Uncaught|unhandledRejection|UnhandledPromiseRejection|FATAL ERROR|out of memory|Allocation failed/i.test(l)).slice(0, 8);
}

async function tokens() {
  const T = { member: [null], supplier: [null], office: [null], open: [null] };
  try { const a = (await post('/api/login', { tier: 'rtg' })).data.token, b = (await post('/api/login', { tier: 'business' })).data.token; T.member = [a, b].filter(Boolean); } catch (e) {}
  try { T.supplier = [(await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token].filter(Boolean); } catch (e) {}
  try { T.office = [(await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token].filter(Boolean); } catch (e) {}
  if (!T.member.length) T.member = [null];
  if (!T.supplier.length) T.supplier = [null];
  if (!T.office.length) T.office = [null];
  return T;
}

/* ---------- de gezondheids-poort tussen de rondes ---------- */
async function geldKlopt(office) {
  const pay = await verzoek('GET', '/api/pay/gezond', null, null, 5000);
  if (pay.status !== 200) return { ok: false, wat: 'pay-grootboek sluit niet (/api/pay/gezond ' + pay.status + ')' };
  if (office) { const b = await post('/api/office/bank/gezond', {}, office); if (b.status === 200 && b.data && b.data.sluit && b.data.sluit.klopt === false) return { ok: false, wat: 'bank-grootboek sluit niet (som ' + b.data.sluit.som + ')' }; }
  return { ok: true };
}
async function leeft() { for (let i = 0; i < 6; i++) { const r = await verzoek('GET', '/api/ready', null, null, 4000); if (r.status === 200) return true; await new Promise(r => setTimeout(r, 500)); } return false; }

(async () => {
  kop('TOT CRASH -- escalerende bug-jager (sqlite, seeded)');
  rij('rondes', RONDES + ' x ' + (RONDE_MS / 1000) + ' s'); rij('start-werkers', BASIS + ' (verdubbelt per ronde, cap ' + nl(MAX_WERKERS) + ')');
  await boot();
  const routes = alleRoutes();
  const T = await tokens();
  await post('/api/office/boardroom/alles', { aan: true }, T.office[0]); // alles aan: raak de echte logica, niet de feature-poort
  const office = T.office[0];
  rij('endpoints uit de bron', nl(routes.length));
  rij('rollen', 'member ' + T.member.length + ' / supplier ' + T.supplier.length + ' / office ' + T.office.length + ' / open');
  const g0 = await geldKlopt(office); rij('geld bij start', g0.ok ? 'klopt' : g0.wat);
  logOffset = (() => { try { return fs.statSync(SRVLOG).size; } catch (e) { return 0; } })();

  const ooit5xx = new Map(); // pad -> { n, sample }
  let heapBasis = null, totaalReq = 0, breuk = null, piekWerkers = 0;

  for (let r = 0; r < RONDES && !breuk; r++) {
    const werkers = Math.min(MAX_WERKERS, BASIS * Math.pow(2, r));
    piekWerkers = werkers;
    const eind = Date.now() + RONDE_MS;
    let req = 0, s5xx = 0, geen = 0;
    async function werker() {
      while (Date.now() < eind && !gestopt) {
        const rt = routes[rint(routes.length)];
        // juiste rol + soms bewust de verkeerde rol (rol-scheiding onder druk)
        const rolPool = rng() < 0.75 ? T[rt.rol] : rkeuze([T.member, T.supplier, T.office, T.open]);
        const tk = rkeuze(rolPool.length ? rolPool : T.open);
        const b = rt.schakel ? { aan: true } : (rt.method === 'GET' ? null : body(0, r));
        const st = await verzoek(rt.method, rt.pad, tk, b);
        req++;
        if (st.status >= 500) { s5xx++; const e = ooit5xx.get(rt.pad) || { n: 0, sample: null }; e.n++; if (!e.sample) { try { e.sample = JSON.stringify(b).slice(0, 200); } catch (x) { e.sample = '<onserialiseerbaar>'; } } ooit5xx.set(rt.pad, e); }
        else if (st.status === 0) geen++;
      }
    }
    await Promise.all(Array.from({ length: werkers }, werker));
    totaalReq += req;

    // --- de gezondheids-poort na de ronde ---
    if (gestopt) { breuk = { wat: 'DE SERVER VIEL OM (proces stopte, code ' + gestopt.code + (gestopt.signal ? ' / ' + gestopt.signal : '') + ')', ronde: r }; break; }
    if (!(await leeft())) { breuk = { wat: 'DE SERVER HANGT (/api/ready antwoordt niet meer)', ronde: r }; break; }
    const fout = nieuweFouten();
    if (fout.length) { breuk = { wat: 'ONAFGEVANGEN FOUT in het serverlog', ronde: r, log: fout }; break; }
    const geld = await geldKlopt(office);
    if (!geld.ok) { breuk = { wat: 'GELD KLOPT NIET MEER: ' + geld.wat, ronde: r }; break; }
    const heap = await heapNaGc(); if (heapBasis == null) heapBasis = heap;
    // lek: heap-na-GC ruim boven de startvloer terwijl de druk terugviel naar rust
    if (heap != null && heapBasis != null && heap > heapBasis * 3 && heap > heapBasis + 400) { breuk = { wat: 'GEHEUGENLEK: heap-na-GC ' + heap + ' MB (start ' + heapBasis + ' MB) -- klimt richting OOM', ronde: r }; break; }

    rij('ronde ' + (r + 1) + '  ' + nl(werkers) + ' werkers', nl(req) + ' req (' + Math.round(req / (RONDE_MS / 1000)) + '/s) | 5xx ' + s5xx + ' | geen-antwoord ' + geen + ' | heap ' + heap + ' MB | rss ' + rssMB() + ' MB');
  }

  kop('UITKOMST');
  rij('rondes gehaald', (breuk ? breuk.ronde : RONDES) + ' / ' + RONDES);
  rij('piek-werkers', nl(piekWerkers)); rij('verzoeken totaal', nl(totaalReq));
  if (ooit5xx.size) {
    kop('KANDIDAAT-BUGS -- endpoints die 5xx gaven (hardden naar 4xx):');
    const lijst = [...ooit5xx.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20);
    for (const [pad, e] of lijst) rij(pad + '  (' + e.n + 'x)', e.sample);
  } else rij('5xx-endpoints', 'geen -- alle rommel netjes met 4xx afgewezen');

  await stop();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

  if (breuk) {
    console.log('\n\x1b[1;31m[tot-crash] GEBROKEN in ronde ' + (breuk.ronde + 1) + ': ' + breuk.wat + '\x1b[0m');
    if (breuk.log) for (const l of breuk.log) console.log('  \x1b[31m' + l + '\x1b[0m');
    console.log('  Fix deze en draai opnieuw -- dan vindt hij de volgende.');
    process.exit(1);
  }
  console.log('\n\x1b[1;32m[tot-crash] GEEN harde crash t/m ' + nl(piekWerkers) + ' werkers en ' + nl(totaalReq) + ' verzoeken. Draai zwaarder met TOTCRASH_RONDES / TOTCRASH_MAX_WERKERS voor meer druk.\x1b[0m');
  process.exit(0);
})().catch(async e => { console.error('\n[tot-crash] uitzondering:', e && e.message); try { await stop(); } catch (x) {} process.exit(2); });
