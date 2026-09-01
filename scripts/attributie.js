#!/usr/bin/env node
/* ============================================================================
   WIE RAAKTE WAT? -- de attributiemeter, en vooral: wat er NIET is gemeten.

   WAAROM DIT ER IS

   Een impactplan mag pas versmallen als het kan onderbouwen wat het overslaat.
   De bodem daaronder is deze vraag: van welke toets weten we wat hij aanraakt?
   Het routejournaal draagt dat sinds RTG_TOETS per toetsproces wordt gezet
   (test/toetsnaam.js), maar een journaal beantwoordt alleen de helft die het
   ZAG. Deze meter zet de andere helft er even groot naast.

   DRIE STANDEN, EN DE DERDE IS DE BELANGRIJKSTE

     waargenomen  deze toets heeft in het journaal kanten op zijn naam
     deels        er is wel gedrag gezien, maar zonder eigenaar (`onbekend`)
     ongemeten    deze toets kwam in geen enkel journaal voor

   `ongemeten` is met opzet GEEN synoniem van "raakt niets aan". Een toets die
   volledig in het proces draait raakt geen route en hoort hier gewoon als
   ongemeten te staan; hetzelfde geldt voor een toets die niet meedraaide in de
   ronde die dit journaal opleverde. Beide betekenen: hierover is niets bewezen.
   Wie die twee door elkaar haalt, bouwt een planner die een toets overslaat
   omdat de METING ontbrak -- en dat is de duurste fout die deze laag kan maken.

   DAAROM STAAT DE VEILIGHEIDSRICHTING IN DE UITVOER EN NIET IN EEN LATER HOOFD:
   elke toets die niet `waargenomen` is, draagt `volleRing: true`. Zolang die
   vlag ergens op staat, is versmallen voor die toets geen recht.

   WAT DEZE METER NIET IS. Hij is geen impactgraaf. Hij zegt welke ROUTES en
   SCHERMEN een toets heeft aangeraakt -- niet welke bronbestanden. Die tweede
   as komt uit dekking per toets en die wordt vandaag per GROEP geschreven, niet
   per bestand (scripts/test-runner.js geeft node een lcov per batch). Zolang
   dat zo is, staat die as hier eerlijk als `nietGemeten` en niet als nul.

   DRAAIEN

     node scripts/attributie.js --lees .routejournaal
     node scripts/attributie.js --lees a.log --lees b.log --schrijf
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'ATTRIBUTIE.json');

/* Alle toetsbestanden die er ZIJN. De noemer komt uit de map en niet uit het
   journaal: een journaal kent per definitie alleen wat het zag, en een
   percentage over zijn eigen waarnemingen staat altijd op 100. */
function alleToetsen() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(test|e2e)\.js$/.test(n)).sort();
}

function leesJournalen(paden) {
  const perToets = new Map();      // toets -> Set van kanten
  let zonderEigenaar = 0, regels = 0;
  for (const p of paden) {
    let tekst = '';
    try { tekst = fs.readFileSync(p, 'utf8'); }
    catch (e) { continue; }        // een ontbrekend journaal is geen nul, zie hieronder
    for (const regel of tekst.split('\n')) {
      const r = regel.trim();
      if (!r) continue;
      let toets = null, kant = null;
      if (r.startsWith('TOETS ')) {
        /* TOETS <METHODE> <patroon> <toets> */
        const v = r.split(' ').filter(Boolean);
        if (v.length < 4) continue;
        toets = v[v.length - 1];
        kant = 'route:' + v[1] + ' ' + v.slice(2, -1).join(' ');
      } else if (r.startsWith('SCHERM ')) {
        /* SCHERM <url> <toets> <soort> */
        const v = r.split(' ').filter(Boolean);
        if (v.length < 4) continue;
        toets = v[2];
        kant = 'scherm:' + v[1];
      } else continue;
      regels++;
      if (toets === 'onbekend') { zonderEigenaar++; continue; }
      if (!perToets.has(toets)) perToets.set(toets, new Set());
      perToets.get(toets).add(kant);
    }
  }
  return { perToets, zonderEigenaar, regels };
}

function meet(paden) {
  const aanwezig = paden.filter((p) => fs.existsSync(p));
  const { perToets, zonderEigenaar, regels } = leesJournalen(aanwezig);
  const toetsen = alleToetsen();

  const per = {};
  let waargenomen = 0, ongemeten = 0;
  for (const t of toetsen) {
    const kanten = perToets.get(t);
    if (kanten && kanten.size) {
      waargenomen++;
      per[t] = { stand: 'waargenomen', kanten: kanten.size, volleRing: false };
    } else {
      ongemeten++;
      per[t] = { stand: 'ongemeten', kanten: 0, volleRing: true };
    }
  }

  /* Namen in het journaal die geen bestaand toetsbestand zijn. Dat hoort nul te
     zijn; staat er iets, dan is de sleutel uit elkaar gelopen met de bestanden
     en dan meet deze hele meter iets anders dan hij denkt. */
  const onbekendeNamen = [...perToets.keys()].filter((t) => !toetsen.includes(t)).sort();

  return {
    uitleg: 'Van welke toets weten we wat hij aanraakt. `ongemeten` betekent ' +
      'dat er niets over bewezen is -- nooit dat de toets niets aanraakt. Elke ' +
      'toets die niet `waargenomen` is draagt volleRing: true.',
    hoe: 'node scripts/attributie.js --lees <journaal> [--lees ...] --schrijf',
    gelezen: { journalen: aanwezig, ontbrekend: paden.filter((p) => !aanwezig.includes(p)), regels },
    gemeten: {
      toetsbestanden: toetsen.length,
      waargenomen,
      ongemeten,
      kantenZonderEigenaar: zonderEigenaar,
      onbekendeNamen
    },
    nietGemeten: {
      bronbestanden: 'welke BRONBESTANDEN een toets raakt is hier niet gemeten: ' +
        'node schrijft lcov per groep en niet per toetsbestand ' +
        '(scripts/test-runner.js). Dat is een tekort van de meting en geen nul.'
    },
    per
  };
}

function main() {
  const paden = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--lees') paden.push(path.resolve(WORTEL, process.argv[++i]));
  }
  if (!paden.length) paden.push(path.join(WORTEL, '.routejournaal'));

  const uit = meet(paden);
  const g = uit.gemeten;

  /* EEN ONTBREKEND JOURNAAL IS GEEN UITSLAG. Zonder bron is alles ongemeten, en
     dat ziet er in een tabel uit als een meting terwijl er niet gekeken is. */
  if (!uit.gelezen.journalen.length) {
    console.error('\n  Geen enkel journaal gevonden (' + paden.join(', ') + ').' +
      '\n  Draai de suite met RTG_ROUTELOG gezet; zonder bron is er niets te attribueren.\n');
    return 2;
  }

  console.log('\nATTRIBUTIE  (' + uit.gelezen.regels + ' journaalregels uit ' +
    uit.gelezen.journalen.length + ' journaal/journalen)\n');
  console.log('  toetsbestanden        ' + String(g.toetsbestanden).padStart(5));
  console.log('  waargenomen           ' + String(g.waargenomen).padStart(5) +
    '  (' + (100 * g.waargenomen / g.toetsbestanden).toFixed(1) + '%)');
  console.log('  ongemeten             ' + String(g.ongemeten).padStart(5) +
    '   -> volle ring, versmallen is hier geen recht');
  console.log('  kanten zonder eigenaar' + String(g.kantenZonderEigenaar).padStart(5) +
    (g.kantenZonderEigenaar ? '   -> een proces zonder RTG_TOETS; zie test/toetsnaam.js' : ''));
  if (g.onbekendeNamen.length) {
    console.log('\n  ' + g.onbekendeNamen.length + ' naam/namen in het journaal horen bij geen ' +
      'bestaand toetsbestand:\n    ' + g.onbekendeNamen.slice(0, 10).join('\n    '));
  }
  console.log('\n  ' + uit.nietGemeten.bronbestanden + '\n');

  if (process.argv.includes('--schrijf')) {
    fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 1) + '\n');
    console.log('  geschreven: ATTRIBUTIE.json\n');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, alleToetsen };
