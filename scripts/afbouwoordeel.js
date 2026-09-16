#!/usr/bin/env node
/* ============================================================================
   HET AFBOUWOORDEEL -- is DEZE commit bewezen, of is hij alleen niet rood?

   WAAROM DIT ER IS

   `afbouw:software` is de gezagspoort voor een uitrol: volledige suite,
   schermsuite, releasepoort en stagingrepetitie, aan elkaar geregen met `&&`.
   Dat is een BINAIRE keten: hij stopt bij de eerste die valt, en anders is hij
   klaar. Wat hij niet kan zeggen is of alle vier er ook werkelijk zijn geweest.

   En dat is geen theorie. `afbouw:snel` heet bijna hetzelfde en draait er TWEE:
   de releasepoort en de stagingrepetitie, zonder de volledige suite en zonder de
   schermsuite. Wie die voor een uitrol gebruikt, krijgt een groen dat de halve
   oppervlakte oversloeg -- en niets in de uitvoer zegt dat.

   Dit is dezelfde fout die scripts/ci-lokaal.js op 15 september 2026 aan het
   licht bracht: afwezigheid van falen las als bewijs. De reparatie daar was een
   derde stand, en die stand wordt hier HERGEBRUIKT en niet nagebouwd --
   `oordeelVan` woont in ci-lokaal.js en heeft hier geen tweede huis. Twee
   plekken die allebei beslissen wat BEWEZEN betekent, zeggen op een dag iets
   anders.

   WAT DIT WEL EN NIET IS. Dit draait geen enkele toets. Het is een LEZER: elk
   van de vier stappen laat bewijs achter met een stempel erin, en dit script
   vraagt per stap of dat bewijs er is, of het bij DEZE commit hoort, en of het
   niet gezakt is. Een bewijs van gisteren is geen bewijs van vandaag.

   DE DRIE STANDEN, en de middelste is de reden dat dit bestaat:

     GEZAKT      er is tegenbewijs op deze commit.
     ONBEWEZEN   er valt niets om, maar voor deze commit ontbreekt vereist
                 bewijs -- geen groen en geen rood.
     BEWEZEN     alle vier de vereiste bewijzen zijn geleverd, op deze commit.

   MET --eis-bewezen ZAKT HIJ OOK OP ONBEWEZEN, en zo hoort een gezagspoort hem
   aan te roepen. Zonder die vlag drukt hij het oordeel af en laat hij door: dat
   is de stand voor iemand die tussendoor kijkt. Een release-, merge- of
   uitrolpoort mag die vrijblijvende stand nooit gebruiken -- niet als afspraak
   maar mechanisch, en daarom staat de vlag in package.json en niet in een
   handleiding.

   DRAAIEN

     npm run afbouw:oordeel                 (lezen, altijd exit 0)
     npm run afbouw:oordeel -- --eis-bewezen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { oordeelVan } = require('./ci-lokaal');
const { nuCommit } = require('./lib/stempel');

/* DE BEWIJSMAP IS TE OVERSCHRIJVEN, en dat is geen achterdeur maar de enige
   manier om deze poort te BEPROEVEN. test/afbouwoordeel.test.js zet een
   kunstmatige ronde neer (een die ontbreekt, een die gezakt is, een die
   compleet is) en kijkt of de exitcode meebeweegt. Zonder die naad zou de
   negatieve proef de ECHTE .release-map moeten vervuilen, en een toets die de
   releasepoort van de machine waarop hij draait kan dichttrekken, wordt binnen
   een week uitgezet. Dezelfde vorm als RTG_AFBOUW_SLOT in scripts/afbouw-slot.js.
   Niets in de productieweg zet deze variabele. */
const WORTEL = process.env.RTG_AFBOUW_BEWIJSMAP
  ? path.resolve(process.env.RTG_AFBOUW_BEWIJSMAP)
  : path.join(__dirname, '..');
const DOEL = path.join(WORTEL, '.release', 'afbouwoordeel.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', dim: '\x1b[2m', vet: '\x1b[1m', uit: '\x1b[0m' };

/* DE VIER VEREISTE BEWIJZEN VAN DE SOFTWAREPOORT. Deze lijst is de definitie
   van "bewezen" voor een commit, en hij hoort gelijk te lopen met
   `afbouw:software` in package.json. Wijkt die opdracht af, dan wijkt dit
   oordeel mee -- test/afbouwoordeel.test.js houdt dat vast. */
const VEREIST = [
  { id: 'suite', naam: 'De volledige toetssuite', opdracht: 'npm test',
    bestand: 'SUITE.json' },
  { id: 'schermen', naam: 'De schermsuite', opdracht: 'npm run schermsuite:bewijs',
    bestand: '.release/schermsuite-bewijs.json' },
  { id: 'releasepoort', naam: 'De releasepoort', opdracht: 'npm run release:gate',
    bestand: '.release/release-gate-bewijs.json' },
  { id: 'staging', naam: 'De stagingrepetitie', opdracht: 'npm run staging:repetitie',
    bestand: '.release/staging-bewijs.json' }
];

/* De commit waar een bewijsbestand bij hoort. De vier schrijvers gebruiken niet
   allemaal hetzelfde veld -- `bron` bij wie exactStempel() schrijft, `stempel`
   bij een register -- en dat verschil hoort hier te worden opgevangen en niet
   in vier schrijvers te worden rechtgetrokken. */
function commitVan(j) {
  const s = j && (j.bron || j.stempel || j.gemeten);
  return (s && s.commit) ? String(s.commit) : null;
}

/* Twee commits horen bij elkaar als de een een voorvoegsel van de ander is:
   exactStempel() schrijft kort, een register soms de volle sha. */
function zelfdeCommit(a, b) {
  if (!a || !b) return false;
  const kort = a.length < b.length ? a : b, lang = a.length < b.length ? b : a;
  return kort.length >= 7 && lang.startsWith(kort);
}

function lees(hier) {
  const nu = hier || nuCommit();
  const per = VEREIST.map((v) => {
    const pad = path.join(WORTEL, v.bestand);
    let j;
    try { j = JSON.parse(fs.readFileSync(pad, 'utf8')); }
    catch (e) {
      return Object.assign({}, v, { stand: 'ontbreekt',
        waarom: 'geen bewijs op ' + v.bestand + ' -- deze stap heeft hier niet gedraaid' });
    }
    const commit = commitVan(j);
    /* EEN BEWIJS ZONDER COMMIT IS GEEN BEWIJS VAN DEZE COMMIT. Het telt als
       ontbrekend en niet als geleverd: wie het zou meetellen, laat een bewijs
       van een onbekend moment voor vandaag doorgaan. */
    if (!commit) {
      return Object.assign({}, v, { stand: 'ontbreekt',
        waarom: v.bestand + ' draagt geen commit -- niet vast te stellen waar dit bewijs bij hoort' });
    }
    if (!zelfdeCommit(commit, nu)) {
      return Object.assign({}, v, { stand: 'ontbreekt', commit,
        waarom: 'bewijs hoort bij ' + commit.slice(0, 8) + ', deze commit is ' + String(nu).slice(0, 8) });
    }
    if (j.geslaagd === false) {
      return Object.assign({}, v, { stand: 'gezakt', commit,
        waarom: v.bestand + ' meldt geslaagd: false' });
    }
    return Object.assign({}, v, { stand: 'geleverd', commit });
  });

  const gezakt = per.filter((p) => p.stand === 'gezakt').length;
  const ontbreekt = per.filter((p) => p.stand === 'ontbreekt').length;
  /* DE BESLISREGEL KOMT UIT ci-lokaal.js EN WORDT HIER NIET NAGEBOUWD. De derde
     parameter is daar "draait alleen in de keten"; die bestaat hier niet, dus 0. */
  const stand = oordeelVan(gezakt, ontbreekt, 0);

  return { formaat: 'rtg-afbouwoordeel-v1', commit: nu, stand,
    vereist: VEREIST.length,
    geleverd: per.filter((p) => p.stand === 'geleverd').length,
    ontbreekt, gezakt, per };
}

function toon(u) {
  console.log('\n' + K.vet + 'AFBOUWOORDEEL' + K.uit + K.dim + '  commit ' + String(u.commit).slice(0, 8) + K.uit + '\n');
  for (const p of u.per) {
    const kleur = p.stand === 'geleverd' ? K.groen : p.stand === 'gezakt' ? K.rood : K.geel;
    console.log('  ' + kleur + p.stand.padEnd(10) + K.uit + p.naam.padEnd(28) +
      K.dim + (p.stand === 'geleverd' ? p.opdracht : p.waarom) + K.uit);
  }
  const kleur = u.stand === 'GEZAKT' ? K.rood : u.stand === 'ONBEWEZEN' ? K.geel : K.groen;
  console.log('\n  OORDEEL   : ' + kleur + u.stand + K.uit +
    K.dim + '  ' + u.geleverd + ' van ' + u.vereist + ' vereiste bewijzen geleverd op deze commit' + K.uit);
  if (u.stand === 'ONBEWEZEN') {
    console.log('  ' + K.dim + 'Afwezigheid van falen is geen bewijs. Een uitrolpoort hoort hier te zakken;' +
      '\n  draai `npm run afbouw:software` in plaats van `afbouw:snel`.' + K.uit);
  }
  console.log('');
}

function main() {
  const u = lees();
  toon(u);
  try {
    fs.mkdirSync(path.dirname(DOEL), { recursive: true, mode: 0o700 });
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n', { mode: 0o600 });
  } catch (e) { /* het oordeel staat al op het scherm; niet kunnen opschrijven mag het niet wegnemen */ }

  if (u.stand === 'GEZAKT') return 1;
  if (u.stand === 'ONBEWEZEN' && process.argv.includes('--eis-bewezen')) return 1;
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { lees, VEREIST, commitVan, zelfdeCommit, DOEL };
