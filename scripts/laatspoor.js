#!/usr/bin/env node
/* ============================================================================
   LAAT DEZE ROUTE EEN SPOOR NA OP EEN VERZOEK DAT HIJ WEIGERT?

   WAAROM DIT ER IS. Op 2 en 3 september 2026 zijn er ELF routes gerepareerd met
   exact dezelfde fout: de handler raakt de opslag aan VOORDAT hij de invoer
   keurt. Een lui aangemaakte la (`db.data.x[code] = db.data.x[code] || []`), een
   pak-of-maak-getter, een `bak()` die zijn vak neerzet. Het verzoek wordt daarna
   netjes met 400 of 404 afgewezen, maar er staat iets dat er niet was -- en dan
   spreken de statuscode en de database elkaar tegen.

   Die elf zijn niet gevonden door te lezen maar door de staatproef, een route
   per keer. En dat werkte slecht: elke ronde duurt een half uur en leverde er
   een of twee op, telkens ANDERE, omdat een ronde nu eenmaal niet elke route in
   dezelfde toestand aantreft. Zo blijft een staart eeuwig schuiven en weet
   niemand hoe lang hij is.

   Dit script beantwoordt die vraag STATISCH. Het leest per route het lijf van de
   handler en zoekt naar het patroon: een aanroep die de opslag kan aanmaken, met
   daarna nog een 4xx-uitgang. Dat is geen bewijs -- daar is de staatproef voor --
   maar het is wel de LIJST waaruit de staart komt, en die is eindig.

   WAT HET NIET ZEGT:
   - of de wijziging er werkelijk toe doet (een lege lijst is onschuldig; een
     halve boeking niet). De staatproef meet dat, dit niet.
   - of de 4xx ooit wordt bereikt. Een tak die onbereikbaar is telt hier mee.
   - iets over routes waarvan de bron niet te vinden is. Die staan apart, want
     "niet gekeken" is geen "in orde" (LAT.md regel 10).

   Draai:  node scripts/laatspoor.js
           node scripts/laatspoor.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { alleRoutes } = require('./lib/routes');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);

/* De vormen waarmee dit huis een la lui aanmaakt. Alle vier komen ze uit een
   reparatie van 2/3 september; het zijn geen bedachte patronen. */
const SCHEPPERS = [
  { id: 'toewijzing', re: /(\w[\w.[\]'"]*)\s*=\s*\1\s*\|\|\s*(\[\]|\{\})/,
    wat: 'x = x || [] -- zet de la neer bij het lezen' },
  { id: 'isArray-vul', re: /if\s*\(\s*!\s*Array\.isArray\([^)]*\)\s*\)[^;]*=\s*\[\]/,
    wat: 'if (!Array.isArray(x)) x = [] -- idem' },
  { id: 'bak', re: /\bbak\s*\(/, wat: 'bak() -- de gedeelde la-opener; maakt aan als hij er niet is' },
  { id: 'pak-of-maak', re: /\b(pak|store|lijstVan|mijne|vakInst|H)\s*\(/,
    wat: 'een pak-of-maak-getter (pak/store/lijstVan/mijne/vakInst/H)' }
];
const WEIGERT = /res\s*\.\s*status\s*\(\s*4\d\d\s*\)|status:\s*4\d\d|\{\s*error\s*:/;

/* Het lijf van een handler: van zijn regel tot de volgende routeregistratie of
   het einde van het bestand. Ruwe bron, want de regelnummers uit de routetabel
   horen bij het bestand zoals het op schijf staat. */
function lijfVan(bestand, regel) {
  let bron;
  try { bron = fs.readFileSync(bestand, 'utf8'); } catch (e) { return null; }
  const regels = bron.split('\n');
  if (regel < 1 || regel > regels.length) return null;
  const uit = [];
  for (let i = regel - 1; i < regels.length && uit.length < 80; i++) {
    if (i > regel - 1 && /^\s*(app|router)\s*\.\s*(get|post|put|patch|delete|use)\s*\(/.test(regels[i])) break;
    uit.push(regels[i]);
  }
  return uit.join('\n');
}

function meet() {
  const routes = alleRoutes().filter(r => r && typeof r.pad === 'string' && r.pad.startsWith('/api/'));
  const verdacht = [], bronOnvindbaar = [];
  for (const r of routes) {
    if (r.methode === 'GET') continue;            // een leesroute weigert zelden iets te bewaren
    if (!r.bestand || !r.regel) { bronOnvindbaar.push(r.methode + ' ' + r.pad); continue; }
    const lijf = lijfVan(r.bestand, r.regel);
    if (lijf === null) { bronOnvindbaar.push(r.methode + ' ' + r.pad); continue; }
    /* Het patroon: een schepper EN daarna nog een uitgang die weigert. Staat de
       weigering ERVOOR, dan is er niets aan de hand -- dan keurt hij eerst. */
    for (const s of SCHEPPERS) {
      const m = s.re.exec(lijf);
      if (!m) continue;
      const na = lijf.slice(m.index + m[0].length);
      if (!WEIGERT.test(na)) continue;
      verdacht.push({ methode: r.methode, pad: r.pad, waar: path.relative(WORTEL, r.bestand) + ':' + r.regel,
        vorm: s.id, wat: s.wat, fragment: m[0].trim().slice(0, 70) });
      break;
    }
  }
  return { stempel: stempel(), uitleg: 'Routes waar de opslag wordt aangeraakt VOORDAT de invoer is gekeurd: ' +
      'een lui aangemaakte la met daarna nog een 4xx-uitgang. Statisch gevonden, dus een LIJST en geen bewijs -- ' +
      'de staatproef (STAATPROEF.json, kolom ROLLBACK) meet of het er werkelijk toe doet.',
    grens: 'zegt niet of de wijziging ertoe doet, niet of de 4xx bereikbaar is, en niets over routes ' +
      'waarvan de bron niet te vinden is (die staan apart geteld).',
    gemeten: { routes: routes.length, verdacht: verdacht.length, bronOnvindbaar: bronOnvindbaar.length },
    perVorm: SCHEPPERS.map(s => ({ vorm: s.id, aantal: verdacht.filter(v => v.vorm === s.id).length })),
    verdacht: verdacht.sort((a, b) => a.pad.localeCompare(b.pad)), bronOnvindbaar };
}

module.exports = { meet, SCHEPPERS };
if (require.main !== module) return;

const uit = meet();
if (argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); return; }
fs.writeFileSync(path.join(WORTEL, 'LAATSPOOR.json'), JSON.stringify(uit, null, 1) + '\n');
console.log('\n=== EEN SPOOR NA EEN WEIGERING ===\n');
console.log('  schrijfroutes onderzocht : ' + uit.gemeten.routes);
console.log('  VERDACHT                 : ' + uit.gemeten.verdacht);
console.log('  bron onvindbaar          : ' + uit.gemeten.bronOnvindbaar + '   <- niet gekeken, geen "in orde"');
for (const v of uit.perVorm) console.log('      ' + v.vorm.padEnd(14) + v.aantal);
console.log('\n  de eerste twintig:');
for (const v of uit.verdacht.slice(0, 20)) console.log('    ' + (v.methode + ' ' + v.pad).padEnd(48) + v.waar);
console.log('\n  weggeschreven in LAATSPOOR.json\n');
