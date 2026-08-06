#!/usr/bin/env node
/* ============================================================================
   DE GRENSLIJST -- schrijft GRENZEN.json uit de meting.

   Per domein: welke kern-namen raakt het aan, minus de gedeelde interface die
   elk domein toch al mag (server/opzet/domeingrens.js). Wat overblijft is wat
   dit domein OPSCHRIJFT als zijn eigen.

   DIT IS EEN VERTREKPUNT EN GEEN WAARHEID, en dat verschil is de hele reden dat
   dit script bestaat in plaats van dat de grens de lijst zelf berekent. Een
   grens die zijn eigen lijst uit de code haalt, houdt per definitie niets tegen:
   wat je vandaag aanraakt mag dan morgen ook. De lijst hoort een BESLUIT te zijn
   dat in de repo staat en dat je moet aanraken als je verder wilt reiken.

   WAT DE SCANNER NIET ZIET, en dat komt er dus niet in: vier plekken lezen een
   naam die ze zelf uitrekenen (routes/supplier/genrepuls.js, genreplan.js,
   genreblik.js en routes/werkplek-bureaus.js). Die worden door de grens
   tegengehouden zodra hij aanstaat, met een fout die de naam noemt, en dan
   komen ze met de hand op de lijst. Dat is de bedoeling: de lijst wordt compleet
   doordat hij ergens knelt, niet doordat iemand goed heeft geraden.

   Draai:  node scripts/grenslijst.js            (schrijft GRENZEN.json)
           node scripts/grenslijst.js --uit       (laat zien, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GRENZEN.json');
const ROUTES = path.join(WORTEL, 'server', 'routes');
const { bereikVan } = require('./grenzen');
const { INTERFACE, DOORGEEF } = require('../server/opzet/domeingrens');

/* De acht domeinen uit opzet/routes.js, plus elk los routebestand als eigen
   domein -- want dat is precies wat het is: een eigen ding dat de kern aanraakt.
   Zo staat het ook in scripts/grenzen.js; twee indelingen zou twee waarheden
   geven. */
function domeinVan(f) {
  const stukken = path.relative(ROUTES, f).split(path.sep);
  return stukken.length > 1 ? stukken[0] : stukken[0].replace(/\.js$/, '');
}

function bouw() {
  const bestanden = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) { loop(p); continue; }
      if (naam.endsWith('.js')) bestanden.push(p);
    }
  })(ROUTES);

  const gedeeld = new Set([].concat(INTERFACE, DOORGEEF));
  const per = new Map();
  for (const f of bestanden) {
    const d = domeinVan(f);
    if (!per.has(d)) per.set(d, new Set());
    for (const n of bereikVan(fs.readFileSync(f, 'utf8'))) {
      if (!gedeeld.has(n)) per.get(d).add(n);
    }
  }
  const uit = {};
  for (const d of [...per.keys()].sort()) uit[d] = [...per.get(d)].sort();
  return uit;
}

if (require.main === module) {
  const lijst = bouw();
  const totaal = Object.values(lijst).reduce((n, a) => n + a.length, 0);
  if (process.argv.includes('--uit')) {
    for (const [d, a] of Object.entries(lijst)) console.log(String(a.length).padStart(4) + '  ' + d);
    console.log('\n  ' + Object.keys(lijst).length + ' domeinen, ' + totaal + ' eigen namen');
    process.exit(0);
  }
  /* Een BESTAANDE lijst wordt niet overschreven maar samengevoegd: wie met de
     hand een naam heeft toegevoegd (de vier uitgerekende gevallen) verliest die
     niet bij de volgende meting. Dat is het verschil tussen een vertrekpunt en
     een generator die je werk opeet. */
  let oud = {};
  try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')).domeinen || {}; } catch (e) {}
  const samen = {};
  let bijGehouden = 0;
  for (const d of new Set([].concat(Object.keys(lijst), Object.keys(oud))).values()) {
    const set = new Set([].concat(lijst[d] || [], oud[d] || []));
    const extra = (oud[d] || []).filter(n => !(lijst[d] || []).includes(n));
    bijGehouden += extra.length;
    samen[d] = [...set].sort();
  }
  const geordend = {};
  for (const d of Object.keys(samen).sort()) geordend[d] = samen[d];
  fs.writeFileSync(DOEL, JSON.stringify({
    uitleg: 'Per domein de kern-namen die het mag aanraken, BOVEN de gedeelde interface in server/opzet/domeingrens.js. Gegenereerd met npm run grenslijst en met de hand aan te vullen; die aanvullingen blijven staan.',
    domeinen: geordend
  }, null, 2) + '\n');
  console.log('GRENZEN.json geschreven: ' + Object.keys(geordend).length + ' domeinen, ' +
    Object.values(geordend).reduce((n, a) => n + a.length, 0) + ' namen' +
    (bijGehouden ? ' (' + bijGehouden + ' met de hand toegevoegde namen behouden)' : ''));
}

module.exports = { bouw, DOEL };
