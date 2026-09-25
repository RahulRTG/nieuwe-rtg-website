#!/usr/bin/env node
/* ============================================================================
   HET HERHAALPAKKET EN DE HERHAALMATRIX (BEWIJSLUS.md par. 5). De motor staat
   in ./lib/herhaalpakket.js; dit is de aanroep.

     npm run herhaalpakket -- maak [--zaad=1 --reeksen=100 --lengte=12] [--wortel=DIR] [--uit=BESTAND]
         zoek een tegenvoorbeeld en schrijf het als pakket
     npm run herhaalpakket -- speel BESTAND [--wortel=DIR] [--json]
         speel een pakket na op deze checkout (of op DIR)
     npm run herhaalpakket -- matrix BESTAND --tegen=REV,REV,...
         speel hetzelfde pakket na op elke REV, elk in een eigen worktree en
         een eigen proces, en zet de uitkomsten naast elkaar

   DE MATRIX leest zo: breekt het alleen op de huidige en niet op de vorige, dan
   is het zoekgebied al klein; houdt het op de kandidaat-reparatie, dan is dat
   de reparatie. Een kolom die niet kon draaien heet `niet vast te stellen`, met
   de reden, en telt nooit als `houdt`.

   UITGANG
     0  gedaan (bij speel: het pakket gaf de verwachte uitkomst NIET, of wel --
        de uitslag staat erbij; een uitslag is geen fout)
     2  niet vast te stellen: het pakket of een kolom kon niet draaien

   Wat hij NIET doet: iets vastleggen in een register, of bisecten. Een
   automatische bisect bovenop de matrix is een stap verder (par. 5).
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const hp = require('./lib/herhaalpakket');
const tv = require('./lib/tegenvoorbeeld');

const WORTEL = path.join(__dirname, '..');
const vlag = (naam) => {
  const a = process.argv.find(x => x.startsWith('--' + naam + '='));
  return a ? a.slice(naam.length + 3) : null;
};
const getal = (naam, standaard) => { const n = Number(vlag(naam)); return Number.isFinite(n) && n > 0 ? Math.floor(n) : standaard; };
const los = process.argv.slice(2).filter(a => !a.startsWith('--'));

async function maak() {
  const zaad = getal('zaad', 1), reeksen = getal('reeksen', 100), lengte = getal('lengte', 12);
  const wortel = vlag('wortel') ? path.resolve(vlag('wortel')) : undefined;
  const u = await tv.zoek({ zaad, reeksen, lengte, spelers: tv.maakWereld({ wortel }).spelers, maak: () => tv.maakWereld({ wortel }) });
  if (!u.gevonden) {
    console.log('Geen tegenvoorbeeld in ' + reeksen + ' reeksen (zaad ' + zaad + '), dus geen pakket.' +
      (u.nietBeproefd.length ? ' Niet beproefd: ' + u.nietBeproefd.join(', ') + '.' : ''));
    return u.nietBeproefd.length ? 2 : 0;
  }
  const pakket = await hp.maakPakket(u, { wortel, zaad, reeksen, lengte });
  const tekst = JSON.stringify(pakket, null, 2) + '\n';
  if (vlag('uit')) { fs.writeFileSync(vlag('uit'), tekst); console.log('Pakket geschreven: ' + vlag('uit') + ' (wet "' + u.schending.wet + '")'); }
  else process.stdout.write(tekst);
  return 0;
}

async function speel() {
  if (!los[1]) throw new Error('welk pakket? npm run herhaalpakket -- speel BESTAND');
  const pakket = JSON.parse(fs.readFileSync(los[1], 'utf8'));
  const wortel = vlag('wortel') ? path.resolve(vlag('wortel')) : undefined;
  const r = await hp.speelNa(pakket, { wortel });
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(r) + '\n'); return 0; }
  console.log('Herhaalpakket op ' + (r.artefact.commit || '?').slice(0, 10) + (r.artefact.boomSchoon === false ? ' (met lokale wijzigingen)' : '') + ': ' + r.uitkomst);
  if (r.schending) console.log('  wet: ' + r.schending.wet + ', stap ' + (r.schending.stap + 1));
  if (r.divergentie) console.log('  eerste divergentie: ' + (r.divergentie.van ? r.divergentie.van + ' -> ' : '') + r.divergentie.naar);
  console.log('  verwacht (bij het maken): ' + pakket.verwacht.schending.wet);
  return 0;
}

/* Een kolom: een worktree op REV, node_modules gedeeld, en een eigen proces --
   twee versies van server/ in een proces zouden elkaars modules kunnen delen. */
function kolom(bestand, rev) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herhaal-'));
  const git = (...a) => cp.spawnSync('git', a, { cwd: WORTEL, encoding: 'utf8' });
  try {
    const wt = git('worktree', 'add', '--detach', map, rev);
    if (wt.status !== 0) return { rev, uitkomst: 'niet vast te stellen', reden: 'geen worktree op ' + rev + ': ' + (wt.stderr || '').trim().split('\n').pop() };
    if (!fs.existsSync(path.join(map, 'server/kern/spellen/magnaat/rtg-keten.js')))
      return { rev, uitkomst: 'niet vast te stellen', reden: 'dit artefact heeft de proefopstelling niet (server/kern/spellen/magnaat/rtg-keten.js)' };
    fs.symlinkSync(path.join(WORTEL, 'node_modules'), path.join(map, 'node_modules'), 'dir');
    const r = cp.spawnSync(process.execPath, [__filename, 'speel', path.resolve(bestand), '--wortel=' + map, '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 300000, env: Object.assign({}, process.env, { RTG_SIMULATIEBANK: '1' }) });
    const regel = (r.stdout || '').trim().split('\n').pop();
    try { return Object.assign({ rev }, JSON.parse(regel)); }
    catch (e) { return { rev, uitkomst: 'niet vast te stellen', reden: ((r.stderr || '').trim().split('\n').pop() || 'geen uitslag') }; }
  } finally {
    git('worktree', 'remove', '--force', map);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
}

async function matrix() {
  if (!los[1] || !vlag('tegen')) throw new Error('npm run herhaalpakket -- matrix BESTAND --tegen=REV,REV');
  const pakket = JSON.parse(fs.readFileSync(los[1], 'utf8'));
  console.log('Herhaalmatrix -- verwacht: "' + pakket.verwacht.schending.wet + '" (gemaakt op ' +
    String(pakket.herkomst.artefact.commit).slice(0, 10) + ')\n');
  let onbepaald = 0;
  for (const rev of vlag('tegen').split(',').map(x => x.trim()).filter(Boolean)) {
    const k = kolom(los[1], rev);
    if (k.uitkomst === 'niet vast te stellen') onbepaald++;
    console.log('  ' + rev.padEnd(24) + ' ' + String(k.artefact ? k.artefact.commit : '').slice(0, 10).padEnd(11) + k.uitkomst +
      (k.divergentie ? '  (' + (k.divergentie.van ? k.divergentie.van + ' -> ' : '') + k.divergentie.naar + ')' : '') +
      (k.reden ? '  -- ' + k.reden : ''));
  }
  return onbepaald ? 2 : 0;
}

const opdracht = { maak, speel, matrix }[los[0]];
if (!opdracht) { console.error('Gebruik: npm run herhaalpakket -- maak | speel BESTAND | matrix BESTAND --tegen=REV,REV'); process.exitCode = 2; }
else opdracht().then(c => { process.exitCode = c; })
  .catch(e => { console.error('Niet vast te stellen: ' + e.message); process.exitCode = 2; });
