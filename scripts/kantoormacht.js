#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE KANTOORMACHT -- staat er een MENS achter elke kantoorhandeling?

   WAAR DIT UIT KOMT. KANTOORMACHT.md par. 26 zet dit script als blok 0: "eerst,
   altijd". De reden staat in par. 29: de getallen in dat document zijn van
   2 september 2026 en dragen de graad `vermoed` omdat ze LEXICAAL zijn geteld
   (grep op de handlertekst). Zonder meter veroudert een richtingsdocument in
   stilte, en dan wordt het geciteerd alsof het de stand van vandaag beschrijft.
   Dat is precies wat er gebeurde: het document zegt 106 bestanden en 548
   routes, de router zegt vandaag iets anders.

   DE GRONDWET DIE HIJ MEET, uit par. 0 van dat document:

     "En niets zonder een mens erachter. Een spoor dat eindigt bij een gedeelde
      code is geen spoor, het is een alibi."

   ZES ASSEN, ZES GETALLEN, GEEN SAMENGESTELD CIJFER. Dat is geen stijlkeuze
   maar een regel van dit huis: BEWIJSMACHINE.md verbiedt het enkele `READY`
   boven een scorecard, en scripts/zekerheid.js bestaat juist omdat losse
   eerlijke getallen samen een gevaarlijk gevoel geven. Er komt hier dus geen
   "control health 87%".

   WAT DE ASSEN ZIJN, en met welke graad -- dat verschil is het halve script:

     1 deur          welke bewaker staat er voor de route            GEMETEN
     2 mensEis       eist die bewaker een IDENTITEIT                 GEMETEN
     3 handlerMens   kent de handler de handelende mens              VERMOED
     4 spoor         schrijft het bestand een auditspoor             VERMOED
     5 reden         vraagt het bestand een reden                    VERMOED
     6 machinerie    hangt voornemen/vierogen/simulatie eraan        GEMETEN

   As 1, 2 en 6 komen uit de ROUTER en uit require-verwijzingen: die zijn hard.
   As 3, 4 en 5 zijn lexicaal op BESTANDSNIVEAU en dragen daarom `vermoed` --
   een bestand dat `officeKey` noemt, gebruikt hem misschien niet in elke route
   erin. Daarom is `handlerKentMens` een BOVENgrens en `anoniemUitvoerbaar` een
   ONDERgrens, en dat staat in de uitslag in plaats van in iemands hoofd.

   WAAROM DE GATE AAN AS 2 HANGT EN NIET AAN AS 3. Een deploy-gate op een
   vermoed getal is een gate die je niet kunt vertrouwen: hij zakt op een grep
   die iets anders vond. `deurEistMens` komt uit de routetabel en beweegt alleen
   als er werkelijk een bewaker bij komt. Dat is het getal waarop je een build
   mag tegenhouden; de rest is een triagelijst.

   ONGEMETEN IS EEN EIGEN UITSLAG. Waar dit huis geen bron heeft -- risico per
   route bestaat niet, er is geen risicomodule -- staat `null` met een REDEN en
   nooit een 0. Een nul zegt "gemeten en het is er niet"; dat is een andere
   bewering dan "hier is niet gekeken", en die twee door elkaar halen is hoe een
   scorecard geruststellend wordt zonder iets te weten. Zelfde regel als
   `geen-effect-gemeten` tegenover `onbekend` in kern/stuur/gevolg.js.

   WAT HIJ NIET DOET. Hij beslist niets en hij hangt aan geen enkele route: hij
   woont in scripts/ en leest alleen. Zou server/ hem importeren, dan is hij de
   22e capabilitylijst uit OS.md in plaats van de meter erboven -- dezelfde
   grens die test/gezagsnoemer.test.js bewaakt voor de gezagsnoemer. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { alleRoutes } = require('./lib/routes.js');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'KANTOORMACHT.json');

/* De kantoordeur is een PADvraag en geen bewakervraag: /api/office en
   /api/boardroom zijn de twee voorvoegsels waar personeelswerk woont. Wie hier
   een derde bij zet, zet er een kamer bij -- zie par. 28 ("geen /admin"). */
const KANTOORPAD = /^\/api\/(office|boardroom)\//;

/* WELKE BEWAKERS EISEN EEN MENS. Afgeleid uit de bron en niet uit hun naam:
   - boardroomAuth  kern/kantoor/boardroom.js -- eist een IDENTITEIT waar de
                    kantoordeur een anonieme code toelaat
   - kluisAuth      kern/kantoor/kluispoort.js -- "een spoor dat niet naar een
     naamAuth       mens leidt, is geen spoor"; twee redenen, een implementatie
   - eigenaarAlleen de eigenaar is een persoon, geen code
     alleenBaas
   - balieAuth     server/routes/ledenbalie.js -- leest boardroomWie(req) en
                   weigert de gedeelde code letterlijk: "de gedeelde kantoorcode
                   opent wel de ruimte, maar wijst niemand aan". Hij stond hier
                   NIET in, en dat was een ondertelling van tot eenendertig
                   routes: de meter las hem als een rolcontrole omdat hij naast
                   officeAuth staat, terwijl hij juist de mens erachter opzoekt.
                   Gevonden bij het bedraden van de zware kantoorroutes -- vijf
                   ervan bleken al beschermd, en "repareren" wat al klopt is de
                   duurste manier om een getal te laten bewegen.
   Wie hier iets bij zet, leest eerst de bron van die bewaker. Een bewaker die
   alleen een ROL controleert, hoort er niet bij: `office` is een rol en geen
   mens, en dat verschil is het hele punt van dit script. */
const EIST_MENS = new Set(['boardroomAuth', 'kluisAuth', 'naamAuth', 'eigenaarAlleen', 'alleenBaas', 'balieAuth']);

/* WELKE KANTOORROUTES ZWAAR ZIJN, en waarom die lijst niet zelfverzonnen is.
   De klassen komen uit kern/isolatie/herkomst.js: dat bestand noemt de effecten
   die nooit uit een naamloze bron mogen komen (GELD_BEWEGEN, RECHT_VERLENEN,
   BULK_UITVOER). Dit is dezelfde vraag, een verdieping lager: mag een GEDEELDE
   CODE dat wel?

   HET IS EEN PADHERKENNING EN DUS EEN ONDERGRENS, geen effectmeting -- een route
   die geld beweegt zonder dat zijn pad dat verraadt, valt hier buiten. Vandaar
   graad `vermoed` op de teller en niet `gemeten`. Wie hier iets bij zet,
   verbreedt de meting; wie iets weghaalt, moet uitleggen waarom die handeling
   met een gedeelde code mag. */
const ZWAAR = [
  ['GELD_BEWEGEN', /(bank\/(incasso|krediet|rekening|salaris|bevoegdheid)|terugstort|uitbetaal)/i],
  ['RECHT_VERLENEN', /(office\/rechten|machtig|toegang\/geef)/i],
  ['BULK_UITVOER', /export/i]
];
const isZwaar = (pad) => ZWAAR.some(([, re]) => re.test(pad));

/* De twee manieren waarop een handler de handelende mens kan kennen. Beide zijn
   echt in gebruik, en wie er maar een van zoekt telt een factor tien mis --
   dat is bij het schrijven van dit script gebeurd. */
const KENT_MENS = /\bofficeKey\b|\bboardroomWie\b/;

/* Een auditspoor. Bewust breed: dit is de VERMOEDEN-as, dus liever een valse
   treffer die op de triagelijst komt dan een gemiste. */
const SPOOR = /logActivity|securityLog|inzagelog|inzageLog|lib\/keten|journaal/;
const REDEN = /\breden\b/;

/* De machinerie uit KANTOORMACHT.md par. 3: bestaat al, hangt elders. Per stuk
   het require-pad, want de NAAM alleen is te grof -- `bevoegdheid` bestaat twee
   keer in dit huis met verschillende betekenissen (kern/bevoegdheid/ is de
   VERMOGENS-lijst en draait; kern/commercie/bevoegdheid.js is de vier-dimensie-
   motor en heeft nul aanroepers). Precies de botsing die SEMANTIEK.json meet. */
const MACHINERIE = [
  ['voornemen', 'commercie/voornemen', 'execution plan: plan, keuring, uitvoeren'],
  ['vierogen', 'appstore/vierogen', 'tweede handtekening, met de graad van de scheiding'],
  ['bevoegdheid', 'commercie/bevoegdheid', 'vier dimensies; delegatie versmalt structureel'],
  ['simulatie', 'command/simulatie', 'impact vooraf, met de aannames in de uitslag'],
  ['canary', 'command/canary', 'beleid geleidelijk uitrollen, met terugrol'],
  ['schaduw', 'commercie/schaduw', 'een nieuwe regel loopt eerst mee zonder te blokkeren'],
  ['rechten', 'commercie/rechten', 'machtskaart: nominaal naast effectief']
];

const leescache = new Map();
function lees(betrekkelijk) {
  if (!betrekkelijk) return '';
  if (leescache.has(betrekkelijk)) return leescache.get(betrekkelijk);
  let t = '';
  for (const p of [path.join(WORTEL, betrekkelijk), betrekkelijk]) {
    try { t = fs.readFileSync(p, 'utf8'); break; } catch (e) { /* volgende */ }
  }
  leescache.set(betrekkelijk, t);
  return t;
}

function commit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'],
      { cwd: WORTEL, encoding: 'utf8' }).trim();
  } catch (e) { return null; }
}

function meet() {
  const routes = alleRoutes().filter(r => KANTOORPAD.test(r.pad));

  const perDeur = {};
  let eistMens = 0, gedeeldeDeur = 0, kentMens = 0, metSpoor = 0, metReden = 0, zonderBewaker = 0;
  const anoniem = [];

  for (const r of routes) {
    for (const b of r.bewakers) perDeur[b] = (perDeur[b] || 0) + 1;
    if (r.bewakersBekend && r.bewakers.length === 0) zonderBewaker++;

    const mensViaDeur = r.bewakers.some(b => EIST_MENS.has(b));
    if (mensViaDeur) eistMens++; else gedeeldeDeur++;

    const bron = lees(r.bestand);
    const handlerMens = KENT_MENS.test(bron);
    if (handlerMens) kentMens++;
    if (SPOOR.test(bron)) metSpoor++;
    if (REDEN.test(bron)) metReden++;

    /* Een ANONIEM EFFECT: geen bewaker die een mens eist, en de handler noemt
       nergens de handelende mens. Dat is de teller waar par. 0 over gaat. */
    if (!mensViaDeur && !handlerMens) {
      anoniem.push({ methode: r.methode, pad: r.pad, bestand: r.bestand });
    }
  }

  /* De machinerie: hangt hij aan een kantoorroute? Gemeten op de bestanden die
     werkelijk een kantoorroute registreren, niet op de hele boom. */
  const kantoorBestanden = [...new Set(routes.map(r => r.bestand).filter(Boolean))];
  const machinerie = {};
  for (const [naam, pad, wat] of MACHINERIE) {
    const aan = kantoorBestanden.filter(f => lees(f).includes(pad));
    let aanroepersTotaal = 0;
    try {
      aanroepersTotaal = execFileSync('grep',
        ['-rl', pad, path.join(WORTEL, 'server'), '--include=*.js'],
        { encoding: 'utf8' }).trim().split('\n').filter(Boolean).length;
    } catch (e) { aanroepersTotaal = 0; }
    machinerie[naam] = { wat, aanKantoorroute: aan.length, aanroepersInServer: aanroepersTotaal };
  }

  /* De zware routes en hoeveel er GEEN mens achter hebben. Dit is het getal dat
     zegt of een gestolen kantoorcode iets onomkeerbaars kan; het aantal gedeelde
     deuren alleen zegt dat niet, want de meeste kantoorroutes zijn dagelijks
     werk. */
  const zwareRoutes = routes.filter(r => isZwaar(r.pad));
  const zwaarZonderMens = zwareRoutes.filter(r => !(r.bewakers || []).some(b => EIST_MENS.has(b))).length;

  return {
    soort: 'meting',
    uitleg: 'Blok 0 van KANTOORMACHT.md: staat er een MENS achter elke kantoorhandeling? ' +
      'Zes assen, zes getallen, met opzet geen samengesteld cijfer (BEWIJSMACHINE.md verbiedt ' +
      'het enkele READY boven een scorecard).',
    grens: 'De as `deurEistMens` komt uit de ROUTER en is hard; `handlerKentMens` is lexicaal ' +
      'op BESTANDSniveau en draagt daarom `vermoed` -- een bestand dat officeKey noemt gebruikt ' +
      'hem misschien niet in elke route erin. `handlerKentMens` is dus een BOVENgrens en ' +
      '`anoniemUitvoerbaar` een ONDERgrens. Een deploy-gate hoort aan de harde as te hangen.',
    stempel: { op: new Date().toISOString(), commit: commit(), node: process.version },
    gemeten: {
      routes: routes.length,
      deurEistMens: eistMens,
      deurGedeeld: gedeeldeDeur,
      zonderBewakerslaag: zonderBewaker,
      handlerKentMens: kentMens,
      anoniemUitvoerbaar: anoniem.length,
      metSpoor,
      metReden,
      bestanden: kantoorBestanden.length,
      zwaar: zwareRoutes.length,
      zwaarZonderMens
    },
    graden: {
      routes: 'gemeten',
      deurEistMens: 'gemeten',
      deurGedeeld: 'gemeten',
      zonderBewakerslaag: 'gemeten',
      handlerKentMens: 'vermoed',
      anoniemUitvoerbaar: 'vermoed',
      metSpoor: 'vermoed',
      metReden: 'vermoed',
      zwaar: 'vermoed',
      zwaarZonderMens: 'vermoed'
    },
    ongemeten: {
      risicoPerRoute: 'er is geen risicomodule in dit huis (KANTOORMACHT.md par. 3); ' +
        'een 0 zou hier "gemeten en niet aanwezig" beweren, en dat is onwaar',
      vierOgenVereist: 'welke handeling vier ogen VERDIENT is een besluit en geen meting; ' +
        'wat wel gemeten is, staat in `machinerie.vierogen`',
      vierOgenBuitenDeModule: 'machinerie.vierogen telt bestanden die kern/appstore/vierogen REQUIREN, en dat is ' +
        'een lexicale telling van EEN implementatie. Er is er minstens nog een: kern/payroll/run.js draagt een ' +
        'eigen ladder (concept, gecontroleerd, manager, administrateur, definitief) met "NOOIT dezelfde persoon", ' +
        'en /api/office/bank/salaris/run betaalt alleen een DEFINITIEVE run uit. Die route bereikt payroll via de ' +
        'kern-tas (kern.payrollOS) en niet via een require, dus deze grep kan hem per constructie niet zien. Lees de ' +
        '0 als "nul routes gebruiken DIE module" en nooit als "nergens tekent een tweede mens" -- dezelfde faalvorm ' +
        'als de balieAuth-ondertelling hierboven.',
      historischeToestand: 'er is geen versiegeschiedenis van entiteiten (par. 18)'
    },
    machinerie,
    anoniemVoorbeeld: anoniem.slice(0, 25),
    deuren: Object.fromEntries(Object.entries(perDeur).sort((a, b) => b[1] - a[1]))
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('KANTOORMACHT -- staat er een mens achter de handeling?\n');
  console.log('  kantoorroutes            ' + g.routes + '   (' + g.bestanden + ' bestanden)');
  console.log('  deur eist een mens       ' + g.deurEistMens + '   gemeten');
  console.log('  deur is gedeeld          ' + g.deurGedeeld + '   gemeten');
  console.log('  handler kent de mens     ' + g.handlerKentMens + '   vermoed (bovengrens)');
  console.log('  ANONIEM UITVOERBAAR      ' + g.anoniemUitvoerbaar + '   vermoed (ondergrens)');
  console.log('  schrijft een spoor       ' + g.metSpoor + '   vermoed');
  console.log('  vraagt een reden         ' + g.metReden + '   vermoed');
  console.log('\n  de machinerie -- bestaat, hangt hij aan de kantoordeur?');
  for (const [naam, m] of Object.entries(u.machinerie)) {
    console.log('    ' + naam.padEnd(13) + 'kantoor: ' + String(m.aanKantoorroute).padStart(3) +
      '   elders in server/: ' + m.aanroepersInServer);
  }
  console.log('\n  ongemeten (met reden, nooit als 0):');
  for (const k of Object.keys(u.ongemeten)) console.log('    ' + k);
}

function main() {
  const argv = process.argv.slice(2);
  const u = meet();

  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); return; }
  toon(u);

  if (argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\n  vastgelegd in KANTOORMACHT.json');
    return;
  }

  /* --controle is de deploy-gate, en hij hangt met opzet aan de HARDE as.
     Hij vergelijkt met het vastgelegde register: het aantal anoniem
     uitvoerbare routes mag dalen en nooit stijgen. Dat is dezelfde vorm als de
     normtanden in PROOF.md -- bewijs mag alleen groeien, schuld alleen krimpen. */
  if (argv.includes('--controle')) {
    let oud;
    try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) {
      console.error('\nGEZAKT: KANTOORMACHT.json ontbreekt. Draai eerst --vastleggen.');
      process.exitCode = 1; return;
    }
    const was = oud.gemeten.anoniemUitvoerbaar;
    const nu = u.gemeten.anoniemUitvoerbaar;
    if (nu > was) {
      console.error('\nGEZAKT: anoniem uitvoerbare kantoorroutes ' + was + ' -> ' + nu +
        '. Deze teller mag alleen dalen.');
      process.exitCode = 1; return;
    }
    if (u.gemeten.zonderBewakerslaag > oud.gemeten.zonderBewakerslaag) {
      console.error('\nGEZAKT: kantoorroutes zonder bewakerslaag ' +
        oud.gemeten.zonderBewakerslaag + ' -> ' + u.gemeten.zonderBewakerslaag + '.');
      process.exitCode = 1; return;
    }
    console.log('\n  in orde: ' + nu + ' anoniem uitvoerbaar (was ' + was + '), niet gestegen.');
  }
}

if (require.main === module) main();
module.exports = { meet, EIST_MENS, KANTOORPAD };
