#!/usr/bin/env node
'use strict';
/* DE VERDELING -- welke toetsbestanden horen bij welke scherf?

   WAAROM. De poort draaide 1083 toetsbestanden in één proces: vier uur, en met
   elke samenvoeging langer. Verdelen kon niet, omdat de dekkingsvloer over
   processen niet optelt -- dat is nu opgelost (scripts/lib/lcov.js), en hier
   staat de andere helft: WIE gaat waarheen.

   OP KOSTEN EN NIET OP AANTAL. De duur verschilt hier met een factor honderd.
   Vier gelijke stukken op aantal betekent drie werkers die duimen draaien
   terwijl de vierde de zware bak leegt; de wandklok is de langste scherf en niet
   het gemiddelde. De duren komen uit SUITEDUUR.json, en wat daar nog niet in
   staat krijgt de ZWAARSTE bekende schatting -- niet nul en niet het gemiddelde.
   Verkeerd gokken kost dan wat evenwicht, en niet een scherf die als laatste nog
   een uur bezig is.

   EN DE SOLO-LIJST GAAT MEE, want die werd hier juist genegeerd. `npm run
   test:gate` draaide `node --test test/*.test.js` rechtstreeks, dus zonder de
   zes bronmuterende bestanden apart te zetten die scripts/lib/geisoleerd.js
   noemt. De poort die telt draaide dus anders dan de loper die het huis lokaal
   gebruikt. Die bestanden gaan hier allemaal naar scherf 1 en worden daar
   serieel gedraaid, vóór de rest.

   DE VERDELING IS DETERMINISTISCH. Zelfde invoer, zelfde uitkomst -- anders kan
   een herhaalde ronde een ander bestand op een andere scherf zetten, en dan is
   "die scherf zakte" geen bruikbare aanwijzing meer.

   GEBRUIK
     node scripts/scherf.js --van 1 --totaal 4            de gewone bestanden
     node scripts/scherf.js --van 1 --totaal 4 --solo     de geisoleerde (alleen scherf 1)
     node scripts/scherf.js --totaal 4 --overzicht        wat elke scherf krijgt
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { GEISOLEERD } = require('./lib/geisoleerd');

const WORTEL = path.join(__dirname, '..');
const ARG = process.argv.slice(2);
const getal = (naam, standaard) => {
  const i = ARG.indexOf(naam);
  return i >= 0 ? Number(ARG[i + 1]) : standaard;
};

const TOTAAL = getal('--totaal', 4);
const VAN = getal('--van', 1);

function duren() {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'SUITEDUUR.json'), 'utf8')).ms || {}; }
  catch (e) { return {}; }
}

function bestanden() {
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => n.endsWith('.test.js')).sort();
}

/* GREEDY: het duurste bestand naar de scherf die op dat moment het lichtst is.
   Niet optimaal (dat is NP-hard) maar in de praktijk binnen een paar procent van
   optimaal, en in één doorloop te lezen. */
function verdeel(namen, ms, totaal) {
  const bekend = Object.entries(ms).map(([, v]) => v).filter((v) => v > 0);
  const zwaarste = bekend.length ? Math.max(...bekend) : 1000;
  const kosten = (n) => ms['test/' + n] || zwaarste;

  const scherven = Array.from({ length: totaal }, () => ({ namen: [], kosten: 0 }));
  for (const n of [...namen].sort((a, b) => kosten(b) - kosten(a) || a.localeCompare(b))) {
    const licht = scherven.reduce((a, b) => (b.kosten < a.kosten ? b : a));
    licht.namen.push(n);
    licht.kosten += kosten(n);
  }
  for (const s of scherven) s.namen.sort();
  return scherven;
}

const alle = bestanden();
const solo = alle.filter((n) => GEISOLEERD.has(n));
const gewoon = alle.filter((n) => !GEISOLEERD.has(n));
const scherven = verdeel(gewoon, duren(), TOTAAL);

if (ARG.includes('--overzicht')) {
  const ms = duren();
  const bekend = Object.values(ms).filter((v) => v > 0);
  const zwaarste = bekend.length ? Math.max(...bekend) : 1000;
  console.log('\n' + alle.length + ' toetsbestand(en) over ' + TOTAAL + ' scherf/scherven' +
    '  (' + solo.length + ' geisoleerd, altijd op scherf 1 en serieel)');
  console.log('\x1b[2m' + Object.keys(ms).length + ' duren bekend; de rest krijgt de zwaarste schatting (' +
    Math.round(zwaarste / 1000) + 's)\x1b[0m\n');
  scherven.forEach((s, i) => {
    console.log('  scherf ' + (i + 1) + ': ' + String(s.namen.length).padStart(4) + ' bestand(en), ' +
      'geschat ' + Math.round(s.kosten / 60000) + ' min' + (i === 0 ? '  + ' + solo.length + ' serieel' : ''));
  });
  const spreiding = Math.max(...scherven.map((s) => s.kosten)) - Math.min(...scherven.map((s) => s.kosten));
  console.log('\n\x1b[2mspreiding tussen de zwaarste en de lichtste scherf: ' +
    Math.round(spreiding / 60000) + ' min\x1b[0m\n');
} else if (ARG.includes('--solo')) {
  /* De geisoleerde bestanden horen bij scherf 1 en nergens anders. Vraagt een
     andere scherf ernaar, dan krijgt hij een lege lijst -- niet een fout, want
     dan zou elke scherf zijn eigen aanroep moeten bewaken. */
  if (VAN === 1) console.log(solo.map((n) => 'test/' + n).join('\n'));
} else {
  const s = scherven[VAN - 1];
  if (!s) { console.error('scherf ' + VAN + ' bestaat niet bij een totaal van ' + TOTAAL); process.exit(2); }
  console.log(s.namen.map((n) => 'test/' + n).join('\n'));
}
