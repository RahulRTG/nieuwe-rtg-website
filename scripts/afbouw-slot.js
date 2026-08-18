/* Eén proces tegelijk mag bronmuterende tests, een releasepoort of de
   stagingrepetitie uitvoeren. Zo kan een tijdelijk ijkbestand nooit meer een
   geldige Sentinel-scan vervuilen.

   Het slot draagt PID, taaknaam EN de starttijd van het proces. Die derde is
   er niet voor de sier: op een drukke machine worden PID's hergebruikt, en
   dan "leeft" de eigenaar van een verweesd slot schijnbaar nog -- drie
   opeenvolgende meetrondes in deze sessie strandden zo op een slot van een
   allang gestorven proces waarvan het PID inmiddels van iemand anders was.
   De starttijd (veld 22 van /proc/<pid>/stat, in klokticks sinds boot) maakt
   de claim eenduidig: zelfde PID met een andere starttijd is een ANDER
   proces, en dan is het slot aantoonbaar verweesd. Waar /proc niet bestaat
   valt de controle terug op alleen het PID -- het oude gedrag. */
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

/* De starttijd van een proces, of null waar dat niet te lezen is. */
function procesStart(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    // veld 22, geteld NA de ")": de procesnaam zelf kan spaties en haakjes bevatten
    const na = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(na[19]) || null;
  } catch (e) { return null; }
}

/* Is dit nog steeds DEZELFDE eigenaar -- niet alleen een levend PID? */
function eigenaarLeeft(huidig) {
  if (!huidig || !procesLeeft(Number(huidig.pid))) return false;
  const nu = procesStart(Number(huidig.pid));
  if (huidig.start == null || nu == null) return true;   // geen /proc: oude gedrag
  return nu === huidig.start;
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
      fs.writeFileSync(EIGENAAR, JSON.stringify({ pid: process.pid, start: procesStart(process.pid), taak, gestart: new Date().toISOString() }) + '\n', { mode: 0o600 });
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
      if (eigenaarLeeft(huidig)) {
        throw new Error('Afbouw is al actief: ' + (huidig.taak || 'onbekende taak') +
          ' (PID ' + huidig.pid + ', gestart ' + (huidig.gestart || 'onbekend') + ').');
      }
      // Alleen een aantoonbaar verweesd slot wordt hersteld.
      fs.rmSync(SLOT, { recursive: true, force: true });
    }
  }
  throw new Error('Het exclusieve afbouwslot kon niet veilig worden verkregen.');
}

module.exports = { pak, procesLeeft, procesStart, eigenaarLeeft };
