#!/usr/bin/env node
/* DE BASISLIJN VAN DE NORM MAG NIET MEEBEWEGEN MET DE TAK.

   scripts/norm.js is een ratel: hij vergelijkt waar de code NU staat met wat er
   in NORM.json staat, en de poort gaat dicht als het slechter is. Dat werkt
   zolang NORM.json vaststaat. Maar NORM.json is een bestand IN de tak, en een
   tak kan hem verzetten. Dan meet de ratel de code tegen een lat die in
   dezelfde commit is verlaagd, en meldt netjes groen.

   DIT IS ECHT GEBEURD, twee keer in een week:

     15 augustus  endpointsZonderTest ging van 1158 naar 1284 -- de lat 126
                  ongedekte endpoints omhoog. Met een reden in `notities`, want
                  main was ver doorgelopen; maar niets hield het tegen als die
                  reden er niet had gestaan.
     18 augustus  een tak zette inlineStijlAttributen op 5878 (strakker), main
                  stond intussen op 5927. Bij het samengaan moest iemand met de
                  hand uitzoeken welke van de twee de echte was. Dat is toen
                  goed gegaan; het hing aan een mens die het zag.

   WAT DEZE KEURING DOET. Hij haalt NORM.json op zoals die op main staat, legt
   hem naast die van de tak, en kijkt per meter welke kant hij op is gegaan:

     strakker of gelijk  -> goed, daar is de ratel voor
     LOSSER              -> alleen toegestaan met een verse regel in `notities`
                            die deze meter bij naam noemt

   Dat is precies de belofte die norm.js in zijn eigen kop doet ("wie de lat toch
   wil verlagen moet NORM.json met de hand wijzigen, en dan staat het als bewuste
   keuze in de git-historie") -- maar dan met een handhaver eronder in plaats van
   met vertrouwen. De discipline was overigens onberispelijk: alle zestig
   verlagingen die er tot nu toe zijn, dragen een notitie. Deze keuring maakt van
   die gewoonte een regel.

   `--vastleggen` van norm.js zelf kan NIET verruimen; dat is nagetrokken en het
   klopt (hij stopt met exitcode 1 voordat hij aan schrijven toekomt). Het gat
   zat alleen in de handmatige weg, en dat is de weg die deze keuring afdekt.

   Draai:  node scripts/normbasis.js                  (tegen origin/main)
           node scripts/normbasis.js --tegen FETCH_HEAD
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { METERS, PRESTATIEMETERS } = require('./norm.js');

const WORTEL = path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', grijs: '\x1b[2m', reset: '\x1b[0m' };

/* De vergelijking apart, zonder git en zonder bestanden: zo is hij te ijken met
   verzonnen invoer in plaats van met de toevallige stand van de repo. */
function vergelijk(basis, nu, meters) {
  const losser = [], strakker = [], nieuw = [];
  for (const m of meters) {
    const b = (basis.meters || {})[m.sleutel];
    const n = (nu.meters || {})[m.sleutel];
    if (n === undefined) continue;                  // meter weg: dat is geen verruiming
    if (b === undefined) { nieuw.push({ sleutel: m.sleutel, nu: n }); continue; }
    if (b === n) continue;
    const beter = m.richting === 'omlaag' ? n < b : n > b;
    (beter ? strakker : losser).push({ sleutel: m.sleutel, basis: b, nu: n });
  }
  return { losser, strakker, nieuw };
}

/* Een verruiming is toegestaan met een reden, en die reden moet DEZE VERPLAATSING
   noemen -- niet alleen deze meter.

   DAT VERSCHIL IS DE HELE KEURING, en de eerste versie hiervan miste hem. Die
   vroeg alleen of er ergens een notitie stond die de meter noemde. NORM.json
   draagt zestig notities uit twee weken, waarvan een stuk of vijf het woord
   `endpointsZonderTest` bevat -- dus dekte een notitie van 4 augustus elke
   verlaging die iemand vandaag zou doen. Betrapt door de tegenproef in
   test/normbasis.test.js, die eerst gewoon groen bleef op een verzonnen
   verlaging zonder reden.

   De vorm waar dit huis zijn notities al in schrijft, draagt het antwoord in
   zich: "keuringOmvang 158 -> 159; kernBreedte 1405 -> 1413". Er staat een
   NIEUWE WAARDE bij. Die eisen we, als los getal, naast de naam van de meter --
   dan dekt een notitie precies een verplaatsing en geen enkele andere. */
function gedekt(sleutel, notities, nieuweWaarde) {
  const getal = new RegExp('(^|[^0-9.])' + String(nieuweWaarde).replace('.', '\\.') + '([^0-9]|$)');
  return (notities || []).some((n) => {
    const waar = String(n.meter || '');
    return waar.includes(sleutel) && getal.test(waar) && String(n.reden || '').trim().length > 25;
  });
}

function lees(ref) {
  try {
    return JSON.parse(execFileSync('git', ['show', ref + ':NORM.json'], { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (e) { return null; }
}

function main() {
  const i = process.argv.indexOf('--tegen');
  const ref = i > -1 ? process.argv[i + 1] : 'origin/main';
  const basis = lees(ref);
  if (!basis) {
    /* Geen tweede kant is geen vergelijking. Dit hoort te zakken en niet
       stilzwijgend te slagen: precies LAT.md regel 10. In CI komt origin/main
       uit de volle checkout (fetch-depth: 0); een latere `git fetch` kan daar
       niet meer, want de checkout laat geen credential achter. */
    console.error('\n  ' + K.rood + 'De basislijn van ' + ref + ' is niet te lezen.' + K.reset +
      '\n  Een vergelijking met een kant is geen vergelijking. Haal de tak op\n' +
      '  (git fetch origin main) en draai opnieuw.\n');
    return 1;
  }
  const nu = JSON.parse(fs.readFileSync(path.join(WORTEL, 'NORM.json'), 'utf8'));
  const alle = [...METERS, ...PRESTATIEMETERS];
  const { losser, strakker, nieuw } = vergelijk(basis, nu, alle);

  const zonderReden = losser.filter(l => !gedekt(l.sleutel, nu.notities, l.nu));
  for (const s of strakker) console.log('  ' + K.groen + 'strakker' + K.reset + '  ' + s.sleutel + ': ' + s.basis + ' -> ' + s.nu);
  for (const n of nieuw) console.log('  ' + K.grijs + 'nieuw   ' + K.reset + '  ' + n.sleutel + ': ' + n.nu);
  for (const l of losser) {
    const ok = gedekt(l.sleutel, nu.notities, l.nu);
    console.log('  ' + (ok ? K.grijs + 'losser  ' + K.reset : K.rood + 'LOSSER  ' + K.reset) +
      '  ' + l.sleutel + ': ' + l.basis + ' -> ' + l.nu + (ok ? K.grijs + '  (met reden)' + K.reset : ''));
  }
  if (zonderReden.length) {
    console.error('\n  ' + K.rood + 'DE LAT IS VERLAAGD ZONDER REDEN.' + K.reset + '\n');
    for (const l of zonderReden) console.error('    ' + l.sleutel + ': op ' + ref + ' ' + l.basis + ', in deze tak ' + l.nu);
    console.error('\n  Verlagen mag, stilletjes niet. Zet er een regel bij in `notities` van\n' +
      '  NORM.json die de meter bij NAAM noemt en zegt waarom -- dan staat het als\n' +
      '  bewuste keuze in de historie in plaats van als erosie.\n');
    return 1;
  }
  console.log('\n  ' + K.groen + 'De basislijn is niet verruimd ten opzichte van ' + ref + '.' + K.reset + '\n');
  return 0;
}

module.exports = { vergelijk, gedekt };
if (require.main === module) process.exit(main());
