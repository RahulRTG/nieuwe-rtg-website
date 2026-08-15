/* Eén proces tegelijk mag bronmuterende tests, een releasepoort of de
   stagingrepetitie uitvoeren. Zo kan een tijdelijk ijkbestand nooit meer een
   geldige Sentinel-scan vervuilen. Het slot bevat alleen PID en taaknaam. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SLOT = path.join(ROOT, '.release', 'afbouw-slot');
const EIGENAAR = path.join(SLOT, 'eigenaar.json');

function procesLeeft(pid) {
  if (!Number.isSafeInteger(pid) || pid < 2) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }
}

function leesEigenaar() {
  try { return JSON.parse(fs.readFileSync(EIGENAAR, 'utf8')); }
  catch (e) { return null; }
}

function pak(taak) {
  fs.mkdirSync(path.dirname(SLOT), { recursive: true, mode: 0o700 });
  for (let poging = 0; poging < 3; poging++) {
    try {
      fs.mkdirSync(SLOT, { mode: 0o700 });
      fs.writeFileSync(EIGENAAR, JSON.stringify({ pid: process.pid, taak, gestart: new Date().toISOString() }) + '\n', { mode: 0o600 });
      let vrij = false;
      const geefVrij = () => {
        if (vrij) return;
        vrij = true;
        const huidig = leesEigenaar();
        if (huidig && huidig.pid === process.pid) fs.rmSync(SLOT, { recursive: true, force: true });
      };
      process.once('exit', geefVrij);
      for (const [signaal, code] of [['SIGINT', 2], ['SIGTERM', 15]]) {
        process.once(signaal, () => { geefVrij(); process.exit(128 + code); });
      }
      return geefVrij;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const huidig = leesEigenaar();
      if (huidig && procesLeeft(Number(huidig.pid))) {
        throw new Error('Afbouw is al actief: ' + (huidig.taak || 'onbekende taak') +
          ' (PID ' + huidig.pid + ', gestart ' + (huidig.gestart || 'onbekend') + ').');
      }
      // Alleen een aantoonbaar verweesd slot wordt hersteld.
      fs.rmSync(SLOT, { recursive: true, force: true });
    }
  }
  throw new Error('Het exclusieve afbouwslot kon niet veilig worden verkregen.');
}

module.exports = { pak, procesLeeft };
