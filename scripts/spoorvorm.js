#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE CONVERGENTIEMATRIX VAN HET VERTEGENWOORDIGINGSSPOOR.

   DE VRAAG. `kern/vertegenwoordiging/handelen.js` is niet één van zeven
   implementaties -- het is de enige die de hele gedragsvorm voert. De vraag is
   dus niet "moeten we een uniform spoor ONTWERPEN" maar "hoever staan de andere
   zes van een vorm die er al is". Dat is een meting en geen ontwerp.

   DE VIER EIGENSCHAPPEN, afgelezen aan de referentie en niet bedacht:

     V-1  een TOEGESTANE handeling wordt vastgelegd
     V-2  een GEWEIGERDE handeling wordt OOK vastgelegd
     V-3  het spoor gaat VOOR de uitkomst de deur uit
     V-4  een spoor dat niet vaststaat HOUDT DE HANDELING TEGEN

   V-4 is de scherpste en het is niet hetzelfde als wat `scripts/stilspoor.js`
   meet. Die vraagt of het FALEN van een spoorschrijver wordt opgegeten door een
   lege catch (smoren). Deze vraagt of de aanroeper er iets MEE DOET (tegenhouden).
   Een schrijver kan ongesmoord zijn en toch niets tegenhouden: netjes loggen en
   doorlopen haalt stilspoor wel en V-4 niet. Twee meters, twee vragen; ze worden
   nergens opgeteld.

   DE INDELING IS VERKLAARD EN DE UITSLAG GEMETEN, en die twee staan met opzet
   uit elkaar. Welke functie van een mechanisme de BESLISSING neemt, kan geen
   parser vinden -- dat is een menselijk oordeel, en het staat hieronder in
   `MECHANISMEN` met per stuk de reden. Wat die functie DOET, wordt gelezen. Wie
   de indeling uit de meting zou afleiden, laat de toets met zichzelf
   vergelijken (dezelfde opzet als `EIGENAAR` naast `detecteer()`).

   DE BESTURINGSPROEF ZIT IN DE METER ZELF. De referentie MOET 4 van 4 halen.
   Haalt zij dat niet, dan is de METER stuk en niet de code -- en dan eindigt dit
   script met een foutcode in plaats van met een uitslag die niemand vertrouwt.
   Zonder die regel is een matrix vol nullen niet te onderscheiden van een meter
   die niets herkent.

   DE GRAAD IS `vermoed`. De herkenning is lexicaal: een spoorschrijver onder een
   naam die hier niet staat, wordt gemist. Voor deze meter is dat de VEILIGE kant
   -- een gemiste schrijver leest als "niet aanwezig", en dat is een schuld die
   je gaat repareren, geen dekking die je ten onrechte claimt.

        node scripts/spoorvorm.js                 (toont de matrix)
        node scripts/spoorvorm.js --vastleggen    (schrijft SPOORVORM.json)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'SPOORVORM.json');

/* ----------------------------------------------------------------------------
   DE INDELING. Per mechanisme: waar het woont, welke functie de beslissing
   neemt, en waarom juist die. De namen zijn dezelfde zeven als in
   NAMENSVORM.json -- een tweede lijst mechanismen zou betekenen dat twee meters
   iets anders bedoelen met hetzelfde woord.
   -------------------------------------------------------------------------- */
const MECHANISMEN = [
  { naam: 'vertegenwoordiging', referentie: true,
    bestanden: ['server/kern/vertegenwoordiging/handelen.js'],
    ingang: 'handel',
    waarom: 'de enige functie in dit huis die een handeling ONDER een machtiging beoordeelt, vastlegt en dan pas antwoordt' },

  { naam: 'bijstand',
    bestanden: ['server/kern/command/bijstand-rtg.js', 'server/kern/command/bijstand.js',
      'server/kern/command/bijstand-klant.js'],
    ingang: 'betreed',
    waarom: 'betreden van de omgeving van een klant is hier de handeling die mag of niet mag; hij woont ' +
      'in bijstand-rtg.js (de RTG-kant), niet in bijstand-klant.js (waar de klant besluit)' },

  { naam: 'servicemachtiging',
    bestanden: ['server/kern/service/machtiging.js', 'server/kern/service/machtiging-poort.js'],
    ingang: 'magNu',
    waarom: 'magNu() is de poort die per moment beslist of een medewerker in het dossier mag' },

  { naam: 'ai-mandaat',
    bestanden: ['server/kern/stuur/mandaat.js'],
    ingang: 'magZelfstandig',
    waarom: 'de enige plek waar een agent te horen krijgt of hij zelfstandig mag handelen' },

  { naam: 'fiscaal-mandaat',
    bestanden: ['server/kern/fiscaal/gateway/mandaat.js'],
    ingang: 'geldt',
    waarom: 'geldt() wordt VOOR de zending gesteld; hij is de beslissing waar de gateway op afgaat' },

  { naam: 'sepa-machtiging',
    bestanden: ['server/kern/machtiging.js'],
    ingang: 'keur',
    waarom: 'keur() is de enige beoordeling in deze laag; innen bestaat hier niet (geen incassorail)' },

  { naam: 'app-machtiging',
    bestanden: ['server/kern/appstore/brug.js', 'server/kern/appstore/brugweigering.js'],
    ingang: 'roepKaal',
    waarom: 'de brug is de enige weg van een app naar RTG, en roepKaal() is waar hij doorgelaten of geweigerd wordt' }
];

/* DE SPOORSCHRIJVERS. Twee families: de huisbrede namen (dezelfde vocabulaire
   als scripts/stilspoor.js, zodat de twee meters over hetzelfde praten) en de
   LOKALE vorm `spoor(...)`, die stilspoor met opzet niet kent omdat hij daar
   geen journaalnaam voor zich heeft. */
const HUISBREED = /\b(?:inzagelog|journaal|doorgeefjournaal|auditlog|routelog)\s*\.\s*(?:noteer|schrijf|log)\w*\s*\(|\bnoteer[A-Z]?\w*\s*\(/;
const LOKAAL = /\bspoor\s*\(/;
const SCHRIJVER = new RegExp(HUISBREED.source + '|' + LOKAAL.source);

/* DE DUURZAME WEG. `vastleggen(...)` en `noteerVast(...)` zijn de twee vormen
   die in dit huis een uitslag TERUGGEVEN die je kunt lezen. Ze zijn de enige
   waarmee V-4 gehaald kan worden; de rest schrijft write-behind. */
const DUURZAAM = /\b(?:vastleggen|noteerVast|duurzaam\w*)\s*\(/;

/* ----------------------------------------------------------------------------
   DE LEZER. Hij pakt het LIJF van de ingangsfunctie -- gebalanceerd op accolades
   zodat een geneste functie meetelt en de volgende functie niet.
   -------------------------------------------------------------------------- */
function lijfVan(bron, naam) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + naam + '\\s*\\(|' +
    '\\b' + naam + '\\s*[:=]\\s*(?:async\\s*)?(?:function\\s*)?\\(');
  const m = re.exec(bron);
  if (!m) return null;
  const start = bron.indexOf('{', m.index + m[0].length - 1);
  if (start === -1) return null;
  let diep = 0;
  for (let i = start; i < bron.length; i++) {
    if (bron[i] === '{') diep++;
    else if (bron[i] === '}') { diep--; if (diep === 0) return bron.slice(start, i + 1); }
  }
  return null;
}

/* Waar staat een UITKOMST-return? Een return die een status of een fout draagt.

   MAAR NIET ELKE UITKOMST-RETURN TELT VOOR V-3, en dat heeft de besturingsproef
   hier gevonden in plaats van een lezer. De eerste versie vergeleek het spoor
   met de EERSTE status-return in het lijf, en dat is in de referentie de 404
   "U heeft deze machtiging niet" -- een VOORWAARDE-uitgang die vóór het oordeel
   ligt en er niets mee te maken heeft. De referentie zakte daardoor op V-3
   terwijl zij hem juist definieert.

   De vraag is niet "gaat het spoor voor élke uitgang" maar "gaat het spoor voor
   de uitgang die het OORDEEL draagt". Dus wordt eerst het oordeel gelokaliseerd
   (de variabele waaruit de spoorregel zijn uitkomstveld haalt) en daarna
   gekeken of het spoor tussen het oordeel en de eerstvolgende uitkomst-return
   staat. Voorwaarde-uitgangen ervóór doen niet mee -- die zeggen "dit gaat niet
   over u", niet "dit mag niet". */
const UITKOMST = /return\s*\{[^}]*\b(?:status|error|ok)\b/;

/* Uit welke variabele haalt de spoorregel zijn uitkomst? `gelukt: !!oordeel.mag`
   geeft `oordeel`. Zonder die vondst blijft V-3 ONBEPAALD -- liever geen
   uitspraak dan een verkeerde. */
const OORDEELBRON = /\b(?:gelukt|toegestaan|uitkomst)\s*:\s*[^,}\n]*?\b(\w+)\s*\.\s*(?:mag|toegestaan|ok)\b/;

function beoordeel(lijf) {
  if (!lijf) return null;
  const uit = {};

  /* V-1 en V-2 in één greep: is er een schrijver, en draagt de geschreven regel
     de UITKOMST in zich? Een regel met `gelukt: <oordeel>` wordt voor beide
     paden geschreven; een schrijver binnen `if (mag) {` alleen voor het ene. */
  const schrijft = SCHRIJVER.test(lijf);
  uit.V1 = schrijft;

  /* Draagt de spoorregel een veld dat uit het OORDEEL komt? Dan gaat dezelfde
     regel mee bij toestaan en bij weigeren. Dit is de vorm van de referentie:
     `gelukt: !!oordeel.mag`. */
  const oordeelInRegel = /\b(?:gelukt|toegestaan|uitkomst|mag)\s*:\s*[^,}]*\b(?:mag|oordeel|toegestaan)\b/.test(lijf);
  uit.V2 = schrijft && oordeelInRegel;

  /* V-3: staat het spoor TUSSEN het oordeel en de uitgang die dat oordeel
     draagt? Zie de kop bij UITKOMST voor waarom de eerste status-return niet de
     goede maatstaf is. */
  const iSchrijver = lijf.search(SCHRIJVER);
  const bron = OORDEELBRON.exec(lijf);
  if (!schrijft) {
    uit.V3 = false;
  } else if (!bron) {
    uit.V3 = null;
    uit.V3reden = 'de spoorregel noemt geen veld dat uit een oordeelsvariabele komt, dus deze meter kan ' +
      'niet bepalen welke uitgang het oordeel draagt';
  } else {
    const decl = new RegExp('\\b(?:const|let|var)\\s+' + bron[1] + '\\s*=');
    const iOordeel = lijf.search(decl);
    const na = iOordeel === -1 ? 0 : iOordeel;
    const rest = lijf.slice(na);
    const iUit = rest.search(UITKOMST);
    uit.V3 = iOordeel !== -1 && iSchrijver > iOordeel && iUit !== -1 && iSchrijver < na + iUit;
  }

  /* V-4: gaat de schrijver langs een DUURZAME weg EN wordt zijn uitslag gelezen?
     `const mis = await vastleggen(...); if (mis) return mis;` is de vorm. Een
     duurzame aanroep waarvan niemand de uitslag leest, haalt V-4 niet -- dat is
     precies het verschil met stilspoor. */
  const duurzaam = DUURZAAM.test(lijf);
  const uitslagGelezen = /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:vastleggen|noteerVast)\s*\([\s\S]*?\)\s*;[\s\S]{0,200}?\bif\s*\(\s*!?\1\b/.test(lijf);
  uit.V4 = duurzaam && uitslagGelezen;

  uit.gehaald = ['V1', 'V2', 'V3', 'V4'].filter(k => uit[k]).length;
  return uit;
}

function main() {
  const rijen = [];
  for (const mech of MECHANISMEN) {
    const gevonden = [];
    let lijf = null, bestand = null;
    for (const rel of mech.bestanden) {
      const p = path.join(WORTEL, rel);
      if (!fs.existsSync(p)) continue;
      gevonden.push(rel);
      if (lijf) continue;
      const l = lijfVan(zonderCommentaar(fs.readFileSync(p, 'utf8'), { regelsHeel: true }), mech.ingang);
      if (l) { lijf = l; bestand = rel; }
    }
    const oordeel = beoordeel(lijf);
    rijen.push(Object.assign({
      mechanisme: mech.naam,
      referentie: !!mech.referentie,
      ingang: mech.ingang,
      waarom: mech.waarom,
      bestandenGevonden: gevonden,
      ingangGevonden: !!lijf,
      gelezenIn: bestand
    }, oordeel || {
      /* GEEN NULLEN WAAR NIETS IS GEMETEN. Een ingang die niet gevonden wordt,
         is iets anders dan een ingang die niets vastlegt -- de eerste is een
         gat in DEZE meter, de tweede een gat in het huis. */
      V1: null, V2: null, V3: null, V4: null, gehaald: null,
      reden: 'de verklaarde ingang `' + mech.ingang + '` is in geen van de opgegeven bestanden gevonden; ' +
        'dit is een tekort van deze meter en geen uitspraak over dit mechanisme'
    }));
  }

  const ref = rijen.find(r => r.referentie);
  const besturing = {
    referentie: ref ? ref.mechanisme : null,
    gehaald: ref ? ref.gehaald : null,
    inOrde: !!(ref && ref.gehaald === 4),
    wat: 'De referentie MOET vier van vier halen. Haalt zij dat niet, dan herkent deze meter de vorm ' +
      'niet die hij komt meten, en zegt een matrix vol nullen niets.'
  };

  const metSpoor = rijen.filter(r => r.V1 === true).length;
  const kanTegenhouden = rijen.filter(r => r.V4 === true).length;

  return {
    graad: 'vermoed',
    hoe: 'lexicaal op het lijf van een VERKLAARDE ingangsfunctie, met het commentaar eruit. Een ' +
      'spoorschrijver onder een onbekende naam wordt gemist en leest als afwezig.',
    /* WAT DEZE MATRIX NIET AANTOONT. Zonder deze zin leest een rij met vier keer
       `ja` als een garantie, en dat is zij niet. */
    grens: 'VIER VAN VIER IS GEEN GOUDEN IMPLEMENTATIE, en dat is de zin die hier het hardst nodig is. ' +
      'Deze matrix meet EEN helft van het contract: beoordelen en vastleggen. De andere helft -- ' +
      'uitvoeren, en weten of die uitvoering landde -- meet hij niet, en de referentie HEEFT die helft ' +
      'niet: kern/vertegenwoordiging/handelen.js voert niets uit. Het mechanisme dat haar wel heeft is ' +
      'kern/appstore/brug.js (roepKaal, met m.doe() in een try/catch en uitvoeringBekend op de fout), en ' +
      'dat staat hier op vier streepjes. Geen enkel mechanisme is dus vandaag de referentie voor de ' +
      'combinatie; wie deze rij kopieert, kopieert de helft (REPRESENTATIE.md par. 9). ' +
      'Verder zegt deze meter NIETS over de kwaliteit van wat er wordt vastgelegd -- of de spoorregel de ' +
      'juiste velden draagt, of hij leesbaar is voor de mens over wie hij gaat, en of het spoor ooit ' +
      'wordt teruggelezen, valt er allemaal buiten. De referentie haalt vier van vier terwijl haar veld ' +
      '`gelukt` aantoonbaar TOEGESTAAN betekent en niet GESLAAGD (par. 8.2, beproefd in ' +
      'test/handelenspoor.test.js toets 4). En hij kijkt alleen in de VERKLAARDE ingangsfunctie: een ' +
      'mechanisme dat elders wel een spoor schrijft, telt hier niet mee.',
    besturing,
    gemeten: {
      mechanismen: rijen.length,
      metSpoor,
      kanTegenhouden,
      volledigConvergent: rijen.filter(r => r.gehaald === 4).length
    },
    rijen
  };
}

if (require.main === module) {
  const uit = main();
  const vast = process.argv.includes('--vastleggen');
  const b = (v) => (v === null ? ' ?  ' : v ? ' ja ' : ' -  ');
  console.log('\nDE CONVERGENTIEMATRIX VAN HET VERTEGENWOORDIGINGSSPOOR\n');
  console.log('  mechanisme            ingang            V-1  V-2  V-3  V-4');
  console.log('  ' + '-'.repeat(62));
  for (const r of uit.rijen) {
    console.log('  ' + (r.mechanisme + (r.referentie ? ' *' : '')).padEnd(22) +
      r.ingang.padEnd(18) + b(r.V1) + b(r.V2) + b(r.V3) + b(r.V4) +
      (r.ingangGevonden ? '' : '   (ingang niet gevonden)'));
  }
  console.log('\n  * de referentie\n');
  console.log('  ' + uit.gemeten.metSpoor + ' van ' + uit.gemeten.mechanismen + ' legt iets vast; ' +
    uit.gemeten.kanTegenhouden + ' kan de handeling tegenhouden; ' +
    uit.gemeten.volledigConvergent + ' haalt alle vier.');
  if (!uit.besturing.inOrde) {
    console.error('\n  BESTURINGSPROEF GEZAKT: de referentie haalt ' + uit.besturing.gehaald +
      ' van 4. ' + uit.besturing.wat + '\n');
    process.exit(1);
  }
  console.log('  besturingsproef: de referentie haalt 4 van 4.\n');
  if (vast) {
    const poort = eisSchoneBoom('spoorvorm');
    if (poort && poort.fout) { console.error(poort.fout); process.exit(1); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, uit), null, 2) + '\n');
    console.log('Vastgelegd in SPOORVORM.json\n');
  }
}

/* `beoordeel` en `lijfVan` gaan mee naar buiten zodat een toets de meter op
   VERZONNEN lijven kan loslaten. Dat is de enige manier om te laten zien dat hij
   kan uitslaan: op de echte boom haalt alleen de referentie vier van vier, en
   een meter die je nooit hebt zien zakken is geen meter (LAT-regel 10). */
module.exports = { meet: main, beoordeel, lijfVan, MECHANISMEN };
