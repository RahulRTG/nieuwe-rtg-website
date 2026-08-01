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
  { sleutel: 'zelfpoortendeToetsen', richting: 'omlaag', wat: 'toetsen die zichzelf overslaan als een dienst ontbreekt' },
  { sleutel: 'e2eBestanden', richting: 'omhoog', wat: 'schermtoetsen (*.e2e.js, draaien niet mee in npm test)' }
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
     en `skip: false` juist niet -- dat is een poort die openstaat. */
  let zelfpoortendeToetsen = 0;
  for (const f of inMap.filter(n => /\.(test|e2e)\.js$/.test(n))) {
    const bron = fs.readFileSync(path.join(testMap, f), 'utf8');
    for (const m of bron.matchAll(/\{\s*skip\s*:\s*([^}]+)\}/g)) {
      if (!/^false\s*$/.test(m[1])) zelfpoortendeToetsen++;
    }
    // test.skip(...) / it.skip(...): de harde vorm, altijd overgeslagen
    zelfpoortendeToetsen += (bron.match(/\b(?:test|it)\.skip\s*\(/g) || []).length;
  }

  return {
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

  if (slechter.length) {
    console.log('\n\x1b[31m  DE NORM IS NIET GEHAALD.\x1b[0m\n');
    for (const s of slechter)
      console.log('    ' + s.m.sleutel + ': ' + s.nu + ' terwijl de norm ' + s.norm + ' is  -- ' + s.m.wat);
    console.log('\n  Dit is geen advies. Wat een keer goed was, hoort niet stilletjes slechter te');
    console.log('  worden. Herstel het, of verlaag de norm met de hand in NORM.json -- dan staat');
    console.log('  het als bewuste keuze in de historie.\n');
    return 1;
  }

  if ((beterDan.length || nieuw.length) && !vastleggen) {
    console.log('\n\x1b[32m  De norm is gehaald\x1b[0m' +
      (beterDan.length ? ', en op ' + beterDan.length + ' punt(en) ruim' : '') +
      (nieuw.length ? '; ' + nieuw.length + ' meter(s) wachten nog op een grondwaarde' : '') + '.');
    console.log('  \x1b[2mLeg dat vast met: node --experimental-sqlite scripts/norm.js --vastleggen\x1b[0m\n');
    return 0;
  }
  /* HIER STOND `if (beterDan.length && vastleggen)`. Een meter die je toevoegt
     terwijl er verder niets verbeterde, viel dus door naar "de norm is gehaald"
     en werd NOOIT vastgelegd -- hij bleef eeuwig zonder grondwaarde en dus
     eeuwig tandeloos. Nieuwe meters zijn nu op zichzelf reden om te schrijven. */
  if (beterDan.length || nieuw.length) {
    /* Alleen de verbeterde meters opschuiven. Een meter die gelijk bleef of
       (onmogelijk, want dan waren we hierboven al gestopt) slechter werd, raken
       we niet aan.
       De overige velden van NORM.json blijven staan: `notities` draagt de reden
       van een met de hand verlaagde norm, en die mag niet bij de eerstvolgende
       --vastleggen stilzwijgend verdwijnen. */
    const uit = { ...norm, vastgelegd: new Date().toISOString().slice(0, 10), meters: { ...norm.meters } };
    for (const b of beterDan) uit.meters[b.m.sleutel] = b.nu;
    for (const m of METERS) if (uit.meters[m.sleutel] === undefined) uit.meters[m.sleutel] = nu[m.sleutel];
    fs.writeFileSync(NORMBESTAND, JSON.stringify(uit, null, 2) + '\n');
    if (beterDan.length) {
      console.log('\n  \x1b[32mNorm strakker gezet op ' + beterDan.length + ' punt(en).\x1b[0m');
      for (const b of beterDan) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    }
    if (nieuw.length) {
      console.log('  \x1b[36m' + nieuw.length + ' nieuwe meter(s) vastgelegd.\x1b[0m');
      for (const n of nieuw) console.log('    ' + n.m.sleutel + ': ' + n.nu);
    }
    console.log('');
    return 0;
  }

  console.log('\n  \x1b[32mDe norm is gehaald.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, leesNorm, METERS, oordeel };
