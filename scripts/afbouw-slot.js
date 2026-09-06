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

/* KIJKEN OF ER EEN AFBOUW LOOPT, ZONDER HET SLOT TE PAKKEN.

   pak() is exclusief en gooit als een ander hem heeft. Dat is goed voor een
   motor die de bron muteert, en verkeerd voor een LEZER: twee metingen mogen
   prima naast elkaar draaien. Wat niet mag, is naast een motor die met opzet
   bestanden neerzet en weghaalt.

   DAT IS HIER ECHT MISGEGAAN, twee keer op een dag. test/meterijk.test.js zet
   tijdens zijn ijking een tijdelijk scherm onder public/apps/ neer, een
   pakketregel met diezelfde naam in package.json, en honderd proefroutes in
   server/routes/klok.js. (Die naam staat hier niet voluit: keuringsregel 36
   grep't de rauwe bron op de ijknaam en kan commentaar niet van code
   onderscheiden, en de regel weigert met reden een uitzonderingslijst. Alleen
   test/meterijk.test.js mag hem noemen, want daar wordt hij gemaakt.) -- allemaal om te bewijzen dat de tellers bewegen, en
   allemaal netjes teruggezet in een finally. Maar wie er middenin meet, meet
   die aanbouw mee. scripts/kaart.js telde het extra scherm en schreef het in
   ARCHITECTUUR.md; CI zag daarna een document dat achterliep op de code.

   `eisSchoneBoom` vangt dit maar bij toeval: git ziet de aanbouw wel, maar een
   meting die START in een schoon venster en er middenin belandt, komt er
   gewoon langs. Deze controle is deterministisch. */
function actief() {
  const huidig = leesEigenaar();
  return eigenaarLeeft(huidig) ? huidig : null;
}

/* DE POORT ZELF, zodat de drie families hem niet elk overschrijven. Geeft een
   REDEN terug en niet alleen een ja/nee: wie geweigerd wordt, hoort te zien
   welke motor draait en sinds wanneer, anders lijkt het op een storing.

   De ontsnapping (RTG_METEN_TIJDENS_AFBOUW=1) hoort bij een harde poort, en
   mag hier alleen omdat zo'n ronde daarmee zelf zegt dat hij niet als bewijs
   telt -- dezelfde afspraak als RTG_METEN_OP_VUILE_BOOM in lib/stempel.js. */
function eisGeenAfbouw(naam, lees) {
  if (process.env.RTG_METEN_TIJDENS_AFBOUW === '1') {
    return { ok: true, reden: 'toegestaan met RTG_METEN_TIJDENS_AFBOUW=1; deze uitslag telt niet als bewijs' };
  }
  /* HET SLOT VAN JE EIGEN OUDER IS GEEN VREEMDE MOTOR, en dat onderscheid hoort
     hier omdat het slot twee dingen tegelijk betekent: "ik verbouw de bron" en
     "ik wil exclusiviteit". scripts/test-runner.js pakt het voor het tweede --
     de suite verbouwt niets -- en geeft RTG_AFBOUW_SLOT_ACTIEF=1 door aan elk
     kindproces, dezelfde vlag die pak() al kent.

     ZONDER DEZE REGEL WEIGERT DE POORT BINNEN ELKE TOETS. Dat is precies wat er
     gebeurde toen hij erbij kwam: test/functielijst.test.js viel om met
     exitCode 2 (scripts/functielijst.js doet process.exit(2) op een weigering)
     en test/schoneboom.test.js zakte twee keer, want eisSchoneBoom gaf een
     weigering terug zonder `bestanden` en met een reden die zijn eigen
     ontsnapping RTG_METEN_OP_VUILE_BOOM niet noemt. Een poort die het gevraagde
     vermogen verbergt is een gebrek en geen veiligheid.

     WAT DIT NIET WEGGEEFT: binnen een suite raakt alleen een IJKING de bron aan,
     en scripts/lib/ijkingen.js draait die een voor een -- in CI zelfs elk in een
     eigen job. Die isolatie is daar de bescherming. Deze poort gaat over een
     motor in een ANDERE proceslijn: een shell die kaart.js draait naast een
     lopende meterijking, het geval waarvoor hij is gebouwd. */
  if (process.env.RTG_AFBOUW_SLOT_ACTIEF === '1') {
    return { ok: true, reden: 'het slot is van de eigen proceslijn (RTG_AFBOUW_SLOT_ACTIEF=1); ' +
      'de ouder die het pakte is verantwoordelijk, niet deze aanroep' };
  }
  const bezig = (lees || actief)();
  if (!bezig) return { ok: true, reden: 'er loopt geen afbouw' };
  return { ok: false, afbouw: bezig,
    reden: (naam || 'deze meting') + ' kan niet draaien terwijl er een afbouw loopt: ' +
      (bezig.taak || 'onbekende taak') + ' (PID ' + bezig.pid + ', gestart ' +
      (bezig.gestart || 'onbekend') + '). Die motor zet met opzet bestanden neer en haalt ze ' +
      'weer weg; een meting ernaast telt die aanbouw mee. Wacht tot hij klaar is.' };
}

module.exports = { pak, actief, eisGeenAfbouw, procesLeeft, procesStart, eigenaarLeeft };
