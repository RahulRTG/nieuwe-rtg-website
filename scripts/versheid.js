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
const { versheid, nuCommit, WORTEL } = require('./lib/stempel');

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
  ['BEWIJSMATRIX.json', 'npm run bewijsmatrix:vast', 'de elf schakels per route, uit de vijf registers hierboven'],
  ['MUTATIES.json', 'npm run mutatie', 'welke toetsen kunnen zakken'],
  ['BEPROEVING.json', 'npm run beproeving', 'storm, geld, misbruik en herstel'],
  ['SCHERMLEUGEN.json', 'node --test test/liegend-scherm.e2e.js', 'of een scherm iets toont dat er niet is'],
  ['SABOTAGE.json', 'node scripts/sabotage.js', 'of elke handhaver echt aan staat'],
  ['WAAROM.json', 'node scripts/waarom.js --vastleggen', 'waarom een route niet te bewijzen valt, in zijn eigen woorden'],
  /* EN DE SCHULDENLIJST. Hij leest de registers hierboven en is dus per
     definitie zo oud als de oudste daarvan -- maar hij droeg zijn eigen
     ouderdom niet uit. Gevonden op 31 augustus 2026: tien dagen stil, 126
     commits achter, en gemeten op een vuile boom. Precies het gat waar dit
     instrument voor bestaat, en het stond er zelf niet in. */
  ['BEWIJSSCHULD.json', 'node scripts/bewijsschuld.js --vastleggen', 'wat er nog niet gemeten is, en waarom niet'],
  /* TIEN REGISTERS DIE HIER NIET IN STONDEN, en dat was het gat waar dit
     instrument juist voor is. Zeven ervan droegen zelfs helemaal geen stempel:
     hun ouderdom was niet vast te stellen, en ze zeiden dat ook niet -- ze
     toonden gewoon getallen. Gevonden bij de vraag "wat staat er nog open",
     nadat dertien instrumenten bleken stil te staan zonder dat iets het meldde.

     Ze staan hier in de volgorde waarin ze iets over de code zeggen: eerst de
     vier route-proeven, dan de rondes, dan de meters die over de machine gaan. */
  ['AUDITPROEF.json', 'npm run auditproef', 'of een geslaagde schrijfactie een regel in het API-spoor nalaat'],
  ['HANDELINGPROEF.json', 'npm run handelingproef', 'of een geslaagde schrijfactie een geketende regel nalaat'],
  ['UITVOERPROEF.json', 'npm run uitvoerproef', 'of een 2xx-antwoord gegevens teruggeeft die er niet in horen'],
  ['IDOR.json', 'node scripts/idorproef.js', 'of het object van een ander te openen is'],
  ['ROLRONDE.json', 'node scripts/rolronde.js', 'welke rol waar binnenkomt, gevraagd aan een echte server'],
  ['GLUURRONDE.json', 'node scripts/gluurronde.js', 'de horizontale scheiding tussen twee leden'],
  ['VERRAAD.json', 'node scripts/verraadronde.js', 'wat een verraden seed of zegel doet'],
  ['INHOUDSKAART.json', 'node scripts/inhoudskaart.js', 'wat elke route werkelijk teruggeeft'],
  ['OUTPUTPROEF.json', 'node scripts/outputproef.js', 'of de uitvoerband klopt'],
  ['DUURZAAMHEIDSKOSTEN.json', 'node scripts/duurzaamheidskosten.js', 'wat een commit aan machine en opslag kost'],
  /* DE SCHERFMETER, EN WAAROM HIJ HIER STAAT EN NIET IN BUITEN. Zijn `churn`
     wordt gemeten TEGEN de vorige vastlegging: hoeveel bestanden zijn sinds die
     opname van scherf gewisseld. Een oude opname maakt dat getal dus niet
     onnauwkeurig maar betekenisloos -- je vergelijkt met een indeling die
     niemand meer draait. Van alle registers hier is dit er een waar veroudering
     de meting niet vertraagt maar ONGELDIG maakt. */
  ['SCHERFMETER.json', 'npm run scherfmeter:vast',
    'de balans en de churn van de scherfverdeling, en wat een ongemeten bestand kostte'],

  /* De twee boekhoudkundige registers. Ze meten geen gedrag maar TELLINGEN, en
     juist daar doet veroudering pijn: een schuldgetal van vorige maand naast een
     routelijst van vandaag leest als vooruitgang. */
  ['IDEMSCHULD.json', 'npm run idemschuld:vast', 'welke schrijfroutes nog geen besluit over duplicaatgedrag dragen'],
  ['MUTATIEBOEK.json', 'npm run mutatieboek:vast', 'in welke bak elke route valt, en of de optelling sluit'],
  ['ONBEWEZEN.json', 'npm run onbewezen:vast', 'waarom een mutatie geen geldig bewijs heeft, van goedkoop naar duur'],
  ['HANDLERWACHT.json', 'npm run handlerwacht:vast', 'wie de routes bewaakt waar de router geen bewakerslaag ziet'],

  /* ACHT METERS DIE MET DE SAMENVOEGING BINNENKWAMEN.

     Ze stonden nergens onder toezicht, en dat is precies het gat dat
     test/versheidsdekking.test.js dicht hoort te houden: een verouderd register
     geeft getallen, en getallen worden geloofd. Bij deze acht is dat geen
     theorie -- vier ervan meten in een ECHTE browser of tegen een DRAAIENDE
     server, en zo'n meting hoort bij de code van die dag en bij geen andere.

     Vijf van de acht dragen (nog) geen stempel. Dat wordt hier niet weggepoetst:
     versheid meldt ze dan als "ouderdom niet vast te stellen", en dat is de
     eerlijke uitslag en tevens de aansporing om er een te zetten. Ze hier
     WEGLATEN omdat ze geen stempel hebben, zou de meter stil maken over precies
     de registers waarover het minst bekend is. */
  ['TIKKEN.json', 'npm run tikken', 'hoeveel tikken elke functie van het beginscherm af ligt, in een echte browser'],
  ['VINDBAAR.json', 'npm run vindbaar', 'of je een functie terugvindt met het woord dat erop staat'],
  ['WERELDSTIJL.json', 'npm run wereldstijl', 'of elk scherm de vormtaal van zijn wereld draagt'],
  ['SCHERMMUTATIES.json', 'npm run mutatie:scherm', 'of een schermtoets het merkt als er iets van het scherm verdwijnt'],
  ['RESOLVERBEREIK.json', 'npm run resolverbereik', 'de dekking van de resolver over elke toegestane route'],
  ['HERSTELPROEF.json', 'npm run herstelproef', 'of de tegenhanger werkelijk ongedaan maakt wat de heenweg deed'],
  ['DROOGLOOP.json', 'npm run droogloop', 'een plan werkelijk laten lopen, maar nergens waar het telt'],
  ['ONDERZOEKSKETEN.json', 'npm run onderzoeksketen', 'welke stations van het onderzoek van elkaar weten'],

  /* DE VIJF VAN DE BESTURINGSLAAG (MODULAIR.md).

     Ze horen hier om precies de reden die hierboven al twee keer is opgeschreven,
     en bij deze vijf weegt hij zwaarder dan gemiddeld: DRIE ervan meten tegen een
     DRAAIENDE server (de tredeproef klopt elke trede aan, de zaakwig loopt een
     hele bestelling, en de activering leest de kern-tas uit een echte boot). Zo'n
     meting hoort bij de code van die dag en bij geen andere. Een verouderde
     TREDEPROEF.json die "0 lekken" meldt terwijl er sindsdien routes bij kwamen,
     is erger dan geen meting: hij geeft een getal, en getallen worden geloofd.

     Ze staan in de volgorde waarin ze iets zeggen: eerst de structuur (wat hangt
     waaraan), dan wat een schakelaar werkelijk aanzet, dan de treden zelf, dan de
     ingangen die geen route zijn, en tot slot de ene keten van begin tot eind. */
  ['VERSTRENGELING.json', 'npm run verstrengeling:vast', 'de require-graaf als laag+domein, en welke rand niemand verklaard heeft'],
  ['ACTIVERING.json', 'npm run activering:vast', 'wat een functie aanzetten werkelijk aanzet, met de graad van zekerheid erbij'],
  ['TREDEPROEF.json', 'node scripts/tredeproef.js --alle --vastleggen', 'of een trede lekt: zuiver, beproefd, de rondgang en de ingangen buiten HTTP'],
  ['WEKKERS.json', 'npm run wekkers:vast', 'de ingangen die geen route zijn (klok, bus, luisteraar, werker) en welke functie ze doen'],
  ['ZAAKWIG.json', 'npm run zaakwig:vast', 'een bestelling van het lid tot in de kassa, op drie treden, op de bedrijfsinvarianten'],

  /* EN DE MEETLEER, die over deze registers zelf gaat.

     Hij hoort hier om de reden die hij zelf handhaaft, en dat is geen woordspel:
     een verouderde meetleer meldt hoeveel registers hun lezer remmen, gemeten op
     een boom die er niet meer is. Een instrument dat over eerlijkheid van
     metingen gaat en zelf niet onder toezicht staat, is het eerste dat niemand
     serieus neemt. */
  ['MEETLEER.json', 'npm run meetleer:vast', 'of een register de lezer er meer uit laat concluderen dan het aantoont']
];

/* Het stempel van een register. Twee vormen, en dat is historie en geen smaak:
   DEKKING.json zette zijn tijdstempel vanaf het begin onder `gemeten`, de rest
   krijgt hem onder `stempel`. Een van de twee hernoemen zou een bestand breken
   dat een toets al leest; hier wordt het op EEN plek opgevangen. */
function stempelVan(naam) {
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
