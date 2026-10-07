/* DE ECHTE RUST-MOTOR VOOR EEN TOETS, en met opzet geen nagemaakte.

   De geldfouten die deze helper bestaan liet, waren met een nep-motor niet te
   zien: de JS-kant stuurde `pay-oplaad:BW-...` en de echte motor weigert elke
   sleutel die geen SHA-256 is. Een stub die alles aanneemt, keurt precies dat
   goed. Dus: de binary die `cargo build --release --locked` in motor/ maakt,
   een eigen map met een eigen sleutel en genesis, `init-state`, en pas dan
   starten op een vrije poort.

   Ontbreekt de binary, dan GOOIT start() met de bouwopdracht erbij. Overslaan
   zou een geldtoets groen laten staan die niets heeft gemeten (CI bouwt de
   motor voor de toetsscherven; zie .github/workflows/ci.yml). */
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const BIN = process.env.RTG_TOETS_MOTOR_BIN ||
  path.join(__dirname, '..', '..', 'motor', 'target', 'release', 'rtg-motor');

function vrijePoort() {
  return new Promise((ok, fout) => {
    const s = net.createServer();
    s.on('error', fout);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

async function startEchteMotor() {
  if (!fs.existsSync(BIN))
    throw new Error('De Rust-motor ontbreekt op ' + BIN + '. Bouw hem met ' +
      '`cargo build --release --locked --manifest-path motor/Cargo.toml`.');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toetsmotor-'));
  const sleutel = path.join(map, 'key');
  fs.writeFileSync(sleutel, 'k-0123456789abcdef:' + 'ab'.repeat(32) + '\n', { mode: 0o600 });
  const poort = await vrijePoort();
  const env = Object.assign({}, process.env, {
    RTG_MOTOR_ADDR: '127.0.0.1:' + poort,
    RTG_MOTOR_DATA: path.join(map, 'state.json'), RTG_MOTOR_GIDS: path.join(map, 'gids.bin'),
    RTG_MOTOR_STATE_KEY_FILE: sleutel, RTG_MOTOR_EXPECT_GENESIS: 'g-' + 'cd'.repeat(16),
    RTG_MOTOR_SALDI: '1', RTG_MOTOR_KLUIS: path.join(map, 'kluis.bin')
  });
  const init = spawnSync(BIN, ['init-state'], { env, encoding: 'utf8', cwd: map });
  if (init.status !== 0) throw new Error('init-state van de motor mislukte: ' + init.stderr);
  const proc = spawn(BIN, [], { env, cwd: map, stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '';
  proc.stderr.on('data', d => { log += d; });
  const url = 'http://127.0.0.1:' + poort;
  let leeft = false;
  for (let i = 0; i < 200 && !leeft; i++) {
    try { leeft = (await fetch(url + '/api/leeft')).ok; } catch (e) { /* nog niet op */ }
    if (!leeft) await new Promise(r => setTimeout(r, 25));
  }
  if (!leeft) { proc.kill('SIGKILL'); throw new Error('De motor kwam niet op: ' + log); }
  const stop = () => { try { proc.kill('SIGKILL'); } catch (e) { /* al weg */ } fs.rmSync(map, { recursive: true, force: true }); };
  /* De volledige saldi-stand: alleen beschikbaar met RTG_MOTOR_SALDI=1, en
     alleen hier, in een wegwerpmotor. */
  const saldi = async () => (await (await fetch(url + '/api/motor/saldi', { method: 'POST', body: '{}' })).json());
  const saldo = async rek => Math.round(Number((await saldi())[rek] || 0));
  /* De ruwe boekguard, zoals kern/motorverbinding.js hem aanroept. */
  const boekguard = async body => {
    const r = await fetch(url + '/api/pay/boekguard', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { url, stop, saldi, saldo, boekguard, log: () => log };
}

module.exports = { startEchteMotor, MOTOR_BIN: BIN };
