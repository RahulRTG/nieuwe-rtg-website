#!/usr/bin/env node
/* DE TWEEDE BRON ONDER DE BRUG ROUTE -> BESTAND.

   CODEWERELD.json wees uit dat de brug tussen de as ROUTE en de as BESTAND op
   EEN register rustte (SCHRIJFANALYSE.json). Daardoor stond er `0 tegenspraken`
   terwijl er over 0,7% van de paden iets te vergelijken viel: geen groen, maar
   een lege controle. Een samengevoegde Codewereld zou die ene bron dus
   klakkeloos hebben overgenomen.

   Dit register legt er een ONAFHANKELIJKE afleiding naast. Onafhankelijk is hier
   geen woord maar een eis, en de twee wegen verschillen echt:

     SCHRIJFANALYSE  loopt de bronboom af en leest per bestand welke routes
                     erin staan (scripts/lib/schrijfanalyse.js).
     dit register    vraagt het de ROUTER -- wat de server werkelijk aanbiedt --
                     en zoekt daar de plek in de bron bij (scripts/lib/routes.js).

   WAT HET METEEN VOND, EN WAAROM DAT DE OPZET VERANDERT. Van de 4120 routes die
   beide kennen, zijn er 4119 gelijk en 1 verschillend. Die ene, POST
   /api/auth/me, is GEEN denkfout van een van de twee: SCHRIJFANALYSE.json draagt
   het stempel van commit 55e4a311 (29 augustus) en het bestand is op 1 september
   gesplitst. Het register heeft gelijk over de code van toen.

   Daarom kent dit register twee soorten verschil, en dat onderscheid is de
   opbrengst:

     verouderd    een van de betrokken bestanden is NA het stempel van het
                  andere register gewijzigd. Dan vergelijk je twee momenten en
                  geen twee meningen.
     tegenspraak  beide bestanden staan stil sinds dat stempel, en toch zeggen
                  de twee wegen iets anders. DAT is een bevinding.

   Wie die twee op een hoop gooit, krijgt een Codewereld die op leeftijdsverschil
   alarm slaat en bij een echte tegenspraak niets zegt -- of erger, er stil een
   winnaar uit kiest. BESTUUR.md zegt het al voor bewijs: vervallen bewijs is
   geen bewijs. Voor een samenvoeging geldt hetzelfde: registers van
   verschillende leeftijd zijn niet zonder meer naast elkaar te leggen.

   Draaien: npm run routebron -> ROUTEBRON.json */
'use strict';

/* DE WACHT. Dit script rekent en SCHRIJFT bij het laden: er is geen meet()
   die je los kunt aanroepen, alles staat op het hoogste niveau. Een enkele
   laadcontrole (node -e "require('./scripts/routebron')") zou het register dus
   overschrijven met wat die aanroep toevallig meet -- exact de fout waarmee
   ROLPROEF.json van 3377 beproefde routes terugviel naar 292, en het register
   zag er daarna volkomen normaal uit. Vandaar dat requiren hier niets doet.
   Wie de uitslag in code nodig heeft, leest het register. */
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { alleRoutes } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const ANDER = 'SCHRIJFANALYSE.json';

function git(args) {
  try { return execFileSync('git', args, { cwd: WORTEL }).toString().trim(); }
  catch (e) { return null; }
}

/* Wanneer is dit bestand voor het laatst gewijzigd, als tijdstip? Null betekent
   "niet vast te stellen" (geen git, of een bestand dat nooit is vastgelegd) en
   nooit "nooit gewijzigd" -- anders wordt een onbekende leeftijd stilzwijgend
   het bewijs dat er niets veranderd is. */
const datumCache = new Map();
function gewijzigdOp(rel) {
  if (datumCache.has(rel)) return datumCache.get(rel);
  const uit = git(['log', '-1', '--format=%cI', '--', rel]);
  const d = uit ? new Date(uit) : null;
  datumCache.set(rel, d && !isNaN(d) ? d : null);
  return datumCache.get(rel);
}

const ander = JSON.parse(fs.readFileSync(path.join(WORTEL, ANDER), 'utf8'));
const anderStempel = ander.stempel || {};
const anderOp = anderStempel.op ? new Date(anderStempel.op) : null;

const routerRoutes = alleRoutes();
/* TWEE LIJSTEN, en het verschil is de fout die lib/routes.js in zijn eigen kop
   beschrijft: laat de vindbaarheid in de BRON nooit beslissen over het BESTAAN
   van een route. `alle` is wat de server aanbiedt (ook zonder bestand); `mijn`
   is de deelverzameling waarvoor een plek in de bron gevonden is, en alleen die
   valt te vergelijken met een register dat uit de bron leest.

   Dit is hier meteen misgegaan: SCHERMROUTES.js nam eerst `perRoute` als
   "welke routes bestaan er", en verklaarde /api/instant-reality/event daarmee
   dood -- terwijl de router hem gewoon heeft. Zijn bestand is alleen onvindbaar
   omdat het hele routebestand op EEN regel staat. */
const alle = new Set(routerRoutes.map(r => r.methode + ' ' + r.pad));
const mijn = new Map(), samengesteld = new Set();
for (const r of routerRoutes) {
  if (!r.bestand) continue;
  const sleutel = r.methode + ' ' + r.pad;
  mijn.set(sleutel, { bestand: r.bestand, regel: r.regel || null });
  if (r.samengesteld) samengesteld.add(sleutel);
}

const hunne = new Map();
for (const r of ander.perRoute || []) if (r.bestand) hunne.set(r.route, r.bestand);

const gelijk = [], verschillen = [];
for (const [sleutel, m] of mijn) {
  const h = hunne.get(sleutel);
  if (!h) continue;
  if (h === m.bestand) { gelijk.push(sleutel); continue; }
  /* Twee momenten of twee meningen? Alleen als BEIDE bestanden stilstonden
     sinds het stempel van het andere register, is dit een echte tegenspraak. */
  const dA = gewijzigdOp(m.bestand), dB = gewijzigdOp(h);
  const naStempel = d => (anderOp && d ? d > anderOp : null);
  const aNa = naStempel(dA), bNa = naStempel(dB);
  const onbekend = aNa === null || bNa === null;
  verschillen.push({
    route: sleutel,
    volgensRouter: m.bestand, volgensBron: h,
    routerRegel: m.regel,
    samengesteldPad: samengesteld.has(sleutel),
    gewijzigdNaStempel: { [m.bestand]: aNa, [h]: bNa },
    soort: onbekend ? 'niet-vast-te-stellen' : (aNa || bNa ? 'verouderd' : 'tegenspraak'),
    reden: onbekend ? 'de wijzigingsdatum van minstens een bestand is niet vast te stellen'
      : (aNa || bNa ? 'een van de bestanden is gewijzigd na het stempel van ' + ANDER + ' (' + (anderStempel.commit || '?') + '); dit vergelijkt twee momenten'
        : 'beide bestanden staan stil sinds dat stempel, en toch verschillen de twee wegen')
  });
}

const alleenRouter = [...mijn.keys()].filter(k => !hunne.has(k));
const alleenBron = [...hunne.keys()].filter(k => !mijn.has(k));
const tel = s => verschillen.filter(v => v.soort === s).length;

let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const uit = {
  /* Wat voor SOORT bewering doet dit register? `index` = structuur en
     relaties (waar woont wat, wat hangt met wat samen). `meting` = een
     uitspraak over gedrag (schrijft het, klopt het, is het bewezen). Het
     verschil is niet cosmetisch: een index noemt bijna alles en maakt elke
     dekkingsvraag triviaal waar, dus scripts/codewereld.js telt hem apart. */
  soort: 'meting',
  uitleg: 'De tweede, onafhankelijke bron onder de brug route -> bestand: gevraagd aan de ROUTER (wat de server werkelijk aanbiedt) in plaats van gelezen uit de bronboom. Bestaat om ' + ANDER + ' toetsbaar te maken; zonder tweede bron betekent "geen tegenspraak" niets.',
  stempel: { op: new Date().toISOString(), commit },
  vergelekenMet: { register: ANDER, stempel: anderStempel },
  grens: 'Een verschil is pas een TEGENSPRAAK als beide betrokken bestanden stilstaan sinds het stempel van het andere register. Verschilt de leeftijd, dan vergelijk je twee momenten -- dat wordt hier apart geteld en nooit als tegenspraak gepresenteerd.',
  gemeten: {
    routerRoutes: alle.size,
    routerRoutesZonderBestand: alle.size - mijn.size,
    routerRoutesMetBestand: mijn.size,
    bronRoutesMetBestand: hunne.size,
    beideKennen: gelijk.length + verschillen.length,
    gelijk: gelijk.length,
    verschillend: verschillen.length,
    waarvanVerouderd: tel('verouderd'),
    waarvanTegenspraak: tel('tegenspraak'),
    waarvanNietVastTeStellen: tel('niet-vast-te-stellen'),
    alleenRouter: alleenRouter.length,
    alleenBron: alleenBron.length,
    toetsbaarPct: mijn.size ? Math.round((gelijk.length + verschillen.length) / mijn.size * 1000) / 10 : 0
  },
  verschillen,
  alleenRouterVoorbeeld: alleenRouter.slice(0, 20),
  alleenBronVoorbeeld: alleenBron.slice(0, 20),
  /* ALLE routes van de router, ook die zonder bestand. Wie wil weten of een pad
     bestaat, hoort hier te kijken en niet in `perRoute`. */
  alleRoutes: [...alle].sort(),
  perRoute: [...mijn].map(([route, m]) => ({ route, bestand: m.bestand, regel: m.regel, samengesteld: samengesteld.has(route) }))
};

fs.writeFileSync(path.join(WORTEL, 'ROUTEBRON.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten;
console.log('ROUTEBRON.json geschreven');
console.log('  router      ', g.routerRoutes, 'routes, waarvan', g.routerRoutesMetBestand, 'met een bestand (' + g.routerRoutesZonderBestand, 'zonder) |', ANDER + ':', g.bronRoutesMetBestand);
console.log('  vergeleken  ', g.beideKennen, 'routes (' + g.toetsbaarPct + '% van de router-kant)');
console.log('  gelijk      ', g.gelijk);
console.log('  verschillend', g.verschillend, '-> verouderd:', g.waarvanVerouderd + ', TEGENSPRAAK:', g.waarvanTegenspraak + ', niet vast te stellen:', g.waarvanNietVastTeStellen);
console.log('  alleen een kant:', g.alleenRouter, 'router-only,', g.alleenBron, 'bron-only');
for (const v of verschillen.filter(x => x.soort === 'tegenspraak').slice(0, 10)) {
  console.log('   TEGENSPRAAK', v.route, '\n     router:', v.volgensRouter, '\n     bron  :', v.volgensBron);
}
