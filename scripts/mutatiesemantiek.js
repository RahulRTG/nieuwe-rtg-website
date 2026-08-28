#!/usr/bin/env node
/* ============================================================================
   DE MUTATIESEMANTIEK OVER DE ROUTES -- wat doet een tweede aanroep?

   HET BESLUIT DAT HIERONDER LIGT staat in CREATE.md par. 10 en het is een
   omkering: het doel is NIET dat alle 3074 routes idempotent zijn, maar dat van
   alle 3074 is UITGESPROKEN wat een tweede aanroep doet. Een mutatie mag met
   opzet onherhaalbaar zijn -- als het maar is gezegd, want dan weten de SDK, een
   taakloper, een client en een werkstroommotor wat ze ermee moeten.

   WAT DIT SCRIPT NIET DOET, EN WAAROM DAT DE HELE KUNST IS. Het plakt geen
   etiketten. `IDEMPROEF.json` laat zien waarom dat ook niet kan:

     3074 routes met een rol
      115 beoordeeld (15 beschermd, 100 onbeschermd)
     2959 ONGEMETEN -- en dat is geen luiheid van de proef

   Van die 2959 kwam de proef 1100 keer op een 404, 562 keer op een 403 en 346
   keer op een 400: hij had geen geldige invoer of geen rechten, dus hij raakte
   de code die muteert nooit aan. Bij 738 veranderde het antwoord sowieso niet,
   waardoor een tweede effect onzichtbaar zou blijven. Ze zijn dus niet
   ongemeten omdat niemand keek, maar omdat de meting er niet BIJ kon.

   Wie ze op grond daarvan een klasse zou geven, verzint hem. Dat is precies wat
   LAT-regel 10 verbiedt: een bewering zonder meting.

   WAT DIT SCRIPT WEL DOET, en dat is wat het probleem hanteerbaar maakt:

     1. het leest wat er VERKLAARD is -- aan de rand (de brug, structureel) en
        bij de route zelf (een `mutatie:`-regel in het commentaar erboven);
     2. het legt dat naast wat er GEMETEN is (IDEMPROEF.json);
     3. het meldt de TEGENSPRAAK: een route die zegt idempotent te zijn terwijl
        de proef een tweede effect zag. Dat is de duurste fout die hier bestaat,
        want een taakloper gelooft de verklaring en niet de meting;
     4. het telt de dekking, zodat de 2959 zichtbaar blijven en kunnen slinken
        in plaats van dat ze uit beeld raken.

   DE VERKLARING STAAT BIJ DE ROUTE EN NIET IN EEN LIJST. Een lijst naast de code
   loopt achter op de dag dat iemand een route verplaatst (LAT-regel 4). Dus:

       /* mutatie: idempotent -- twee keer verlenen laat dezelfde stand achter *​/
       app.post('/api/appstore/verleen', auth, (req, res) => ...

   Draai: node scripts/mutatiesemantiek.js               (leesbaar)
          node scripts/mutatiesemantiek.js --json
          node scripts/mutatiesemantiek.js --vastleggen  (schrijft MUTATIESEMANTIEK.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { NAMEN, isKlasse } = require(path.join(WORTEL, 'server/kern/mutatie'));

/* Hoeveel regels boven een route een `mutatie:`-regel mag staan. Drie: genoeg
   voor een korte uitleg erboven, te weinig om per ongeluk de verklaring van de
   VORIGE route mee te pakken. */
const BEREIK = 3;
const ROUTE = /\bapp\s*\.\s*(post|get|put|patch|delete)\s*\(\s*'([^']+)'/;
const MERK = /mutatie:\s*([a-zA-Z]+)\s*(?:--\s*(.*))?$/;

/* Een absoluut pad mag ook, en dat is er voor de toets: die voert een verzonnen
   routebestand in waarvan je WEET wat eruit hoort te komen (LAT-regel 10). Zonder
   dat kan deze meter alleen op de echte boom draaien, en dan is hij nooit te zien
   uitslaan op een tegenspraak die er vandaag toevallig niet is. */
function bestandenOnder(map, uit) {
  let namen = [];
  const vol = path.isAbsolute(map) ? map : path.join(WORTEL, map);
  try { namen = fs.readdirSync(vol, { withFileTypes: true }); } catch (e) { return uit; }
  for (const d of namen) {
    const rel = map + '/' + d.name;
    if (d.isDirectory()) bestandenOnder(rel, uit);
    else if (d.name.endsWith('.js')) uit.push(rel);
  }
  return uit;
}

/* De verklaringen bij de routes. Per gevonden route wordt hooguit BEREIK regels
   omhoog gekeken naar een `mutatie:`-regel; staat er geen, dan is de route niet
   verklaard -- en dat is een uitslag en geen nul. */
function verklaringen(mappen) {
  const uit = [];
  const fouten = [];
  for (const bestand of (mappen || ['server/routes', 'server/bedrijf']).reduce((a, m) => bestandenOnder(m, a), [])) {
    const regels = fs.readFileSync(path.isAbsolute(bestand) ? bestand : path.join(WORTEL, bestand), 'utf8').split('\n');
    for (let i = 0; i < regels.length; i++) {
      const r = ROUTE.exec(regels[i]);
      if (!r) continue;
      /* De markering mag ACHTER de route staan of erboven. Achter is voor de
         vele eenregelige routes in dit huis -- een blok commentaar boven elk van
         die regels maakt een routebestand onleesbaar, en een verklaring die je
         niet wilt opschrijven wordt niet opgeschreven. Erboven is voor routes
         met een echte uitleg. */
      let klasse = null, waarom = null;
      const achter = MERK.exec(regels[i]);
      if (achter) { klasse = achter[1]; waarom = (achter[2] || '').trim() || null; }
      else {
        for (let j = Math.max(0, i - BEREIK); j < i; j++) {
          const m = MERK.exec(regels[j]);
          if (m) { klasse = m[1]; waarom = (m[2] || '').trim() || null; }
        }
      }
      if (klasse && !isKlasse(klasse)) {
        fouten.push({ bestand, regel: i + 1, pad: r[2],
          wat: 'de klasse "' + klasse + '" bestaat niet; het zijn er ' + NAMEN.length + ': ' + NAMEN.join(', ') });
        klasse = null;
      }
      uit.push({ methode: r[1].toUpperCase(), pad: r[2], bestand, regel: i + 1, klasse, waarom });
    }
  }
  return { verklaard: uit, fouten };
}

/* De meting ernaast. IDEMPROEF.json draagt per route wat er gebeurde bij een
   tweede oproep; deze functie zegt alleen wat dat BETEKENT voor een verklaring.

   `onbeschermd` is in die proef een telling en geen defect-oordeel -- maar het
   betekent wel dat een tweede oproep een ander antwoord gaf, en dat is precies
   wat een verklaring `idempotent` ontkent. Daar mag de tegenspraak dus op. */
function tegenspraak(klasse, gemeten) {
  if (!klasse || !gemeten) return null;
  if (gemeten === 'onbeschermd' && klasse === 'idempotent') {
    return 'verklaard als idempotent, maar de proef zag bij een tweede oproep een ander antwoord';
  }
  if (gemeten === 'beschermd' && klasse === 'nietHerhaalbaar') {
    return 'verklaard als nietHerhaalbaar, maar de proef zag een tweede oproep zonder tweede effect';
  }
  return null;
}

function meet(opties) {
  const O = Object.assign({ mappen: null, idemproef: null }, opties || {});
  const { verklaard, fouten } = verklaringen(O.mappen);
  const proef = O.idemproef || JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8'));

  const gemetenVan = new Map();
  for (const r of proef.perRoute || []) gemetenVan.set(r.methode + ' ' + r.pad, r);

  const rijen = verklaard.map(v => {
    const g = gemetenVan.get(v.methode + ' ' + v.pad) || null;
    return Object.assign({}, v, {
      gemeten: g ? g.idempotentie : null,
      reden: g ? g.reden : null,
      tegenspraak: tegenspraak(v.klasse, g && g.idempotentie)
    });
  });

  /* De rand van het platform staat apart, want daar is `onbekend` al verboden
     (kern/mutatie.js) en de verklaring is er structureel in plaats van in een
     commentaarregel. Hem meetellen met de routes zou de dekking mooier maken
     dan hij is. */
  const rand = randVanHetPlatform();

  const p = proef.gemeten || {};
  return {
    gemeten: {
      routesMetRol: p.routesMetRol || 0,
      routesGevonden: rijen.length,
      verklaard: rijen.filter(r => r.klasse).length,
      onverklaard: rijen.filter(r => !r.klasse).length,
      beproefd: p.beoordeeld || 0,
      onbereikbaarVoorDeProef: p.ongemeten || 0,
      verklaardEnBeproefd: rijen.filter(r => r.klasse && r.gemeten && r.gemeten !== 'ongemeten').length,
      tegenspraken: rijen.filter(r => r.tegenspraak).length,
      onbekendeKlassen: fouten.length,
      randVerklaard: rand.length
    },
    rand,
    tegenspraken: rijen.filter(r => r.tegenspraak),
    onbekendeKlassen: fouten,
    verklaard: rijen.filter(r => r.klasse)
  };
}

/* Wat er aan de rand staat: de publiek aanroepbare opdrachten van de brug. Die
   dragen hun klasse structureel en laten de server niet starten zonder. */
function randVanHetPlatform() {
  try {
    const { maakBrug } = require(path.join(WORTEL, 'server/kern/appstore/brug'));
    const staat = { opslag: {}, bakjes: {} };
    const brug = maakBrug({ S: () => staat, save() {}, boek() {},
      nu: () => new Date().toISOString(), eigen: (o, k) => o[k] });
    return brug.mutaties.map(m => ({ naam: m.naam, klasse: m.mutatie, herhaalbaar: m.herhaalbaar }));
  } catch (e) { return []; }
}

module.exports = { meet, verklaringen, tegenspraak, randVanHetPlatform, BEREIK };

if (require.main === module) {
  const r = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'MUTATIESEMANTIEK.json'), JSON.stringify(Object.assign({
      uitleg: 'Gemeten met scripts/mutatiesemantiek.js; de vraag en de methode staan in de kop van dat bestand en in CREATE.md par. 10. Dit script plakt geen etiketten: het legt VERKLAARD naast GEMETEN en meldt de tegenspraak.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('MUTATIESEMANTIEK.json geschreven.');
  }
  const g = r.gemeten;
  console.log('\n  WAT DOET EEN TWEEDE AANROEP?\n');
  /* Twee tellingen uit twee inventarissen, en dat hoort erbij te staan. IDEMPROEF
     telt SCHRIJFroutes met een rol; dit script leest alles wat er in de bron als
     app.post/get/... staat, dus ook leesroutes en routes zonder rol. Zonder die
     zin leest het verschil als "762 routes kwijt". */
  console.log('  ' + String(g.routesGevonden).padStart(5) + '  routes in de bron (alle werkwoorden, met en zonder rol)');
  console.log('  ' + String(g.routesMetRol).padStart(5) + '  daarvan met een rol en beproefbaar (telling van IDEMPROEF)');
  console.log('  ' + String(g.verklaard).padStart(5) + '  VERKLAARD bij de route');
  console.log('  ' + String(g.randVerklaard).padStart(5) + '  verklaard aan de rand van het platform (de brug, structureel)');
  console.log('  ' + String(g.beproefd).padStart(5) + '  beproefd door IDEMPROEF');
  console.log('  ' + String(g.onbereikbaarVoorDeProef).padStart(5) + '  ONBEREIKBAAR voor de proef (404/403/400: hij kwam niet bij het werk)');
  console.log('  ' + String(g.tegenspraken).padStart(5) + '  TEGENSPRAKEN tussen verklaring en meting');
  console.log('');
  if (g.onbekendeKlassen) {
    console.log('  VERKLARINGEN MET EEN KLASSE DIE NIET BESTAAT\n');
    for (const f of r.onbekendeKlassen) console.log('    ' + f.bestand + ':' + f.regel + '  ' + f.wat);
    console.log('');
  }
  if (r.tegenspraken.length) {
    console.log('  TEGENSPRAAK -- hier gelooft een taakloper de verklaring en niet de meting\n');
    for (const t of r.tegenspraken) {
      console.log('    ' + t.methode + ' ' + t.pad);
      console.log('      ' + t.tegenspraak);
      console.log('      ' + t.bestand + ':' + t.regel);
    }
    console.log('');
  } else {
    console.log('  Geen tegenspraak tussen wat er is verklaard en wat er is gemeten.\n');
  }
  console.log('  De 2959 onbereikbare routes krijgen GEEN klasse op grond van een gok.');
  console.log('  Ze slinken doordat de proef er wel bij kan komen (geldige invoer, de juiste rol),');
  console.log('  of doordat iemand die de route kent hem bij de route verklaart.\n');
}
