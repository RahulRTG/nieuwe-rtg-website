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
  ['POORTWACHT.json', 'npm run meetronde -- --alleen=poortwacht', 'welke routes zonder token opengaan'],
  ['ROLPROEF.json', 'npm run meetronde -- --alleen=rolproef', 'of een verkeerde rol binnenkomt'],
  ['INVOERPROEF.json', 'npm run meetronde -- --alleen=invoerproef', 'of rommel netjes wordt geweigerd'],
  ['IDEMPROEF.json', 'npm run meetronde -- --alleen=idemproef', 'of een herhaalde oproep niets dubbel doet'],
  ['STAATPROEF.json', 'npm run meetronde -- --alleen=staatproef', 'of de toestand na afloop klopt'],
  ['KETENS.json', 'npm run meetronde -- --alleen=ketenronde', 'of een keten netjes faalt onder sabotage'],
  /* DE VIER DIE HIER NIET STONDEN, en dat is geen kleinigheid: de bewijsmatrix
     LEEST ze alle vier, en geen enkele versheidsmeter keek ernaar. Een register
     dat de matrix voedt en dat niemand op ouderdom nakijkt, veroudert stil --
     precies waarvoor deze lijst bestaat. */
  ['OUTPUTPROEF.json', 'npm run meetronde -- --alleen=outputproef', 'of een antwoord meer prijsgeeft dan het hoort'],
  ['AUDITPROEF.json', 'npm run meetronde -- --alleen=auditproef', 'of een geslaagde handeling een spoor nalaat'],
  ['HANDELINGPROEF.json', 'npm run meetronde -- --alleen=handelingproef', 'of dat spoor geketend is'],
  ['UITVOERPROEF.json', 'npm run meetronde -- --alleen=uitvoerproef', 'of een antwoord gegevens van een ander bevat'],
  ['BEWIJSMATRIX.json', 'npm run bewijsmatrix:vast', 'de elf schakels per route, uit de vijf registers hierboven'],
  ['MUTATIES.json', 'npm run mutatie', 'welke toetsen kunnen zakken'],
  ['BEPROEVING.json', 'npm run beproeving', 'storm, geld, misbruik en herstel'],
  ['SCHERMLEUGEN.json', 'node --test test/liegend-scherm.e2e.js', 'of een scherm iets toont dat er niet is'],
  ['SABOTAGE.json', 'node scripts/sabotage.js', 'of elke handhaver echt aan staat'],
  ['WAAROM.json', 'node scripts/waarom.js --vastleggen', 'waarom een route niet te bewijzen valt, in zijn eigen woorden']
];

/* De lezer van beide stempelvormen woont in ./lib/stempel.js -- hij stond hier,
   en scripts/vertrouwen.js had zijn eigen kortere versie die er een van de twee
   miste. Zie de uitleg bij stempelVan() daar. */
function ongebruikt_stempelVan(naam) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));
    return j.stempel || (j.gemeten && j.gemeten.op ? j.gemeten : null);
  } catch (e) { return undefined; }   // undefined = het bestand is er niet
}

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

function meet() {
  const nu = nuCommit();
  const rijen = REGISTERS.map(([naam, tabelHoe, wat]) => {
    const hoe = hoeVan(naam, tabelHoe);
    const s = stempelVan(naam);
    if (s === undefined) {
      return { register: naam, hoe, wat, staat: 'ontbreekt',
        reden: 'dit register bestaat niet; er is dus niets gemeten' };
    }
    const v = versheid(s, nu);
    return { register: naam, hoe, wat, staat: v.vers ? 'vers' : 'verouderd', reden: v.reden,
      op: s && s.op ? s.op : null, commit: s && s.commit ? s.commit : null };
  });
  return { nu, rijen,
    vers: rijen.filter(r => r.staat === 'vers').length,
    verouderd: rijen.filter(r => r.staat === 'verouderd').length,
    ontbreekt: rijen.filter(r => r.staat === 'ontbreekt').length };
}

module.exports = { meet, REGISTERS, stempelVan };

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
/* GEEN POORT. Dit script MELDT en oordeelt niet: een register dat achterloopt op
   een commit die alleen een typefout repareerde, is geen defect. De poort staat
   bij de ratels zelf (norm.js, bewijsmatrix.js, dekking.js), die wel weten wat
   er inhoudelijk slechter is geworden. */
process.exit(0);
