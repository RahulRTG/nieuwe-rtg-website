/* Schaduw-modus end-to-end: de autoritaire Node-JS-engine draait een reeks
   boekingen met RTG_MOTOR_SHADOW aan; elke boeking wordt naar de Rust-motor
   gespiegeld. Daarna vergelijken we de saldi: de motor moet in LOCKSTEP staan
   met de JS-waarheid.

   Draaien (lege motor met debug-vlag):
     RTG_MOTOR_DEBUG=1 motor/target/release/rtg-motor &
     RTG_MOTOR_SHADOW=http://127.0.0.1:3100 node --experimental-sqlite scripts/motor-schaduw.js
*/
'use strict';
const http = require('http');
const crypto = require('crypto');
const MOTOR = process.env.RTG_MOTOR_SHADOW || 'http://127.0.0.1:3100';

function maakJsEngine() {
  const leden = new Set();
  const db = { data: {} };
  const save = () => {};
  const schoon = (s, n) => Array.from(String(s == null ? '' : s)).filter((c) => c.charCodeAt(0) >= 32).join('').slice(0, n).trim();
  const betaal = {
    async maakBetaling() { return { status: 'betaald', id: 'demo' + crypto.randomBytes(4).toString('hex') }; },
    async maakUitbetaling() { return { status: 'betaald', id: 'uit' + crypto.randomBytes(4).toString('hex') }; },
  };
  const keyVanCodenaam = async (c) => (leden.has(c) ? { key: 'k_' + c } : null);
  const { pay } = require('../server/kern/pay')({ db, save, crypto, betaal, keyVanCodenaam, sseToCustomer: () => {}, schoon, betaaldienstKosten: () => 0 });
  return { pay, registreer: (c) => leden.add(c), saldi: () => db.data.paySaldi || {} };
}

function motorGet(path) {
  return new Promise((resolve) => {
    const u = new URL(path, MOTOR);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'GET', headers: { 'content-length': 0 } },
      (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); });
    req.on('error', () => resolve({}));
    req.end();
  });
}

const LEDEN = ['ALFA', 'BETA', 'GAMMA', 'DELTA'];
(async () => {
  const eng = maakJsEngine();
  for (const c of LEDEN) eng.registreer(c);
  // een reeks die door boek() loopt (oplaad, stuur met autolaad, kassa)
  await eng.pay.laadOp({ codenaam: 'ALFA', centen: 200000, idem: 'a' });
  await eng.pay.stuur({ van: 'ALFA', aanCodenaam: 'BETA', centen: 75000, idem: 'b' });
  await eng.pay.stuur({ van: 'BETA', aanCodenaam: 'GAMMA', centen: 90000, idem: 'c' }); // autolaad
  await eng.pay.laadOp({ codenaam: 'DELTA', centen: 12345, idem: 'd' });
  await eng.pay.stuur({ van: 'DELTA', aanCodenaam: 'ALFA', centen: 12345, idem: 'e' });

  // wachten tot de schaduw-flusher (200 ms tik) alles heeft doorgezet
  await new Promise((r) => setTimeout(r, 1500));

  const jsSaldi = eng.saldi();
  const motorSaldi = await motorGet('/api/motor/saldi');
  const jsSom = Object.values(jsSaldi).reduce((s, v) => s + Math.round(v), 0);

  const keys = new Set([...Object.keys(jsSaldi), ...Object.keys(motorSaldi)]);
  const verschillen = [];
  for (const k of keys) {
    const a = Math.round(jsSaldi[k] || 0), b = Math.round(motorSaldi[k] || 0);
    if (a !== b) verschillen.push(`${k}: js=${a} motor=${b}`);
  }

  console.log('SCHADUW-MODUS (JS autoritair -> Rust-motor spiegelt)');
  console.log('  JS-som saldi         ', jsSom);
  console.log('  motor-rekeningen     ', Object.keys(motorSaldi).length);
  if (verschillen.length === 0 && jsSom === 0) {
    console.log('  RESULTAAT            LOCKSTEP - de motor volgt de JS-waarheid exact');
    process.exit(0);
  } else {
    console.log('  RESULTAAT            DRIFT:');
    for (const v of verschillen) console.log('    -', v);
    process.exit(1);
  }
})();
