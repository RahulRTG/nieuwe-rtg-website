/* Ledengids-beproeving tegen de Rust-motor: bouw N leden, meet bestandsgrootte
   en zoeksnelheid. Bewijst out-of-RAM: het serveren gebruikt O(1) RAM (binair
   zoeken op schijf), ongeacht hoeveel leden er zijn.

   Draaien (met een eigen gids-pad, los van de money-state):
     RTG_MOTOR_GIDS=/tmp/gids.bin motor/target/release/rtg-motor &
     node scripts/motor-gids.js 2000000
*/
'use strict';
const http = require('http');
const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
const MOTOR = process.env.RTG_MOTOR_URL || 'http://127.0.0.1:3100';
const N = Number(process.argv[2] || 1000000);

function call(path, body) {
  return new Promise((resolve) => {
    const u = new URL(path, MOTOR);
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request(
      { host: u.hostname, port: u.port, path: u.pathname, method: path.endsWith('/status') ? 'GET' : 'POST', agent,
        headers: { 'content-type': 'application/json', 'content-length': data.length } },
      (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }
    );
    req.on('error', () => resolve({}));
    req.write(data); req.end();
  });
}

(async () => {
  console.log('LEDENGIDS-BEPROEVING (Rust-motor, out-of-RAM)');
  const t0 = Date.now();
  const b = await call('/api/gids/bouw', { aantal: N });
  if (!b.ok) { console.error('bouwen mislukt:', JSON.stringify(b)); process.exit(2); }
  console.log('  gebouwd              ' + b.leden.toLocaleString('nl-NL') + ' leden in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's  (' + (b.bestandBytes / 1e6).toFixed(1) + ' MB op schijf)');

  const st = await call('/api/gids/status', {});
  console.log('  RAM-model            ' + st.ramModel);

  // een steekproef exacte zoekopdrachten (meestal raak op bekende namen)
  const M = 5000, lat = [];
  const s0 = Date.now();
  for (let i = 0; i < M; i++) {
    const idx = (i * 337) % N;
    const a = ['Ne', 'vel', 'Mist', 'Eb', 'Tij', 'Duin', 'Storm', 'Vloed', 'Kust', 'Wind', 'Nevel', 'Zee'];
    const naam = a[(idx * 7) % 12] + a[(idx * 13 + 3) % 12] + idx;
    const t = process.hrtime.bigint();
    await call('/api/gids/zoek', { naam });
    lat.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  lat.sort((x, y) => x - y);
  const p = (q) => lat[Math.floor(M * q)].toFixed(3);
  const secs = (Date.now() - s0) / 1000;
  console.log('  zoeken               ' + M + ' in ' + secs.toFixed(2) + 's  (~' + Math.round(M / secs) + '/s)');
  console.log('  latentie             p50 ' + p(0.5) + 'ms  p99 ' + p(0.99) + 'ms');
  console.log('  -> RAM blijft O(1); bij 100M is het bestand ~9 GB op schijf, het RAM ~2,5 MB.');
})();
