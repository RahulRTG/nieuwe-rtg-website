#!/usr/bin/env node
/* ============================================================================
   DE BEWAKERS DIE IN DE HANDLER ZITTEN -- en waarom een map op NAAM niet mag.

   HET PROBLEEM. scripts/lib/bewakers.js leest de deur van een route uit de
   ROUTER: `app.post('/api/x', officeAuth, ...)`. Dat werkt voor elke route waar
   de bewaking een middleware is. Voor 660 schrijfroutes is dat niet zo -- daar
   staat de poort in het lichaam van de handler:

       app.post('/api/rtf/samen/maak', (req, res) => {
         const s = samenSess(req, res); if (!s) return;
         ...
       });

   Voor de router is dat een route zonder enige bewaking. In MUTATIECONTRACT.json
   komen ze daarom uit als "toegang niet af te leiden", en dat is precies de bak
   die niemand kan opruimen zonder de code te lezen.

   WAT DIT SCRIPT MEET. Per handler de eerste POORTVORM: een aanroep met
   `(req, res)` waarvan de uitkomst meteen tot een `return` leidt. Dat is de
   huisvorm van een bewaker in een handler, en hij is te herkennen zonder te
   raden wat de functie doet.

   DE UITKOMST, en dit is de reden dat dit script bestaat in plaats van een map:

     - over alle handlers: 60 verschillende poortvormen, samen 1220 routes;
     - binnen de 660 zonder af te leiden toegang: 9 vormen, samen 97 routes;
     - en DRIE van die negen dragen een naam die in dit huis ook iets ANDERS
       betekent.

   `profiel` is in server/routes/rtfschool.js een gezinsprofiel-poort en in
   server/kern/spellen/magnaat/bankprofiel.js een functie die cijfers uitrekent.
   `beheerVan` is in server/bedrijf/ een poort op een beheertoken en in
   server/kern/office/samen.js een helper die een classificatie normaliseert.
   `lidVan` is in server/bedrijf/deuren.js een poort en in kern/agenda-pro.js een
   functie die een prefix van een string knipt.

   Een map van NAAM naar toegangsklasse zou die drie dus verkeerd indelen, en het
   ergste geval is stil: een rekenfunctie die als bewaker wordt geteld, maakt van
   een open route een AUTHENTICATED-route in het register. Dat is dezelfde fout
   die SEMANTIEK.json 78 keer vond, nu in de beveiligingslaag.

   DUS: wie deze routes wil classificeren, doet dat per BESTAND EN NAAM, en niet
   per naam. Dit script levert die lijst; het vult niets in.

   Draaien:  node scripts/handlerbewakers.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { handlersUit } = require('./lib/schrijfanalyse');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const SERVER = path.join(WORTEL, 'server');
const UITSLAG = path.join(WORTEL, 'HANDLERBEWAKERS.json');
const vastleggen = process.argv.includes('--vastleggen');

/* Welke routes hebben GEEN af te leiden toegang? Die lijst komt uit het
   contractregister, zodat deze meting precies over de bak gaat die vastzit. */
let zonderToegang = new Set();
try {
  const c = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIECONTRACT.json'), 'utf8'));
  zonderToegang = new Set((c.rijen || []).filter(r => !r.toegang.waargenomen).map(r => r.route));
} catch (e) {}

/* DE POORTVORM. Drie schrijfwijzen van hetzelfde: een aanroep met (req, res)
   waarvan de uitkomst meteen tot een return leidt. Alles wat daar niet op lijkt,
   telt niet mee -- liever een poort missen dan een rekenfunctie meetellen. */
const VORMEN = [
  /const\s+\w+\s*=\s*(\w+)\s*\(\s*req\s*,\s*res\s*\)\s*;\s*if\s*\(\s*!/,
  /if\s*\(\s*!\s*(\w+)\s*\(\s*req\s*,\s*res[^)]*\)\s*\)\s*return/,
  /if\s*\(\s*(\w+)\s*\(\s*req\s*,\s*res[^)]*\)\s*\)\s*return/
];

const alle = new Map();      // naam -> {routes, bestanden}
const inDeBak = new Map();
let handlers = 0;

(function loop(map) {
  for (const naam of fs.readdirSync(map)) {
    const p = path.join(map, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (naam === 'data' || naam === 'node_modules') continue; loop(p); continue; }
    if (!naam.endsWith('.js')) continue;
    let hs = [];
    try { hs = handlersUit(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }
    for (const h of hs) {
      handlers++;
      let poort = null;
      for (const re of VORMEN) { const m = re.exec(h.lichaam); if (m) { poort = m[1]; break; } }
      if (!poort) continue;
      const rel = path.relative(WORTEL, p);
      const route = h.methode + ' ' + h.pad;
      for (const doel of [alle, zonderToegang.has(route) ? inDeBak : null]) {
        if (!doel) continue;
        if (!doel.has(poort)) doel.set(poort, { routes: [], bestanden: new Set() });
        doel.get(poort).routes.push(route);
        doel.get(poort).bestanden.add(rel);
      }
    }
  }
})(SERVER);

/* De naambotsingen: een poortnaam die in meer dan een bestand voorkomt. Dat is
   op zichzelf niet fout -- een gedeelde helper mag -- maar het is wel het
   signaal dat een map op naam alleen niet kan bestaan. */
const botsingen = [...alle.entries()]
  .filter(([, v]) => v.bestanden.size > 1)
  .map(([naam, v]) => ({ naam, bestanden: [...v.bestanden], routes: v.routes.length }))
  .sort((a, b) => b.routes - a.routes);

const rij = (n, wat) => String(n).padStart(5) + '  ' + wat;
console.log('\n=== DE BEWAKERS IN DE HANDLER ===\n');
console.log(rij(handlers, 'handlers gelezen'));
console.log(rij([...alle.values()].reduce((s, v) => s + v.routes.length, 0), 'routes met een poortvorm in het lichaam'));
console.log(rij(alle.size, 'verschillende poortvormen'));
console.log('');
console.log(rij(zonderToegang.size, 'routes zonder af te leiden toegang (de bak die vastzit)'));
console.log(rij([...inDeBak.values()].reduce((s, v) => s + v.routes.length, 0), '   daarvan met een poortvorm in het lichaam'));
console.log(rij(inDeBak.size, '   verschillende vormen'));
console.log('');
for (const [naam, v] of [...inDeBak.entries()].sort((a, b) => b[1].routes.length - a[1].routes.length)) {
  console.log(rij(v.routes.length, naam + '   (' + [...v.bestanden].join(', ') + ')'));
}
console.log('\n  NAAMBOTSINGEN -- dezelfde poortnaam in meer dan een bestand\n');
for (const b of botsingen.slice(0, 12)) {
  console.log(rij(b.routes, b.naam + '   ' + b.bestanden.slice(0, 3).join(', ') + (b.bestanden.length > 3 ? ' (+' + (b.bestanden.length - 3) + ')' : '')));
}
console.log('\n  Wie deze routes indeelt, doet dat per BESTAND EN NAAM. Een map op naam alleen');
console.log('  telt een rekenfunctie als bewaker, en dan wordt een open route stil AUTHENTICATED.');

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'Per handler de eerste poortvorm: een aanroep met (req, res) waarvan de uitkomst meteen tot ' +
      'een return leidt. Dat is de huisvorm van een bewaker die niet in de router staat maar in het lichaam.',
    grens: 'Dit script vult NIETS in. Het levert de lijst waarmee een mens de toegangsklasse kan zetten, ' +
      'per BESTAND EN NAAM -- want drie van deze namen betekenen elders iets anders, en een map op naam ' +
      'alleen zou een rekenfunctie als bewaker tellen.',
    gemeten: {
      handlers,
      metPoortvorm: [...alle.values()].reduce((s, v) => s + v.routes.length, 0),
      vormen: alle.size,
      zonderAfTeLeidenToegang: zonderToegang.size,
      daarvanMetPoortvorm: [...inDeBak.values()].reduce((s, v) => s + v.routes.length, 0),
      vormenInDeBak: inDeBak.size
    },
    naambotsingen: botsingen,
    inDeBak: [...inDeBak.entries()].map(([naam, v]) => ({ naam, bestanden: [...v.bestanden], routes: v.routes }))
  }, null, 1) + '\n');
  console.log('\n  HANDLERBEWAKERS.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
