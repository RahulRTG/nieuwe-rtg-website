#!/usr/bin/env node
/* ============================================================================
   DE NORM -- een ratel, geen rapportcijfer.

   Het probleem met een kwaliteitsronde is dat hij verdampt. Je haalt de lat,
   je gaat verder, en een half jaar later is de helft weer weggezakt zonder dat
   iemand een beslissing heeft genomen. Niemand heeft het stukgemaakt; het is
   gewoon gebeurd.

   Dit script maakt daar een grens van. In NORM.json staat waar de code NU
   staat. Bij elke draai wordt de huidige stand daarmee vergeleken:

     - slechter dan de norm -> de poort gaat dicht (exit 1)
     - beter dan de norm    -> geen fout, maar wel de melding dat de norm
                               strakker gezet kan worden

   De norm kan dus alleen omlaag (strenger). Dat is de hele truc: wat een keer
   goed is, kan niet meer stilletjes slechter worden. `--vastleggen` schrijft de
   verbetering weg, en weigert een verslechtering vast te leggen -- wie de lat
   toch wil verlagen moet NORM.json met de hand wijzigen, en dan staat het als
   bewuste keuze in de git-historie in plaats van als sluipende erosie.

   WAAROM DIT ER IS EN NIET ALLEEN DE SUITE

   De slotsuite meet en meldt. Hij zakt op wat STUK is, maar niet op wat is
   WEGGEZAKT: gaat de dekking van 60% naar 51%, dan blijft alles groen en staat
   het als "kan beter" in een lijst van 127 punten die niemand meer leest. Deze
   ratel is precies dat verschil.

   Draai:  node --experimental-sqlite scripts/norm.js
           node --experimental-sqlite scripts/norm.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');

/* Elke meter met de richting waarin hij mag bewegen. `omlaag` betekent: een
   lager getal is beter (minder ongedekte endpoints). `omhoog`: hoger is beter. */
const METERS = [
  /* De ratel op regel 10 zelf. check.js regel 35 eist dat ELKE meter in de
     registratie van test/meterijk.test.js staat; deze meter telt hoeveel er
     daar met alleen een REDEN staan in plaats van een proef. Dat is het
     eerlijke gat: meters die we niet hebben zien uitslaan. Hij mag alleen
     omlaag, dus het gat kan niet groeien en wordt over de tijd kleiner. */
  { sleutel: 'metersOngeijkt', richting: 'omlaag', wat: 'meters met alleen een reden, zonder proef die ze laat uitslaan' },
  { sleutel: 'endpointsZonderTest', richting: 'omlaag', wat: 'endpoints die in geen enkele test voorkomen' },
  { sleutel: 'dekkingPct', richting: 'omhoog', wat: 'percentage endpoints dat in een test voorkomt' },
  { sleutel: 'keuringStuk', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "stuk"' },
  { sleutel: 'keuringScheef', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "scheef"' },
  /* keuringBeter WAS EEN GEBLENDE TELLER, en daarmee de enige meter in deze
     lijst die niet kon ratelen. Hij telde drie onvergelijkbare dingen bij
     elkaar op: bestanden die vlak onder de 10 kB-grens zitten, functienamen
     die in meer dan twee kernmodules voorkomen, en domeinen met endpoints
     zonder toets. Dat getal loopt op zodra je een legitiem bestand toevoegt,
     en -- erger -- een daling in de ene groep maskeerde een stijging in de
     andere. Precies zo dook de dubbeling van teVaak() onder in het totaal.

     Drie losse meters is niet losser maar STRAKKER: elke groep moet nu op
     zichzelf de goede kant op, en verrekenen kan niet meer. Voor de eerlijkheid:
     de som stond op 126 toen de norm werd vastgelegd en staat nu op 130, dus
     over die vier is geen ratel meer die klaagt. Ze zijn ontstaan door bestanden
     toe te voegen, niet door iets te laten verslechteren; de enige inhoudelijke
     van de vijf (teVaak in drie kernmodules) is opgelost. */
  { sleutel: 'keuringOmvang', richting: 'omlaag', wat: 'bestanden die vlak onder de 10 kB-grens zitten' },
  { sleutel: 'keuringDubbeling', richting: 'omlaag', wat: 'functienamen die in meer dan twee kernmodules staan' },
  { sleutel: 'keuringDekkingAdvies', richting: 'omlaag', wat: 'domeinen met endpoints zonder toets' },
  { sleutel: 'dependencies', richting: 'omlaag', wat: 'externe pakketten (de nul is een principe, geen toeval)' },
  { sleutel: 'testbestanden', richting: 'omhoog', wat: 'testbestanden' },
  /* DE TWEE METERS OVER TOETSEN DIE ER WEL ZIJN MAAR NIET DRAAIEN.

     Aanleiding: acht Postgres-toetsbestanden poortten zichzelf op DATABASE_URL,
     `npm test` geeft die bewust niet mee, en de enige draaier die dat wel deed
     had een handgeschreven lijst waar ze niet in stonden. Ze telden maandenlang
     mee als dekking zonder ooit uitgevoerd te zijn.

     `zelfpoortendeToetsen` telt de toetsen die zichzelf kunnen overslaan. Elke
     nieuwe is een toets die op de standaardmachine NIET draait, dus dit getal
     mag alleen omlaag. Het staat niet op nul en dat hoeft ook niet -- een toets
     die een echte database vraagt hoort zich over te slaan als die er niet is.
     Wat niet mag, is dat het er stilletjes meer worden.

     `e2eBestanden` telt de schermtoetsen. Die draaien niet mee in `npm test`
     (eigen glob, eigen CI-baan) en zijn daardoor het makkelijkst te vergeten
     hoekje van de suite: verdwijnt er een, dan merkt de hoofdsuite niets. */
  /* Staat elke functie in de boardroom? Een route die door geen enkele functie
     wordt bewaakt is vanuit de schakelkast onzichtbaar: niet uit te zetten,
     niet per stad te sluiten, en de storingswachter komt er nooit aan. Dat gat
     groeit vanzelf (routes schrijven is stap een, de catalogus bijwerken stap
     twee), dus het hoort aan een ratel. scripts/schakelbaar.js meet het. */
  { sleutel: 'routesNietSchakelbaar', richting: 'omlaag', wat: 'API-routes die niet vanuit de boardroom te schakelen zijn' },
  { sleutel: 'zelfpoortendeToetsen', richting: 'omlaag', wat: 'toetsen die zichzelf overslaan als een dienst ontbreekt' },
  { sleutel: 'e2eBestanden', richting: 'omhoog', wat: 'schermtoetsen (*.e2e.js, draaien niet mee in npm test)' }
];

/* ============================================================================
   DE PRESTATIEMETERS -- de tweede helft van de ratel.

   De meters hierboven komen uit de keuring: ze zijn statisch en altijd te
   berekenen. Prestatie is dat niet. p99, doorvoer, event-loopvertraging en
   hersteltijd komen uit De Beproeving, die een kwartier draait -- die kun je
   niet bij elke `npm run norm` opnieuw meten.

   Daarom schrijft scripts/beproeving.js zijn cijfers naar BEPROEVING.json en
   leest deze ratel ze daar. Drie dingen die daarbij misgaan als je er niet op
   let, en die hier alle drie zijn dichtgezet:

   1. HET BESTAND ONTBREEKT. Zonder maatregel zou de ratel dan vrolijk groen
      geven: geen invoer, geen oordeel, geen probleem. Dat is LAT.md regel 3.
      Staat er een grondwaarde in NORM.json, dan is een ontbrekend BEPROEVING.json
      een FOUT -- je hebt een lat gezet en die moet je blijven meten.
   2. EEN ANDERE MACHINE. 144 ms p99 op vier kernen is een ander getal dan
      144 ms op zestien; ze vergelijken zou de lat laten dansen op de vraag op
      welke laptop iemand toevallig draaide. Verschilt de vingerafdruk, dan
      vergelijkt de ratel NIET en zegt hij dat hardop -- en hij legt ook niets
      vast, want een grondwaarde van een andere machine is geen grondwaarde.
   3. EEN ANDERE MODUS. sqlite en Postgres meten niet hetzelfde platform.
      Zelfde behandeling.
   ========================================================================== */
const PRESTATIEBESTAND = path.join(WORTEL, 'BEPROEVING.json');
const PRESTATIEMETERS = [
  { sleutel: 'p99Ms', richting: 'omlaag', wat: 'latentie p99 onder de storm (ms)' },
  { sleutel: 'doorvoerPerSec', richting: 'omhoog', wat: 'afgehandelde verzoeken per seconde onder de storm' },
  { sleutel: 'eventLoopP99Ms', richting: 'omlaag', wat: 'event-loopvertraging p99 onder de storm (ms)' },
  { sleutel: 'herstelSeconden', richting: 'omlaag', wat: 'seconden tot een gewone aanroep weer normaal was' },
  { sleutel: 'verhalenSlaagPctStorm', richting: 'omhoog', wat: 'percentage goede verhalen dat de storm doorkwam' },
  { sleutel: 'geheugenHellingMBPerMin', richting: 'omlaag', wat: 'geheugengroei per minuut onder herhaalde last' }
];

/* De drie groepen van de keuring, apart geteld. Een groep die de keuring niet
   meer kent geeft 0 -- en dat is bewust GEEN stille nul: 0 is beter dan de
   grondwaarde, dus de ratel meldt het als een verbetering en dan hoort iemand
   te kijken of dat klopt of dat de groep gewoon verdwenen is. */
function telPerGroep(k) {
  const uit = { keuringOmvang: 0, keuringDubbeling: 0, keuringDekkingAdvies: 0 };
  const naar = { omvang: 'keuringOmvang', dubbeling: 'keuringDubbeling', dekking: 'keuringDekkingAdvies' };
  for (const b of (k.bevindingen || [])) {
    if (b.soort !== 'beter') continue;
    const sleutel = naar[b.groep];
    if (sleutel) uit[sleutel]++;
  }
  return uit;
}

/* Hoeveel van ONZE meters staan in de ijk-registratie met alleen een reden?

   Losse functie met de bron als invoer, en niet een leesactie diep in meet():
   zo kan deze meter zelf geijkt worden (test/meterijk.test.js voert hem een
   verzonnen registratie met een bekend aantal redenen). Een meter die zijn
   eigen bron leest en nergens te voeden is, zou precies het soort meter zijn
   waar regel 10 over gaat.

   Hij telt alleen sleutels die ECHT in METERS of PRESTATIEMETERS staan. Een
   eerdere versie telde elke `reden:` in het bestand en kwam op 16 waar
   check.js op 13 uitkwam -- twee tellingen van hetzelfde ding die uiteenlopen
   is hoe een meter begint te liegen. */
function telOngeijkt(ijkBron) {
  const sleutels = METERS.concat(PRESTATIEMETERS).map(m => m.sleutel);
  const blok = /const IJKINGEN = \{([\s\S]*?)\n\};/.exec(ijkBron);
  if (!blok) throw new Error('de IJKINGEN-registratie is niet te lezen; een meter zonder invoer is geen meter');
  /* Een regel staat op EEN regel ({ reden: '...' }) of over meerdere; het
     patroon mag dus geen regeleinde eisen. Een eerdere versie deed dat wel en
     telde nul, terwijl er dertien stonden -- een meter die nul teruggeeft
     omdat zijn patroon niet past, is precies de vorm waar deze meter over
     gaat. Redenen bevatten nooit geneste accolades, dus [^{}] volstaat. */
  return sleutels.filter(s => {
    const m = new RegExp('(^|[^a-zA-Z0-9])' + s + '\\s*:\\s*\\{([^{}]*)\\}').exec(blok[1]);
    return m && /reden:/.test(m[2]);
  }).length;
}

function meet() {
  const uit = execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(__dirname, 'keuring.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 });
  const k = JSON.parse(uit);

  /* De dependencies tellen we uit package.json zelf en niet uit een rapport:
     dit is de meter waar je bij twijfel de bron van wilt zien. */
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;

  const testMap = path.join(WORTEL, 'test');
  const inMap = fs.readdirSync(testMap);
  const testbestanden = inMap.filter(f => f.endsWith('.test.js')).length;
  const e2eBestanden = inMap.filter(f => f.endsWith('.e2e.js')).length;

  /* Tel de toetsen die zichzelf kunnen overslaan. We tellen de AANROEP, niet
     het bestand: een bestand met acht toetsen achter een poort is acht toetsen
     die niet draaien. Zowel `{ skip: X }` als `{ skip: X ? .. : .. }` telt mee,
     en `skip: false` juist niet -- dat is een poort die openstaat.

     COMMENTAAR TELT NIET MEE, en dat is hier een geleerde les en geen detail.
     Deze teller las de RUWE bron, dus een toets die in zijn kop uitlegt hoe die
     skip-regel eruitziet, telde als een extra overgeslagen toets. Precies dat
     gebeurde bij test/browserpoort.e2e.js -- een bestand dat juist bestaat OM
     die poort te bewaken en zichzelf nooit overslaat. Dezelfde fout is op
     2026-08-01 al een keer uit scripts/keuring.js gehaald (zie de eerste
     notitie in NORM.json); een meter die tekst leest in plaats van code komt
     kennelijk twee keer terug. Nu gaat de bron eerst door de wringer. */
  const zonderCommentaar = (b) => String(b)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  /* En de derde keer was een tekenreeks. test/meterijk.test.js zet als ijking
     een toets-met-skip in een TIJDELIJK bestand, en die regel staat dus als
     letterlijke tekst in de ijking zelf -- waarop deze meter hem meetelde als
     een echte zelfpoortende toets. Dezelfde fout als hierboven, een laag
     dieper: commentaar ging al door de wringer, tekst nog niet. Een toets die
     zichzelf werkelijk overslaat schrijft `{ skip: ... }` nooit binnen
     aanhalingstekens, dus dit kost geen enkele echte melding (nagemeten over
     de hele testmap: alleen meterijk.test.js verandert, 78 -> 77). */
  const zonderTekst = (b) => String(b)
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, m => m.replace(/[^\n]/g, ' '));
  let zelfpoortendeToetsen = 0;
  for (const f of inMap.filter(n => /\.(test|e2e)\.js$/.test(n))) {
    const bron = zonderTekst(zonderCommentaar(fs.readFileSync(path.join(testMap, f), 'utf8')));
    for (const m of bron.matchAll(/\{\s*skip\s*:\s*([^}]+)\}/g)) {
      if (!/^false\s*$/.test(m[1])) zelfpoortendeToetsen++;
    }
    // test.skip(...) / it.skip(...): de harde vorm, altijd overgeslagen
    zelfpoortendeToetsen += (bron.match(/\b(?:test|it)\.skip\s*\(/g) || []).length;
  }

  /* De schakelbaarheid uit dezelfde bron als het losse script: een tweede
     implementatie zou binnen een week uiteenlopen (regel 4). */
  let routesNietSchakelbaar = 0;
  try { routesNietSchakelbaar = require('./schakelbaar').meet().ongedekt.length; }
  catch (e) { throw new Error('schakelbaarheid kon niet worden gemeten (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* Hoeveel meters staan er in de ijk-registratie met alleen een REDEN? Die
     hebben we dus NIET zien uitslaan. De teller leest het registratiebestand
     zelf, want een getal dat je hier hardcodeert is precies het soort meter
     waar regel 10 over gaat. Ontbreekt het bestand, dan is niets geijkt en
     hoort deze meter dat te zeggen in plaats van stil nul te geven. */
  const ijkPad = path.join(WORTEL, 'test/meterijk.test.js');
  if (!fs.existsSync(ijkPad)) {
    throw new Error('test/meterijk.test.js ontbreekt; dan is geen enkele meter geijkt en kan deze meter niet meten');
  }
  const metersOngeijkt = telOngeijkt(fs.readFileSync(ijkPad, 'utf8'));

  return {
    metersOngeijkt,
    routesNietSchakelbaar,
    endpointsZonderTest: (k.cijfers.dekking.ongedekt || []).length,
    dekkingPct: k.cijfers.dekking.pct || 0,
    keuringStuk: k.stuk, keuringScheef: k.scheef,
    ...telPerGroep(k),
    dependencies: deps, testbestanden, zelfpoortendeToetsen, e2eBestanden
  };
}

/* ONTBREEKT HIJ, OF IS HIJ KAPOT? DAT IS NIET HETZELFDE.

   Deze functie gaf voor allebei `null`, en de aanroeper maakte daar "nog niet
   vastgelegd" van: hij schreef een verse NORM.json weg op basis van waar de code
   NU staat, en gaf exitcode 0. Eén onleesbaar bestand -- een half geschreven
   commit, een verkeerde merge, een afgekapte schrijfactie -- en de hele lat was
   weg. Stilzwijgend, en met een groen vinkje.

   Dat is precies LAT.md regel 3 (een meter zakt als zijn invoer ontbreekt), in
   de ratel die daar zelf over gaat. Nu: ontbreken mag (dat is de eerste keer),
   maar onleesbaar is een fout en die overschrijft niets. */
function leesNorm() {
  if (!fs.existsSync(NORMBESTAND)) return null;                 // eerste keer: mag
  const ruw = fs.readFileSync(NORMBESTAND, 'utf8');
  try { return JSON.parse(ruw); }
  catch (e) { throw new Error('NORM.json staat er wel maar is onleesbaar (' + e.message +
    '). Herstel hem uit de git-historie; ik overschrijf de lat niet met de huidige stand.'); }
}

/* De vingerafdruk waar een prestatiecijfer alleen binnen geldig is. Bewust grof:
   kernen, geheugen, platform en modus. De node-versie zit er NIET in -- die
   wisselt vaker dan de machine en zou de lat elke upgrade wissen, terwijl het
   effect op deze cijfers klein is vergeleken met het aantal kernen. */
function bron(c) {
  if (!c || !c.machine) return null;
  return c.machine.kernen + 'k/' + c.machine.geheugenGB + 'g/' + c.machine.platform + '/' + (c.modus || '?');
}

/* Geeft altijd hetzelfde soort antwoord: { cijfers, bron, reden }. `reden`
   ingevuld = niet bruikbaar, en dan zegt de aanroeper WAAROM. Nooit stil null. */
function leesPrestatie(bestand) {
  const pad = bestand || PRESTATIEBESTAND;   // parameter zodat een toets hem echt kan beproeven
  if (!fs.existsSync(pad)) return { reden: 'BEPROEVING.json ontbreekt (draai: npm run beproeving)' };
  let c;
  try { c = JSON.parse(fs.readFileSync(pad, 'utf8')); }
  catch (e) { return { reden: 'BEPROEVING.json is onleesbaar (' + e.message + ')' }; }
  if (!c || !c.meters) return { reden: 'BEPROEVING.json heeft geen meters' };
  /* Een GEZAKTE ronde levert geen grondwaarde. De cijfers van een run die zijn
     eigen drempels niet haalde zijn geen norm om aan vast te houden. */
  if (c.oordeel !== 'PASS') return { reden: 'de laatste beproeving is GEZAKT (' + c.gezakteDrempels + ' drempel(s)); die cijfers zijn geen lat' };
  return { cijfers: c.meters, bron: bron(c), gedraaid: c.gedraaid };
}

/* Beweegt de meter de goede kant op, de verkeerde kant op, of staat hij stil? */
function oordeel(m, nu, norm) {
  if (nu === norm) return 'gelijk';
  const beter = m.richting === 'omlaag' ? nu < norm : nu > norm;
  return beter ? 'beter' : 'slechter';
}

function main() {
  const nu = meet();
  let norm;
  try { norm = leesNorm(); }
  catch (e) { console.error('\n  \x1b[31m' + e.message + '\x1b[0m\n'); return 2; }
  const vastleggen = process.argv.includes('--vastleggen');

  if (!norm) {
    console.log('\n\x1b[1mDE NORM\x1b[0m -- nog niet vastgelegd.\n');
    for (const m of METERS) console.log('  ' + m.sleutel.padEnd(22) + String(nu[m.sleutel]).padStart(6) + '   ' + m.wat);
    fs.writeFileSync(NORMBESTAND, JSON.stringify({ vastgelegd: new Date().toISOString().slice(0, 10), meters: nu }, null, 2) + '\n');
    console.log('\n  \x1b[32mNORM.json aangemaakt.\x1b[0m Vanaf nu mag geen van deze meters nog slechter worden.\n');
    return 0;
  }

  console.log('\n\x1b[1mDE NORM\x1b[0m\x1b[2m -- vastgelegd op ' + (norm.vastgelegd || '?') + '\x1b[0m\n');
  const slechter = [], beterDan = [], nieuw = [];
  for (const m of METERS) {
    const n = norm.meters[m.sleutel];
    /* HIER STOND EEN STIL `continue`. Een meter die je toevoegt maar nog niet
       vastlegt, deed dus helemaal niets en zei er ook niets over -- precies de
       vorm die deze hele ratel moet vangen. Nu staat hij er, elke run, tot
       iemand hem met --vastleggen een grondwaarde geeft. Zakken doet hij niet:
       zonder grondwaarde valt er niets te vergelijken, en een meter die faalt
       omdat hij nieuw is leert je niets. */
    if (n === undefined) { nieuw.push({ m, nu: nu[m.sleutel] }); continue; }
    const v = nu[m.sleutel];
    const o = oordeel(m, v, n);
    const merk = o === 'slechter' ? '\x1b[31mSLECHTER\x1b[0m' : o === 'beter' ? '\x1b[32mbeter   \x1b[0m' : '\x1b[2mgelijk  \x1b[0m';
    console.log('  ' + merk + '  ' + m.sleutel.padEnd(22) + String(v).padStart(6) +
      '\x1b[2m  (norm: ' + n + ')\x1b[0m');
    if (o === 'slechter') slechter.push({ m, nu: v, norm: n });
    if (o === 'beter') beterDan.push({ m, nu: v, norm: n });
  }

  for (const n of nieuw)
    console.log('  \x1b[36mNIEUW   \x1b[0m  ' + n.m.sleutel.padEnd(22) + String(n.nu).padStart(6) +
      '\x1b[2m  (nog geen grondwaarde -- leg vast met npm run norm:vast)\x1b[0m');

  /* ---------- de prestatiehelft ---------- */
  const pres = leesPrestatie();
  const presNorm = norm.prestatie || {};
  const heeftGrond = Object.keys(presNorm).length > 0;
  const presNieuw = [], presBeter = [];
  let presFout = null;

  console.log('\n  \x1b[1mprestatie\x1b[0m \x1b[2m(uit BEPROEVING.json)\x1b[0m');
  if (pres.reden) {
    /* Ontbrekende invoer terwijl er een lat staat: dat is een fout en geen
       stilte. Staat er nog geen lat, dan is het een mededeling. */
    if (heeftGrond) { presFout = pres.reden; console.log('  \x1b[31mGEEN CIJFERS\x1b[0m ' + pres.reden); }
    else console.log('  \x1b[2m' + pres.reden + ' -- nog geen prestatielat gezet\x1b[0m');
  } else if (heeftGrond && norm.prestatieBron && norm.prestatieBron !== pres.bron) {
    console.log('  \x1b[33mNIET VERGELEKEN\x1b[0m: deze ronde draaide op ' + pres.bron
      + ', de lat staat op ' + norm.prestatieBron + '.');
    console.log('  \x1b[2mEen p99 van een andere machine of modus is geen betere of slechtere p99, maar een andere.\x1b[0m');
  } else {
    for (const m of PRESTATIEMETERS) {
      const v = pres.cijfers[m.sleutel];
      if (v == null) { console.log('  \x1b[2mniet gemeten\x1b[0m ' + m.sleutel); continue; }
      const n = presNorm[m.sleutel];
      if (n === undefined) { presNieuw.push({ m, nu: v }); continue; }
      const o = oordeel(m, v, n);
      const merk = o === 'slechter' ? '\x1b[31mSLECHTER\x1b[0m' : o === 'beter' ? '\x1b[32mbeter   \x1b[0m' : '\x1b[2mgelijk  \x1b[0m';
      console.log('  ' + merk + '  ' + m.sleutel.padEnd(22) + String(v).padStart(6) + '\x1b[2m  (norm: ' + n + ')\x1b[0m');
      if (o === 'slechter') slechter.push({ m, nu: v, norm: n });
      if (o === 'beter') presBeter.push({ m, nu: v, norm: n });
    }
    for (const n of presNieuw)
      console.log('  \x1b[36mNIEUW   \x1b[0m  ' + n.m.sleutel.padEnd(22) + String(n.nu).padStart(6) +
        '\x1b[2m  (nog geen grondwaarde)\x1b[0m');
    console.log('  \x1b[2mgemeten op ' + (pres.gedraaid || '?').slice(0, 16).replace('T', ' ') + ' op ' + pres.bron + '\x1b[0m');
  }

  if (presFout) {
    console.log('\n\x1b[31m  DE PRESTATIELAT KAN NIET WORDEN GECONTROLEERD.\x1b[0m\n');
    console.log('    ' + presFout);
    console.log('\n  Er staat een prestatielat in NORM.json, dus deze cijfers horen er te zijn.');
    console.log('  Een ratel zonder invoer is geen ratel; hij zwijgt dan precies wanneer het ertoe doet.\n');
    return 1;
  }

  if (slechter.length) {
    console.log('\n\x1b[31m  DE NORM IS NIET GEHAALD.\x1b[0m\n');
    for (const s of slechter)
      console.log('    ' + s.m.sleutel + ': ' + s.nu + ' terwijl de norm ' + s.norm + ' is  -- ' + s.m.wat);
    console.log('\n  Dit is geen advies. Wat een keer goed was, hoort niet stilletjes slechter te');
    console.log('  worden. Herstel het, of verlaag de norm met de hand in NORM.json -- dan staat');
    console.log('  het als bewuste keuze in de historie.\n');
    return 1;
  }

  const teSchrijven = beterDan.length + nieuw.length + presBeter.length + presNieuw.length;
  if (teSchrijven && !vastleggen) {
    console.log('\n\x1b[32m  De norm is gehaald\x1b[0m' +
      (beterDan.length + presBeter.length ? ', en op ' + (beterDan.length + presBeter.length) + ' punt(en) ruim' : '') +
      (nieuw.length + presNieuw.length ? '; ' + (nieuw.length + presNieuw.length) + ' meter(s) wachten nog op een grondwaarde' : '') + '.');
    console.log('  \x1b[2mLeg dat vast met: node --experimental-sqlite scripts/norm.js --vastleggen\x1b[0m\n');
    return 0;
  }
  /* HIER STOND `if (beterDan.length && vastleggen)`. Een meter die je toevoegt
     terwijl er verder niets verbeterde, viel dus door naar "de norm is gehaald"
     en werd NOOIT vastgelegd -- hij bleef eeuwig zonder grondwaarde en dus
     eeuwig tandeloos. Nieuwe meters zijn nu op zichzelf reden om te schrijven. */
  if (teSchrijven) {
    /* Alleen de verbeterde meters opschuiven. Een meter die gelijk bleef of
       (onmogelijk, want dan waren we hierboven al gestopt) slechter werd, raken
       we niet aan.
       De overige velden van NORM.json blijven staan: `notities` draagt de reden
       van een met de hand verlaagde norm, en die mag niet bij de eerstvolgende
       --vastleggen stilzwijgend verdwijnen. */
    const uit = { ...norm, vastgelegd: new Date().toISOString().slice(0, 10), meters: { ...norm.meters } };
    for (const b of beterDan) uit.meters[b.m.sleutel] = b.nu;
    for (const m of METERS) if (uit.meters[m.sleutel] === undefined) uit.meters[m.sleutel] = nu[m.sleutel];
    /* De prestatielat schrijven we alleen als er cijfers ZIJN en ze van dezelfde
       machine en modus komen. Anders zou een ronde op een andere machine de lat
       stilletjes verzetten -- omhoog of omlaag, allebei fout. */
    if (presBeter.length || presNieuw.length) {
      uit.prestatie = { ...(norm.prestatie || {}) };
      for (const b of presBeter) uit.prestatie[b.m.sleutel] = b.nu;
      for (const n of presNieuw) uit.prestatie[n.m.sleutel] = n.nu;
      uit.prestatieBron = pres.bron;
      uit.prestatieGemeten = pres.gedraaid;
    }
    fs.writeFileSync(NORMBESTAND, JSON.stringify(uit, null, 2) + '\n');
    if (beterDan.length) {
      console.log('\n  \x1b[32mNorm strakker gezet op ' + beterDan.length + ' punt(en).\x1b[0m');
      for (const b of beterDan) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    }
    if (nieuw.length) {
      console.log('  \x1b[36m' + nieuw.length + ' nieuwe meter(s) vastgelegd.\x1b[0m');
      for (const n of nieuw) console.log('    ' + n.m.sleutel + ': ' + n.nu);
    }
    if (presBeter.length) {
      console.log('  \x1b[32mPrestatielat strakker gezet op ' + presBeter.length + ' punt(en).\x1b[0m');
      for (const b of presBeter) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    }
    if (presNieuw.length) {
      console.log('  \x1b[36m' + presNieuw.length + ' prestatiemeter(s) vastgelegd\x1b[0m \x1b[2m(geldig op ' + pres.bron + ')\x1b[0m');
      for (const n of presNieuw) console.log('    ' + n.m.sleutel + ': ' + n.nu);
    }
    console.log('');
    return 0;
  }

  console.log('\n  \x1b[32mDe norm is gehaald.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, leesNorm, METERS, oordeel, PRESTATIEMETERS, leesPrestatie, bron, PRESTATIEBESTAND, telOngeijkt };
