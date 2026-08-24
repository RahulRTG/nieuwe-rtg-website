#!/usr/bin/env node
/* ============================================================================
   IS HET MUTATIEBEWIJS NOG WAAR?

   MUTATIES.json is het sterkste bewijs dat er in dit huis bestaat: het zegt niet
   "de toets staat groen" maar "we hebben hem zien ZAKKEN toen we regel Y in
   module Z veranderden". Dat is de enige meting die aantoont dat een toets
   uberhaupt kan zakken (LAT-regel 9), en 924 toetsen leunen erop.

   En het stond zonder enige houdbaarheid opgeschreven. Verandert module Z
   daarna, dan gaat dat bewijs over code die er niet meer is -- en niets merkte
   dat. Een groene suite met verlopen bewijs is precies de vorm die dit hele
   programma probeert weg te halen: alles staat groen, en niemand weet meer
   waarom.

   DE HOUDBAARHEID HANGT AAN DE INHOUD EN NIET AAN DE KLOK, en dat is met opzet.
   Een module die een jaar niet is aangeraakt is nog even bewezen als gisteren;
   een module die een uur geleden veranderde niet meer. Een TTL van dertig dagen
   zou het eerste ten onrechte afkeuren en het tweede ten onrechte goedkeuren --
   twee fouten voor de prijs van een.

   Per soort bewijs een eigen regel, want ze gaan over iets anders:

     puur       verloopt zodra de GEMUTEERDE MODULE of het toetsbestand van
                inhoud verandert. Het bewijs gaat over die ene regel in die ene
                module; verandert die, dan is de proef nooit op deze code gedaan.
     server     verloopt zodra het TOETSBESTAND verandert. Daar is geen bron
                gemuteerd maar het ANTWOORD van een route (de liegpoort in
                server/opzet/liegpoort.js); wat de meting aantoont is dat DEZE
                toets het merkt, en dat blijft waar zolang de toets hetzelfde is.
     geen stempel  telt als verlopen. Niet omdat het fout is, maar omdat we het
                NIET WETEN -- en een meter die "onbekend" als "in orde" telt,
                bewaakt niets.

   Draai:
     node scripts/bewijsvers.js
     node scripts/bewijsvers.js --top
     node scripts/bewijsvers.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'MUTATIES.json');
const TEST = path.join(WORTEL, 'test');

function sha(p) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }
  catch (e) { return null; }
}

/* Welke uitslagen DRAGEN uberhaupt bewijs? "gezakt" is de enige staat die zegt
   dat een assertie het zag. De andere staten ("al rood", "te langzaam", "geen
   module gevonden") zijn redenen waarom er NIET gemeten is; die kunnen niet
   verlopen, want er is niets om te verliezen. Ze meetellen zou de meter opblazen
   met iets wat nooit nul kan worden. */
function draagtBewijs(r) {
  return !!r && (r.staat === 'gezakt' || r.scherp === 'gezakt');
}

function meet(opties) {
  const wortel = (opties && opties.wortel) || WORTEL;
  let toetsen = {};
  try { toetsen = JSON.parse(fs.readFileSync(path.join(wortel, 'MUTATIES.json'), 'utf8')).toetsen || {}; }
  catch (e) { return null; }   // geen register: dan is er niets te zeggen, en dat is geen nul
  const uit = { totaal: 0, metBewijs: 0, vers: 0, verlopen: 0,
    redenen: { geenStempel: 0, moduleVeranderd: 0, toetsVeranderd: 0, moduleWeg: 0, toetsWeg: 0 }, lijst: [] };
  for (const [naam, r] of Object.entries(toetsen)) {
    uit.totaal++;
    if (!draagtBewijs(r)) continue;
    uit.metBewijs++;
    const tPad = path.join(wortel, 'test', naam);
    const tNu = sha(tPad);
    let reden = null;
    if (!r.toetsSha) reden = 'geenStempel';
    else if (tNu === null) reden = 'toetsWeg';
    else if (tNu !== r.toetsSha) reden = 'toetsVeranderd';
    else if (r.module) {
      const mNu = sha(path.join(wortel, r.module));
      if (!r.moduleSha) reden = 'geenStempel';
      else if (mNu === null) reden = 'moduleWeg';
      else if (mNu !== r.moduleSha) reden = 'moduleVeranderd';
    }
    if (reden) { uit.verlopen++; uit.redenen[reden]++; uit.lijst.push({ naam, reden, module: r.module || null }); }
    else uit.vers++;
  }
  return uit;
}

module.exports = { meet, draagtBewijs, sha };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const u = meet();
  if (!u) { console.error('Geen leesbare MUTATIES.json; er valt niets na te rekenen.'); process.exit(1); }
  if (argv.includes('--json')) { process.stdout.write(JSON.stringify(u) + '\n'); process.exit(0); }
  console.log('\n=== IS HET MUTATIEBEWIJS NOG WAAR? ===\n');
  console.log('  uitslagen in het register : ' + u.totaal);
  console.log('  daarvan met echt bewijs   : ' + u.metBewijs + '   (staat "gezakt": een assertie zag het)');
  console.log('  nog geldig                : ' + u.vers);
  console.log('  VERLOPEN                  : ' + u.verlopen);
  for (const [r, n] of Object.entries(u.redenen)) if (n) console.log('      ' + r.padEnd(18) + n);
  if (argv.includes('--top')) {
    console.log('\n  de eerste dertig:');
    for (const x of u.lijst.slice(0, 30))
      console.log('    ' + x.reden.padEnd(18) + x.naam + (x.module ? '  [' + x.module + ']' : ''));
  }
  console.log('\n  Verlopen bewijs is niet hetzelfde als een fout: de toets kan nog steeds goed zijn.');
  console.log('  Het betekent dat NIEMAND MEER WEET of hij kan zakken op de code zoals die nu is.');
  console.log('  Opnieuw meten: node scripts/mutatie.js --verlopen  (alleen deze, en met stempel).');
  console.log('  Zonder --verlopen slaat de motor over wat al in het register staat, ook als het verlopen is.');
  process.exit(0);
}
