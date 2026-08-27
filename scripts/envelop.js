/* WIE PUBLICEERT ER OP DE BUS, EN ZEGT HIJ ERBIJ WAT HET IS?

   De envelop (server/kern/envelop.js) stempelt elk bericht met een id, een tijd
   en een keten -- dat kan de bus zelf afleiden. Twee velden kan hij NIET
   afleiden, en juist die twee zijn de interessante: WIE het veroorzaakte en HOE
   GEVOELIG de inhoud is. Die moet de publicerende plek zeggen.

   Een envelop waarvan niemand de handgeschreven velden invult, is een
   decoratie. Deze meter maakt dat zichtbaar in plaats van het weg te werken:
   hij telt per publicerende plek of er een classificatie en een actor bij staan.
   Wat ontbreekt, komt als `onbekend` de bus over -- eersteklas uitslag, geen
   stilzwijgend `openbaar`.

   WAT DEZE METER NIET DOET. Hij leest de broncode, niet het verkeer. Een plek
   die een classificatie MEEGEEFT kan hem nog steeds verkeerd kiezen; dat ziet
   geen enkel script en dat hoort ook niet zo. Hij meet dekking, niet juistheid.

   EN HIJ NOEMT GEEN REGELNUMMER. Dat stond er eerst wel, en het was fout: het
   commentaar gaat er eerst uit (anders telt een voorbeeld in een kop mee), en
   die wringer krimpt een blokcommentaar tot een spatie. Elk nummer lag dus een
   paar regels naast de werkelijkheid, en dat is erger dan geen nummer -- het
   stuurt iemand met vertrouwen naar de verkeerde plek. Bestand plus kanaal is
   genoeg om hem te vinden; er staan er hoogstens twee per bestand.

   EEN DOORGEEFLUIK IS GEEN PUBLICERENDE PLEK. leverancierpoort.js draagt
   `publish: (a, b) => busGeef().publish(a, b)`: dat geeft door wat een ander al
   heeft samengesteld, en daar hoort geen tweede classificatie bij. Zo'n plek
   telt apart en niet als gat -- anders meldt deze meter voor altijd een tekort
   dat niemand kan dichten.

   Draaien:  node scripts/envelop.js          (leesbaar)
             node scripts/envelop.js --json */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');

const WORTEL = path.join(__dirname, '..');
const MAP = path.join(WORTEL, 'server');

function bestanden(map, uit) {
  uit = uit || [];
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') bestanden(p, uit); }
    else if (naam.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Een publicatie herkennen: `<iets>.publish('kanaal', {`. De bus zelf en de
   Redis-laag tellen niet mee -- die VERVOEREN, ze publiceren niet. */
const PUBLICEERT = /\.publish\(\s*([A-Za-z_$][\w$]*|'[^']*'|"[^"]*")\s*,/g;
const OVERSLAAN = ['server/bus.js', 'server/redis.js', 'server/db/redis.js'];

/* Het argument dat na het kanaal komt, tot de haak weer dicht is. Tellen in
   plaats van een regexp, want er zitten geneste accolades in. */
function argumentNa(tekst, vanaf) {
  let diepte = 0;
  for (let i = vanaf; i < tekst.length; i++) {
    const c = tekst[i];
    if (c === '(' || c === '{' || c === '[') diepte++;
    else if (c === ')' || c === '}' || c === ']') { diepte--; if (diepte < 0) return tekst.slice(vanaf, i); }
  }
  return tekst.slice(vanaf, vanaf + 400);
}

function lees(wortel) {
  const root = wortel || WORTEL;
  const map = path.join(root, 'server');
  const plekken = [];
  for (const p of bestanden(map)) {
    const rel = path.relative(root, p).replace(/\\/g, '/');
    if (OVERSLAAN.includes(rel)) continue;
    const tekst = zonderCommentaar(fs.readFileSync(p, 'utf8'));
    PUBLICEERT.lastIndex = 0;
    let m;
    while ((m = PUBLICEERT.exec(tekst))) {
      const arg = argumentNa(tekst, m.index + m[0].length);
      /* Stelt deze plek het bericht zelf samen, of geeft hij door wat hij
         binnenkreeg? Doorgeven herken je eraan dat het hele tweede argument EEN
         naam is (`b`, `bericht`, `this.bericht`). Alles wat bouwt -- een
         accolade, een Object.assign, een ternair -- stelt samen.

         Hier stond eerst "begint het met een accolade", en dat was te grof:
         kern/sessies.js bouwt met Object.assign en viel daardoor uit de telling
         weg, mét zijn classificatie. Een meter die een ingevuld veld niet meet,
         geeft precies het verkeerde soort geruststelling. */
      const doorgeef = /^\s*[A-Za-z_$][\w$.]*\s*$/.test(arg);
      plekken.push({
        bestand: rel,
        kanaal: m[1].replace(/['"]/g, ''),
        doorgeef,
        classificatie: /envelop\s*:\s*\{[^}]*classificatie\s*:/.test(arg),
        actor: /envelop\s*:\s*\{[^}]*actor\s*:/.test(arg)
      });
    }
  }
  return plekken;
}

function analyse(plekken) {
  const eigen = plekken.filter(p => !p.doorgeef);
  return {
    plekken: plekken.length,
    doorgeefluiken: plekken.length - eigen.length,
    stelenZelfSamen: eigen.length,
    metClassificatie: eigen.filter(p => p.classificatie).length,
    metActor: eigen.filter(p => p.actor).length,
    zonderClassificatie: eigen.filter(p => !p.classificatie).map(p => p.bestand + ' (' + p.kanaal + ')'),
    lijst: plekken
  };
}

const meet = (wortel) => analyse(lees(wortel));

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) console.log(JSON.stringify(uit, null, 2));
  else {
    console.log('PUBLICERENDE PLEKKEN OP DE BUS\n');
    for (const p of uit.lijst)
      console.log('  ' + (p.doorgeef ? '  →' : (p.classificatie ? '✓' : '·') + (p.actor ? '✓' : '·') + ' ') +
        '  ' + p.bestand + '  (' + p.kanaal + ')');
    console.log('\n' + uit.stelenZelfSamen + ' plekken stellen zelf een bericht samen (' +
      uit.doorgeefluiken + ' doorgeefluik(en) tellen niet mee); ' +
      uit.metClassificatie + ' noemen een classificatie, ' + uit.metActor + ' een actor.');
    if (uit.zonderClassificatie.length)
      console.log('\nZonder classificatie (die gaan als "onbekend" de bus over):\n  ' +
        uit.zonderClassificatie.join('\n  '));
    else console.log('\nElke plek die zelf een bericht samenstelt, zegt hoe gevoelig het is.');
  }
}

module.exports = { lees, analyse, meet, argumentNa, OVERSLAAN };
