/* Gedeeld testgereedschap: start een echte server op een GEGARANDEERD vrije
   poort en wacht robuust tot hij gezond is. Zo botsen parallelle of snel
   opeenvolgende tests niet meer op dezelfde poort (de oude oorzaak van
   sporadische "fetch failed"), en kan de suite weer met concurrency draaien. */
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

// Een vrije poort van het besturingssysteem: bind op 0, lees de toegewezen
// poort, laat hem meteen weer los en geef hem door aan de kindserver.
function vrijePoort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

/* Start server/server.js (of een ander script) en wacht tot hij gezond is.
   Geeft { child, base, port } terug. Gooit als de server niet gezond wordt.

   Belangrijk: tussen het vrijgeven van de poort en het binden door de kindserver
   zit een gaatje waarin een parallelle test dezelfde poort kan krijgen. Dan
   antwoordt op onze poort de server van een ANDERE test (met andere env!) en
   crasht ons eigen kind op EADDRINUSE. Daarom checken we via /api/health dat de
   pid van de antwoordende server echt ons kind is, en proberen we bij een
   verloren poort gewoon opnieuw op een verse poort. */
async function startServer(opts = {}) {
  let laatste;
  for (let poging = 0; poging < 3; poging++) {
    try { return await startEens(opts); }
    catch (e) {
      laatste = e;
      if (!/stopte tijdens opstarten/.test(e.message)) throw e; // echte startfout: niet maskeren
    }
  }
  throw laatste;
}

async function startEens(opts) {
  const script = opts.script || path.join(__dirname, '..', 'server', 'server.js');
  const wachtPad = opts.wachtPad || '/api/health';
  const pogingen = opts.pogingen || 150;
  const port = await vrijePoort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(process.execPath, ['--experimental-sqlite', script], {
    env: { ...process.env, NODE_ENV: 'test', ...(opts.env || {}), PORT: String(port) },
    stdio: ['ignore', 'ignore', opts.stderr || 'inherit']
  });
  for (let i = 0; i < pogingen; i++) {
    if (child.exitCode != null) throw new Error('server stopte tijdens opstarten (exit ' + child.exitCode + ')');
    try {
      const r = await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d.pid === child.pid) {
          // echt onze server; eventueel nog even wachten op het gevraagde pad
          if (wachtPad !== '/api/health') {
            for (let j = 0; j < 50; j++) {
              const w = await fetch(base + wachtPad, { headers: { 'X-Forwarded-Proto': 'https' } }).catch(() => null);
              if (w && w.ok) break;
              await new Promise(r2 => setTimeout(r2, 100));
            }
          }
          return { child, base, port };
        }
        // een vreemde server op onze poort: ons kind gaat zo op EADDRINUSE af,
        // de exitCode-check hierboven vangt dat en we beginnen op een verse poort
      }
    } catch (e) { /* nog niet op; opnieuw proberen */ }
    await new Promise(r => setTimeout(r, 100));
  }
  try { child.kill('SIGKILL'); } catch (e) {}
  throw new Error('server werd niet gezond op ' + base);
}

function stop(child) { if (child) try { child.kill('SIGKILL'); } catch (e) {} }

module.exports = { vrijePoort, startServer, stop };
