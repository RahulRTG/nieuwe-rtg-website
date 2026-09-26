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
const { execFileSync } = require('node:child_process');

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
  } catch (e) {
    /* macOS heeft geen /proc, maar ps onderscheidt daar dezelfde zombie. Zonder
       deze tweede lezing bleef een door de proef geveld kind vijf seconden
       schijnbaar leven omdat zijn ouder hem nog niet had geoogst. */
    try {
      const stand = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' }).trim();
      if (/^Z/.test(stand)) return false;
    } catch (geenPs) { /* voorzichtig: als ook ps niets zegt, telt het PID als levend */ }
  }
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

/* De proceskring: alle nakomelingen van een wortel-PID. Linux levert ze uit
   /proc; op macOS bestaat die boom niet en gebruiken we pgrep met een losse
   argumentlijst (dus zonder shell). Recursief, want een toets die een server
   start die een werker start is drie diep. */
function kringVan(wortel, gezien = new Set()) {
  const uit = [];
  let kinderen = [], viaProc = true;
  try {
    kinderen = fs.readFileSync('/proc/' + wortel + '/task/' + wortel + '/children', 'utf8')
      .trim().split(/\s+/).filter(Boolean).map(Number);
  } catch (e) {
    viaProc = false;
    try {
      kinderen = execFileSync('pgrep', ['-P', String(wortel)], { encoding: 'utf8' })
        .trim().split(/\s+/).filter(Boolean).map(Number);
    } catch (geenKinderen) { kinderen = []; }
  }
  for (const k of kinderen) {
    if (gezien.has(k)) continue;
    gezien.add(k);
    /* EEN KIND DAT AL WEG IS, LEGGEN WE NIET VAST. Tussen het lezen van de
       kinderlijst en van /proc/<pid>/stat kan een kortlevend kind verdwijnen;
       dan is zijn starttijd `null`, en zelfdeProces() rekent een PID zonder
       starttijd voorzichtig als hetzelfde proces. Op een drukke runner krijgt
       een ander proces dat nummer, en dan "leefde" er na een schone herstel()
       ineens weer een wees (test/afbouwketen.test.js zakte daarop in CI). Waar
       /proc er is, betekent geen starttijd: er is niets meer. */
    const m = merk(k);
    if (viaProc && m.start == null) continue;
    uit.push(m);
    uit.push(...kringVan(k, gezien));
  }
  return uit;
}

function lees() {
  try { return JSON.parse(fs.readFileSync(AFLOOP, 'utf8')); }
  catch (e) { return null; }
}
/* ATOMAIR, EN DAT IS GEEN NETHEID MAAR DE BELOFTE VAN `lees()` HIERBOVEN.

   Hier stond een kale writeFileSync. Die MAAKT het bestand eerst (of kapt het
   af op nul) en vult het daarna, dus er is een venster waarin de afloop wel
   BESTAAT en niet PARSEERT. `lees()` geeft dan `null`, en null betekent in deze
   laag "er loopt geen ronde" -- de lezing faalt dus OPEN: een tweede
   bronmuterende ronde zou mogen starten naast een ronde die gewoon draait.

   Dat venster is echt waargenomen en niet bedacht. test/afbouwketen.test.js
   wacht met `fs.existsSync` tot de afloop er is en leest hem meteen daarna; op
   deze machine is dat 363 ms groen, op een belaste CI-runner (419 toetsbestanden,
   vier parallel, twee containers) zakte hij op `null.stand` -- twee rondes
   achter elkaar, op een toets en een laag die geen letter waren veranderd.

   Schrijven naar een buurbestand en dan renamen maakt de vervanging ondeelbaar:
   een lezer ziet de oude afloop of de nieuwe, nooit een halve. De naam draagt
   het pid, want twee rondes die tegelijk hun tijdelijke bestand schrijven mogen
   elkaars bestand niet overschrijven. Er kijkt niets met fs.watch naar dit pad
   (nagetrokken), dus een nieuwe inode breekt niemand.

   Waarom de REPARATIE hier zit en niet in de wacht van die toets: de toets
   beweert "pak() hoort de ronde als RUNNING te publiceren", en dat is precies
   wat een niet-atomaire schrijf niet garandeert. De wacht verbreden had de toets
   groen gekregen en de belofte onbewezen gelaten -- LAT.md regel 1. */
function schrijf(o) {
  fs.mkdirSync(path.dirname(AFLOOP), { recursive: true, mode: 0o700 });
  const tijdelijk = AFLOOP + '.' + process.pid + '.tmp';
  fs.writeFileSync(tijdelijk, JSON.stringify(o, null, 1) + '\n', { mode: 0o600 });
  try { fs.renameSync(tijdelijk, AFLOOP); }
  catch (e) { try { fs.unlinkSync(tijdelijk); } catch (e2) {} throw e; }
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
    /* EEN WAARNEMER BEOORDEELT, HIJ HERSCHRIJFT NIET.

       Hier stond de verleiding om `ABORTED` weg te schrijven zodra de wortel
       dood blijkt. Dat zou de fout zijn die deze hele module bestrijdt, een
       niveau hoger: dan reconstrueert een OPVOLGER een terminale toestand uit
       een AFWEZIGHEID, en daarna is niet meer te zien of de ronde zelf heeft
       gezegd dat zij stopte of dat iemand anders dat voor haar invulde.

       De opgeslagen stand blijft dus RUNNING, en wat deze functie teruggeeft is
       een OORDEEL: `ONVOLTOOID`. Een terminale stand kan alleen ontstaan bij de
       eigenaar van de ronde (via klaar() of de exitcode) of bij een expliciete
       herstel() met naam en reden. */
    /* RUNNING. Leeft de wortel nog, dan loopt er echt iets. Leeft hij niet, dan
       is de ronde gestorven zonder iets te schrijven -- en dat is precies de
       toestand waar deze hele module voor bestaat: het is GEEN klaar. */
    const leeft = zelfdeProces(a.wortel);
    return { mag: false, stand: a.stand, wezen,
      oordeel: leeft ? 'LOOPT' : 'ONVOLTOOID',
      reden: leeft ? 'de vorige ronde loopt nog (' + a.taak + ', PID ' + a.wortel.pid + ')'
        : 'de opgeslagen stand is RUNNING en de wortel leeft niet meer: gestorven zonder eigen afloop. ' +
          'Die stand wordt hier NIET herschreven -- een terminale toestand komt van de eigenaar of van een expliciete herstel()' };
  }
  if (wezen.length) return { mag: false, stand: a.stand, wezen, oordeel: 'VUILE_RUNTIME',
    reden: 'de vorige ronde is ' + a.stand + ' maar ' + wezen.length + ' proces(sen) uit haar kring leven nog; een nieuwe meting zou langs hun poorten en bestanden meten' };
  /* MAG ER GEWERKT WORDEN, EN IS HET RESULTAAT BEWIJS -- twee vragen, en hier
     stond maar een antwoord.

     De eerste versie liet alleen PASSED een opvolger vrijgeven. Dat is strenger
     dan de wet ("een expliciete terminale toestand EN een aantoonbaar beeindigde
     proceskring") en het zet de machine vast: een mutatieronde die overlevende
     mutanten vindt eindigt FAILED, en dat is een VOLTOOIDE ronde. Daarna kwam er
     nooit meer een volgende, tot iemand met de hand in het bestand ging --
     precies de poort-die-nooit-opengaat waar de kop van wezenVan() voor
     waarschuwt, een niveau hoger.

     De tweede vraag verdwijnt daarmee niet, hij krijgt zijn eigen veld.
     `resultaatBruikbaar` zegt of de UITKOMST van die ronde als bewijs mag
     meetellen, en dat blijft alleen bij PASSED. Wie een FAILED ronde als bewijs
     wil lezen, moet dat veld negeren en dat is dan zichtbaar. */
  return { mag: true, stand: a.stand, oordeel: a.stand, wezen: [],
    resultaatBruikbaar: a.stand === 'PASSED',
    reden: a.stand === 'PASSED'
      ? 'de vorige ronde is PASSED en haar proceskring is leeg'
      : 'de vorige ronde eindigde op ' + a.stand + ' en haar proceskring is leeg: zij is voltooid, ' +
        'dus er mag gewerkt worden -- haar UITKOMST telt niet als bewijs' };
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

/* DE DIAGNOSE, EN WAAROM HIJ HIER STAAT EN NIET IN scripts/check.js.

   Een afbouwslot dat alleen "rood" zegt, wordt in de CI een mysterie dat mensen
   leren wegkijken. De weigering hoort dus te noemen WELKE run blokkeert, welke
   stand die heeft, welke procesidentiteit nog leeft, en wat de actie is.

   Dat formaat woont hier omdat er twee lezers zijn -- de keuring en
   test/afbouwafloop.test.js -- en twee kopieen van dezelfde tekst lopen uiteen
   zodra er een veld bijkomt. De toets kan nu de ECHTE diagnose beproeven in
   plaats van een nagebouwde. */
function diagnose(g, a) {
  const wezen = g.wezen || [];
  return 'afbouwslot: GEWEIGERD\n' +
    '      vorige run:       ' + ((a && a.runId) || '?') + '  (' + ((a && a.taak) || 'onbenoemd') + ')\n' +
    '      opgeslagen stand: ' + ((a && a.stand) || '?') +
      (a && a.gestart ? '  gestart ' + a.gestart : '') +
      (a && a.geeindigd ? ', geeindigd ' + a.geeindigd : ', nooit afgerond') + '\n' +
    '      oordeel:          ' + (g.oordeel || '?') + '\n' +
    '      levende kinderen: ' + wezen.length +
      (wezen.length ? '  ->  ' + wezen.map(w => 'pid ' + w.pid + ' (start ' + w.start + ')').join(', ') : '') + '\n' +
    '      reden:            ' + g.reden + '\n' +
    '      actie:            ' + (wezen.length
      /* GEEN PLAKBARE require() IN DEZE TEKST, en dat is geen stijlkwestie.

         Hier stond een plakbaar `node -e`-commando dat deze module met een
         relatief pad inlaadde.
         sluiting() in scripts/lib/stempel.js zoekt in de BRON naar require(...)
         om te bepalen wat een instrument inleest, en een require met iets anders
         dan een letterlijke tekst maakt die sluiting ONBEKEND -- fail-closed, en
         terecht. Het vond deze aanroep binnen een string, en daarmee viel de
         sluiting van elk instrument dat dit bestand bereikt (via afbouw-slot.js
         ook scripts/poortwacht.js) op null. Gevolg: toets 12 van
         test/schoneboom.test.js zakte op iets wat alleen een hulpzin was.

         De les is groter dan deze regel, en ik ben er bij het OPSCHRIJVEN nog
         een keer in getrapt: de eerste versie van dit commentaar citeerde het
         kapotte commando letterlijk, en toen bleef de sluiting gewoon null. Die
         zeef leest commentaar net zo goed als code. Noem het bestand en de
         functie dus met woorden, ook in een uitleg. */
      ? 'ruim eerst op met ruimOp() uit scripts/lib/afbouw-afloop.js'
      : 'sluit de ronde met de hand af: herstel({ stand: \'ABORTED\', reden, door }) -- PASSED kan alleen de ronde zelf');
}

/* EEN RONDE MET DE HAND AFSLUITEN -- de enige weg uit een ONVOLTOOID.

   magStarten() weigert een ronde die RUNNING staat met een dode wortel, en hij
   herschrijft die stand met opzet niet. Zonder deze functie zou daar geen uitweg
   zijn: het slot gaat correct dicht en niemand komt er ooit uit. Een poort
   zonder uitgang wordt vanzelf het volgende productieprobleem.

   HIJ KAN NOOIT `PASSED` SCHRIJVEN, en dat is de kern. Een herstelhandeling weet
   dat de ronde stopte; zij weet NIET dat het werk goed is gegaan -- alleen de
   ronde zelf kan dat zeggen, en die is er niet meer. Wie hier PASSED zou mogen
   zetten, kan elke afgebroken meting alsnog tot bewijs verklaren.

   De uitslag draagt WIE het deed en WAAROM, zodat later te zien is dat deze
   terminale toestand van een mens komt en niet van de ronde. */
function herstel({ stand, reden, door } = {}) {
  if (!['ABORTED', 'FAILED'].includes(stand))
    throw new Error('herstel() sluit een ronde af als ABORTED of FAILED; PASSED kan alleen de ronde zelf schrijven');
  if (!reden || String(reden).trim().length < 5)
    throw new Error('herstel() vraagt een reden -- een terminale toestand zonder reden is een vinkje');
  const a = lees();
  if (!a) throw new Error('er is geen ronde om te herstellen');
  const wezen = wezenVan(a);
  if (wezen.length)
    throw new Error('er leven nog ' + wezen.length + ' proces(sen) uit deze ronde; ruim die eerst op (ruimOp)');
  schrijf(Object.assign({}, a, {
    stand, geeindigd: a.geeindigd || new Date().toISOString(),
    hersteld: { door: door || 'onbekend', reden: String(reden), op: new Date().toISOString(),
      wasStand: a.stand }
  }));
  return lees();
}

/* ---------------------------------------------------------------------------
   EEN RONDE BEGINNEN. Geeft een klaar()-functie terug; wordt die niet
   aangeroepen, dan blijft ABORTED staan.
--------------------------------------------------------------------------- */
function begin({ taak, commit, basis, verwachteUitvoer, poorten, uitExitcode } = {}) {
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

  /* DE HARTSLAG -- en die is er omdat test/afbouwketen.test.js een gat vond dat
     precies in het midden van deze wet zat.

     De kring werd alleen bij leg() vastgelegd, dus alleen bij een NETTE afloop.
     Maar het geval waar deze module voor bestaat is juist de ONNETTE: een ronde
     die door SIGKILL wordt geveld schrijft niets, en dan stond er `kring: []`.
     wezenVan() vond dus nul wezen, de diagnose noemde geen enkel levend kind, en
     de drie processen die negentien minuten poorten vasthielden zouden opnieuw
     onzichtbaar zijn geweest. De wet beloofde iets wat de implementatie alleen
     kon waarmaken als er niets ergs gebeurde.

     WAAROM EEN HARTSLAG EN GEEN PROCESGROEP. De verleiding is om bij begin() de
     procesgroep vast te leggen en na de dood van de wortel alles in die groep
     als wees te tellen. Dat is korter en het is fout: een ronde die als
     `npm run ...` uit een schil start, deelt haar groep met die schil en met
     alles wat daar verder draait. Dan ruimt ruimOp() het verkeerde proces op,
     en dat is de duurste fout die deze module kan maken.

     De hartslag legt dus af en toe de ECHTE afstammingskring vast, uit /proc.
     De prijs staat er eerlijk bij: wat in de laatste tel voor de kill is
     gestart, staat er niet in. Een bronmuterende ronde duurt uren; dit venster
     is seconden. De interval is te zetten met RTG_AFLOOP_HARTSLAG (ms) zodat
     een toets hem kan beproeven zonder erop te wachten. */
  const hartslagMs = Number(process.env.RTG_AFLOOP_HARTSLAG) > 0
    ? Number(process.env.RTG_AFLOOP_HARTSLAG) : 5000;
  let af = false;
  const klop = () => {
    if (af) return;
    const a = lees();
    /* Alleen de eigen ronde bijwerken. Heeft iemand anders inmiddels herstel()
       gedraaid of een nieuwe ronde geopend, dan hoort deze hartslag te zwijgen
       in plaats van eroverheen te schrijven. */
    if (!a || a.runId !== runId || a.stand !== 'RUNNING') return;
    try { schrijf(Object.assign({}, a, { kring: kringVan(process.pid), kringGepeild: new Date().toISOString() })); }
    catch (e) { /* een getuige mag een ronde nooit laten vallen */ }
  };
  const hartslag = setInterval(klop, hartslagMs);
  if (hartslag.unref) hartslag.unref();   // de hartslag houdt het proces nooit in leven

  const leg = (stand, extra) => {
    if (af) return;
    af = true;
    clearInterval(hartslag);
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
  /* DE UITKOMST UIT DE EXITCODE, en dat is iets anders dan "het proces is weg".
     Een exitcode is een expliciete terminale uitspraak van het proces zelf: 0
     betekent dat het zijn werk afmaakte, alles daarboven dat het faalde. Wie
     door SIGKILL wordt geveld schrijft NIETS -- en dan blijft RUNNING staan,
     precies de toestand die magStarten() als "gestorven zonder af te ronden"
     herkent.

     Zonder deze afleiding zou elke geslaagde ronde ABORTED heten, want de vier
     aanroepers van afbouw-slot.pak() roepen hun geefVrij() zonder argument aan.
     Dan weigert de poort voortaan altijd, en een poort die nooit opengaat is
     geen poort (dezelfde les als de wortel-als-wees hierboven). */
  process.once('exit', (code) => leg(uitExitcode ? (code === 0 ? 'PASSED' : 'FAILED') : 'ABORTED'));
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

module.exports = { begin, lees, magStarten, ruimOp, herstel, diagnose, wezenVan, kringVan, zelfdeProces, procesLeeft, AFLOOP, STANDEN, TERMINAAL };
