/* Bewijs voor de CUTOVER (RTG_MOTOR_GELD=motor): de Rust-motor is het ENIGE
   autoritatieve grootboek, de JS-engine is nog slechts een spiegel. We draaien de
   echte JS geld-engine in motor-modus tegen een live motor en bewijzen:

     1. LOCKSTEP  -- na elke reeks boekingen is de JS-spiegel byte-identiek aan de
                     motor-autoriteit (zelfde som EN zelfde saldi-vingerafdruk).
     2. CONSERVATIE -- de som van alle saldi blijft exact 0.
     3. GUARD IN DE MOTOR -- een boeking boven het saldo wordt door de MOTOR
                     geweigerd (402) en verandert NIETS aan de JS-spiegel.

   Zo is aangetoond dat de motor de beslissingen neemt en de JS-kant hem exact
   volgt -- klaar om bewust om te flippen. Draai: node scripts/motor-cutover.js */
'use strict';
const cp = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { vingerafdruk } = require('../server/kern/pay/vingerafdruk');

const BIN = path.join(__dirname, '..', 'motor', 'target', 'release', 'rtg-motor');
const ADDR = '127.0.0.1:4820';
const URL = 'http://' + ADDR;

function wacht(ms) { return new Promise(r => setTimeout(r, ms)); }
async function motorStatus() {
  const r = await fetch(URL + '/api/motor/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return r.json();
}

(async () => {
  // 1. Start de motor (verse, lege staat).
  const datadir = path.join(require('os').tmpdir(), 'motor-cutover-' + Date.now());
  const motor = cp.spawn(BIN, [], { env: Object.assign({}, process.env, { RTG_MOTOR_ADDR: ADDR, RTG_MOTOR_DATA: path.join(datadir, 'state.json') }), stdio: 'ignore' });
  let op = false;
  for (let i = 0; i < 40; i++) { try { await motorStatus(); op = true; break; } catch (e) { await wacht(200); } }
  if (!op) { console.error('[cutover] motor start niet'); motor.kill(); process.exit(1); }

  // 2. Bouw de ECHTE JS geld-engine in motor-modus (tegen deze motor).
  process.env.RTG_MOTOR_GELD = 'motor';
  process.env.RTG_MOTOR_GELD_URL = URL;
  const db = { data: {} };
  const demoBetaal = {
    async maakBetaling() { return { status: 'betaald', id: 'demo-' + crypto.randomBytes(4).toString('hex') }; },
    async maakUitbetaling() { return { status: 'uitbetaald' }; },
  };
  const { pay } = require('../server/kern/pay')({
    db, save() {}, crypto, betaal: demoBetaal,
    keyVanCodenaam: () => null, sseToCustomer() {},
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n || 120),
    betaaldienstKosten: () => 0,
  });
  if (pay.geldModus !== 'motor') { console.error('[cutover] engine niet in motor-modus'); motor.kill(); process.exit(1); }

  const jsAfdruk = () => vingerafdruk(db.data.paySaldi || {});
  const jsSom = () => Object.values(db.data.paySaldi || {}).reduce((s, v) => s + v, 0);
  let fouten = 0;
  async function checkLockstep(stap) {
    const m = await motorStatus();
    const ja = jsAfdruk(), js = jsSom();
    const okSom = js === 0 && Number(m.som) === 0;
    const okAfdruk = ja === m.vingerafdruk;
    if (!okSom || !okAfdruk) {
      fouten++;
      console.error('[cutover] FOUT bij "' + stap + '": jsSom=' + js + ' motorSom=' + m.som + ' | jsAfdruk=' + ja + ' motorAfdruk=' + m.vingerafdruk);
    } else {
      console.log('[cutover] OK  ' + stap.padEnd(34) + ' som=0  afdruk=' + ja);
    }
  }

  // 3. Een reeks echte geld-operaties -- elke boeking gaat geguard naar de motor.
  await pay.laadOp({ codenaam: 'NEVEL', centen: 100000, idem: 'l1' });
  await checkLockstep('oplaad NEVEL 1000');
  await pay.laadOp({ codenaam: 'MIST', centen: 50000, idem: 'l2' });
  await checkLockstep('oplaad MIST 500');
  await pay.boekAsync({ van: 'lid:NEVEL', naar: 'lid:MIST', centen: 40000, soort: 'p2p', oms: 'tik' });
  await checkLockstep('NEVEL -> MIST 400');
  await pay.boekAsync({ van: 'lid:MIST', naar: 'partner:SAKURA', centen: 25000, soort: 'kassa', oms: 'kassa' });
  await checkLockstep('MIST -> partner 250');

  // 4. De guard leeft in de MOTOR: boven het saldo -> 402, en NIETS verandert.
  const voorSom = jsSom(), voorAfdruk = jsAfdruk();
  const w = await pay.boekAsync({ van: 'lid:MIST', naar: 'lid:NEVEL', centen: 90000, soort: 'p2p', oms: 'te veel' });
  if (!w.error || w.status !== 402) { fouten++; console.error('[cutover] FOUT: motor guard weigerde NIET (kreeg ' + JSON.stringify(w) + ')'); }
  else if (jsSom() !== voorSom || jsAfdruk() !== voorAfdruk) { fouten++; console.error('[cutover] FOUT: JS-spiegel veranderde na een geweigerde boeking'); }
  else console.log('[cutover] OK  motor-guard weigert onvoldoende saldo (402), spiegel onaangeroerd');

  // 5. Herhaalde idempotente oplaad boekt niet dubbel.
  await pay.laadOp({ codenaam: 'NEVEL', centen: 100000, idem: 'l1' });
  await checkLockstep('oplaad NEVEL herhaald (idem)');

  // Borging tegen een vals-positieve lockstep: als er NIETS geboekt was, zouden
  // beide kanten de lege afdruk hebben en "matchen". Eis dus echte activiteit.
  const LEEG = 'cbf29ce484222325';
  if (jsAfdruk() === LEEG) { fouten++; console.error('[cutover] FOUT: er is niets geboekt (lege afdruk) -- de proef zegt niets.'); }

  motor.kill();
  try { require('fs').rmSync(datadir, { recursive: true, force: true }); } catch (e) {}
  if (fouten) { console.error('\n[cutover] ' + fouten + ' fout(en) -- de cutover is NIET bewezen.'); process.exit(1); }
  console.log('\n[cutover] BEWEZEN: de motor is het enige grootboek, de JS-spiegel volgt byte-voor-byte, som blijft 0, en de guard leeft in de motor.');
  process.exit(0);
})().catch(e => { console.error('[cutover] uitzondering:', e); process.exit(1); });
