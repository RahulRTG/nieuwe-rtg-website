/* ============================================================================
   GEEN COMMERCIELE DRUK BINNEN DE BODEM -- eis 5 van SAMENLEVING.md par. 6.

   "Geen upgradeknop midden in een leerpad en geen 'met RTG Pass kon u dit
   sneller'. Wie meer wil, vindt de ladder waar de ladder staat." Deze meter
   maakt van die zin een telling die alleen mag dalen (ratel `bodemDruk` in
   NORM.json).

   WELKE SCHERMEN BIJ DE BODEM HOREN, wordt niet met de hand bijgehouden maar
   AFGELEID: de verklaring van de bodem (scripts/lib/onvervreemdbaar-verklaring.js)
   noemt per werkwoord functies, het functieregister geeft hun paden, en
   SCHERMROUTES.json zegt welk bestand in public/ welk pad aanroept. Een scherm
   dat een bodempad raakt, is een bodemscherm. Een scherm dat de verklaring
   rechtstreeks noemt (de hulpwijzer), telt ook.

   WAT DRUK IS. Een uitnodiging om te betalen OP een bodemscherm: "word lid",
   "upgrade", "met RTG Pass kon u...", "ontgrendel", "voor betalende leden".
   Commentaar telt niet (`zonderCommentaar`): de eerste proef vond negen
   "treffers" en alle negen stonden in uitleg voor ontwikkelaars.

   WAT DEZE METER NIET ZEGT.
   - Of er druk is die geen van deze woorden gebruikt (een badge, een kleur, een
     vergrendeld slotje). Lexicaal, dus een ONDERGRENS: graad `vermoed`.
   - Of een scherm dat een pas NOEMT, druk uitoefent. De deur die zegt dat iets
     bij een pas hoort (shared/deur.js) is een weigering en geen verleiding; of
     die weigering zelf op de bodem terecht mag komen, meet SAM-01
     (npm run onvervreemdbaar), niet deze meter.
   - Hoe lang iemand iets gebruikt. Dat meet RTG niet (SAM-05).
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'BODEMDRUK.json');

/* De zinnen die om een betaling vragen. Elk patroon staat er om een vorm die in
   een scherm kan staan; ze worden gebundeld zodat een treffer zegt WELKE vorm. */
const DRUK = [
  { vorm: 'word lid', re: /\bword(?:t)?\s+(?:nu\s+)?lid\b/i },
  { vorm: 'upgrade', re: /\bupgrade/i },
  { vorm: 'met een pas kon het', re: /\bmet\s+(?:de\s+|een\s+|uw\s+|je\s+)?(?:RTG|Lifestyle|Business)\s+Pass\s+(?:kon|kun|kan|krijg|heb)/i },
  { vorm: 'ontgrendel', re: /\bontgrendel/i },
  { vorm: 'voor betalende leden', re: /\bvoor\s+betalende\s+leden\b/i },
  { vorm: 'koop een pas', re: /\b(?:koop|neem)\s+(?:een|de|uw|je)\s+pas\b/i }
];

function drukIn(tekst) {
  const uit = [];
  const regels = String(tekst).split('\n');
  regels.forEach((regel, i) => {
    for (const d of DRUK) if (d.re.test(regel)) uit.push({ regel: i + 1, vorm: d.vorm, tekst: regel.trim().slice(0, 160) });
  });
  return uit;
}

function bodempaden() {
  const { VERKLARING } = require('./lib/onvervreemdbaar-verklaring');
  const { FUNCTIES } = require('../server/functies/register');
  const paden = [], schermen = [];
  for (const [werkwoord, lijst] of Object.entries(VERKLARING)) {
    for (const e of lijst) {
      if (e.scherm) { schermen.push({ werkwoord, scherm: e.scherm }); continue; }
      const f = FUNCTIES.find(x => x.id === e.functie);
      for (const pad of (e.paden || (f && f.paden) || [])) paden.push({ werkwoord, functie: e.functie, pad });
    }
  }
  return { paden, schermen };
}

function meet() {
  const sr = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SCHERMROUTES.json'), 'utf8'));
  const per = Array.isArray(sr.perScherm) ? sr.perScherm
    : Object.entries(sr.perScherm).map(([bestand, v]) => Object.assign({ bestand }, v));
  const { paden, schermen: genoemd } = bodempaden();

  const bodem = new Map();
  for (const r of per) {
    const aangeroepen = [...(r.exact || []), ...(r.voorvoegsels || [])];
    const raakt = paden.filter(b => aangeroepen.some(a => a === b.pad || a.startsWith(b.pad + '/') || a.startsWith(b.pad)));
    if (!raakt.length) continue;
    bodem.set(r.bestand, {
      werkwoorden: [...new Set(raakt.map(b => b.werkwoord))].sort(),
      functies: [...new Set(raakt.map(b => b.functie))].sort()
    });
  }
  for (const g of genoemd) {
    const bestand = 'public' + g.scherm;
    const oud = bodem.get(bestand) || { werkwoorden: [], functies: [] };
    bodem.set(bestand, { werkwoorden: [...new Set(oud.werkwoorden.concat(g.werkwoord))].sort(), functies: oud.functies });
  }

  const schermen = [], nietGelezen = [];
  for (const [bestand, v] of [...bodem.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const vol = path.join(WORTEL, bestand);
    if (!fs.existsSync(vol)) { nietGelezen.push({ bestand, reden: 'bestaat niet (meer)' }); continue; }
    const soort = bestand.endsWith('.html') ? 'html' : bestand.endsWith('.css') ? 'css' : 'js';
    const tekst = zonderCommentaar(fs.readFileSync(vol, 'utf8'), { soort, regelsHeel: true });
    schermen.push(Object.assign({ bestand }, v, { druk: drukIn(tekst) }));
  }
  const metDruk = schermen.filter(s => s.druk.length);
  return {
    graad: 'vermoed',
    uitleg: 'Per scherm dat een pad van de universele bodem aanroept (afgeleid uit de verklaring, het functieregister en SCHERMROUTES.json): staat er een uitnodiging om te betalen op? SAMENLEVING.md par. 6, eis 5.',
    grens: 'Lexicaal en zonder commentaar gelezen, dus een ONDERGRENS: druk zonder deze woorden (een slotje, een kleur, een badge) ziet deze meter niet. Een deur die zegt dat iets bij een pas hoort is een weigering en geen druk; of die weigering op de bodem mag, meet npm run onvervreemdbaar. Gebruikstijd wordt niet gemeten (SAM-05).',
    gemeten: {
      schermen: schermen.length,
      metDruk: metDruk.length,
      treffers: metDruk.reduce((n, s) => n + s.druk.length, 0)
    },
    metDruk,
    nietGelezen,
    schermen: schermen.map(s => ({ bestand: s.bestand, werkwoorden: s.werkwoorden, functies: s.functies }))
  };
}

function toon(stand) {
  const g = stand.gemeten;
  console.log('\nGEEN COMMERCIELE DRUK BINNEN DE BODEM -- SAMENLEVING.md par. 6, eis 5\n');
  console.log('  ' + g.schermen + ' bodemschermen, ' + g.metDruk + ' met druk (' + g.treffers + ' treffers)');
  for (const s of stand.metDruk) {
    console.log('    ' + s.bestand + '  [' + s.werkwoorden.join(', ') + ']');
    for (const d of s.druk) console.log('        r' + d.regel + '  ' + d.vorm + ':  ' + d.tekst);
  }
  if (stand.nietGelezen.length) console.log('  niet gelezen: ' + stand.nietGelezen.map(n => n.bestand + ' (' + n.reden + ')').join(', '));
  console.log('\n  graad: ' + stand.graad + ' -- lexicaal, dus een ondergrens.\n');
}

if (require.main === module) {
  const stand = meet();
  if (process.argv.includes('--vastleggen')) {
    const poort = eisSchoneBoom('bodemdruk');
    if (!poort.ok) { console.error('[bodemdruk] ' + poort.reden); process.exit(2); }
    fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, stand), null, 2) + '\n');
    console.log('BODEMDRUK.json geschreven.');
  }
  toon(stand);
}

module.exports = { meet, drukIn, DRUK };
