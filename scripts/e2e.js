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
const BEWIJS = argv.includes('--bewijs');
const BEWIJSPAD = path.join(WORTEL, '.release', 'schermsuite-bewijs.json');
const begonnen = new Date().toISOString();
if (BEWIJS) {
  try { fs.rmSync(BEWIJSPAD, { force: true }); } catch (e) {}
}

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
if (BEWIJS && deel) {
  console.error('[e2e] releasebewijs kan alleen uit één volledige, onverdeelde schermronde komen.');
  process.exit(2);
}

const journaal = process.env.RTG_SCHERMJOURNAAL || path.join(WORTEL, '.schermjournaal');
try { fs.unlinkSync(journaal); } catch (e) { if (e.code !== 'ENOENT') throw e; }

/* DEZE LOPER DRAAIT ZONDER DEKKING, en dat is een eigenschap van de meting en
   niet een detail. Hij stond hier eerst helemaal niet, en daardoor schreven de
   schermtoetsen hun duur weg als modus `onbekend`: een bak die nooit leegloopt,
   waardoor deze suite voor altijd op `twijfelachtig` bleef staan en met een
   marge verdeeld werd. Gemeten in run 33504563133 -- 1434 bestanden onder
   `onbekend`, terwijl de unit-scherven netjes onder `dekking` landden.

   Hij staat BOVEN de verdeling hieronder, want `verdeel()` kiest zijn gewichten
   op de modus van dit proces. Meten en plannen horen hetzelfde model te
   gebruiken; dat ze uit elkaar konden lopen is de fout waar deze laag voor is
   gebouwd. */
require('./lib/meetbron').zetModus(false);

const alle = fs.readdirSync(TESTMAP).filter(n => n.endsWith('.e2e.js')).sort();
const mijn = verdeel(alle, deel);   // dezelfde verdeelregel als de unit-toetsen
const bewijsHulp = BEWIJS ? require('./lib/schermsuite-bewijs') : null;
const inventarisVoor = BEWIJS ? bewijsHulp.inventaris(WORTEL) : null;
const bronVoor = BEWIJS ? require('./lib/stempel').exactStempel() : null;

if (!mijn.length) {
  console.error('[e2e] geen schermtoetsen in dit deel; dat is geen groene ronde maar een lege.');
  process.exit(2);
}
console.log('[e2e] ' + (deel ? 'deel ' + deel.nr + ' van ' + deel.totaal + ': ' : '') +
  mijn.length + ' van ' + alle.length + ' schermbestanden, een tegelijk');

const tapPad = path.join(WORTEL, '.release', '.schermsuite-' + process.pid + '.tap');
if (BEWIJS) fs.mkdirSync(path.dirname(tapPad), { recursive: true, mode: 0o700 });
const nodeArgs = [
  '--experimental-sqlite', '--test', '--test-concurrency=1', '--test-timeout=600000',
];
if (BEWIJS) nodeArgs.push('--test-reporter=spec', '--test-reporter-destination=stdout',
  '--test-reporter=tap', '--test-reporter-destination=' + tapPad);
nodeArgs.push(...mijn.map(n => path.join('test', n)));
const r = spawnSync(process.execPath, nodeArgs, {
  cwd: WORTEL,
  /* Zelfde voorlading als in scripts/test-runner.js, en om dezelfde reden: de
     naam van het toetsbestand moet in elk kindproces staan, niet alleen in de
     servers die test/helper.js start. Zie test/toetsnaam.js. */
  env: { ...process.env, RTG_ROUTELOG: journaal,
    ...(BEWIJS ? { RTG_E2E_STRICT: '1' } : {}),
    /* Ook de schermtoetsen worden in vier delen verdeeld, dus ook zij hebben
       een gewicht nodig. Zelfde meting, zelfde bestand. */
    RTG_TOETSDUUR: process.env.RTG_TOETSDUUR || path.join(WORTEL, '.toetsduur'),
    RTG_TOETSBRON: require('./lib/meetbron').bron(),
    NODE_OPTIONS: (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + ' ' : '') +
      '--require ' + JSON.stringify(path.join(WORTEL, 'test', 'toetsnaam.js')) },
  stdio: 'inherit'
});

if (r.error) {
  console.error('[e2e] runnerfout: ' + r.error.message);
}
let code = r.error || r.status == null ? 2 : r.status;

if (BEWIJS) {
  let tap = '';
  try { tap = fs.readFileSync(tapPad, 'utf8'); } catch (e) {}
  try { fs.rmSync(tapPad, { force: true }); } catch (e) {}
  const telling = bewijsHulp.tapSamenvatting(tap);
  const inventarisNa = bewijsHulp.inventaris(WORTEL);
  const bronNa = require('./lib/stempel').exactStempel();
  const groen = code === 0 && telling.volledig && telling.tests > 0 &&
    telling.mislukt === 0 && telling.geannuleerd === 0 &&
    telling.overgeslagen === 0 && telling.todo === 0 &&
    bewijsHulp.zelfdeInventaris(inventarisVoor, inventarisNa) &&
    bronVoor.commit && bronVoor.commit === bronNa.commit &&
    bronVoor.boomVuil === false && bronNa.boomVuil === false;
  const rapport = { formaat: 'rtg-schermsuite-bewijs-v1', begonnen,
    afgerond: new Date().toISOString(), bron: bronNa, geslaagd: groen,
    afsluitcode: code, ...inventarisNa, ...telling };
  const tijdelijk = BEWIJSPAD + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(rapport, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, BEWIJSPAD);
  if (!groen) {
    console.error('[e2e] geen geldig schermsuitebewijs: ' +
      (telling.volledig ? telling.overgeslagen + ' overgeslagen, ' + telling.mislukt + ' mislukt' : 'TAP-samenvatting ontbreekt') + '.');
    if (code === 0) code = 1;
  } else {
    console.log('[e2e] schermsuitebewijs: ' + rapport.bestanden + ' bestanden, ' +
      rapport.tests + ' tests, nul overgeslagen, SHA-256 ' + rapport.bestandenSha256);
  }
}
process.exitCode = code;
