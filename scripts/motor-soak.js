/* Schaduw-SOAK: houdt continu geldverkeer door de autoritaire JS-engine, met
   RTG_MOTOR_SHADOW naar de Rust-motor, en controleert periodiek de drift
   (JS-som vs motor-som). Dit is de "schaduwperiode" die vóór een cutover
   langdurig groen moet blijven -- hier ingekort tot een paar minuten als bewijs
   van volgehouden lockstep.

   Draaien (lege motor met debug-vlag):
     RTG_MOTOR_DEBUG=1 motor/target/release/rtg-motor &
     RTG_MOTOR_SHADOW=http://127.0.0.1:3100 node --experimental-sqlite scripts/motor-soak.js 120
*/
'use strict';
const http = require('http');
const crypto = require('crypto');
const MOTOR = process.env.RTG_MOTOR_SHADOW || 'http://127.0.0.1:3100';
const DUUR_S = Number(process.argv[2] || 120);

function maakJsEngine() {
  const leden = new Set();
  const db = { data: {} };
  const schoon = (s, n) => Array.from(String(s == null ? '' : s)).filter((c) => c.charCodeAt(0) >= 32).join('').slice(0, n).trim();
  const betaal = { async maakBetaling() { return { status: 'betaald', id: 'd' + crypto.randomBytes(4).toString('hex') }; }, async maakUitbetaling() { return { status: 'betaald', id: 'u' }; } };
  const keyVanCodenaam = async (c) => (leden.has(c) ? { key: 'k_' + c } : null);
  const { pay } = require('../server/kern/pay')({ db, save: () => {}, crypto, betaal, keyVanCodenaam, sseToCustomer: () => {}, schoon, betaaldienstKosten: () => 0 });
  return { pay, registreer: (c) => leden.add(c), som: () => Object.values(db.data.paySaldi || {}).reduce((s, v) => s + Math.round(v), 0) };
}

function motorSom() {
  return new Promise((resolve) => {
    const u = new URL('/api/motor/status', MOTOR);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': 2 } },
      (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { const j = JSON.parse(b); resolve({ som: Number(j.som), klopt: j.klopt }); } catch (e) { resolve({ fout: true }); } }); });
    req.on('error', () => resolve({ fout: true }));
    req.end('{}');
  });
}

const M = 300;
(async () => {
  const eng = maakJsEngine();
  for (let i = 0; i < M; i++) eng.registreer('K' + i);
  console.log('SCHADUW-SOAK gestart — ' + DUUR_S + 's, ' + M + ' leden, drift-check elke 10s');
  const eind = Date.now() + DUUR_S * 1000;
  let ops = 0, checks = 0, drift = 0, laatsteLog = 0;
  while (Date.now() < eind) {
    // een golfje echt geldverkeer door boek()
    for (let i = 0; i < 200; i++) {
      const a = Math.floor(Math.random() * M);
      if (ops % 3 === 0) { await eng.pay.laadOp({ codenaam: 'K' + a, centen: 1000 + (ops % 40) * 100, idem: 'o' + ops }); }
      else { let b = Math.floor(Math.random() * M); if (b === a) b = (b + 1) % M; await eng.pay.stuur({ van: 'K' + a, aanCodenaam: 'K' + b, centen: 1000, idem: 's' + ops }); }
      ops++;
    }
    // laat de schaduw-flusher (200ms) bijwerken, dan drift meten
    await new Promise((r) => setTimeout(r, 400));
    if (Date.now() - laatsteLog >= 10000) {
      const js = eng.som();
      const m = await motorSom();
      checks++;
      const gelijk = !m.fout && m.klopt && m.som === js;
      if (!gelijk) drift++;
      const rest = Math.max(0, Math.round((eind - Date.now()) / 1000));
      console.log('  +' + String(checks * 10).padStart(3) + 's  ops=' + ops + '  JS-som=' + js + '  motor-som=' + (m.fout ? 'FOUT' : m.som) + '  ' + (gelijk ? 'LOCKSTEP' : 'DRIFT!') + '  (nog ~' + rest + 's)');
      laatsteLog = Date.now();
    }
  }
  console.log('\nSOAK KLAAR: ' + ops + ' operaties, ' + checks + ' drift-checks, ' + drift + ' afwijking(en)');
  console.log(drift === 0 ? 'RESULTAAT: VOLGEHOUDEN LOCKSTEP — de motor bleef de hele periode exact gelijk.' : 'RESULTAAT: DRIFT GEZIEN — niet cutover-gereed.');
  process.exit(drift === 0 ? 0 : 1);
})();
