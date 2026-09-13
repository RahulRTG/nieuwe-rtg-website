/* ============================================================================
   DE AFLOOP VAN EEN MEETRONDE -- twee bewijzen, niet een afwezigheid.

   WAAROM DIT BESTAAT, en het komt uit een fout die ik hier zelf heb gemaakt.
   scripts/afbouw-slot.js bewaakt al dat er maar EEN bronmuterende ronde tegelijk
   loopt, en hij is zelfs slim genoeg om een hergebruikt PID te herkennen (hij
   vergelijkt de starttijd uit /proc). Maar hij geeft het slot vrij op `exit`,
   `SIGINT` en `SIGTERM` -- en SIGKILL is niet af te vangen. Een schone
   afronding, een crash en een kill zien er daarna IDENTIEK uit: het slot is weg.

   Op 13 september 2026 brak ik een ijkronde af die 146 bestanden gesaboteerd had
   staan. Een wachtketting die toetste "draait het proces nog?" las die
   afwezigheid als "klaar" en startte de volgende stap. Erger: er bleven DRIE
   processen achter (een toets met twee servers eraan) die poorten vasthielden,
   negentien minuten lang, zonder eigenaar. scripts/mutatie.js waarschuwt in zijn
   eigen commentaar precies daarvoor -- "die stapelen zich op, houden poorten en
   geheugen vast, en vervuilen de metingen die erna komen".

   DAARUIT VOLGEN TWEE VERSCHILLENDE BEGRIPPEN, en ze liepen door elkaar:

     WERKSTATUS    is de ronde inhoudelijk af? (PASSED / FAILED / ABORTED)
     PROCESBEZIT   is de runtime schoon? (leeft er nog iets van die ronde?)

   Een ronde kan ABORTED zijn terwijl drie kinderen nog routes en poorten
   vasthouden. Dan is een volgende meting formeel nieuw en materieel vervuild.

   DE WET:

     Een nieuwe meetronde mag alleen starten wanneer de vorige ronde een
     expliciete terminale toestand heeft EN zijn volledige proceskring
     aantoonbaar beeindigd is.

   DE STANDAARDUITKOMST IS `ABORTED`, en dat is de hele omkering. begin() schrijft
   meteen RUNNING; alleen een expliciete klaar('PASSED') maakt er PASSED van. Wie
   niet afmaakt -- crash, kill, stille stop -- laat ABORTED achter. Afwezigheid
   bewijst niets meer; er staat altijd iets, en dat iets is standaard ongunstig.

   EEN PID IS GEEN IDENTITEIT. PID's worden hergebruikt, en dan houd je een vreemd
   proces voor een oud kind -- of erger, je ruimt bij het opruimen het verkeerde
   proces op. Elk proces wordt daarom vastgelegd als PID PLUS starttijd (veld 22
   uit /proc/<pid>/stat, in klokticks sinds boot). Zelfde PID met een andere
   starttijd is een ANDER proces, en dat telt dus niet als wees.

   WAT HIER NIET IN ZIT, met de reden. Resources (poorten, bestandssloten) worden
   wel GENOEMD in het afbouwbewijs maar niet zelfstandig gepeild: een poort vrij
   noemen omdat niemand hem in /proc claimt, is een gevolgtrekking uit afwezig
   bewijs -- precies wat dit bestand bestrijdt. Wat er staat is welke poorten de
   ronde ZEI te gebruiken; het peilen daarvan is werk voor wie een echte
   poortcontrole aansluit, en tot die tijd staat het als `ongepeild` in de uitslag.
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
/* Het pad is te verleggen, en niet voor productie -- daar is het altijd
   .release/. Het is er zodat test/afbouwafloop.test.js zijn twee sabotages in
   een wegwerpmap kan draaien met ECHTE processen. Een tegenproef die het
   werkelijke afloopbestand overschrijft, zou de volgende meetronde blokkeren op
   iets wat nooit is gebeurd. */
const AFLOOP = process.env.RTG_AFLOOP_PAD
  ? path.resolve(process.env.RTG_AFLOOP_PAD)
  : path.join(ROOT, '.release', 'afbouw-afloop.json');

const STANDEN = ['RUNNING', 'PASSED', 'FAILED', 'ABORTED'];
const TERMINAAL = ['PASSED', 'FAILED', 'ABORTED'];

/* De starttijd van een proces, of null waar dat niet te lezen is. Zelfde
   afleiding als scripts/afbouw-slot.js -- veld 22 geteld NA de ")", want de
   procesnaam zelf kan spaties en haakjes bevatten. */
function procesStart(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const na = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(na[19]) || null;
  } catch (e) { return null; }
}
/* EEN ZOMBIE IS GEEN LEVEND WERK, en dat onderscheid is hier niet academisch.

   Een gedood kind blijft als `Z` (defunct) in de procestabel staan tot zijn
   ouder hem oogst. Zolang dat niet gebeurt, SLAAGT `process.kill(pid, 0)`
   gewoon -- het lijk is adresseerbaar. Wie daarop afgaat, ziet een opgeruimd
   kind eeuwig als wees en gaat nooit meer open.

   Maar een zombie houdt geen poort vast, geen bestandslot en geen geheugen: al
   zijn resources zijn al vrij, er staat alleen nog een regel in de tabel te
   wachten op een ouder. Voor de vraag die deze module stelt -- kan een nieuwe
   meting langs achtergelaten werk meten -- is hij dus dood.

   Gevonden door toets 2 van test/afbouwafloop.test.js: ruimOp() doodde het kind
   aantoonbaar (hij meldde het PID) en de toets zag het daarna nog "leven". */
function procesLeeft(pid) {
  if (!Number.isSafeInteger(pid) || pid < 2) return false;
  try { process.kill(pid, 0); } catch (e) { return e.code === 'EPERM'; }
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const na = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (na[0] === 'Z') return false;          // defunct: adresseerbaar, maar houdt niets meer vast
  } catch (e) { /* geen /proc: het oude, voorzichtige gedrag -- hij telt als levend */ }
  return true;
}
/* LEEFT DIT NOG, EN IS HET NOG HETZELFDE? Een PID dat leeft maar een andere
   starttijd draagt, is een ander proces dat het nummer heeft geerfd. Dat is geen
   wees van ons en wordt dus niet opgeruimd -- die vergissing kost je het
   verkeerde proces. */
function zelfdeProces(p) {
  if (!p || !procesLeeft(Number(p.pid))) return false;
  const nu = procesStart(Number(p.pid));
  if (p.start == null || nu == null) return true;    // geen /proc: het oude, voorzichtige gedrag
  return nu === Number(p.start);
}
const merk = (pid) => ({ pid: Number(pid), start: procesStart(Number(pid)) });

/* De proceskring: alle nakomelingen van een wortel-PID, uit /proc. Recursief,
   want een toets die een server start die een werker start is drie diep. */
function kringVan(wortel, gezien = new Set()) {
  const uit = [];
  let kinderen = [];
  try {
    kinderen = fs.readFileSync('/proc/' + wortel + '/task/' + wortel + '/children', 'utf8')
      .trim().split(/\s+/).filter(Boolean).map(Number);
  } catch (e) { kinderen = []; }
  for (const k of kinderen) {
    if (gezien.has(k)) continue;
    gezien.add(k);
    uit.push(merk(k));
    uit.push(...kringVan(k, gezien));
  }
  return uit;
}

function lees() {
  try { return JSON.parse(fs.readFileSync(AFLOOP, 'utf8')); }
  catch (e) { return null; }
}
function schrijf(o) {
  fs.mkdirSync(path.dirname(AFLOOP), { recursive: true, mode: 0o700 });
  fs.writeFileSync(AFLOOP, JSON.stringify(o, null, 1) + '\n', { mode: 0o600 });
}

/* WELKE VAN DE VASTGELEGDE KINDEREN LEVEN ER NOG? Dit is het afbouwbewijs, en
   het is met opzet een LIJST en geen boolean: wie moet opruimen, wil weten wat. */
function wezenVan(afloop) {
  if (!afloop) return [];
  /* ALLEEN DE KINDEREN, NOOIT DE WORTEL -- en die regel is precies het verschil
     tussen de twee begrippen waar deze module over gaat.

     De eerste versie telde de wortel mee, en dat leek streng maar was een
     categoriefout: de wortel IS het proces van de ronde zelf. Bij een normale
     afronding leeft hij nog, want hij is degene die klaar('PASSED') aanroept.
     Een PASSED-ronde blokkeerde daardoor zichzelf -- en dat is geen strengheid
     maar een poort die nooit opengaat, wat erger is dan geen poort.

     De liveness van de WORTEL is een vraag over de WERKSTATUS en die wordt
     hieronder in magStarten() gesteld: staat er RUNNING en leeft de wortel niet,
     dan is de ronde gestorven zonder iets te schrijven. De liveness van de
     KINDEREN is een vraag over PROCESBEZIT, en dat is deze functie.

     Gevonden door toets 1 van test/afbouwafloop.test.js. */
  return (afloop.kring || []).filter(zelfdeProces);
}

/* ---------------------------------------------------------------------------
   DE POORT. Hij geeft een REDEN terug en niet alleen een ja of nee: een
   weigering die niet zegt waarom, leert niemand iets (CONTROLPLANE.md -- een
   storing hoort niet te klinken als een overtreding).
--------------------------------------------------------------------------- */
function magStarten(taak) {
  const a = lees();
  if (!a) return { mag: true, reden: 'geen eerdere ronde vastgelegd' };
  if (taak && a.taak && a.taak !== taak) {
    /* Een andere taak: zijn afloop zegt niets over deze. Maar zijn WEZEN wel --
       die houden dezelfde machine bezet. */
    const vreemd = wezenVan(a);
    if (vreemd.length) return { mag: false, reden: 'een andere ronde (' + a.taak + ') heeft nog ' + vreemd.length + ' proces(sen) in leven', wezen: vreemd, stand: a.stand };
    return { mag: true, reden: 'de vorige ronde was een andere taak (' + a.taak + ') en haar proceskring is leeg' };
  }
  const terminaal = TERMINAAL.includes(a.stand);
  const wezen = wezenVan(a);
  if (!terminaal) {
    /* RUNNING. Leeft de wortel nog, dan loopt er echt iets. Leeft hij niet, dan
       is de ronde gestorven zonder iets te schrijven -- en dat is precies de
       toestand waar deze hele module voor bestaat: het is GEEN klaar. */
    const leeft = zelfdeProces(a.wortel);
    return { mag: false, stand: a.stand, wezen,
      reden: leeft ? 'de vorige ronde loopt nog (' + a.taak + ', PID ' + a.wortel.pid + ')'
        : 'de vorige ronde schreef geen terminale toestand -- zij is gestorven of afgebroken, en dat is geen geslaagde afronding' };
  }
  if (wezen.length) return { mag: false, stand: a.stand, wezen,
    reden: 'de vorige ronde is ' + a.stand + ' maar ' + wezen.length + ' proces(sen) uit haar kring leven nog; een nieuwe meting zou langs hun poorten en bestanden meten' };
  if (a.stand !== 'PASSED') return { mag: false, stand: a.stand, wezen: [],
    reden: 'de vorige ronde eindigde op ' + a.stand + '; alleen PASSED geeft een opvolger vrij' };
  return { mag: true, stand: 'PASSED', reden: 'de vorige ronde is PASSED en haar proceskring is leeg' };
}

/* Bekende wezen beeindigen. Alleen processen die ALS ZELFDE PROCES herkend
   worden -- een hergebruikt PID raakt hier nooit iets. */
function ruimOp() {
  const a = lees();
  const wezen = wezenVan(a);
  const geraakt = [];
  for (const w of wezen) {
    try { process.kill(w.pid, 'SIGKILL'); geraakt.push(w.pid); } catch (e) { /* al weg */ }
  }
  if (a) schrijf(Object.assign({}, a, { opgeruimd: { op: new Date().toISOString(), geraakt } }));
  return geraakt;
}

/* ---------------------------------------------------------------------------
   EEN RONDE BEGINNEN. Geeft een klaar()-functie terug; wordt die niet
   aangeroepen, dan blijft ABORTED staan.
--------------------------------------------------------------------------- */
function begin({ taak, commit, basis, verwachteUitvoer, poorten } = {}) {
  const runId = 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const wortel = merk(process.pid);
  const start = {
    runId, taak: taak || 'onbenoemd', stand: 'RUNNING',
    commit: commit || null, basis: basis || null,
    gestart: new Date().toISOString(), geeindigd: null,
    wortel, kring: [],
    verwachteUitvoer: verwachteUitvoer || [], uitvoer: null,
    poorten: poorten || [], poortenGepeild: 'ongepeild',
    /* Waarom dit veld er is: zie de kop. Een poort vrij NOEMEN omdat niemand hem
       claimt, is een gevolgtrekking uit afwezig bewijs. */
    let: 'de standaarduitkomst is ABORTED; alleen een expliciete klaar(PASSED) verandert dat'
  };
  schrijf(start);

  let af = false;
  const leg = (stand, extra) => {
    if (af) return;
    af = true;
    const a = lees() || start;
    schrijf(Object.assign({}, a, {
      stand, geeindigd: new Date().toISOString(),
      kring: kringVan(process.pid),
      uitvoer: (extra && extra.uitvoer) || null,
      forceerKill: (extra && extra.forceerKill) || false
    }, extra && extra.extra ? extra.extra : {}));
  };
  /* De vangnetten. `exit` dekt een normale afloop en een throw; de signalen
     dekken een nette kill. SIGKILL dekt niets en KAN niets dekken -- en juist
     daarom staat er al RUNNING op schijf, zodat de volgende ronde ziet dat er
     nooit iets terminaals is geschreven. */
  process.once('exit', () => leg('ABORTED'));
  for (const [sig, code] of [['SIGINT', 2], ['SIGTERM', 15]]) {
    process.once(sig, () => { leg('ABORTED'); process.exit(128 + code); });
  }
  return {
    runId,
    klaar: (stand, extra) => {
      if (!STANDEN.includes(stand) || stand === 'RUNNING')
        throw new Error('afloop.klaar() vraagt een terminale stand: ' + TERMINAAL.join(', '));
      leg(stand, extra);
    }
  };
}

module.exports = { begin, lees, magStarten, ruimOp, wezenVan, kringVan, zelfdeProces, procesLeeft, AFLOOP, STANDEN, TERMINAAL };
