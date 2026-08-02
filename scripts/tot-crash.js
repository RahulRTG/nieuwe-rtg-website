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

   WAT HET RAPPORTEERT (ook zonder harde crash): elk endpoint dat een ECHTE
   serverfout (500/502/504) gaf, met een voorbeeld van de rommel die het brak --
   de kandidaat-bugs om te harden. Een 503 ("kom zo terug") is GEEN bug maar de
   immuunreactie van De Wacht (kern/wacht.js), die onder een flood bewust load
   afwerpt; die telt apart mee als een gezond signaal, niet als kandidaat-bug.

   EN HET WEET WANNEER HET ZICHZELF MEET. Werkers verdubbelen loopt een keer
   dood op de client: duizenden sockets in EEN Node-proces leveren minder druk op
   dan honderd, en van buiten ziet dat er identiek uit aan een server die het
   niet meer trekt. Dit harnas heeft daar op gelogen -- "24 / 24 rondes gehaald,
   geen crash t/m 4.000 werkers", terwijl er in die rondes tien verzoeken per
   twaalf seconden aankwamen. Sinds ronde-oordeel scripts/lib/verzadiging.js
   erbij zit, telt alleen een ronde mee waarin er ECHT druk stond, en stopt hij
   met de mededeling zodra hij zijn eigen client meet in plaats van de server.

   Deterministisch (seeded), zonder externe database (sqlite), draait overal.
   Draai: node scripts/tot-crash.js   (env: TOTCRASH_RONDES, TOTCRASH_RONDE_MS,
   TOTCRASH_WERKERS, TOTCRASH_MAX_WERKERS, TOTCRASH_SEED, TOTCRASH_PORT). */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');
const { beoordeelRonde } = require('./lib/verzadiging');

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
/* Meet het serverproces van binnenuit: heap-na-GC (het lek) en de piek van de
   event-loop-stilstand (de rem). De loopmeting hoort bij de EERSTE dump: die
   dekt de ronde die net voorbij is, de twee dumps erna dekken alleen de
   milliseconden ertussen.

   De loopwaarde van de EERSTE ronde dekt ook het opstarten en het zaaien van de
   database, en staat daarom altijd hoog (seconden). Dat is geen meetfout maar
   een venster dat nu eenmaal bij het opstarten begint; ronde 1 kan sowieso niet
   verzadigd zijn, want er is dan nog geen piek om tegen af te zetten. */
async function meetServer() {
  let laag = Infinity, lus = null;
  for (let i = 0; i < 3; i++) {
    let voor = 0; try { voor = fs.statSync(GC_OUT).mtimeMs; } catch (e) {}
    try { process.kill(child.pid, 'SIGUSR2'); } catch (e) {}
    for (let w = 0; w < 40; w++) {
      await new Promise(r => setTimeout(r, 100));
      try {
        const st = fs.statSync(GC_OUT);
        if (st.mtimeMs > voor) {
          const d = JSON.parse(fs.readFileSync(GC_OUT, 'utf8'));
          const mb = Math.round(d.heapUsed / 1048576);
          if (mb < laag) laag = mb;
          if (i === 0 && typeof d.lusMs === 'number') lus = d.lusMs;
          break;
        }
      } catch (e) {}
    }
  }
  return { heap: laag === Infinity ? null : laag, lusMs: lus };
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
  // /api/pay/gezond geeft 200 als het grootboek sluit, 500 als het NIET sluit.
  // Onder de storm kan De Wacht 503 "kom zo terug" serveren (L7-lastafworp); dat is
  // geen geldfout -- dan even opnieuw tot de afworp zakt (de storm is voorbij tussen
  // de rondes, dus dat gebeurt snel).
  let pay = { status: 0 };
  for (let i = 0; i < 10; i++) { pay = await verzoek('GET', '/api/pay/gezond', null, null, 5000); if (pay.status === 200 || pay.status === 500) break; await new Promise(r => setTimeout(r, 400)); }
  if (pay.status === 500) return { ok: false, wat: 'pay-grootboek sluit niet (/api/pay/gezond 500)' };
  if (pay.status !== 200) return { ok: true, onzeker: 'pay-poort gaf ' + pay.status + ' (afworp), niet als geldfout geteld' };
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

  const ooit5xx = new Map(); // pad -> { n, sample }  (ECHTE serverfouten: 500/502/504)
  let heapBasis = null, totaalReq = 0, breuk = null, piekWerkers = 0, totaalShed = 0;
  /* De verzadigingspoort. piekReq is de hoogste doorvoer die dit harnas ooit
     heeft gehaald; zakt een ronde daar ver onder terwijl de server aantoonbaar
     rustig is, dan meet het harnas zichzelf. Zie scripts/lib/verzadiging.js. */
  let piekReq = 0, vorigeWerkers = null, drukRondes = 0, piekDrukWerkers = 0, drukReq = 0;
  let zonderDruk = 0, verzadiging = null, gedraaid = 0;
  const NIET_DRUK_OP_RIJ = 2; // twee rondes op rij zonder druk: doorgaan is zinloos

  for (let r = 0; r < RONDES && !breuk; r++) {
    const werkers = Math.min(MAX_WERKERS, BASIS * Math.pow(2, r));
    piekWerkers = werkers; gedraaid = r + 1;
    const eind = Date.now() + RONDE_MS;
    let req = 0, fault = 0, shed = 0, geen = 0;
    async function werker() {
      while (Date.now() < eind && !gestopt) {
        const rt = routes[rint(routes.length)];
        // juiste rol + soms bewust de verkeerde rol (rol-scheiding onder druk)
        const rolPool = rng() < 0.75 ? T[rt.rol] : rkeuze([T.member, T.supplier, T.office, T.open]);
        const tk = rkeuze(rolPool.length ? rolPool : T.open);
        const b = rt.schakel ? { aan: true } : (rt.method === 'GET' ? null : body(0, r));
        const st = await verzoek(rt.method, rt.pad, tk, b);
        req++;
        // 503 = De Wacht die onder de flood bewust load afwerpt ("kom zo terug") --
        // dat is JUIST gedrag (zelfbescherming), geen bug. Alleen 500/502/504 zijn
        // echte serverfouten die we als kandidaat-bug rapporteren.
        if (st.status === 503) shed++;
        else if (st.status >= 500) { fault++; const e = ooit5xx.get(rt.pad) || { n: 0, sample: null }; e.n++; if (!e.sample) { try { e.sample = JSON.stringify(b).slice(0, 200); } catch (x) { e.sample = '<onserialiseerbaar>'; } } ooit5xx.set(rt.pad, e); }
        else if (st.status === 0) geen++;
      }
    }
    await Promise.all(Array.from({ length: werkers }, werker));
    totaalReq += req; totaalShed += shed;

    // --- de gezondheids-poort na de ronde ---
    if (gestopt) { breuk = { wat: 'DE SERVER VIEL OM (proces stopte, code ' + gestopt.code + (gestopt.signal ? ' / ' + gestopt.signal : '') + ')', ronde: r }; break; }
    if (!(await leeft())) { breuk = { wat: 'DE SERVER HANGT (/api/ready antwoordt niet meer)', ronde: r }; break; }
    const fout = nieuweFouten();
    if (fout.length) { breuk = { wat: 'ONAFGEVANGEN FOUT in het serverlog', ronde: r, log: fout }; break; }
    const geld = await geldKlopt(office);
    if (!geld.ok) { breuk = { wat: 'GELD KLOPT NIET MEER: ' + geld.wat, ronde: r }; break; }
    const { heap, lusMs } = await meetServer(); if (heapBasis == null) heapBasis = heap;
    // lek: heap-na-GC ruim boven de startvloer terwijl de druk terugviel naar rust
    if (heap != null && heapBasis != null && heap > heapBasis * 3 && heap > heapBasis + 400) { breuk = { wat: 'GEHEUGENLEK: heap-na-GC ' + heap + ' MB (start ' + heapBasis + ' MB) -- klimt richting OOM', ronde: r }; break; }

    /* --- meet ik de server nog, of mezelf? --- */
    const oordeel = beoordeelRonde({ werkers, req, shed, fault, heap, lusMs }, { piekReq, heapBasis, vorigeWerkers });
    vorigeWerkers = werkers;
    if (oordeel.oordeel === 'druk') {
      drukRondes++; drukReq += req; piekDrukWerkers = Math.max(piekDrukWerkers, werkers); zonderDruk = 0;
      if (req > piekReq) piekReq = req;
    } else {
      zonderDruk++;
      if (!verzadiging) verzadiging = { ronde: r, oordeel: oordeel.oordeel, reden: oordeel.reden };
    }

    const merk = oordeel.oordeel === 'druk' ? ''
      : (oordeel.oordeel === 'verzadigd' ? ' \x1b[33m<- CLIENT VERZADIGD, deze ronde meet de client\x1b[36m'
        : ' \x1b[33m<- ONZEKER, niet vast te stellen wie de rem was\x1b[36m');
    rij('ronde ' + (r + 1) + '  ' + nl(werkers) + ' werkers', nl(req) + ' req (' + Math.round(req / (RONDE_MS / 1000)) + '/s) | serverfout ' + fault + ' | 503-afworp ' + shed + ' | geen-antw ' + geen + ' | heap ' + heap + ' MB | loop ' + (lusMs == null ? '?' : lusMs + ' ms') + ' | rss ' + rssMB() + ' MB' + merk);

    /* Twee rondes op rij zonder echte druk: verder tellen is liegen. Stoppen en
       het zeggen is de enige eerlijke uitkomst -- meer werkers helpen niet, want
       de werkers zijn juist het probleem. */
    if (zonderDruk >= NIET_DRUK_OP_RIJ) { verzadiging.gestopt = true; break; }
  }

  kop('UITKOMST');
  rij('rondes gedraaid', gedraaid + ' / ' + RONDES);
  /* HET GETAL DAT ERTOE DOET. "Rondes gedraaid" zegt hoe vaak de lus rondging;
     alleen dit zegt hoe vaak er ECHT druk op de server stond. Die twee liepen
     uit elkaar en het harnas meldde jarenlang het verkeerde van de twee. */
  rij('rondes met ECHTE druk', drukRondes + ' / ' + RONDES + (drukRondes < RONDES ? '  (de rest mat de client, niet de server)' : ''));
  rij('piek-werkers gevraagd', nl(piekWerkers));
  rij('piek-werkers die AANKWAMEN', nl(piekDrukWerkers) + (piekDrukWerkers < piekWerkers ? '  <- dit is de druk die de server werkelijk heeft gezien' : ''));
  rij('verzoeken totaal', nl(totaalReq) + (drukReq < totaalReq ? ', waarvan ' + nl(drukReq) + ' onder echte druk' : ''));
  // 503-afworp is geen bug maar de immuunreactie (De Wacht) die onder de flood
  // bewust load afwerpt -- apart gerapporteerd als een GEZOND signaal.
  if (totaalShed) rij('503-lastafworp (De Wacht)', nl(totaalShed) + ' verzoeken afgeworpen onder de storm -- correct, geen bug');
  if (ooit5xx.size) {
    kop('ECHTE SERVERFOUTEN (500/502/504) -- bugs om te hardden naar 4xx:');
    const lijst = [...ooit5xx.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20);
    for (const [pad, e] of lijst) rij(pad + '  (' + e.n + 'x)', e.sample);
  } else rij('serverfouten (500/502/504)', 'geen -- alle rommel met 4xx afgewezen of onder afworp (503)');

  await stop();
  // TOTCRASH_KEEPLOG=1 bewaart het serverlog (met de stacktraces van elke 5xx)
  // zodat je de kandidaat-bugs kunt naspeuren; anders ruimen we netjes op.
  if (process.env.TOTCRASH_KEEPLOG === '1') rij('serverlog bewaard', SRVLOG);
  else { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }

  if (breuk) {
    console.log('\n\x1b[1;31m[tot-crash] GEBROKEN in ronde ' + (breuk.ronde + 1) + ': ' + breuk.wat + '\x1b[0m');
    if (breuk.log) for (const l of breuk.log) console.log('  \x1b[31m' + l + '\x1b[0m');
    console.log('  Fix deze en draai opnieuw -- dan vindt hij de volgende.');
    process.exit(1);
  }
  /* DE SLOTREGEL MAG NOOIT MEER MEER BEWEREN DAN ER GEMETEN IS. Hij noemde het
     aantal GEVRAAGDE werkers ("geen crash t/m 4.000 werkers") terwijl er in die
     rondes tien verzoeken per twaalf seconden aankwamen. Wat er staat is nu wat
     de server heeft gezien, en niet wat het harnas had bedoeld. */
  console.log('\n\x1b[1;32m[tot-crash] GEEN harde crash t/m ' + nl(piekDrukWerkers) + ' werkers en ' + nl(drukReq) + ' verzoeken onder echte druk.\x1b[0m');
  if (verzadiging && verzadiging.gestopt) {
    console.log('\x1b[1;33m[tot-crash] GESTOPT IN RONDE ' + (verzadiging.ronde + 1) + ': vanaf daar meet dit harnas zijn eigen client, niet de server.\x1b[0m');
    console.log('  \x1b[33m' + verzadiging.reden + '\x1b[0m');
    console.log('  \x1b[2mMeer werkers helpen hier niet: de werkers ZIJN de rem. Wil je verder omhoog,');
    console.log('  dan moet de druk per socket omhoog (hergebruik, minder sockets, meer verzoeken');
    console.log('  per socket) of moet de storm vanaf meerdere machines komen.\x1b[0m');
  } else if (verzadiging) {
    console.log('  \x1b[2mLet op: ronde ' + (verzadiging.ronde + 1) + ' telde niet als druk (' + verzadiging.oordeel + ') en is uit de tellingen gehouden.\x1b[0m');
  } else {
    console.log('  \x1b[2mDraai zwaarder met TOTCRASH_RONDES / TOTCRASH_MAX_WERKERS voor meer druk.\x1b[0m');
  }
  process.exit(0);
})().catch(async e => { console.error('\n[tot-crash] uitzondering:', e && e.message); try { await stop(); } catch (x) {} process.exit(2); });
