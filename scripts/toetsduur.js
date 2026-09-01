#!/usr/bin/env node
/* ============================================================================
   HOE LANG DOET ELKE TOETS EROVER? -- het gewicht onder de scherfverdeling.

   WAAROM DIT ER IS

   De vier toetsscherven verdeelden zich op VOLGORDE en niet op tijd, en de
   traagste scherf is in zijn eentje het kritieke pad van de hele keten. Gemeten
   op main (run 33404735353): 1336 / 548 / 501 / 577 seconden, terwijl een
   gelijke verdeling ~740 per scherf geeft.

   scripts/lib/delen.js weegt sinds 1 september 2026 op de duur uit dit
   register. Dit script schrijft het, uit een echte meting.

   HOE DE METING TOT STAND KOMT. test/toetsnaam.js wordt in elk toetsproces
   voorgeladen en schrijft bij het aflopen een regel `bestand<TAB>ms` naar
   RTG_TOETSDUUR. Dat proces IS het toetsbestand, dus zijn looptijd is precies
   de gevraagde grootheid -- en daarmee is dit geen schatting uit een logstroom
   maar de klok van de machine die hem draaide.

   DE MEDIAAN, NIET HET GEMIDDELDE EN NIET DE LAATSTE. Een runner die een keer
   wegzakt levert een uitschieter van minuten; een gemiddelde neemt die mee en
   een laatste-waarde laat hem het register overschrijven. De mediaan over alle
   waarnemingen van een bestand negeert hem. Wie de spreiding wil zien: die
   staat er per bestand bij (`n`, `min`, `max`).

   WAT DIT REGISTER NIET IS. Geen norm en geen poort. Een bestand dat trager
   wordt is hier geen fout maar een ander gewicht; wie een trage toets wil
   bewaken heeft NORM.json. En een bestand dat ONTBREEKT is geen nul maar
   ongemeten -- delen.js legt die om en om neer, precies zoals vroeger.

   DRAAIEN

     npm test                     schrijft .toetsduur (de ruwe meting)
     node scripts/toetsduur.js    toont wat die meting zegt
     node scripts/toetsduur.js --schrijf          werkt TOETSDUUR.json bij
     node scripts/toetsduur.js --lees a --lees b  meerdere metingen samen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'TOETSDUUR.json');

function lees(paden) {
  const per = new Map();
  let regels = 0, verminkt = 0;
  for (const p of paden) {
    let tekst = '';
    try { tekst = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    for (const regel of tekst.split('\n')) {
      if (!regel.trim()) continue;
      regels++;
      const [naam, ms] = regel.split('\t');
      const n = Number(ms);
      /* Een half geschreven regel (twee processen tegelijk) telt niet mee en
         laat het bestand dus ongemeten -- de veilige kant. */
      if (!naam || !/\.(test|e2e)\.js$/.test(naam) || !Number.isFinite(n) || n < 0) { verminkt++; continue; }
      if (!per.has(naam)) per.set(naam, []);
      per.get(naam).push(Math.round(n));
    }
  }
  return { per, regels, verminkt };
}

const mediaan = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/* De bestanden die er NU zijn. Een register dat namen bewaart van toetsen die
   niet meer bestaan, weegt met spoken; delen.js zou ze nooit tegenkomen, maar
   het register zou blijven groeien en niemand zou meer zien wat er echt in
   staat. */
function opSchijf() {
  return new Set(fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(test|e2e)\.js$/.test(n)));
}

function bouw(paden, bestaand) {
  const { per, regels, verminkt } = lees(paden);
  const bestaat = opSchijf();

  /* Wat er al in het register stond blijft staan zolang het bestand bestaat:
     een ronde die maar een KWART van de suite draaide (een scherf) mag de
     andere drie kwarten niet uit het register vegen. */
  const duur = {};
  const spreiding = {};
  for (const [naam, waarde] of Object.entries((bestaand || {}).duur || {})) {
    if (bestaat.has(naam)) duur[naam] = waarde;
  }
  for (const [naam, waarde] of Object.entries((bestaand || {}).spreiding || {})) {
    if (bestaat.has(naam)) spreiding[naam] = waarde;
  }

  let vers = 0;
  for (const [naam, waarnemingen] of per) {
    if (!bestaat.has(naam)) continue;
    duur[naam] = mediaan(waarnemingen);
    spreiding[naam] = { n: waarnemingen.length,
      min: Math.min(...waarnemingen), max: Math.max(...waarnemingen) };
    vers++;
  }

  const namen = Object.keys(duur).sort();
  const gesorteerd = {};
  for (const n of namen) gesorteerd[n] = duur[n];
  const gesorteerdeSpreiding = {};
  for (const n of namen) if (spreiding[n]) gesorteerdeSpreiding[n] = spreiding[n];

  /* DE HERKOMST HOORT ERBIJ, en niet als sfeer. Een meting van een CI-runner en
     een van een ontwikkelmachine geven andere absolute getallen; voor de
     verdeling maakt dat niets uit (die weegt verhoudingen) maar voor wie het
     bestand leest wel. Zonder stempel zou iemand deze seconden voor
     runnertijden aanzien en zich afvragen waarom zijn scherf anders loopt.
     Zelfde vorm als KETENS.json en de andere registers hier. */
  const stempel = {
    op: new Date().toISOString(),
    waar: process.env.GITHUB_ACTIONS ? 'ci' : 'lokaal',
    node: process.version,
    kernen: require('os').cpus().length
  };
  try {
    stempel.commit = require('child_process')
      .execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  } catch (e) { /* zonder git ook goed */ }

  return {
    stempel,
    uitleg: 'Hoe lang elk toetsbestand erover deed, als gewicht voor de ' +
      'scherfverdeling in scripts/lib/delen.js. Mediaan over alle waarnemingen. ' +
      'Een bestand dat hier NIET in staat is ongemeten en wordt om en om verdeeld ' +
      '-- nooit overgeslagen.',
    hoe: 'npm test (schrijft .toetsduur), daarna: node scripts/toetsduur.js --schrijf',
    gemeten: {
      bestanden: namen.length,
      opSchijf: bestaat.size,
      ongemeten: bestaat.size - namen.length,
      verseWaarnemingen: vers,
      regels, verminkt,
      totaalMs: namen.reduce((s, n) => s + duur[n], 0)
    },
    duur: gesorteerd,
    spreiding: gesorteerdeSpreiding
  };
}

/* Wat zou de verdeling worden? Dit is de hele reden dat het register bestaat,
   dus hoort hij ook hier af te lezen te zijn -- niet alleen in CI.

   EN HIJ REKENT OVER DEZELFDE VERZAMELING ALS DE KETEN, want anders is de
   afdruk een ander getal met dezelfde naam. De scherven draaien de NIET
   -geisoleerde bestanden (scripts/lib/geisoleerd.js) en laten de ijkingen weg
   (--zonder-ijkingen); die krijgen elk een eigen job. Zonder die twee filters
   telde meterijk.test.js hier mee met 864 seconden -- veertien minuten die in
   geen enkele scherf zitten, en dus een verdeling die nergens over gaat. */
function toonVerdeling(uit, totaal) {
  const { indeling, zetDuren } = require('./lib/delen');
  const { isGeisoleerd } = require('./lib/geisoleerd');
  zetDuren(uit.duur);
  try {
    const alle = [...opSchijf()].filter((n) => n.endsWith('.test.js'))
      .filter((n) => !isGeisoleerd(n)).sort();
    const bakken = indeling(alle, totaal);
    const som = (b) => b.reduce((s, n) => s + (uit.duur[n] || 0), 0);
    const lasten = bakken.map(som);
    const ideaal = lasten.reduce((a, b) => a + b, 0) / totaal;
    console.log('\n  de verdeling over ' + totaal + ' scherven ' +
      '(zoals de keten hem draait: zonder de geisoleerde bestanden en de ijkingen):');
    bakken.forEach((b, i) => console.log('    scherf ' + (i + 1) + '  ' +
      String(b.length).padStart(4) + ' bestanden  ' +
      (lasten[i] / 1000).toFixed(0).padStart(6) + 's' +
      (ideaal ? '  (' + (lasten[i] / ideaal).toFixed(2) + 'x ideaal)' : '')));
    if (ideaal) console.log('    ideaal    ' + ' '.repeat(4) + '             ' +
      (ideaal / 1000).toFixed(0).padStart(6) + 's');
  } finally { zetDuren(null); }
}

function main() {
  const paden = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--lees') paden.push(path.resolve(WORTEL, process.argv[++i]));
  }
  if (!paden.length) paden.push(path.join(WORTEL, '.toetsduur'));

  let bestaand = null;
  try { bestaand = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { /* eerste keer */ }

  const aanwezig = paden.filter((p) => fs.existsSync(p));
  if (!aanwezig.length && !bestaand) {
    console.error('\n  Geen meting (' + paden.join(', ') + ') en geen register.' +
      '\n  Draai eerst `npm test`; die schrijft .toetsduur.\n');
    return 2;
  }

  const uit = bouw(aanwezig, bestaand);
  const g = uit.gemeten;
  console.log('\nTOETSDUUR  (' + g.regels + ' waarnemingen uit ' + aanwezig.length + ' meting(en))\n');
  console.log('  toetsbestanden op schijf ' + String(g.opSchijf).padStart(5));
  console.log('  met een gewicht          ' + String(g.bestanden).padStart(5));
  console.log('  ongemeten                ' + String(g.ongemeten).padStart(5) +
    (g.ongemeten ? '   -> om en om verdeeld, nooit overgeslagen' : ''));
  if (g.verminkt) console.log('  verminkte regels         ' + String(g.verminkt).padStart(5) +
    '   -> die bestanden blijven ongemeten');
  console.log('  samen                    ' + (g.totaalMs / 1000).toFixed(0).padStart(5) + 's');

  toonVerdeling(uit, 4);

  if (process.argv.includes('--schrijf')) {
    fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  geschreven: TOETSDUUR.json\n');
  } else {
    console.log('\n  (niets geschreven; gebruik --schrijf)\n');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { lees, bouw, mediaan, REGISTER };
