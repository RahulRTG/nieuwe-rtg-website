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
  const motor = cp.spawn(BIN, [], { env: Object.assign({}, process.env, { RTG_MOTOR_ADDR: ADDR, RTG_MOTOR_DATA: path.join(datadir, 'state.json'), RTG_MOTOR_SALDI: '1' }), stdio: 'ignore' });
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

  // 6. De bank<->wallet-brug: de pay-KANT loopt via de motor (de bank-kant is
  //    een apart JS-grootboek). We spiegelen precies de bridge-boekingen:
  //    wallet -> extern:bank (naar de bank) en extern:bank -> wallet (terug).
  await pay.boekAsync({ van: 'lid:NEVEL', naar: 'extern:bank', centen: 10000, soort: 'naar-bank', oms: 'brug' });
  await checkLockstep('brug: wallet -> bank 100');
  await pay.boekAsync({ van: 'extern:bank', naar: 'lid:NEVEL', centen: 4000, soort: 'van-bank', oms: 'brug terug' });
  await checkLockstep('brug: bank -> wallet 40');

  // 7. HERSTART-RECONCILE: bouw een VERSE engine (lege db) in motor-modus, laat
  //    hem zijn spiegel uit de motor-snapshot herstellen, en eis dat de verse
  //    spiegel byte-voor-byte gelijk is aan de motor (zoals na een herstart).
  const db2 = { data: {} };
  const { pay: pay2 } = require('../server/kern/pay')({
    db: db2, save() {}, crypto, betaal: demoBetaal,
    keyVanCodenaam: () => null, sseToCustomer() {},
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n || 120),
    betaaldienstKosten: () => 0,
  });
  const rec = await pay2.reconcileVanMotor();
  const mNu = await motorStatus();
  const ja2 = vingerafdruk(db2.data.paySaldi || {});
  if (!rec || !rec.ok) { fouten++; console.error('[cutover] FOUT: reconcile mislukte: ' + JSON.stringify(rec)); }
  else if (ja2 !== mNu.vingerafdruk) { fouten++; console.error('[cutover] FOUT: verse spiegel na reconcile wijkt af (js ' + ja2 + ' vs motor ' + mNu.vingerafdruk + ')'); }
  else console.log('[cutover] OK  herstart-reconcile: verse spiegel == motor (' + ja2 + ', ' + rec.rekeningen + ' rekeningen)');

  // Borging tegen een vals-positieve lockstep: als er NIETS geboekt was, zouden
  // beide kanten de lege afdruk hebben en "matchen". Eis dus echte activiteit.
  const LEEG = 'cbf29ce484222325';
  if (jsAfdruk() === LEEG) { fouten++; console.error('[cutover] FOUT: er is niets geboekt (lege afdruk) -- de proef zegt niets.'); }

  // ============================================================================
  // 8. HET BANK-GROOTBOEK (cutover stap 3): tweede, aparte motor-ledger. Anders
  //    dan pay draait de motor hier RAUW (geen guard); de rijke bank-guard
  //    (rekening bestaat / bevroren / rood-staan-bodem) leeft in JS. We bewijzen:
  //      - LOCKSTEP + CONSERVATIE op het bank-grootboek (eigen som + afdruk);
  //      - de JS-GUARD weigert boven de bodem (402), spiegel onaangeroerd;
  //      - een betaalrekening MAG rood staan tot haar limiet (motor slaat het op);
  //      - het SERIALISATIE-SLOT voorkomt TOCTOU: twee gelijktijdige boekingen
  //        die elk-voor-zich passen maar samen door de bodem zakken -> precies
  //        EEN slaagt;
  //      - HERSTART-RECONCILE herstelt de bank-spiegel byte-voor-byte uit de motor.
  async function bankStatus() {
    const r = await fetch(URL + '/api/bank/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    return r.json();
  }
  const dbB = { data: {} };
  const bankregieStub = {
    bankClearing: () => ({ modus: 'eigen', eigen: true, kaart: true }),
    bankClearingGelukt() {}, bankClearingMislukt() {},
    bankTarief: () => 0, bankSpaarrenteBp: () => 150, bankRoodStandaard: () => 0,
    bankregieOverzicht: () => ({}), bankLedenAan: () => true,
    bankIbanParams: () => ({ landcode: 'NL', bankcode: 'RTGB' }),
  };
  const { bank } = require('../server/kern/bank')({
    db: dbB, save() {}, crypto, betaal: demoBetaal, pay, bankregie: bankregieStub,
    keyVanCodenaam: () => null, accounts: null, sseToCustomer() {}, sseToOffice() {}, anthropic: null,
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n || 140),
  });
  if (bank.geldModus !== 'motor') { fouten++; console.error('[cutover] FOUT: bank-engine niet in motor-modus'); }

  // Seed twee rekeningen: een betaalrekening (mag rood tot -200) en een spaar.
  const IBAN_A = 'NL00RTGB0000000001', IBAN_B = 'NL00RTGB0000000002';
  dbB.data.bankRekeningen = {
    [IBAN_A]: { iban: IBAN_A, codenaam: 'NEVEL', soort: 'betaal', naam: 'Betaal', roodLimiet: 20000, bevroren: false, geopend: Date.now() },
    [IBAN_B]: { iban: IBAN_B, codenaam: 'NEVEL', soort: 'spaar', naam: 'Spaar', roodLimiet: 0, bevroren: false, geopend: Date.now() },
  };
  const bankAfdruk = () => vingerafdruk(dbB.data.bankSaldi || {});
  const bankJsSom = () => Object.values(dbB.data.bankSaldi || {}).reduce((s, v) => s + v, 0);
  async function checkBankLockstep(stap) {
    const m = await bankStatus();
    const ja = bankAfdruk(), js = bankJsSom();
    if (js !== 0 || Number(m.som) !== 0 || ja !== m.vingerafdruk) {
      fouten++;
      console.error('[cutover] FOUT bank "' + stap + '": jsSom=' + js + ' motorSom=' + m.som + ' | jsAfdruk=' + ja + ' motorAfdruk=' + m.vingerafdruk);
    } else console.log('[cutover] OK  bank ' + stap.padEnd(30) + ' som=0  afdruk=' + ja);
  }

  // Storting (extern -> betaal) en een interne overboeking binnen het saldo.
  await bank.bankStorten({ iban: IBAN_A, centen: 80000, route: 'eigen', codenaam: 'NEVEL', idem: 'bs1' });
  await checkBankLockstep('storting 800 -> A');
  await bank.bankOverboek({ vanIban: IBAN_A, naarIban: IBAN_B, centen: 30000, codenaam: 'NEVEL' });
  await checkBankLockstep('A -> B 300');

  // De JS-guard weigert boven de bodem: B (spaar, bodem 0) heeft 300, wil 400 weg.
  const bVoorSom = bankJsSom(), bVoorAfdruk = bankAfdruk();
  const bw = await bank.bankOverboek({ vanIban: IBAN_B, naarIban: IBAN_A, centen: 40000, codenaam: 'NEVEL' });
  if (!bw.error || bw.status !== 402) { fouten++; console.error('[cutover] FOUT: bank-guard liet spaar rood gaan (kreeg ' + JSON.stringify(bw) + ')'); }
  else if (bankJsSom() !== bVoorSom || bankAfdruk() !== bVoorAfdruk) { fouten++; console.error('[cutover] FOUT: bank-spiegel veranderde na een geweigerde boeking'); }
  else console.log('[cutover] OK  bank-guard weigert spaar-rood (402), spiegel onaangeroerd');

  // Een betaalrekening MAG rood tot haar limiet: A heeft 50000, boekt 65000 weg
  // (-> -15000, binnen -20000). De motor slaat het negatieve saldo op; som blijft 0.
  const rood = await bank.bankOverboek({ vanIban: IBAN_A, naarIban: IBAN_B, centen: 65000, codenaam: 'NEVEL' });
  if (rood.error) { fouten++; console.error('[cutover] FOUT: betaalrekening mocht niet rood binnen limiet (' + JSON.stringify(rood) + ')'); }
  else { await checkBankLockstep('A rood binnen limiet'); if ((dbB.data.bankSaldi[IBAN_A] || 0) >= 0) { fouten++; console.error('[cutover] FOUT: A staat niet rood terwijl dat moest'); } }

  // Het SERIALISATIE-SLOT (TOCTOU): breng A terug op precies 0, geef B 100000, en
  // vuur twee gelijktijdige overboekingen B -> A van 60000 af. Elk-voor-zich past
  // (100000 >= 60000, bodem 0), samen niet (zou -20000 geven). Precies EEN slaagt.
  //  eerst A weer aanvullen zodat B genoeg heeft, en A op 0 zetten via de motor.
  dbB.data.bankSaldi = {}; // verse, schone stand (we hebben de lock-eigenschap nodig, niet de historie)
  // herstel de motor-stand ook schoon: nieuwe rekeningnamen zodat we los staan
  const IBAN_C = 'NL00RTGB0000000003';
  dbB.data.bankRekeningen[IBAN_C] = { iban: IBAN_C, codenaam: 'MIST', soort: 'betaal', naam: 'C', roodLimiet: 0, bevroren: false, geopend: Date.now() };
  await bank.reconcileVanMotor(); // spiegel weer gelijk aan de motor
  await bank.bankStorten({ iban: IBAN_C, centen: 100000, route: 'eigen', codenaam: 'MIST', idem: 'bs-c' });
  const [r1, r2] = await Promise.all([
    bank.bankOverboek({ vanIban: IBAN_C, naarIban: IBAN_A, centen: 60000, codenaam: 'MIST' }),
    bank.bankOverboek({ vanIban: IBAN_C, naarIban: IBAN_A, centen: 60000, codenaam: 'MIST' }),
  ]);
  const gelukt = [r1, r2].filter(x => x && x.ok).length;
  const geweigerd = [r1, r2].filter(x => x && x.error && x.status === 402).length;
  if (gelukt !== 1 || geweigerd !== 1) { fouten++; console.error('[cutover] FOUT: slot-race gaf ' + gelukt + ' ok / ' + geweigerd + ' 402 (verwacht 1/1)'); }
  else if ((dbB.data.bankSaldi[IBAN_C] || 0) < 0) { fouten++; console.error('[cutover] FOUT: C zakte door de bodem ondanks het slot (' + dbB.data.bankSaldi[IBAN_C] + ')'); }
  else console.log('[cutover] OK  serialisatie-slot: 1 van 2 gelijktijdige boekingen slaagt, geen bodem-doorbraak');
  await checkBankLockstep('na slot-race');

  // HERSTART-RECONCILE voor de bank: verse engine, spiegel uit de motor-snapshot.
  const dbB2 = { data: {} };
  const { bank: bank2 } = require('../server/kern/bank')({
    db: dbB2, save() {}, crypto, betaal: demoBetaal, pay, bankregie: bankregieStub,
    keyVanCodenaam: () => null, accounts: null, sseToCustomer() {}, sseToOffice() {}, anthropic: null,
    schoon: (s, n) => String(s == null ? '' : s).slice(0, n || 140),
  });
  const brec = await bank2.reconcileVanMotor();
  const mBank = await bankStatus();
  const jbank2 = vingerafdruk(dbB2.data.bankSaldi || {});
  if (!brec || !brec.ok) { fouten++; console.error('[cutover] FOUT: bank-reconcile mislukte: ' + JSON.stringify(brec)); }
  else if (jbank2 !== mBank.vingerafdruk) { fouten++; console.error('[cutover] FOUT: verse bank-spiegel wijkt af (js ' + jbank2 + ' vs motor ' + mBank.vingerafdruk + ')'); }
  else console.log('[cutover] OK  bank herstart-reconcile: verse spiegel == motor (' + jbank2 + ', ' + brec.rekeningen + ' rekeningen)');
  if (bankAfdruk() === LEEG) { fouten++; console.error('[cutover] FOUT: bank-grootboek leeg -- de bankproef zegt niets.'); }

  motor.kill();
  try { require('fs').rmSync(datadir, { recursive: true, force: true }); } catch (e) {}
  if (fouten) { console.error('\n[cutover] ' + fouten + ' fout(en) -- de cutover is NIET bewezen.'); process.exit(1); }
  console.log('\n[cutover] BEWEZEN: de motor is het enige grootboek, de JS-spiegel volgt byte-voor-byte, som blijft 0, en de guard leeft in de motor.');
  process.exit(0);
})().catch(e => { console.error('[cutover] uitzondering:', e); process.exit(1); });
