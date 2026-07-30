/* Concurrency-storm tegen de Rust-motor: veel parallelle schrijvers die door
   elkaar heen opladen en sturen. Bewijst dat het grootboek onder gelijktijdige
   last EXACT blijft sluiten (som van alle saldi = 0) en dat er geen cent
   verdwijnt of bijkomt - de kern van "krachtiger onder gelijktijdige last".

   Draaien (motor met debug-vlag voor de saldi-dump):
     RTG_MOTOR_DEBUG=1 motor/target/release/rtg-motor &
     node scripts/motor-storm.js
*/
'use strict';
const http = require('http');
const MOTOR = process.env.RTG_MOTOR_URL || 'http://127.0.0.1:3100';
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });

function call(path, body) {
  return new Promise((resolve) => {
    const u = new URL(path, MOTOR);
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request(
      { host: u.hostname, port: u.port, path: u.pathname, method: path === '/api/motor/saldi' ? 'GET' : 'POST', agent,
        headers: { 'content-type': 'application/json', 'content-length': data.length } },
      (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(b || '{}'); } catch (e) { return {}; } })() })); }
    );
    req.on('error', () => resolve({ status: -1, json: {} }));
    req.write(data); req.end();
  });
}

const M = 200;                 // leden
const N = 60000;               // operaties
const CONC = 64;               // parallelle schrijvers
const naam = (i) => 'S' + i;

(async () => {
  for (let i = 0; i < M; i++) await call('/api/pay/registreer', { codenaam: naam(i) });

  let i = 0, done = 0, fout5xx = 0, opgeladen = 0;
  const t0 = Date.now();
  async function werker() {
    while (i < N) {
      const k = i++;
      const a = Math.floor(Math.random() * M);
      if (k % 3 === 0) {
        const centen = 1000 + (k % 50) * 100;
        const r = await call('/api/pay/oplaad', { codenaam: naam(a), centen, idem: 'op' + k });
        if (r.status === 200) opgeladen += centen;
        if (r.status >= 500) fout5xx++;
      } else {
        let b = Math.floor(Math.random() * M);
        if (b === a) b = (b + 1) % M;
        const r = await call('/api/pay/stuur', { codenaam: naam(a), aan: naam(b), centen: 1000, idem: 'st' + k });
        // 402 (onvoldoende) mag; autolaad vult meestal aan
        if (r.status >= 500) fout5xx++;
      }
      done++;
    }
  }
  await Promise.all(Array.from({ length: CONC }, werker));
  const secs = (Date.now() - t0) / 1000;

  const gz = await call('/api/pay/gezond', {});
  const saldiResp = await call('/api/motor/saldi', {});
  const saldi = saldiResp.json || {};
  let som = 0, extern = 0, positief = 0;
  for (const [k, v] of Object.entries(saldi)) {
    som += v;
    if (k.startsWith('extern:')) extern += v;
    if (v > 0) positief += v;
  }

  console.log('CONCURRENCY-STORM tegen de Rust-motor');
  console.log('  operaties            ', done, 'in', secs.toFixed(2) + 's  (~' + Math.round(done / secs) + '/s,', CONC, 'parallel)');
  console.log('  5xx serverfouten     ', fout5xx);
  console.log('  sluitcontrole        ', gz.json.klopt ? 'KLOPT (som saldi = 0)' : 'FOUT');
  console.log('  som van alle saldi   ', som);
  console.log('  expliciet opgeladen  ', (opgeladen / 100).toFixed(2), 'euro  (excl. autolaad bij sturen)');
  console.log('  extern:* (tegenpost) ', (extern / 100).toFixed(2), 'euro');
  console.log('  positieve saldi      ', (positief / 100).toFixed(2), 'euro');

  // Echte conservatie: som van alle saldi = 0, en al het positieve geld wordt
  // exact gedekt door de extern-tegenposten (positief === -extern). Het
  // opgeladen-getal is alleen de expliciete oplaad, zonder de interne autolaad.
  const ok = gz.json.klopt && som === 0 && fout5xx === 0 && (positief === -extern);
  console.log('  RESULTAAT            ', ok ? 'GEEN CENT ZOEK - grootboek sluit onder volle parallelle last' : 'AFWIJKING');
  process.exit(ok ? 0 : 1);
})();
