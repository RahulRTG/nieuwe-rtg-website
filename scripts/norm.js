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
  { sleutel: 'endpointsZonderTest', richting: 'omlaag', wat: 'endpoints die in geen enkele test voorkomen' },
  { sleutel: 'dekkingPct', richting: 'omhoog', wat: 'percentage endpoints dat in een test voorkomt' },
  { sleutel: 'keuringStuk', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "stuk"' },
  { sleutel: 'keuringScheef', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "scheef"' },
  { sleutel: 'keuringBeter', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "beter"' },
  { sleutel: 'dependencies', richting: 'omlaag', wat: 'externe pakketten (de nul is een principe, geen toeval)' },
  { sleutel: 'testbestanden', richting: 'omhoog', wat: 'testbestanden' }
];

function meet() {
  const uit = execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(__dirname, 'keuring.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 });
  const k = JSON.parse(uit);

  /* De dependencies tellen we uit package.json zelf en niet uit een rapport:
     dit is de meter waar je bij twijfel de bron van wilt zien. */
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;

  const testbestanden = fs.readdirSync(path.join(WORTEL, 'test')).filter(f => f.endsWith('.test.js')).length;

  return {
    endpointsZonderTest: (k.cijfers.dekking.ongedekt || []).length,
    dekkingPct: k.cijfers.dekking.pct || 0,
    keuringStuk: k.stuk, keuringScheef: k.scheef, keuringBeter: k.beter,
    dependencies: deps, testbestanden
  };
}

function leesNorm() {
  if (!fs.existsSync(NORMBESTAND)) return null;
  try { return JSON.parse(fs.readFileSync(NORMBESTAND, 'utf8')); } catch (e) { return null; }
}

/* Beweegt de meter de goede kant op, de verkeerde kant op, of staat hij stil? */
function oordeel(m, nu, norm) {
  if (nu === norm) return 'gelijk';
  const beter = m.richting === 'omlaag' ? nu < norm : nu > norm;
  return beter ? 'beter' : 'slechter';
}

function main() {
  const nu = meet();
  const norm = leesNorm();
  const vastleggen = process.argv.includes('--vastleggen');

  if (!norm) {
    console.log('\n\x1b[1mDE NORM\x1b[0m -- nog niet vastgelegd.\n');
    for (const m of METERS) console.log('  ' + m.sleutel.padEnd(22) + String(nu[m.sleutel]).padStart(6) + '   ' + m.wat);
    fs.writeFileSync(NORMBESTAND, JSON.stringify({ vastgelegd: new Date().toISOString().slice(0, 10), meters: nu }, null, 2) + '\n');
    console.log('\n  \x1b[32mNORM.json aangemaakt.\x1b[0m Vanaf nu mag geen van deze meters nog slechter worden.\n');
    return 0;
  }

  console.log('\n\x1b[1mDE NORM\x1b[0m\x1b[2m -- vastgelegd op ' + (norm.vastgelegd || '?') + '\x1b[0m\n');
  const slechter = [], beterDan = [];
  for (const m of METERS) {
    const n = norm.meters[m.sleutel];
    if (n === undefined) continue;                 // nieuwe meter: pas bij het vastleggen erbij
    const v = nu[m.sleutel];
    const o = oordeel(m, v, n);
    const merk = o === 'slechter' ? '\x1b[31mSLECHTER\x1b[0m' : o === 'beter' ? '\x1b[32mbeter   \x1b[0m' : '\x1b[2mgelijk  \x1b[0m';
    console.log('  ' + merk + '  ' + m.sleutel.padEnd(22) + String(v).padStart(6) +
      '\x1b[2m  (norm: ' + n + ')\x1b[0m');
    if (o === 'slechter') slechter.push({ m, nu: v, norm: n });
    if (o === 'beter') beterDan.push({ m, nu: v, norm: n });
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

  if (beterDan.length && !vastleggen) {
    console.log('\n\x1b[32m  De norm is gehaald\x1b[0m, en op ' + beterDan.length + ' punt(en) ruim.');
    console.log('  \x1b[2mLeg dat vast met: node --experimental-sqlite scripts/norm.js --vastleggen\x1b[0m\n');
    return 0;
  }
  if (beterDan.length && vastleggen) {
    /* Alleen de verbeterde meters opschuiven. Een meter die gelijk bleef of
       (onmogelijk, want dan waren we hierboven al gestopt) slechter werd, raken
       we niet aan. */
    const nieuw = { vastgelegd: new Date().toISOString().slice(0, 10), meters: { ...norm.meters } };
    for (const b of beterDan) nieuw.meters[b.m.sleutel] = b.nu;
    for (const m of METERS) if (nieuw.meters[m.sleutel] === undefined) nieuw.meters[m.sleutel] = nu[m.sleutel];
    fs.writeFileSync(NORMBESTAND, JSON.stringify(nieuw, null, 2) + '\n');
    console.log('\n  \x1b[32mNorm strakker gezet op ' + beterDan.length + ' punt(en).\x1b[0m');
    for (const b of beterDan) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    console.log('');
    return 0;
  }

  console.log('\n  \x1b[32mDe norm is gehaald.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, leesNorm, METERS, oordeel };
