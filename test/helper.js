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

// Start server/server.js (of een ander script) en wacht tot /api/health 200 geeft.
// Geeft { child, base, port } terug. Gooit als de server niet gezond wordt.
async function startServer(opts = {}) {
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
      const r = await fetch(base + wachtPad, { headers: { 'X-Forwarded-Proto': 'https' } });
      if (r.ok) return { child, base, port };
    } catch (e) { /* nog niet op; opnieuw proberen */ }
    await new Promise(r => setTimeout(r, 100));
  }
  try { child.kill('SIGKILL'); } catch (e) {}
  throw new Error('server werd niet gezond op ' + base);
}

function stop(child) { if (child) try { child.kill('SIGKILL'); } catch (e) {} }

module.exports = { vrijePoort, startServer, stop };
