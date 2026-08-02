#!/usr/bin/env node
/* ============================================================================
   SCHAKELBAAR -- staat elke functie van het platform ook echt in de boardroom?

   De schakelkast is alleen zo compleet als haar catalogus. Een route die door
   geen enkele functie wordt bewaakt is vanuit de boardroom ONZICHTBAAR: je
   kunt hem niet uitzetten, niet per stad sluiten, niet per pas fijnregelen, en
   de storingswachter grijpt er nooit op in. Hij is er gewoon, altijd, voor
   iedereen.

   Dat gat groeit vanzelf. Wie een nieuw domein bouwt schrijft routes; de
   catalogus in server/functies/register/ bijwerken is een tweede handeling,
   en tweede handelingen worden vergeten. Op het moment dat dit script werd
   geschreven stond 41% van de routes buiten de kast -- niet door een besluit,
   maar door optelling.

   Dit script meet dat, en scripts/norm.js ratelt erop (meter
   routesNietSchakelbaar, richting omlaag): het gat mag kleiner worden en nooit
   groter. Zo hoeft niemand het in een keer dicht te maken, en kan het ook niet
   stilletjes weer opengaan.

   DE BESTUURSLAAG HOORT ER BEWUST NIET IN. /api/techniek en /api/boardroom
   zijn de knoppen zelf; die achter een schakelaar zetten is een deur met het
   slot aan de binnenkant. /api/health en /api/ready moeten altijd antwoorden,
   anders ziet een monitor een gezonde server als dood. En /api/privacy staat
   er om een heel andere reden buiten: inzage, export en verwijdering zijn
   WETTELIJKE RECHTEN, en een knop waarmee RTG die kan uitzetten hoort niet te
   bestaan.

   Draai: node --experimental-sqlite scripts/schakelbaar.js [--json]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const functies = require('../server/functies');

const WORTEL = path.join(__dirname, '..');

/* De bestuurslaag: routes die met REDEN niet schakelbaar zijn. Elke regel is
   een keuze, geen omissie -- dezelfde afspraak als de publieke-routelijst in
   scripts/check.js. */
const BUITEN = new Map([
  ['/api/techniek', 'het techniekbord zelf: de knoppen mogen niet achter een knop'],
  ['/api/boardroom', 'de schakelkast zelf: anders sluit de eigenaar zichzelf buiten'],
  ['/api/health', 'de gezondheidscheck moet altijd antwoorden, anders leest een monitor gezond als dood'],
  ['/api/ready', 'idem: de startsignalering van de load balancer'],
  /* DE AVG-RECHTEN ZIJN GEEN FUNCTIE. Inzage, export en verwijdering zijn
     wettelijke rechten van de betrokkene; een knop waarmee RTG die kan
     uitzetten hoort niet te bestaan, ook niet met de beste bedoelingen. Dit is
     de enige regel in deze lijst die er staat omdat schakelbaarheid ZELF
     verkeerd zou zijn, en niet omdat de deur technisch open moet blijven. */
  ['/api/privacy', 'inzage, export en verwijdering zijn AVG-rechten; die mag niemand kunnen uitzetten'],
  ['/api/metrics', 'de meetlijn voor monitoring: dicht betekent blind, en blind lijkt van buiten op gezond'],
  ['/api/cluster', 'de clusterlaag stuurt de instances aan; die hoort niet aan een schakelaar van een instance'],
  ['/api/sat', 'de satellietping waarmee een zaakdoos de wolk zoekt; zonder antwoord denkt de doos dat hij offline is'],
  ['/api/test', 'de opzettelijke bug- en crashhaak: bestaat alleen in demostand en is geen dienst om te schakelen']
]);

const zonderCommentaar = (b) => String(b)
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

function alleRoutes() {
  const uit = new Set();
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const vol = path.join(map, naam);
      if (fs.statSync(vol).isDirectory()) { loop(vol); continue; }
      if (!/\.js$/.test(naam)) continue;
      const bron = zonderCommentaar(fs.readFileSync(vol, 'utf8'));
      const re = /app\.(get|post|put|delete|patch|all)\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(bron))) if (m[2].startsWith('/api/')) uit.add(m[2]);
    }
  })(path.join(WORTEL, 'server'));
  return [...uit].sort();
}

const buitenOm = (pad) => [...BUITEN.keys()].some(p => pad === p || pad.startsWith(p + '/'));

function meet() {
  const routes = alleRoutes();
  const gedekt = [], ongedekt = [], bestuur = [];
  for (const r of routes) {
    if (buitenOm(r)) { bestuur.push(r); continue; }
    (functies.functieVoorPad(r) ? gedekt : ongedekt).push(r);
  }
  /* Gegroepeerd op het tweede pad-deel: zo lees je in een oogopslag WELK
     domein nog geen schakelaar heeft, in plaats van achthonderd losse regels. */
  const groepen = new Map();
  for (const r of ongedekt) {
    const k = '/' + r.split('/').slice(1, 3).join('/');
    if (!groepen.has(k)) groepen.set(k, []);
    groepen.get(k).push(r);
  }
  return { totaal: routes.length, gedekt, ongedekt, bestuur,
    groepen: [...groepen.entries()].map(([prefix, r]) => ({ prefix, aantal: r.length, routes: r }))
      .sort((a, b) => b.aantal - a.aantal) };
}

function main() {
  const r = meet();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ totaal: r.totaal, gedekt: r.gedekt.length,
      nietSchakelbaar: r.ongedekt.length, bestuur: r.bestuur.length,
      groepen: r.groepen.map(g => ({ prefix: g.prefix, aantal: g.aantal })) }, null, 2));
    return 0;
  }
  const pct = (r.gedekt.length / (r.gedekt.length + r.ongedekt.length) * 100).toFixed(1);
  console.log('\n\x1b[1mSCHAKELBAAR\x1b[0m \x1b[2m-- staat elke functie in de boardroom?\x1b[0m\n');
  console.log('  ' + r.totaal + ' API-routes');
  console.log('  \x1b[32m' + r.gedekt.length + '\x1b[0m staan onder een functie in de schakelkast (' + pct + '%)');
  console.log('  \x1b[2m' + r.bestuur.length + ' horen tot de bestuurslaag en staan er met reden buiten\x1b[0m');
  console.log('  ' + (r.ongedekt.length ? '\x1b[33m' : '\x1b[32m') + r.ongedekt.length +
    '\x1b[0m zijn vanuit de boardroom NIET te schakelen');
  if (r.ongedekt.length) {
    console.log('\n  \x1b[1mper domein\x1b[0m \x1b[2m(elk domein is een functie die nog in de catalogus mist)\x1b[0m');
    for (const g of r.groepen.slice(0, 25))
      console.log('    ' + String(g.aantal).padStart(4) + '  ' + g.prefix);
    if (r.groepen.length > 25) console.log('    \x1b[2m... en ' + (r.groepen.length - 25) + ' kleinere domeinen\x1b[0m');
    console.log('\n  \x1b[2mEen domein schakelbaar maken is een regel in server/functies/register/:\x1b[0m');
    console.log('  \x1b[2m{ id, categorie, naam, standaard: true, doelgroepen, uitleg, paden: [prefix] }\x1b[0m');
  }
  console.log('');
  return 0;
}

module.exports = { meet, BUITEN };
if (require.main === module) process.exit(main());
