#!/usr/bin/env node
/* ============================================================================
   HET LEESSPOOR SAMENVOEGEN -- wat een toets leest en de graaf niet weet.

   scripts/lib/leesspoor.js schrijft tijdens een ronde op welk bestand onder deze
   repo er is gelezen en door welke toets. Dit script legt dat naast de statische
   afhankelijkheidsgraaf en bewaart alleen het VERSCHIL: de bestanden die een
   toets aantoonbaar heeft gelezen terwijl geen enkele require ernaartoe wees.

   Waarom alleen het verschil. De meeste toetsen starten een server, en die leest
   dezelfde ~3400 modules die de graaf al kent uit server/server.js. Dat allemaal
   opschrijven zou een register van miljoenen regels geven waarin de vijf regels
   die er toe doen niet te vinden zijn. Wat overblijft is precies de blinde vlek:
   test/ast-grens.test.js leest 90+ bestanden onder server/routes/ waar geen
   enkele require naartoe wijst, en een wijziging in zo'n route zou die toets dus
   nooit selecteren.

   HET IS EEN ONDERGRENS EN GEEN WAARHEID. Wat deze ronde is gelezen kan volgende
   ronde weer worden gelezen; wat NIET is gelezen kan volgende ronde alsnog
   worden gelezen. Daarom voegt het register alleen KANTEN TOE en haalt het er
   nooit een weg, en daarom groeit het over rondes heen in plaats van te worden
   overschreven. De planner kiest er dus MEER van, nooit minder.

   Draai:
     node scripts/leesspoor.js --spoor /pad/spoor.jsonl      voeg een ronde toe
     node scripts/leesspoor.js                                toon het register
     node scripts/leesspoor.js --vergeet                      begin opnieuw
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'LEESSPOOR.json');
const argv = process.argv.slice(2);
const spoorArg = (() => { const i = argv.indexOf('--spoor'); return i >= 0 ? argv[i + 1] : null; })();

function leesRegister() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
    return (r && typeof r.toetsen === 'object') ? r : null;
  } catch (e) { return null; }
}

/* Wat de statische graaf al weet, per toets. Zonder deze aftrek zou het register
   miljoenen regels worden; met de aftrek staan er alleen de kanten in die er
   werkelijk bij komen. */
function statischPerToets() {
  const { graaf } = require('./lib/bewijsgraaf.js');
  const g = graaf({ zonderSpoor: true });
  const uit = new Map();
  if (!g) return uit;
  for (const [naam, d] of g.perToets) {
    const set = new Set();
    for (const f of d.bestanden) set.add(path.relative(WORTEL, f).split(path.sep).join('/'));
    uit.set(naam, set);
  }
  return uit;
}

function voegToe(spoorPad) {
  let regels = [];
  try { regels = fs.readFileSync(spoorPad, 'utf8').split('\n').filter(Boolean); }
  catch (e) { console.error('[leesspoor] geen spoor te lezen op ' + spoorPad + ': ' + e.message); process.exit(1); }
  /* Een LEEG spoor is geen "niets gelezen" maar een kapotte meting: dan stond de
     voorlader niet aan, en het register stilletjes ongewijzigd laten zou de
     volgende lezer laten denken dat er gemeten is (LAT-regel 3). */
  if (!regels.length) { console.error('[leesspoor] het spoor is leeg; er is niets gemeten.'); process.exit(1); }

  const waargenomen = new Map();
  let stuk = 0;
  for (const r of regels) {
    let o; try { o = JSON.parse(r); } catch (e) { stuk++; continue; }
    if (!o || !o.t || !o.p) { stuk++; continue; }
    if (!/\.(test|e2e)\.js$/.test(o.t)) continue;     // niet aan een toets toe te schrijven
    if (!waargenomen.has(o.t)) waargenomen.set(o.t, new Set());
    waargenomen.get(o.t).add(o.p);
  }

  const statisch = statischPerToets();
  const oud = leesRegister();
  const toetsen = Object.assign({}, oud ? oud.toetsen : {});
  let nieuweKanten = 0;
  for (const [toets, gelezen] of waargenomen) {
    const bekend = statisch.get(toets) || new Set();
    const extra = new Set(toetsen[toets] || []);
    for (const p of gelezen) {
      if (bekend.has(p) || extra.has(p)) continue;
      /* Alleen bestanden die de planner ook KAN wegen: bron, geen uitvoer. */
      if (!/^(server|scripts|public|test)\//.test(p)) continue;
      extra.add(p); nieuweKanten++;
    }
    if (extra.size) toetsen[toets] = [...extra].sort();
  }

  const stand = {
    uitleg: 'Bestanden die een toets aantoonbaar HEEFT GELEZEN terwijl geen enkele require ernaartoe ' +
      'wijst. Gemeten door scripts/lib/leesspoor.js tijdens een echte ronde. Dit is een ONDERGRENS: ' +
      'het register groeit over rondes heen en er wordt nooit iets uit weggehaald, zodat de planner ' +
      'er meer van kiest en nooit minder.',
    hoe: 'node scripts/leesspoor.js --spoor <spoor.jsonl>',
    gemetenOp: new Date().toISOString(),
    rondes: (oud && Number(oud.rondes) || 0) + 1,
    gemeten: { toetsenMetExtra: Object.keys(toetsen).length,
      kantenTotaal: Object.values(toetsen).reduce((n, l) => n + l.length, 0), nieuweKantenDezeRonde: nieuweKanten },
    toetsen
  };
  fs.writeFileSync(REGISTER, JSON.stringify(stand, null, 1) + '\n');
  console.log('[leesspoor] ronde ' + stand.rondes + ' toegevoegd: ' + nieuweKanten + ' nieuwe kanten, '
    + stand.gemeten.kantenTotaal + ' totaal over ' + stand.gemeten.toetsenMetExtra + ' toetsen'
    + (stuk ? '  (' + stuk + ' onleesbare regels overgeslagen)' : ''));
}

if (argv.includes('--vergeet')) {
  try { fs.unlinkSync(REGISTER); console.log('[leesspoor] register weg.'); } catch (e) { console.log('[leesspoor] er was niets.'); }
  process.exit(0);
}
if (spoorArg) { voegToe(spoorArg); process.exit(0); }

const r = leesRegister();
if (!r) { console.log('Nog geen LEESSPOOR.json. Draai een ronde en voeg het spoor toe met --spoor.'); process.exit(0); }
console.log('\n=== HET LEESSPOOR ===\n');
console.log('  gemeten over rondes : ' + r.rondes);
console.log('  toetsen met extra   : ' + r.gemeten.toetsenMetExtra);
console.log('  kanten totaal       : ' + r.gemeten.kantenTotaal);
console.log('\n  de toetsen die het meest buiten hun requires lezen:');
Object.entries(r.toetsen).sort((a, b) => b[1].length - a[1].length).slice(0, 15)
  .forEach(([t, l]) => console.log('    ' + String(l.length).padStart(4) + '  ' + t));
