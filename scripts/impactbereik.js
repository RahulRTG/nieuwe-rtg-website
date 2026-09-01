#!/usr/bin/env node
/* ============================================================================
   HOEVER REIKT EEN WIJZIGING? -- de meting die de impactgraaf moet verdienen.

   WAAROM DIT ER IS

   Het aantrekkelijke plan is: classificeer een commit en draai alleen wat hij
   raakt. Het fundament daarvoor ligt er -- scripts/lib/werkelijkheid.js levert
   de require-kanten, BEDRADING.json telt er 3730 opgelost en 5 niet. Keer die
   graaf om en een wijziging in kern/pay/poort.js raakt zes van de 1433
   toetsbestanden.

   ZES. Voor de plek waar elke betaling langskomt. Dat is geen versmalling maar
   een blinde vlek, en dit script meet hoe groot hij is: 57% van de
   toetsbestanden heeft GEEN require-kant naar server/ -- ze starten de server
   als apart proces (scripts/lib/proefserver.js, een eigen spawn) en raken de
   hele oppervlakte over HTTP. Een require-graaf ziet daar niets van.

   Daarom staat deze meter er VOOR de planner en niet erna. Wie hem overslaat
   bouwt een keuring die toetsen overslaat omdat de meting ontbrak, en die
   groen meldt -- "de stilste vorm van kapot die dit huis kent"
   (scripts/lib/bedrading.js).

   WAT DIT NIET IS. Geen impactgraaf en geen planner. Dit beantwoordt een
   vraag: hoeveel van de toetsen is met de statische graaf alleen te bereiken,
   en hoeveel niet. Zolang het tweede getal groot is, is versmallen geen recht.

   DRAAIEN

     node scripts/impactbereik.js
     node scripts/impactbereik.js server/kern/pay/poort.js server/kern/passen.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { index } = require('./lib/werkelijkheid');

const WORTEL = path.join(__dirname, '..');
const ISTOETS = /^test\/.*\.(test|e2e)\.js$/;

/* Deze twee vormen zijn de reden dat de statische graaf te weinig ziet: een
   toets die een server START praat er daarna over HTTP mee, en die kant staat
   in geen enkele require. */
const START_PROCES = /child_process|spawn\(|proefserver|startServer/;
const PRAAT_HTTP = /fetch\(|http:\/\/127|localhost:/;

function bouw() {
  const ix = index(['server', 'scripts', 'test', 'public']);
  const omgekeerd = new Map();
  for (const b of ix.bestanden.values()) {
    /* Een BENADERDE kant telt mee, net als in scripts/lib/bedrading.js: we
       weten niet welke van de kandidaten het is, dus nemen we ze allemaal. Dat
       maakt de graaf RUIMER, en dat is hier de veilige kant. */
    for (const d of b.kanten.opgelost) {
      if (!omgekeerd.has(d)) omgekeerd.set(d, []);
      omgekeerd.get(d).push(b.pad);
    }
  }
  return { ix, omgekeerd };
}

function geraakt(omgekeerd, start) {
  const gezien = new Set([start]);
  const stapel = [start];
  while (stapel.length) {
    for (const o of (omgekeerd.get(stapel.pop()) || [])) {
      if (!gezien.has(o)) { gezien.add(o); stapel.push(o); }
    }
  }
  return [...gezien].filter((p) => ISTOETS.test(p));
}

function meet(bestanden) {
  const { ix, omgekeerd } = bouw();
  const toetsen = [...ix.bestanden.keys()].filter((p) => ISTOETS.test(p)).sort();

  let zonderKant = 0, startProces = 0, praatHttp = 0;
  for (const t of toetsen) {
    const b = ix.bestanden.get(t);
    if (!b.kanten.opgelost.some((d) => d.startsWith('server/'))) zonderKant++;
    let bron = '';
    try { bron = fs.readFileSync(path.join(WORTEL, t), 'utf8'); } catch (e) { /* weg is weg */ }
    if (START_PROCES.test(bron)) startProces++;
    if (PRAAT_HTTP.test(bron)) praatHttp++;
  }

  const proeven = bestanden.map((f) => ({ bestand: f, toetsen: geraakt(omgekeerd, f).length }));

  return {
    uitleg: 'Hoeveel toetsen bereikt de STATISCHE graaf, en hoeveel niet. Het ' +
      'tweede getal is de blinde vlek: een toets die zijn server als apart ' +
      'proces start heeft geen require-kant en verdwijnt uit elk impactplan.',
    hoe: 'node scripts/impactbereik.js',
    gemeten: {
      bestanden: ix.bestanden.size,
      toetsbestanden: toetsen.length,
      zonderRequireKantNaarServer: zonderKant,
      startEenProces: startProces,
      praatOverHttp: praatHttp,
      blindePct: Number((100 * zonderKant / toetsen.length).toFixed(1))
    },
    proeven
  };
}

if (require.main === module) {
  const gevraagd = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const uit = meet(gevraagd.length ? gevraagd : [
    'server/kern/stuur/resolver.js', 'server/kern/pay/poort.js',
    'server/kern/passen.js', 'server/kern/fiscaal/tarief.js'
  ]);
  const g = uit.gemeten;
  console.log('\nIMPACTBEREIK  (' + g.bestanden + ' bestanden, ' + g.toetsbestanden + ' toetsbestanden)\n');
  for (const p of uit.proeven) {
    console.log('  ' + String(p.toetsen).padStart(5) + '  ' +
      (100 * p.toetsen / g.toetsbestanden).toFixed(1).padStart(5) + '%  ' + p.bestand);
  }
  console.log('\n  zonder require-kant naar server/ ' + String(g.zonderRequireKantNaarServer).padStart(5) +
    '  (' + g.blindePct + '%)');
  console.log('  start een eigen proces           ' + String(g.startEenProces).padStart(5));
  console.log('  praat over http                  ' + String(g.praatOverHttp).padStart(5));
  console.log('\n  Die eerste groep is voor de statische graaf onzichtbaar. Zolang hij groot is,\n' +
    '  is versmallen geen recht -- zie KEURING.md par. 1.\n');
}

module.exports = { meet, geraakt, bouw, ISTOETS };
