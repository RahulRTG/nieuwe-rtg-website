/* RTG failover-trio: drie identieke servers met een poortwachter ervoor.

   Start: npm start (of node server/trio.js). De site blijft gewoon op
   http://localhost:3000 draaien; daarachter staan drie servers:

     server 1 op poort 3001 (actief)
     server 2 op poort 3002 (standby)
     server 3 op poort 3003 (standby)

   De poortwachter controleert elke twee seconden of de actieve server nog
   leeft. Valt hij uit, dan neemt de volgende gezonde server het direct over:
   die laadt eerst de laatste data van schijf (promote) en krijgt dan al het
   verkeer. De gevallen server wordt automatisch herstart en zodra hij tien
   seconden stabiel draait, krijgt hij het werk weer terug.

   Alleen de actieve server schrijft naar de database; standby-servers lezen
   alleen mee. Zo kunnen er nooit twee servers tegelijk in de data schrijven. */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const AANTAL = 3;
const BASISPOORT = Number(process.env.RTG_TRIO_BASIS || PORT + 1); // 3001, 3002, 3003
const SLEUTEL = crypto.randomBytes(24).toString('hex'); // deelt het trio onderling
const FAILBACK_MS = 10000;  // zo lang moet een herstelde server stabiel zijn
const CHECK_MS = 2000;      // hartslagcontrole

const servers = [];
for (let i = 0; i < AANTAL; i++) servers.push({ nr: i + 1, port: BASISPOORT + i, child: null, healthy: false, healthySince: 0, restarts: 0 });
let activeIdx = -1;
let switching = null; // lopende overname, zodat er nooit twee tegelijk lopen
let stopping = false;

const log = m => console.log('[poortwachter] ' + m);

/* ---------- de drie servers starten en bewaken ---------- */

function startServer(i) {
  const s = servers[i];
  const child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(s.port), RTG_ROL: 'standby', RTG_SERVER: String(s.nr), RTG_CLUSTER_KEY: SLEUTEL },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  s.child = child;
  s.healthy = false;
  s.healthySince = 0;
  const tag = '[server ' + s.nr + '] ';
  const doorgeven = stream => d => String(d).split('\n').filter(Boolean).forEach(l => stream.write(tag + l + '\n'));
  child.stdout.on('data', doorgeven(process.stdout));
  child.stderr.on('data', doorgeven(process.stderr));
  child.on('exit', (code, sig) => {
    s.child = null; s.healthy = false; s.healthySince = 0;
    if (stopping) return;
    s.restarts++;
    log('server ' + s.nr + ' is uitgevallen (' + (sig || 'code ' + code) + '), herstart over 2 seconden');
    if (activeIdx === i) kiesActieve('server ' + s.nr + ' viel uit');
    setTimeout(() => { if (!stopping) startServer(i); }, 2000);
  });
}

function apiCall(port, pad, method) {
  return new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port, path: pad, method, timeout: 1500, headers: { 'x-rtg-cluster': SLEUTEL } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}
const isGezond = async port => { const r = await apiCall(port, '/api/health', 'GET'); return !!(r && r.status === 200); };

/* ---------- wie is actief ---------- */

async function kiesActieve(reden) {
  if (switching) return switching;
  switching = (async () => {
    // eerste gezonde server wint; even wachten mag, een herstart duurt seconden
    for (let poging = 0; poging < 20 && !stopping; poging++) {
      for (let i = 0; i < servers.length; i++) {
        const s = servers[i];
        if (!s.child) continue;
        if (await isGezond(s.port)) {
          if (i === activeIdx) return; // actieve leeft toch nog
          const oud = activeIdx >= 0 ? servers[activeIdx] : null;
          if (oud) await apiCall(oud.port, '/api/cluster/demote', 'POST'); // best effort
          const r = await apiCall(s.port, '/api/cluster/promote', 'POST');
          if (!r || r.status !== 200) continue; // promotie mislukt, probeer de volgende
          activeIdx = i;
          log((reden ? reden + '; ' : '') + 'server ' + s.nr + ' (poort ' + s.port + ') is nu actief');
          return;
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
    activeIdx = -1;
    log('geen enkele server is bereikbaar; nieuwe pogingen blijven lopen');
  })().finally(() => { switching = null; });
  return switching;
}

async function hartslag() {
  if (stopping) return;
  for (const s of servers) {
    const ok = s.child ? await isGezond(s.port) : false;
    if (ok && !s.healthy) s.healthySince = Date.now();
    if (!ok) s.healthySince = 0;
    s.healthy = ok;
  }
  if (activeIdx < 0 || !servers[activeIdx].healthy) {
    await kiesActieve(activeIdx < 0 ? null : 'server ' + servers[activeIdx].nr + ' reageert niet meer');
  } else {
    // failback: een lager genummerde server die weer 10 seconden gezond is,
    // krijgt het werk terug ("tot die het weer doet")
    const beter = servers.findIndex(s => s.healthy && s.healthySince && Date.now() - s.healthySince >= FAILBACK_MS);
    if (beter >= 0 && beter < activeIdx) {
      const oud = servers[activeIdx];
      await apiCall(oud.port, '/api/cluster/demote', 'POST');
      const r = await apiCall(servers[beter].port, '/api/cluster/promote', 'POST');
      if (r && r.status === 200) {
        activeIdx = beter;
        log('server ' + servers[beter].nr + ' doet het weer en neemt het werk terug; server ' + oud.nr + ' is weer standby');
      } else {
        await apiCall(oud.port, '/api/cluster/promote', 'POST'); // terugdraaien
      }
    }
  }
}

function wachtOpActieve(maxMs) {
  return new Promise(resolve => {
    const t0 = Date.now();
    (function kijk() {
      if (activeIdx >= 0 && servers[activeIdx].healthy) return resolve(activeIdx);
      if (Date.now() - t0 > maxMs || stopping) return resolve(-1);
      setTimeout(kijk, 200);
    })();
  });
}

/* ---------- de poortwachter: al het verkeer naar de actieve server ---------- */

function stuurDoor(req, res, body, idx, magOpnieuw) {
  const s = servers[idx];
  const headers = { ...req.headers };
  headers['x-forwarded-for'] = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '') + (req.socket.remoteAddress || '');
  if (!headers['x-forwarded-proto']) headers['x-forwarded-proto'] = 'http';
  const proxy = http.request({ host: '127.0.0.1', port: s.port, path: req.url, method: req.method, headers }, pres => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res); // streamt ook SSE gewoon door
  });
  proxy.on('error', async () => {
    s.healthy = false; s.healthySince = 0;
    if (res.headersSent || !magOpnieuw) { try { res.destroy(); } catch (e) {} return; }
    await kiesActieve('server ' + s.nr + ' liet een verzoek vallen');
    if (activeIdx >= 0 && activeIdx !== idx) stuurDoor(req, res, body, activeIdx, false);
    else uitleg503(res);
  });
  if (body && body.length) proxy.end(body); else proxy.end();
}
function uitleg503(res) {
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Alle servers zijn tijdelijk onbereikbaar; ze worden automatisch herstart. Probeer het over een paar seconden opnieuw.' }));
}

const poort = http.createServer((req, res) => {
  // Het verzoek eerst binnenhalen (verzoeken zijn klein: JSON en foto's tot
  // ruwweg een megabyte); dan kan het bij een uitval veilig opnieuw naar de
  // volgende server, ook halverwege een POST.
  const delen = [];
  let groot = 0;
  req.on('data', d => { groot += d.length; if (groot <= 20 * 1024 * 1024) delen.push(d); });
  req.on('end', async () => {
    if (groot > 20 * 1024 * 1024) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Verzoek te groot.' })); return; }
    const idx = await wachtOpActieve(15000);
    if (idx < 0) return uitleg503(res);
    stuurDoor(req, res, Buffer.concat(delen), idx, true);
  });
});
poort.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('Poort ' + PORT + ' is al in gebruik. Draait de site al?'); process.exit(1); }
  console.error('[poortwachter]', e.message);
});

/* ---------- netjes starten en stoppen ---------- */

(async () => {
  poort.listen(PORT, () => log('luistert op http://localhost:' + PORT));
  // Server 1 eerst, zodat een verse database maar door een server wordt
  // aangemaakt; daarna de twee standby-servers.
  startServer(0);
  for (let w = 0; w < 60 && !(await isGezond(servers[0].port)); w++) await new Promise(r => setTimeout(r, 500));
  await kiesActieve(null);
  startServer(1);
  startServer(2);
  setInterval(hartslag, CHECK_MS);
  setTimeout(() => {
    console.log('');
    console.log('  Drie servers draaien: 1 actief (poort ' + servers[0].port + '), 2 en 3 standby (' + servers[1].port + ', ' + servers[2].port + ').');
    console.log('  De site staat op http://localhost:' + PORT + '. Valt een server uit, dan neemt de volgende het direct over');
    console.log('  en wordt de gevallen server automatisch herstart.');
    console.log('');
  }, 2500);
})();

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  if (stopping) return;
  stopping = true;
  log(sig + ' ontvangen, alle servers worden netjes gestopt');
  for (const s of servers) if (s.child) try { s.child.kill('SIGTERM'); } catch (e) {}
  poort.close();
  setTimeout(() => process.exit(0), 3000);
});
