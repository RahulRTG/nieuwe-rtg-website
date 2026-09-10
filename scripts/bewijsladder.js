#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE BEWIJSLADDER -- welke soorten bewijs levert dit huis, waar draaien ze, en
   wat laten ze achter?

   WAAROM DIT ER IS

   `npm run ci:lokaal` beantwoordt "draait die poort hier ook". Dat is de
   PARITEITSvraag en hij zegt niets over DEKKING: honderd poorten die alle
   honderd hetzelfde soort bewijs leveren, zijn nog steeds een ladder met een
   sport. De vraag hier is de andere: van eenheidstoets tot productieverificatie
   -- welke sport draagt gewicht, welke draagt het maar aan een kant, en welke
   bestaat niet?

   WAT ER GEMETEN WORDT EN WAT ER VERKLAARD IS -- dit onderscheid is het hele
   verschil tussen deze meter en een praatje:

     VERKLAARD  de ladder zelf: welke soorten bewijs er bestaan (LADDER
                hieronder). Een taxonomie komt uit een hoofd; dat valt niet te
                meten en het staat er daarom hardop bij.
     GEMETEN    welke mechanismen er per sport ECHT zijn. De bron is niet deze
                lijst maar de keten en de Slotsuite: elke poort uit
                .github/workflows (scripts/lib/werkstroom.js) en elke stap uit
                scripts/slotsuite.js. Wat daar draait, draait; wat er niet
                staat, bestaat voor deze meter niet.
     GEMETEN    waar hij draait -- keten, lokaal of allebei. Dat is de
                pariteitsvraag per sport in plaats van per poort.
     GEMETEN    wat hij achterlaat: schrijft dit mechanisme een register in de
                wortel, en draagt dat register een stempel (commit + vuile
                boom, scripts/lib/stempel.js)? Een bewijs zonder stempel hoort
                bij geen enkele commit, en dat is precies het verschil tussen
                een uitslag en een bewijs.

   DE RESTBAK IS DE ANTI-DRIFT. Elke poort die de keten draait en die geen
   sport heeft, staat in `zonderTrede`. Dat is fail-closed: een nieuw soort
   bewijs verdwijnt niet stil uit dit beeld, het valt eruit en vraagt om een
   plek. test/bewijsladder.test.js zakt zodra die bak groeit.

   WAT DEZE METER NIET DOET

   Hij velt GEEN samengesteld eindoordeel. Er komt geen `PROVEN` boven deze
   tabel -- dat is precies wat LAT.md regel 11, keuringsregel 48 en KEURING.md
   par. 5 verbieden. En hij beslist niet welke sport een BESLUIT van de eigenaar
   vraagt: dat is een oordeel over kosten en risico, geen eigenschap van een
   bestand. De stand hier komt uit drie meetbare feiten en niet uit een mening.

   DRAAIEN
     node scripts/bewijsladder.js              de tabel
     node scripts/bewijsladder.js --json
     node scripts/bewijsladder.js --vastleggen  schrijft BEWIJSLADDER.json
     node scripts/bewijsladder.js --controle    zakt op een gegroeide restbak
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const W = require('./lib/werkstroom');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'BEWIJSLADDER.json');
const K = { dim: '\x1b[2m', groen: '\x1b[32m', rood: '\x1b[31m', geel: '\x1b[33m', vet: '\x1b[1m', uit: '\x1b[0m' };

/* ==========================================================================
   DE LADDER -- VERKLAARD, en dat staat er met opzet bij.

   De volgorde is die van een wijziging onderweg naar productie. Elke sport
   noemt PATRONEN, geen bestanden: een patroon vangt ook het mechanisme dat er
   morgen bij komt, een bestandsnaam alleen het mechanisme van vandaag.
   ========================================================================== */
const LADDER = [
  { id: 'snel', naam: 'Snelle bewijzen', wat: 'huisregels, statische analyse, geheimen, het contract van de keten zelf',
    patronen: [/check\.js$/, /ast-scan\.js$/, /geheimen\.js$/, /ci-keten\.js$/, /ci-lokaal\.js$/,
      /deltapoort\.js$/, /normverval\.js$/, /wetten\.js$/, /getallen\.js$/, /samenhang\.js$/, /keuring\.js$/, /^git diff$/] },
  { id: 'geraakt', naam: 'Wat kan deze wijziging raken', wat: 'de affected-graaf: welk bewijs moet opnieuw',
    patronen: [/impactbereik\.js$/, /attributie\.js$/, /verstrengeling\.js$/, /activering\.js$/] },
  { id: 'eenheid', naam: 'Eenheid, contract en bevoegdheid', wat: 'de toetssuite zelf, plus de as-proeven per route',
    patronen: [/test-runner\.js$/, /pgtoetsen\.js$/, /isolatiepoort\.test\.js$/, /mutatiecontract\.js$/,
      /(rolproef|invoerproef|idemproef|staatproef|uitvoerproef|auditproef|handelingproef)-route\.js$/, /mutatie\.js$/,
      /wekkers\.js$/] },
  { id: 'reis', naam: 'Echte reizen per rol', wat: 'een keten van begin tot eind, met de actor die hem loopt',
    patronen: [/(tafel|rit|toelatings)proef\.js$/, /ketenronde\.js$/, /rolronde\.js$/, /zaakwig\.js$/,
      /ladder\.js$/, /tikken\.js$/, /appwerkt\.js$/, /vindbaar\.js$/, /tredeproef\.js$/] },
  { id: 'grens', naam: 'Tenant, veiligheid en tegenspel', wat: 'isolatie, aanval, gluren, verraad, sabotage, overleving',
    patronen: [/isolatieproef\.js$/, /isolatieschaduw\.js$/, /aanval\.js$/, /gluurronde\.js$/,
      /verraadronde\.js$/, /sabotage\.js$/, /overleving\.js$/, /^npm audit$/] },
  { id: 'storing', naam: 'Storing en herstel', wat: 'chaos, crash, faalpad, terugweg, geheugen',
    patronen: [/chaos\.js$/, /tot-crash\.js$/, /faalproef\.js$/, /herstelproef\.js$/, /herstel\.js$/,
      /heapproef\.js$/, /spreidingsproef\.js$/, /grondwacht\.js$/] },
  { id: 'prestatie', naam: 'Prestatiebudgetten', wat: 'de storm, de duurmeting en de gewichten',
    patronen: [/beproeving\.js$/, /prestaties\.js$/, /toetsduur\.js$/, /gewichtdrift\.js$/, /gewichtvoorstel\.js$/,
      /dekkingsvloer\.js$/, /dekking\.js$/] },
  { id: 'scherm', naam: 'Scherm, toegankelijkheid en browser', wat: 'de schermsuite, de a11y-scan en het oordeel erover',
    patronen: [/e2e\.js$/, /a11y\.js$/, /a11y-oordeel\.js$/, /schermen\.js$/, /schermmutatie\.js$/] },
  { id: 'gegevens', naam: 'Migratie en gegevensintegriteit', wat: 'schemamigraties, bewaartermijnen, de container die opkomt',
    patronen: [/rust-migraties\.js$/, /containerproef\.js$/, /kvwis\.js$/, /normbasis\.js$/, /norm\.js$/] },
  { id: 'releasebewijs', naam: 'Releasebewijs', wat: 'de bronboom gehasht, de stuklijst, de herkomst, de poort ervoor',
    patronen: [/release-bewijs\.js$/, /bron-release-bewijs\.js$/, /imageherkomst\.js$/, /release-gate\.js$/,
      /build\.js$/, /zekerheid\.js$/, /bewijsmatrix\.js$/, /vertrouwen\.js$/, /versheid\.js$/, /meetronde\.js$/,
      /envelop\.js$/, /gezag\.js$/, /^npm run afbouw:software$/] },
  { id: 'kandidaat', naam: 'Onveranderlijke kandidaat', wat: 'het image gebonden aan een digest en een handtekening',
    patronen: [/imageherkomst\.js$/, /promotie-teken\.js$/, /external-release-teken\.js$/] },
  { id: 'uitrol', naam: 'Staging, canary en productieverificatie', wat: 'de repetitie, de uitrol en de sonde erna',
    patronen: [/staging-repetitie\.js$/, /uitrol\.js$/, /productie-status\.js$/, /live-vrijgave\.js$/,
      /sonde\.js$/, /publieke-tls-proef\.js$/, /triage\.js$/, /wetwacht\.js$/, /takken\.js$/] }
];

/* ==========================================================================
   DE MECHANISMEN -- gemeten, uit de keten en uit de Slotsuite.
   ========================================================================== */
function ketenPoorten() {
  const uit = new Map();
  for (const gat of W.poorten()) {
    if (gat.soort !== 'toets' || !gat.doel) continue;
    const r = uit.get(gat.doel) || { doel: gat.doel, keten: new Set(), aanleiding: new Set(), lokaal: false };
    r.keten.add(gat.werkstroom);
    for (const a of gat.aanleiding || []) r.aanleiding.add(a);
    uit.set(gat.doel, r);
  }
  return uit;
}

function slotsuiteDoelen() {
  const uit = new Set();
  try {
    const { LAGEN } = require('./slotsuite.js');
    for (const laag of LAGEN || []) {
      if (laag.bouw) uit.add('scripts/build.js');
      if (laag.intern) uit.add('scripts/keuring.js');
      for (const stap of laag.stappen || []) {
        const args = (stap[1] && stap[1][1]) || [];
        const js = args.find(a => typeof a === 'string' && a.endsWith('.js'));
        if (js) uit.add(js.replace(/^\.\//, ''));
      }
    }
  } catch (e) { /* geen slotsuite: dan is er lokaal niets, en dat is de strengste lezing */ }
  return uit;
}

/* WAT LAAT DIT MECHANISME ACHTER?

   Twee vragen, en ze worden op twee verschillende plekken beantwoord omdat ze
   twee verschillende dingen zijn:

     WELK REGISTER  uit de BRON van het script, en dan niet "welke json-naam
                    komt erin voor" -- dat was de eerste versie, en die schreef
                    BEGROTING.json op naam van samenhang.js (dat hem LEEST) en
                    NORM.json op naam van drie meters tegelijk. Een register dat
                    je leest is geen bewijs dat je aflegt. Dus: waar staat een
                    writeFileSync, en welk pad gaat daarin?
     MET STEMPEL    uit het REGISTER ZELF op schijf, niet uit de bron. Of een
                    meting bij een commit hoort, is een eigenschap van de
                    uitslag en niet van het script dat hem maakte. Dit is
                    meteen de scherpste vraag van deze meter: een register dat
                    niet in de repo staat (ATTRIBUTIE.json) kan per definitie
                    geen bewijs dragen dat bij deze commit hoort. */
function bewijsVan(doel) {
  let bron = '';
  try { bron = fs.readFileSync(path.join(WORTEL, doel), 'utf8'); } catch (e) { return { register: null, stempel: null }; }

  /* Welke variabele draagt welke registernaam? (een `const` met een
     samengesteld pad naar een json in de wortel).

     DE NAAM VAN DAT VOORBEELD STOND HIER EERST UITGESCHREVEN, en dat kostte een
     rode keten: test/versheidsdekking.test.js leest scripts/ op de tekst
     `WORTEL, '<NAAM>.json'` om te zien welke registers er geschreven worden, en
     die scan kijkt niet of hij in code of in een UITLEG staat. Mijn voorbeeld
     declareerde dus een register dat niet bestaat, en de toets eiste terecht
     een versheidsmelding voor een bestand dat niemand ooit schrijft. Een
     voorbeeldpad in commentaar is hier geen illustratie maar een bewering. */
  const vanVariabele = new Map();
  for (const m of bron.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*path\.join\([^)]*?['"]([A-Za-z0-9_.-]+\.json)['"]\s*\)/g))
    vanVariabele.set(m[1], m[2]);

  const geschreven = new Set();
  for (const m of bron.matchAll(/writeFileSync\(\s*([^,]+),/g)) {
    const arg = m[1].trim();
    const direct = /['"]([A-Za-z0-9_.-]+\.json)['"]\s*\)?$/.exec(arg);
    if (direct) { geschreven.add(direct[1]); continue; }
    const naam = /^[A-Za-z_$][\w$]*$/.test(arg) ? vanVariabele.get(arg) : null;
    if (naam) geschreven.add(naam);
  }
  let register = geschreven.size ? [...geschreven].sort()[0] : null;
  let grond = register ? 'schrijft' : null;

  /* DE TWEEDE GROND, en hij is zwakker en dat staat erbij. Een schrijfactie via
     een hulpje (`schrijf(REGISTER)`) ziet de regex hierboven niet, en dan zou
     BEPROEVING.json niet bij beproeving.js horen terwijl dit huis zijn registers
     consequent naar hun meter noemt. Een naam is geen bewijs van eigendom, dus
     hij telt alleen als het register ECHT in de wortel staat, en de grond staat
     in de uitslag zodat niemand hem voor een meting aanziet. */
  if (!register) {
    const naam = path.basename(doel).replace(/\.js$/, '').replace(/-/g, '').toUpperCase() + '.JSON';
    const kandidaat = fs.readdirSync(WORTEL).find(n => n.toUpperCase().replace(/-/g, '') === naam);
    if (kandidaat) { register = kandidaat; grond = 'naam'; }
  }
  if (!register) return { register: null, stempel: null, grond: null };

  /* Draagt het register op schijf een stempel met een commit? Staat hij er
     niet, dan is dat de uitslag en niet een leeg veld. */
  let stempel = null;
  try {
    const inhoud = JSON.parse(fs.readFileSync(path.join(WORTEL, register), 'utf8'));
    const st = inhoud && (inhoud.stempel || inhoud.gemeten || inhoud.meta);
    stempel = !!(st && (st.commit || st.sha));
  } catch (e) { stempel = null; }        // null = het register staat hier niet
  return { register, stempel, grond };
}

/* DE STAND KOMT UIT DE FEITEN, en uit niets anders. Drie standen en geen
   vierde: of een sport een BESLUIT van de eigenaar vraagt, is een oordeel over
   kosten en risico en geen eigenschap van een bestand -- dat hoort in
   KEURING.md en niet in een register. */
function standVan(mechanismen) {
  const beide = mechanismen.filter(m => m.lokaal && m.keten.length);
  const metBewijs = beide.filter(m => m.register && m.stempel === true);
  if (!mechanismen.length) return { stand: 'jaren', waarom: 'geen enkel mechanisme draait hiervoor' };
  if (metBewijs.length) return { stand: 'staat',
    waarom: metBewijs.length + ' mechanisme(n) draaien aan beide kanten en laten een gestempeld register achter' };
  if (!beide.length) return { stand: 'stap',
    waarom: 'draait maar aan een kant: ' + (mechanismen.some(m => m.lokaal) ? 'alleen lokaal' : 'alleen in de keten') };
  return { stand: 'stap', waarom: 'draait aan beide kanten, maar laat geen gestempeld register achter' };
}

function meet() {
  const keten = ketenPoorten();
  const lokaal = slotsuiteDoelen();
  for (const doel of lokaal) {
    const r = keten.get(doel) || { doel, keten: new Set(), aanleiding: new Set(), lokaal: false };
    r.lokaal = true;
    keten.set(doel, r);
  }
  for (const r of keten.values()) if (lokaal.has(r.doel)) r.lokaal = true;

  /* Een poort die de keten draait en die scripts/ci-lokaal.js hier ook kan
     draaien, telt als lokaal bereikbaar -- dat is sinds de ketenlaag in de
     Slotsuite precies wat er gebeurt. */
  let lokaalBereikbaar = new Set();
  try {
    for (const rij of require('./ci-lokaal.js').plan({ alle: true }))
      if (['draait', 'gedekt', 'dubbel'].includes(rij.stand) && rij.doel) lokaalBereikbaar.add(rij.doel);
  } catch (e) { /* dan blijft alleen de Slotsuite over, en dat is strenger */ }
  for (const r of keten.values()) if (lokaalBereikbaar.has(r.doel)) r.lokaal = true;

  const gebruikt = new Set();
  const sporten = LADDER.map(sport => {
    const mechanismen = [];
    for (const r of [...keten.values()].sort((a, b) => a.doel.localeCompare(b.doel))) {
      if (!sport.patronen.some(p => p.test(r.doel))) continue;
      gebruikt.add(r.doel);
      const bewijs = bewijsVan(r.doel);
      mechanismen.push({ doel: r.doel, lokaal: !!r.lokaal, keten: [...r.keten].sort(),
        aanleiding: [...r.aanleiding].sort(), register: bewijs.register, stempel: bewijs.stempel, grond: bewijs.grond });
    }
    const { stand, waarom } = standVan(mechanismen);
    return { id: sport.id, naam: sport.naam, wat: sport.wat, stand, waarom, mechanismen };
  });

  const zonderTrede = [...keten.values()].filter(r => !gebruikt.has(r.doel))
    .map(r => ({ doel: r.doel, keten: [...r.keten].sort(), lokaal: !!r.lokaal }))
    .sort((a, b) => a.doel.localeCompare(b.doel));

  return { sporten, zonderTrede,
    /* WAT DEZE UITSLAG NIET AANTOONT, en dat hoort in het REGISTER en niet
       alleen in de kop van dit bestand: zonder die zin leest "6 sporten staan"
       als een dekkende garantie. test/meetkeuring.test.js dwingt het af, en
       betrapte deze meter er meteen op. */
    grens: 'De SPORTEN zijn verklaard en niet gemeten: dat een soort bewijs hier ontbreekt, ' +
      'zegt deze meter niet. Van de mechanismen erop meet hij dat ze DRAAIEN en waar -- niet ' +
      'of het bewijs dat ze leveren goed is, en niet of het genoeg is. `alleenKeten` telt en ' +
      'oordeelt niet: zeven van die mechanismen lezen een artefact uit een andere job en kunnen ' +
      'lokaal per definitie niet draaien. En er staat met opzet geen samengesteld eindoordeel ' +
      'onder deze tabel (KEURING.md par. 5).',
    telling: {
      mechanismen: gebruikt.size,
      sporten: sporten.length,
      staat: sporten.filter(s => s.stand === 'staat').length,
      stap: sporten.filter(s => s.stand === 'stap').length,
      jaren: sporten.filter(s => s.stand === 'jaren').length,
      alleenKeten: sporten.reduce((n, s) => n + s.mechanismen.filter(m => !m.lokaal).length, 0),
      zonderTrede: zonderTrede.length
    } };
}

module.exports = { LADDER, meet, bewijsVan, standVan, REGISTER };

/* ==========================================================================
   DE UITVOER
   ========================================================================== */
if (require.main === module) {
  const argv = process.argv.slice(2);
  const uitslag = meet();
  /* GEEN process.exit NA EEN GROTE UITVOER. Naar een BESTAND gaat dat goed
     (node schrijft dan synchroon), naar een PIPE niet: de poortwacht verloor zo
     twee derde van 484 KB -- geldige tekst, kapotte JSON, exitcode 0. Met
     exitCode loopt de pijp eerst leeg. Zie test/meetkeuring.test.js, regel
     `pipe`, die deze meter er prompt op betrapte. */
  if (argv.includes('--json')) { console.log(JSON.stringify(uitslag, null, 2)); return; }

  if (argv.includes('--controle')) {
    let oud = null;
    try { oud = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) {}
    if (!oud) { console.error('Geen BEWIJSLADDER.json om tegen te vergelijken -- draai `npm run bewijsladder:vast`.'); process.exitCode = 1; return; }
    const gegroeid = uitslag.zonderTrede.filter(z => !(oud.zonderTrede || []).some(o => o.doel === z.doel));
    if (gegroeid.length) {
      console.error('De keten draait bewijs dat op geen enkele sport staat (' + gegroeid.length + '):');
      for (const z of gegroeid) console.error('  - ' + z.doel + '  [' + z.keten.join(', ') + ']');
      console.error('\nGeef het een sport in scripts/bewijsladder.js, of leg uit waarom het er geen heeft.');
      process.exitCode = 1;
      return;
    }
    console.log('De bewijsladder klopt met de keten: ' + uitslag.telling.mechanismen + ' mechanismen op ' +
      uitslag.telling.sporten + ' sporten, ' + uitslag.zonderTrede.length + ' zonder sport (ongewijzigd).');
    return;
  }

  console.log('\n' + K.vet + 'DE BEWIJSLADDER' + K.uit + K.dim +
    ' -- de sporten zijn verklaard, de mechanismen erop zijn gemeten' + K.uit + '\n');
  for (const s of uitslag.sporten) {
    const kleur = s.stand === 'staat' ? K.groen : s.stand === 'jaren' ? K.rood : K.geel;
    console.log('  ' + kleur + s.stand.padEnd(6) + K.uit + ' ' + K.vet + s.naam + K.uit + K.dim + ' -- ' + s.wat + K.uit);
    console.log('         ' + K.dim + s.waarom + K.uit);
    for (const m of s.mechanismen)
      console.log('         ' + (m.lokaal ? '  ' : K.geel + '! ' + K.uit) + m.doel.replace(/^scripts\//, '').padEnd(30) +
        K.dim + (m.lokaal && m.keten.length ? 'beide' : m.keten.length ? 'ALLEEN DE KETEN' : 'alleen lokaal') +
        (m.register ? '  -> ' + m.register + (m.stempel === true ? ' (gestempeld)' : m.stempel === false ? ' (zonder stempel)' : ' (STAAT HIER NIET)') : '  -> geen register') + K.uit);
    console.log('');
  }
  if (uitslag.zonderTrede.length) {
    console.log('  ' + K.geel + 'ZONDER SPORT' + K.uit + K.dim + ' -- de keten draait dit en de ladder kent het niet:' + K.uit);
    for (const z of uitslag.zonderTrede) console.log('    ' + z.doel.padEnd(38) + K.dim + z.keten.join(', ') + K.uit);
    console.log('');
  }
  const t = uitslag.telling;
  console.log('  ' + t.staat + ' staat, ' + t.stap + ' een stap weg, ' + t.jaren + ' bestaat niet; ' +
    t.alleenKeten + ' mechanisme(n) draaien alleen in de keten, ' + t.zonderTrede + ' zonder sport.');
  console.log('  ' + K.dim + 'Er staat met opzet geen samengesteld oordeel onder deze tabel (KEURING.md par. 5).' + K.uit + '\n');

  if (argv.includes('--vastleggen')) {
    const stempel = require('./lib/stempel');
    const inhoud = Object.assign({ stempel: stempel.stempel ? stempel.stempel() : undefined }, uitslag);
    fs.writeFileSync(REGISTER, JSON.stringify(inhoud, null, 2) + '\n');
    console.log('  BEWIJSLADDER.json geschreven.\n');
  }
}
