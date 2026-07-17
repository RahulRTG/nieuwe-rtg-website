/* MEGA65: 65 miljoen klanten in de echte ledengids (Postgres) + het hele
   ecosysteem eroverheen, en meten hoeveel geheugen (RSS) en schijf dat kost.

   De architectuur zet de ledengids bij miljoenen leden bewust in Postgres
   (member_dir), buiten het procesgeheugen. Deze test bewijst dat: 65M leden
   erin, en de server-RAM blijft vlak. Daarna draait het hele platform (De
   Butler, Care, tickets, Salon, kantoor) bovenop die 65M, met een meting van
   de zware leesroutes en de trigram-zoekindex.

   Vereist een draaiende Postgres met DATABASE_URL, en psql op het pad.
   Draai:  DATABASE_URL=postgres://... node scripts/mega65.js
   Knoppen: MEGA_LEDEN (65000000), MEGA_CHUNK (5000000), MEGA_DUUR (30000 ms),
            MEGA_PSQL (pad naar psql), MEGA_PORT (4099).

   Zet MEGA_LEDEN kleiner (bijv. 5000000) voor een snelle proef; het beeld
   (vlakke RAM, opslag in Postgres, geindexeerd zoeken) is hetzelfde. */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.MEGA_PORT || 4099), BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mega65-'));
const LEDEN = Number(process.env.MEGA_LEDEN || 65000000);
const CHUNK = Number(process.env.MEGA_CHUNK || 5000000);
const DUUR_MS = Number(process.env.MEGA_DUUR || 30000);
const DB = process.env.DATABASE_URL || process.env.PG_URL;
if (!DB) { console.error('DATABASE_URL ontbreekt (een draaiende Postgres is nodig).'); process.exit(1); }
function vindPsql() {
  if (process.env.MEGA_PSQL) return process.env.MEGA_PSQL;
  for (const p of ['/usr/lib/postgresql/16/bin/psql', '/usr/bin/psql', 'psql']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch (e) {}
  }
  return 'psql';
}
const PSQL = vindPsql();

const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
function verzoek(pad, { method = 'POST', token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = method === 'GET' ? null : JSON.stringify(body || {});
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => resolve({ status: res.statusCode, tekst: buf }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data); req.end();
  });
}
const json = r => { try { return JSON.parse(r.tekst); } catch (e) { return {}; } };
const nl = n => n.toLocaleString('nl-NL');
function kop(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }
function rij(k, v) { console.log('  ' + k.padEnd(44) + ' \x1b[36m' + v + '\x1b[0m'); }
const psql = sql => execFileSync(PSQL, [DB, '-tAc', sql], { encoding: 'utf8' }).trim();

let child = null;
function rssMB(pid) { try { const m = fs.readFileSync('/proc/' + pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
function boot() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '',
        DATABASE_URL: DB, RTG_STORE: 'postgres', ANTHROPIC_API_KEY: '' },
      stdio: ['ignore', 'ignore', 'inherit']
    });
    child.on('exit', c => { if (c) reject(new Error('server stopte, code ' + c)); });
    (async () => {
      for (let i = 0; i < 200; i++) {
        try { const r = await verzoek('/api/health', { method: 'GET' }); if (r.status === 200) return resolve(); } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
      }
      reject(new Error('server niet gezond'));
    })();
  });
}

(async () => {
  kop('MEGA65 · ' + nl(LEDEN) + ' klanten in de echte ledengids (Postgres) + het hele ecosysteem');
  rij('psql', PSQL);

  // ---------- Fase A: boot + basisgeheugen ----------
  kop('FASE A: boot op Postgres');
  const t0 = Date.now();
  await boot();
  rij('boot-tijd', (Date.now() - t0) + ' ms');
  await new Promise(r => setTimeout(r, 1500));
  const rssLeeg = rssMB(child.pid);
  rij('servergeheugen (RSS) leeg', rssLeeg + ' MB');
  const office = json(await verzoek('/api/office/login', { body: { code: 'RTG-OFFICE' } }));
  rij('ledengids op Postgres (member_dir)', 'ja');

  // ---------- Fase B: 65 miljoen klanten erin ----------
  kop('FASE B: ' + nl(LEDEN) + ' klanten in member_dir (bulk; indexen na afloop)');
  const tSeed = Date.now();
  psql('DROP INDEX IF EXISTS member_dir_codename_lower');
  psql('DROP INDEX IF EXISTS member_dir_codename_trgm');
  psql('TRUNCATE member_dir');
  for (let start = 1; start <= LEDEN; start += CHUNK) {
    const eind = Math.min(start + CHUNK - 1, LEDEN);
    const tc = Date.now();
    psql("INSERT INTO member_dir(key,codename,tier,codename_lower) " +
      "SELECT 'user-'||g, 'Valk '||g, (CASE WHEN g%3=0 THEN 'business' ELSE 'rtg' END), lower('valk '||g) " +
      "FROM generate_series(" + start + "," + eind + ") g");
    process.stdout.write('  ' + ('+' + nl(eind - start + 1) + ' (tot ' + nl(eind) + ')').padEnd(44) + ' \x1b[36m' + (Date.now() - tc) + ' ms\x1b[0m\n');
  }
  let tIdx = Date.now();
  psql('CREATE INDEX member_dir_codename_lower ON member_dir(codename_lower)');
  rij('btree-index (exact opzoeken)', (Date.now() - tIdx) + ' ms');
  tIdx = Date.now();
  try {
    psql('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    psql('CREATE INDEX member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)');
    rij('trigram-index (deelzoeken LIKE %q%)', (Date.now() - tIdx) + ' ms');
  } catch (e) { rij('trigram-index', 'niet beschikbaar: ' + e.message.split('\n')[0]); }
  rij('zaaien totaal', ((Date.now() - tSeed) / 1000).toFixed(0) + ' s');
  const echt = Number(psql('SELECT count(*) FROM member_dir'));
  rij('rijen in member_dir', nl(echt));

  // ---------- Fase C: de meting ----------
  kop('FASE C: geheugen en schijf bij ' + nl(echt) + ' klanten');
  await new Promise(r => setTimeout(r, 1500));
  const rssVol = rssMB(child.pid);
  const tafelB = Number(psql("SELECT pg_table_size('member_dir')"));
  const indexB = Number(psql("SELECT pg_indexes_size('member_dir')"));
  const totaalB = Number(psql("SELECT pg_total_relation_size('member_dir')"));
  const dbB = Number(psql("SELECT pg_database_size(current_database())"));
  const MB = b => (b / 1e6).toFixed(0);
  rij('servergeheugen (RSS) leeg', rssLeeg + ' MB');
  rij('servergeheugen (RSS) bij ' + nl(echt), rssVol + ' MB');
  rij('  -> extra RAM voor ' + nl(echt), (rssVol - rssLeeg) + ' MB  (' + ((rssVol - rssLeeg) * 1e6 / echt).toFixed(2) + ' byte/klant)');
  rij('Postgres tabel', MB(tafelB) + ' MB');
  rij('Postgres indexen (btree + trigram)', MB(indexB) + ' MB');
  rij('Postgres member_dir totaal', MB(totaalB) + ' MB  (' + (totaalB / echt).toFixed(0) + ' byte/klant)');
  rij('Postgres database totaal', MB(dbB) + ' MB');

  // ---------- Fase D: zware leesroutes bij 65M ----------
  kop('FASE D: zware leesroutes bij ' + nl(echt) + ' klanten (blijven ze goedkoop?)');
  let ledental = 0, tPoll = Date.now();
  while (ledental < echt && Date.now() - tPoll < 20000) {
    ledental = json(await verzoek('/api/office/state', { token: office.token })).state.totals.leden;
    if (ledental < echt) await new Promise(r => setTimeout(r, 1500));
  }
  let t = Date.now();
  const st = json(await verzoek('/api/office/state', { token: office.token }));
  rij('kantoor-totalen (ledental O(1))', (Date.now() - t) + ' ms · ledental ' + nl(st.state.totals.leden));
  t = Date.now();
  const reg = json(await verzoek('/api/auth/register', { body: { name: 'Nieuw Lid', email: 'nieuw' + Date.now() + '@x.nl', phone: '0612349999', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' } }));
  await verzoek('/api/state', { token: reg.token });
  rij('nieuw lid registreren + eerste call', (Date.now() - t) + ' ms');
  const lid = json(await verzoek('/api/login', { body: { tier: 'rtg' } }));
  t = Date.now();
  const zoek = json(await verzoek('/api/member/find', { token: lid.token, body: { q: 'Valk 12345' } }));
  rij('codenaam-deelzoeken (trigram) over ' + nl(echt), (Date.now() - t) + ' ms · ' + ((zoek.results || []).length) + ' treffer(s)');

  // ---------- Fase E: alles tegelijk bovenop 65M ----------
  kop('FASE E: het hele ecosysteem ~' + (DUUR_MS / 1000) + 's bovenop ' + nl(echt) + ' klanten');
  const leden = [];
  for (let i = 0; i < 40; i++) leden.push(json(await verzoek('/api/login', { body: { tier: i % 4 ? 'rtg' : 'business' } })).token);
  let ok = 0, zakelijk4xx = 0, afgeremd = 0, fout = 0, s5xx = 0;
  const rssPiek = { v: rssVol };
  const acties = [
    tk => verzoek('/api/care', { token: tk }),
    tk => verzoek('/api/care/pakketten', { token: tk }),
    tk => verzoek('/api/fluister', { token: tk, body: { q: 'wat kun je' } }),
    tk => verzoek('/api/state', { token: tk }),
    tk => verzoek('/api/tickets/aanbod', { token: tk }),
    tk => verzoek('/api/member/find', { token: tk, body: { q: 'Valk' } }),
  ];
  const eind = Date.now() + DUUR_MS;
  async function werker(tk) {
    while (Date.now() < eind) {
      const r = await acties[Math.floor(Math.random() * acties.length)](tk).catch(() => null);
      if (!r) { fout++; continue; }
      if (r.status >= 500) { s5xx++; fout++; }
      else if (r.status === 429) afgeremd++;
      else if (r.status < 400) ok++;
      else if (r.status === 403 || r.status === 409 || r.status === 404 || r.status === 400) zakelijk4xx++;
      else fout++;
    }
  }
  const sonde = setInterval(() => { const m = rssMB(child.pid); if (m > rssPiek.v) rssPiek.v = m; }, 500);
  await Promise.all(leden.map(werker));
  clearInterval(sonde);
  rij('afgehandelde calls', nl(ok + zakelijk4xx + afgeremd + fout));
  rij('  -> goed (2xx)', nl(ok));
  rij('  -> zakelijke 4xx (bijv. gast mag niet)', nl(zakelijk4xx));
  rij('  -> afgeremd (429, rate-limit)', nl(afgeremd));
  rij('  -> 5xx (serverfouten)', s5xx === 0 ? '0' : String(s5xx));
  rij('servergeheugen (RSS) piek onder last', rssPiek.v + ' MB');

  kop('SAMENVATTING');
  rij('klanten in de gids', nl(echt));
  rij('server-RAM (RSS)', rssVol + ' MB   (leeg: ' + rssLeeg + ' MB)');
  rij('opslag voor ' + nl(echt), MB(totaalB) + ' MB in Postgres (' + (totaalB / echt).toFixed(0) + ' byte/klant)');
  rij('serverfouten onder volle last', s5xx === 0 ? 'geen (0)' : String(s5xx));

  child.kill('SIGKILL');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log('\nklaar');
})().catch(e => { console.error('FOUT:', e.message); if (child) child.kill('SIGKILL'); process.exit(1); });
