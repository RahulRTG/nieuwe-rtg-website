/* Pariteit + snelheid: dezelfde reeks geld-operaties door de Node-JS-money-
   engine (server/kern/pay) EN door de Rust-motor over HTTP, daarna de saldi en
   de sluitcontrole vergelijken. Zo bewijzen we dat de motor een 1-op-1 vervanger
   is van het grootboek. Daarna een kleine head-to-head-benchmark.

   Draaien:
     1) motor starten met de debug-vlag (voor de saldi-dump):
        RTG_MOTOR_DEBUG=1 RTG_MOTOR_ADDR=127.0.0.1:3100 motor/target/release/rtg-motor
     2) node --experimental-sqlite scripts/motor-pariteit.js
*/
'use strict';
const http = require('http');
const crypto = require('crypto');
const MOTOR = process.env.RTG_MOTOR_URL || 'http://127.0.0.1:3100';

/* ---------- de Node-JS-engine met lichte stubs (isoleert het grootboek) ---------- */
function maakJsEngine() {
  const leden = new Set();
  const db = { data: {} };
  const save = () => {};
  const schoon = (s, n) => Array.from(String(s == null ? '' : s)).filter((c) => c.charCodeAt(0) >= 32).join('').slice(0, n).trim();
  const betaal = {
    async maakBetaling() { return { status: 'betaald', id: 'demo' + crypto.randomBytes(4).toString('hex') }; },
    async maakUitbetaling() { return { status: 'betaald', id: 'uit' + crypto.randomBytes(4).toString('hex') }; },
  };
  const keyVanCodenaam = async (codenaam) => (leden.has(codenaam) ? { key: 'k_' + codenaam } : null);
  const sseToCustomer = () => {};
  const betaaldienstKosten = () => 0;
  const { pay } = require('../server/kern/pay')({
    db, save, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaaldienstKosten,
  });
  return {
    pay,
    registreer: (c) => leden.add(c),
    saldi: () => db.data.paySaldi || {},
  };
}

/* ---------- HTTP naar de motor ---------- */
function motorCall(path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, MOTOR);
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request(
      { host: u.hostname, port: u.port, path: u.pathname, method: path === '/api/motor/saldi' ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', 'content-length': data.length } },
      (res) => { let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(b || '{}') }); } catch (e) { resolve({ status: res.statusCode, json: {} }); } }); }
    );
    req.on('error', reject);
    req.write(data); req.end();
  });
}

/* ---------- het draaiboek: identiek voor beide kanten ----------
   herhaalde idem-sleutels toetsen de idempotentie. */
const LEDEN = ['NEVEL', 'MIST', 'EBBE', 'TIJ', 'DUIN'];
const STAPPEN = [
  ['oplaad', 'NEVEL', 100000, 'o1'],
  ['oplaad', 'NEVEL', 100000, 'o1'],         // herhaling -> mag niet dubbel
  ['oplaad', 'MIST', 50000, 'o2'],
  ['stuur', 'NEVEL', 'MIST', 25000, 's1'],
  ['stuur', 'NEVEL', 'MIST', 25000, 's1'],   // herhaling
  ['stuur', 'MIST', 'EBBE', 60000, 's2'],    // MIST komt tekort -> autolaad
  ['stuur', 'EBBE', 'TIJ', 12345, 's3'],
  ['stuur', 'TIJ', 'DUIN', 1, 's4'],
  ['oplaad', 'DUIN', 999, 'o3'],
  ['stuur', 'DUIN', 'NEVEL', 1000, 's5'],
];

async function draaiMotor() {
  for (const c of LEDEN) await motorCall('/api/pay/registreer', { codenaam: c });
  for (const st of STAPPEN) {
    if (st[0] === 'oplaad') await motorCall('/api/pay/oplaad', { codenaam: st[1], centen: st[2], idem: st[3] });
    else await motorCall('/api/pay/stuur', { codenaam: st[1], aan: st[2], centen: st[3], idem: st[4] });
  }
  const { json } = await motorCall('/api/motor/saldi', {});
  const gz = await motorCall('/api/pay/gezond', {});
  return { saldi: json, gezond: gz.json.klopt };
}

async function draaiJs(eng) {
  for (const c of LEDEN) eng.registreer(c);
  for (const st of STAPPEN) {
    if (st[0] === 'oplaad') await eng.pay.laadOp({ codenaam: st[1], centen: st[2], idem: st[3] });
    else await eng.pay.stuur({ van: st[1], aanCodenaam: st[2], centen: st[3], idem: st[4] });
  }
  const sc = eng.pay.sluitcontrole();
  return { saldi: eng.saldi(), gezond: sc.klopt };
}

function vergelijkSaldi(js, motor) {
  const verschillen = [];
  const keys = new Set([...Object.keys(js), ...Object.keys(motor)]);
  for (const k of keys) {
    const a = Math.round(js[k] || 0), b = Math.round(motor[k] || 0);
    if (a !== b) verschillen.push(k + ': js=' + a + ' motor=' + b);
  }
  return verschillen;
}

async function benchmark(eng) {
  const N = 20000;
  // JS-engine: seriele oplaad-calls (zelfde werk als de motor per call)
  eng.registreer('BENCH');
  const t0 = Date.now();
  for (let i = 0; i < N; i++) await eng.pay.laadOp({ codenaam: 'BENCH', centen: 1000, idem: 'jb' + i });
  const jsSecs = (Date.now() - t0) / 1000;
  // motor: seriele HTTP-calls (inclusief netwerk-overhead, dus in het nadeel)
  await motorCall('/api/pay/registreer', { codenaam: 'BENCH2' });
  const t1 = Date.now();
  for (let i = 0; i < N; i++) await motorCall('/api/pay/oplaad', { codenaam: 'BENCH2', centen: 1000, idem: 'mb' + i });
  const moSecs = (Date.now() - t1) / 1000;
  return { N, js: jsSecs.toFixed(2) + 's (~' + Math.round(N / jsSecs) + '/s)', motor: moSecs.toFixed(2) + 's (~' + Math.round(N / moSecs) + '/s)' };
}

(async () => {
  const eng = maakJsEngine();
  const js = await draaiJs(eng);
  let motor;
  try { motor = await draaiMotor(); }
  catch (e) { console.error('Kan de motor niet bereiken op', MOTOR, '-', e.message, '\nStart hem eerst met RTG_MOTOR_DEBUG=1.'); process.exit(2); }

  const verschillen = vergelijkSaldi(js.saldi, motor.saldi);
  console.log('PARITEIT (grootboek Node-JS vs Rust-motor)');
  console.log('  sluitcontrole js    ', js.gezond ? 'klopt' : 'FOUT');
  console.log('  sluitcontrole motor ', motor.gezond ? 'klopt' : 'FOUT');
  console.log('  saldi-rekeningen    ', Object.keys(motor.saldi).length);
  if (verschillen.length === 0 && js.gezond && motor.gezond) {
    console.log('  RESULTAAT            IDENTIEK - de motor is een 1-op-1 vervanger van het grootboek');
  } else {
    console.log('  RESULTAAT            VERSCHIL:');
    for (const v of verschillen) console.log('    -', v);
  }

  const b = await benchmark(eng);
  console.log('\nSNELHEID (seriele oplaad, ' + b.N + ' calls elk)');
  console.log('  Node-JS-engine (in proces)     ', b.js);
  console.log('  Rust-motor (over HTTP)         ', b.motor);

  process.exit(verschillen.length === 0 && js.gezond && motor.gezond ? 0 : 1);
})();
