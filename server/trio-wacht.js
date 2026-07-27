/* RTG failover-trio, het bewakingsdeel: de drie servers starten, hun hartslag
   volgen, en bepalen wie de actieve is (met failback naar een lager nummer
   zodra die weer tien seconden stabiel draait). De poortwachter zelf -- het
   doorsturen van verkeer -- staat in ./trio.js en krijgt deze functies mee. */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

function maakWacht({ AANTAL, BASISPOORT, SLEUTEL, FAILBACK_MS, log }) {
  const servers = [];
  for (let i = 0; i < AANTAL; i++) servers.push({ nr: i + 1, port: BASISPOORT + i, child: null, healthy: false, healthySince: 0, restarts: 0 });
  let activeIdx = -1;
  let switching = null; // lopende overname, zodat er nooit twee tegelijk lopen
  let stopping = false;

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

  // netjes stoppen: geen herstarts meer en alle kinderen een SIGTERM
  function stop() {
    if (stopping) return;
    stopping = true;
    for (const s of servers) if (s.child) try { s.child.kill('SIGTERM'); } catch (e) {}
  }

  return { servers, actieve: () => activeIdx, startServer, apiCall, isGezond, kiesActieve, hartslag, wachtOpActieve, stop, gestopt: () => stopping };
}

module.exports = { maakWacht };
