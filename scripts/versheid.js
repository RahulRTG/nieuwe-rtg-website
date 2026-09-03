#!/usr/bin/env node
/* ============================================================================
   DE VERSHEID -- WELK REGISTER LOOPT ACHTER OP DE CODE?

   WAAROM DIT ER IS. Dit huis houdt vierentwintig registers bij, en tot voor kort
   droeg er EEN (DEKKING.json) de commit waarop hij is gemeten. De rest zag er bij
   elke blik identiek uit, of hij nu van vanochtend was of van drie maanden
   geleden. Dat is geen theoretisch bezwaar: POORTWACHT.json liep 196 routes
   achter en dat was alleen te ontdekken door het te vermoeden en na te tellen.

   Een verouderd register is gevaarlijker dan een ontbrekend register. Een
   ontbrekend register geeft "niet gemeten"; een verouderd register geeft
   getallen, en getallen worden geloofd.

   WAT DIT SCRIPT WEL EN NIET ZEGT:

     WEL   dit register is gemeten op een andere commit dan HEAD, of met vuile
           boom, of zonder stempel -- en dus niet na te lopen.
     NIET  of de meting nog KLOPT. Een register van een oudere commit kan best
           nog kloppen als er sindsdien alleen documentatie is gewijzigd. Dat is
           met opzet: "waarschijnlijk nog goed" is precies de redenering waarmee
           een achterstand jaren blijft liggen. Verouderd is verouderd; of het
           erg is, beslist een mens.

   Draai:  node scripts/versheid.js
           node scripts/versheid.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { versheid, nuCommit, stempelVan, WORTEL } = require('./lib/stempel');

/* De registers die een instrument bijhoudt, met het instrument erbij -- zodat
   de uitslag niet alleen zegt DAT iets achterloopt maar ook wat je moet draaien.
   Alleen registers die een MEETRONDE hebben; een tabel met wetten of landen
   heeft geen stempel nodig omdat er niets aan gemeten wordt. */
/* De herstelopdracht wijst naar de MEETRONDE en niet naar het losse instrument.
   Dat is geen voorkeur: de losse proeven draaien met hun STANDAARDbegrenzing, en
   die is kleiner dan een volle ronde. `npm run rolproef` schreef ROLPROEF.json
   een keer van 3377 beproefde routes terug naar 292 -- zonder dat het register
   er anders uitzag. De meetronde geeft de goede vlaggen mee. */
/* WELKE REGISTERS EEN POORT ZIJN, EN WELKE EEN MELDING.

   Dit script MELDDE alleen, met de reden erbij: een register dat achterloopt op
   een commit die een typefout repareerde, is geen defect. Dat klopt nog steeds
   voor de meeste. Het klopt niet voor de registers die zeggen of iemand ergens
   BINNENKOMT waar hij niet hoort, of dat er iets met GELD misgaat. Daar is
   "waarschijnlijk nog goed" precies de redenering waarmee een achterstand jaren
   blijft liggen (TAKEN.md 7.3).

   Vandaar een derde kolom. `beveiliging` en `geld` laten de poort zakken;
   `overig` blijft melden. De indeling is smal gehouden: wie hier een register
   bijzet dat elke week verandert, maakt de poort tot een sirene die iedereen
   uitzet -- en dan houdt hij niets meer tegen.

   Wat er NIET bij zit en waarom:
     SUITE.json    de volle testronde is de bodem onder alles, maar hij loopt
                   achter zodra iemand een regel code wijzigt. Als poort zou hij
                   elke tak rood zetten tot er een ronde van drie kwartier is
                   gedraaid; dan wordt hij weggeklikt in plaats van gerespecteerd.
     BEWIJSMATRIX  een afgeleide van de tien registers eronder. Zakt er een van
                   die tien, dan is dat de melding die je wilt; de matrix erbij
                   zou hetzelfde nog een keer zeggen.
     BEPROEVING    en SABOTAGE.json. Deze twee zaten er eerst WEL bij -- de een
     SABOTAGE      draagt de geldketen, de ander vraagt of elke handhaver echt
                   aanstaat, en inhoudelijk horen ze er dus in. Ze zijn er weer
                   uitgehaald op een MECHANISCHE grond, en die is beslissend:
                   ze worden gemaakt in andere jobs van .github/workflows/ronde.yml
                   dan de job die deze poort draait, en de ronde legt met opzet
                   niets vast ("een ronde die zichzelf vastlegt, legt ook een
                   verslechtering vast"). In de job van de poort komen ze dus
                   altijd uit de checkout, en die is verouderd zodra er sinds de
                   laatste handmatige commit een regel code is gewijzigd.

                   Een poort die per constructie rood staat, wordt binnen twee
                   weken met `|| true` uitgezet -- en neemt dan de vier mee die
                   wel werken. Ze melden daarom, tot iemand besluit dat de ronde
                   ze wel vastlegt. Dat is een besluit van de eigenaar over de
                   werkwijze en niet iets om hier stil in te bouwen.

   DE VIER DIE OVERBLIJVEN zijn niet toevallig vier: het zijn precies de
   registers die `npm run meetronde` in DEZELFDE job verst maakt, vlak voordat
   deze poort draait. Wat de poort eist, levert de stap ervoor. */
const BEVEILIGING = 'beveiliging', GELD = 'geld', OVERIG = 'overig';

const REGISTERS = [
  /* DE SUITE ZELF STAAT BOVENAAN, en dat is de duurste les van dit huis over
     veroudering. Zestien toetsen zakten aan de geldkant zonder dat iemand het
     wist: de losse toetsen die erlangs gingen waren groen, de registers waren
     vers en de keuring was schoon. Nergens was te zien dat de laatste VOLLE
     ronde van dertig commits geleden was. Sinds scripts/test-runner.js een
     stempel achterlaat, veroudert de suite hier net zo zichtbaar als elk
     register -- en hij hoort vooraan, want een register dat verser is dan de
     suite eronder meet een huis waarvan niemand weet of het nog werkt. */
  ['SUITE.json', 'npm test', 'de laatste VOLLE testronde: wanneer, waartegen, en of hij groen was'],
  ['DEKKING.json', 'npm run dekking:vast', 'welke routes een toets echt heeft aangeroepen'],
  ['POORTWACHT.json', 'npm run meetronde -- --alleen=poortwacht', 'welke routes zonder token opengaan', BEVEILIGING],
  ['ROLPROEF.json', 'npm run meetronde -- --alleen=rolproef', 'of een verkeerde rol binnenkomt', BEVEILIGING],
  ['INVOERPROEF.json', 'npm run meetronde -- --alleen=invoerproef', 'of rommel netjes wordt geweigerd'],
  ['IDEMPROEF.json', 'npm run meetronde -- --alleen=idemproef', 'of een herhaalde oproep niets dubbel doet'],
  ['STAATPROEF.json', 'npm run meetronde -- --alleen=staatproef', 'of de toestand na afloop klopt'],
  ['KETENS.json', 'npm run meetronde -- --alleen=ketenronde', 'of een keten netjes faalt onder sabotage'],
  /* DE VIER DIE HIER NIET STONDEN, en dat is geen kleinigheid: de bewijsmatrix
     LEEST ze alle vier, en geen enkele versheidsmeter keek ernaar. Een register
     dat de matrix voedt en dat niemand op ouderdom nakijkt, veroudert stil --
     precies waarvoor deze lijst bestaat. */
  ['OUTPUTPROEF.json', 'npm run meetronde -- --alleen=outputproef', 'of een antwoord meer prijsgeeft dan het hoort', BEVEILIGING],
  ['AUDITPROEF.json', 'npm run meetronde -- --alleen=auditproef', 'of een geslaagde handeling een spoor nalaat'],
  ['HANDELINGPROEF.json', 'npm run meetronde -- --alleen=handelingproef', 'of dat spoor geketend is'],
  ['UITVOERPROEF.json', 'npm run meetronde -- --alleen=uitvoerproef', 'of een antwoord gegevens van een ander bevat', BEVEILIGING],
  ['BEWIJSMATRIX.json', 'npm run bewijsmatrix:vast', 'de elf schakels per route, uit de vijf registers hierboven'],
  ['MUTATIES.json', 'npm run mutatie', 'welke toetsen kunnen zakken'],
  ['BEPROEVING.json', 'npm run beproeving', 'storm, geld, misbruik en herstel'],
  ['SCHERMLEUGEN.json', 'node --test test/liegend-scherm.e2e.js', 'of een scherm iets toont dat er niet is'],
  ['SABOTAGE.json', 'node scripts/sabotage.js', 'of elke handhaver echt aan staat'],
  ['WAAROM.json', 'node scripts/waarom.js --vastleggen', 'waarom een route niet te bewijzen valt, in zijn eigen woorden']
];

/* De lezer van beide stempelvormen woont in ./lib/stempel.js -- hij stond hier
   als tweede kopie, en scripts/vertrouwen.js had er een DERDE die een van de
   twee vormen miste. Zie de uitleg bij stempelVan() daar. De kopie die hier
   stond is weg: hij werd nergens meer aangeroepen, en een dode kopie van een
   waarheid is de kopie die als eerste uit de pas gaat lopen. */

/* HET REGISTER ZEGT ZELF HOE HET WORDT VERVERST, en dat wint van de tabel
   hierboven. Hier stond alleen die tabel, en hij liep uiteen: SCHERMLEUGEN.json
   droeg `"hoe": "node --test test/liegend-scherm.e2e.js"`
   terwijl de tabel `node scripts/schermleugen.js` beloofde -- een bestand dat
   niet bestaat. Twee plekken met een antwoord op dezelfde vraag, en de ene had
   ongelijk (LAT.md regel 4). De tabel blijft staan voor registers die het zelf
   niet zeggen; wie het wel zegt, wordt geloofd. */
function hoeVan(naam, uitTabel) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));
    if (j && typeof j.hoe === 'string' && j.hoe.trim()) return j.hoe.trim();
  } catch (e) { /* dan de tabel */ }
  return uitTabel;
}

/* WELKE RIJEN DE POORT LATEN ZAKKEN. Een losse functie en geen filter in meet(),
   omdat er precies een regel in zit die je niet aan de echte registers kunt zien
   zolang ze allemaal bestaan: een ONTBREKEND register in een poortklasse telt
   net zo hard als een verouderde. "Er is niets gemeten" is geen betere
   uitgangspositie dan "er is iets ouds gemeten" -- het is een slechtere, en het
   is precies de vorm waarin een poort stil opengaat. Zo kan test/versheidspoort
   die regel voeren met een verzonnen rij en hem echt zien zakken. */
function poortRijen(rijen) {
  return (rijen || []).filter(r => r && r.klasse !== OVERIG && r.staat !== 'vers');
}

function meet() {
  const nu = nuCommit();
  const rijen = REGISTERS.map(([naam, tabelHoe, wat, klasse]) => {
    const hoe = hoeVan(naam, tabelHoe);
    const s = stempelVan(naam);
    const k = klasse || OVERIG;
    if (s === undefined) {
      return { register: naam, hoe, wat, klasse: k, staat: 'ontbreekt',
        reden: 'dit register bestaat niet; er is dus niets gemeten' };
    }
    const v = versheid(s, nu);
    return { register: naam, hoe, wat, klasse: k, staat: v.vers ? 'vers' : 'verouderd', reden: v.reden,
      op: s && s.op ? s.op : null, commit: s && s.commit ? s.commit : null };
  });
  const poort = poortRijen(rijen);
  return { nu, rijen, poort,
    vers: rijen.filter(r => r.staat === 'vers').length,
    verouderd: rijen.filter(r => r.staat === 'verouderd').length,
    ontbreekt: rijen.filter(r => r.staat === 'ontbreekt').length };
}

module.exports = { meet, poortRijen, REGISTERS, stempelVan };

if (require.main !== module) return;

const uit = meet();
if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exit(0); }

console.log('\n=== DE VERSHEID VAN DE REGISTERS ===\n');
console.log('  de code staat op commit ' + (uit.nu || 'onbekend') + '\n');
for (const r of uit.rijen) {
  const merk = r.staat === 'vers' ? '  ok  ' : r.staat === 'ontbreekt' ? '  --  ' : '  !!  ';
  console.log(merk + r.register.padEnd(20) + r.staat);
  if (r.staat !== 'vers') {
    console.log('        ' + r.reden);
    console.log('        herstel: ' + r.hoe);
  }
}
console.log('\n  vers ' + uit.vers + '   verouderd ' + uit.verouderd + '   ontbreekt ' + uit.ontbreekt);

/* WEL EEN POORT, MAAR ALLEEN WAAR HET MOET.

   Hier stond "GEEN POORT: dit script meldt en oordeelt niet", met als reden dat
   een register dat achterloopt op een typefout-commit geen defect is. Die reden
   klopt nog steeds -- voor de meeste registers. Hij klopt niet voor de registers
   die zeggen of iemand binnenkomt waar hij niet hoort, of dat er met geld iets
   misgaat. Daar is "waarschijnlijk nog goed" precies de redenering waarmee een
   achterstand jaren blijft liggen, en een melding die niemand tegenhoudt heeft
   die achterstand ook nooit tegengehouden (TAKEN.md 7.3).

   De rest blijft melden. Een poort die op alle achttien registers zakt, is
   binnen een week een poort die iedereen met `|| true` uitzet -- en dan houdt
   hij ook de zes tegen die er wel toe deden. */
if (uit.poort.length) {
  console.log('\n\x1b[31mDE VERSHEIDSPOORT ZAKT: ' + uit.poort.length +
    ' register(s) over beveiliging of geld zijn niet vers.\x1b[0m');
  for (const r of uit.poort) {
    console.log('  - ' + r.register + ' (' + r.klasse + '): ' + r.reden);
    console.log('      herstel: ' + r.hoe);
  }
  console.log('\n  Deze vier melden niet alleen, ze houden tegen. Wat ze zeggen -- wie er');
  console.log('  binnenkomt en wat er met geld gebeurt -- is niet iets om op een oude meting te');
  console.log('  geloven. De andere registers hierboven melden alleen.\n');
  process.exit(1);
}
process.exit(0);
