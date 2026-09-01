#!/usr/bin/env node
'use strict';

/* ============================================================================
   DE SCHERMTOETSEN, EVENTUEEL IN DELEN.

   Dit stond als een regel shell in package.json. Er moest een ding bij -- de
   suite over meerdere runners verdelen -- en dat is precies het soort ding dat
   in een shell-regel onleesbaar wordt. Verder doet dit script hetzelfde als die
   regel deed.

   WAT ER NIET VERANDERT

   SERIEEL BLIJFT SERIEEL. Elk e2e-bestand start een echte server en meestal ook
   een Chromium. Met concurrency 2 wisselde onder belasting alleen WELK goed
   scherm zijn eigen 8/20s-grens miste. Binnen een deel draait dus nog steeds
   een bestand tegelijk; de winst van --deel zit in MEER MACHINES, niet in meer
   processen op dezelfde machine.

   HET JOURNAAL BLIJFT HET JOURNAAL. De server schrijft in RTG_ROUTELOG op welk
   scherm hij werkelijk heeft geserveerd; scripts/schermen.js telt daarna de apps
   die geen enkele toets ooit heeft geopend. Bij een verdeelde ronde schrijft elk
   deel zijn eigen journaal en worden ze samengevoegd voordat die meter oordeelt
   -- anders zou elk deel drie kwart van de schermen als "nooit geopend" zien.

   Gebruik:
     node scripts/e2e.js                 alles, zoals altijd
     node scripts/e2e.js --deel=2/4      alleen deel 2 van vier
     RTG_SCHERMJOURNAAL=x node scripts/e2e.js    schrijf het journaal daar
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ontleedDeel, verdeel } = require('./lib/delen');

const WORTEL = path.join(__dirname, '..');
const TESTMAP = path.join(WORTEL, 'test');
const argv = process.argv.slice(2);

const deelVlag = (argv.find(a => a.startsWith('--deel=')) || '').slice(7);
const deel = (() => {
  if (!deelVlag) return null;
  const d = ontleedDeel(deelVlag);
  if (!d) {
    console.error('[e2e] --deel verwacht de vorm N/M met 1 <= N <= M, kreeg: ' + deelVlag);
    process.exit(2);
  }
  return d;
})();

const journaal = process.env.RTG_SCHERMJOURNAAL || path.join(WORTEL, '.schermjournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }

const alle = fs.readdirSync(TESTMAP).filter(n => n.endsWith('.e2e.js')).sort();
const mijn = verdeel(alle, deel);   // dezelfde verdeelregel als de unit-toetsen

if (!mijn.length) {
  console.error('[e2e] geen schermtoetsen in dit deel; dat is geen groene ronde maar een lege.');
  process.exit(2);
}
console.log('[e2e] ' + (deel ? 'deel ' + deel.nr + ' van ' + deel.totaal + ': ' : '') +
  mijn.length + ' van ' + alle.length + ' schermbestanden, een tegelijk');

const r = spawnSync(process.execPath, [
  '--experimental-sqlite', '--test', '--test-concurrency=1', '--test-timeout=600000',
  ...mijn.map(n => path.join('test', n))
], {
  cwd: WORTEL,
  /* Zelfde voorlading als in scripts/test-runner.js, en om dezelfde reden: de
     naam van het toetsbestand moet in elk kindproces staan, niet alleen in de
     servers die test/helper.js start. Zie test/toetsnaam.js. */
  env: { ...process.env, RTG_ROUTELOG: journaal,
    /* Ook de schermtoetsen worden in vier delen verdeeld, dus ook zij hebben
       een gewicht nodig. Zelfde meting, zelfde bestand. */
    RTG_TOETSDUUR: process.env.RTG_TOETSDUUR || path.join(WORTEL, '.toetsduur'),
    NODE_OPTIONS: (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') +
      '--require ' + JSON.stringify(path.join(WORTEL, 'test', 'toetsnaam.js')) },
  stdio: 'inherit'
});

if (r.error) {
  console.error('[e2e] runnerfout: ' + r.error.message);
  process.exit(2);
}
process.exitCode = r.status == null ? 2 : r.status;
