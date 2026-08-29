#!/usr/bin/env node
/* ============================================================================
   DE FUNCTIELIJST -- FUNCTIES.md, maar dan afgelezen in plaats van bijgehouden.

   WAT ER MIS WAS. FUNCTIES.md opende met de zin dat hij "niet met de hand
   opgeschreven maar afgelezen uit de bron" is, want "een met de hand bijgehouden
   functielijst loopt binnen een week uit de pas met de code". Dat klopte als
   voornemen en niet als mechaniek: hij WAS met de hand bijgehouden. Op het
   moment dat dit script werd geschreven stond er 145 schakelaars waar er 204
   zijn, 83 apps waar er 84 zijn, en zestien categorieen waar er zeventien zijn.
   Een document dat zijn eigen betrouwbaarheid belooft en het niet waarmaakt, is
   erger dan een document dat niets belooft.

   WAT DIT SCRIPT WEL EN NIET OVERSCHRIJFT. Alleen de drie LIJSTEN -- de
   schakelaars, de apps en de genres. Alles ervoor (de inleiding, de vier
   werelden, hoe een functie aan- en uitgaat) en alles vanaf hoofdstuk 4 (de
   lagen, wat er bewust niet is) is met de hand geschreven proza en blijft
   letterlijk staan. Die twee helften uit elkaar houden is het hele punt: wat
   afleidbaar is hoort te worden afgeleid, en wat een mens heeft bedacht hoort
   een mens te houden.

   DE BRONNEN zijn dezelfde die het document zelf noemt:
     server/functies/register/     de functieschakelaars
     server/kern/appcatalogus-data.js  de ledencatalogus
     server/seed/genres-lijst.js   de bedrijfsgenres

   GEEN DATUM IN DE UITVOER, om dezelfde reden als scripts/wereldlijst.js: een
   tijdstempel zou de controle elke dag laten zakken, en dan gaat de regel uit.

   Draai: node scripts/functielijst.js             (schrijft FUNCTIES.md)
          node scripts/functielijst.js --controle  (zakt als hij achterloopt)
          node scripts/functielijst.js --uit       (naar stdout, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'FUNCTIES.md');

const { FUNCTIES } = require('../server/functies/register');
const { APPS } = require('../server/kern/appcatalogus-data');
const GENRES = require('../server/seed/genres-lijst');

/* Het brede streepje uit een codepunt, want keuringsregel 3 verbiedt het teken
   in de bron -- terwijl FUNCTIES.md het juist hoort te dragen (dat is de
   huisstijl van het document). Zelfde truc als scripts/check.js zelf gebruikt
   om zijn eigen regel niet te overtreden. */
const STREEP = String.fromCharCode(0x2014);

const groep = (rijen, sleutel) => rijen.reduce((a, r) => {
  const k = sleutel(r); (a[k] = a[k] || []).push(r); return a;
}, {});

/* Eén regel per functie, in de vorm die er al stond. `doelgroepen` staat als
   losse regel eronder omdat een functie voor drie passen en een gast kan
   gelden, en dat op één regel niet meer te lezen is. */
function schakelaars() {
  const per = groep(FUNCTIES, f => f.categorie);
  const uit = ['# 1. De ' + FUNCTIES.length + ' functieschakelaars', ''];
  for (const [categorie, lijst] of Object.entries(per)) {
    uit.push('### ' + categorie + ' ' + STREEP + ' ' + lijst.length, '');
    for (const f of lijst) {
      uit.push('- **' + f.naam + '** (`' + f.id + '`) ' + STREEP + ' ' + String(f.uitleg || '').replace(/\s+/g, ' ').trim() + '  ');
      const wie = (f.doelgroepen || []).map(d => (typeof d === 'string' ? d : (d && (d.id || d.naam)) || '')).filter(Boolean);
      uit.push('  _voor: ' + (wie.length ? wie.join(', ') : 'niet opgegeven') + '_');
    }
    uit.push('');
  }
  return uit.join('\n');
}

function apps() {
  const per = groep(APPS, a => a.categorieLabel);
  const uit = ['# 2. De ' + APPS.length + ' apps in de leden-catalogus', '',
    'Wat een lid op zijn homescreen kan zetten. De schakelaars hierboven bepalen of',
    'ze werken; dit is wat hij ziet.', ''];
  for (const [categorie, lijst] of Object.entries(per)) {
    uit.push('### ' + categorie + ' ' + STREEP + ' ' + lijst.length, '');
    for (const a of lijst) {
      uit.push('- **' + a.naam + '** `' + a.url + '` ' + STREEP + ' ' + String(a.uitleg || '').replace(/\s+/g, ' ').trim());
    }
    uit.push('');
  }
  return uit.join('\n');
}

function genres() {
  const rijen = Object.entries(GENRES).map(([id, g]) => ({ id, ...g }));
  const per = groep(rijen, g => g.industry || 'zonder sector');
  const sectoren = Object.keys(per).sort();
  const uit = ['# 3. De ' + rijen.length + ' genres in ' + sectoren.length + ' sectoren', '',
    'Er is **één** partner-app en **één** personeels-PDA. Welke schermen een zaak',
    'krijgt volgt niet uit zijn genre maar uit zijn *genre-caps*: een hotel en een',
    'appartement delen `bookings`, een restaurant en een beachclub delen `menu`. Dat',
    'is de reden dat er geen 130 losse apps zijn.', ''];
  for (const sector of sectoren) {
    const lijst = per[sector];
    uit.push('- **' + sector + '** (' + lijst.length + ') ' + STREEP + ' ' +
      lijst.map(g => (g.label || g.id) + ' (`' + g.id + '`)').join(', '));
  }
  uit.push('');
  return uit.join('\n');
}

/* De getallen in de kop. Ze staan in een tabel die verder met de hand is
   geschreven, dus wordt alleen de WAARDE vervangen -- de rij zelf blijft. */
/* Wat er te tellen valt, geteld. De routes komen uit dezelfde lijst als de rest
   van dit huis (scripts/lib/routes.js, uit de ROUTER) zodat dit document niet
   een eigen getal gaat voeren naast MUTATIEBOEK.json. */
function tellingen() {
  const { alleRoutes } = require('./lib/routes');
  const loop = (map, filter) => {
    let n = 0;
    const ga = (m) => {
      for (const d of fs.readdirSync(m, { withFileTypes: true })) {
        const p2 = path.join(m, d.name);
        if (d.isDirectory()) ga(p2); else if (filter(d.name)) n++;
      }
    };
    ga(path.join(WORTEL, map));
    return n;
  };
  return {
    api: alleRoutes().filter(r => r.pad.startsWith('/api/')).length,
    kern: loop('server/kern', n => n.endsWith('.js')),
    schermen: loop('public/apps', n => n.endsWith('.html')),
    toetsen: loop('test', n => n.endsWith('.test.js') || n.endsWith('.e2e.js'))
  };
}

function kopMetGetallen(kop) {
  const tel = tellingen();
  const caps = new Set();
  Object.values(GENRES).forEach(g => (g.caps || []).forEach(c => caps.add(c)));
  const cat = new Set(FUNCTIES.map(f => f.categorie)).size;
  const appCat = new Set(APPS.map(a => a.categorieLabel)).size;
  const sect = new Set(Object.values(GENRES).map(g => g.industry || 'zonder sector')).size;
  return kop
    .replace(/\| Functieschakelaars \(aan\/uit per functie\) \| \*\*\d+\*\* in \d+ categorieën \|/,
      '| Functieschakelaars (aan/uit per functie) | **' + FUNCTIES.length + '** in ' + cat + ' categorieën |')
    .replace(/\| Apps in de leden-catalogus \| \*\*\d+\*\* in \d+ categorieën \|/,
      '| Apps in de leden-catalogus | **' + APPS.length + '** in ' + appCat + ' categorieën |')
    .replace(/\| Bedrijfsgenres \| \*\*\d+\*\* in \d+ sectoren \|/,
      '| Bedrijfsgenres | **' + Object.keys(GENRES).length + '** in ' + sect + ' sectoren |')
    .replace(/\| Genre-caps \(waar de apps op sturen\) \| \*\*\d+\*\* \|/,
      '| Genre-caps (waar de apps op sturen) | **' + caps.size + '** |')
    /* DE VIER ONDERSTE RIJEN STONDEN ER MET EEN TILDE VOOR ("~2.950"), en dat
       was eerlijk bedoeld: een schatting. Ze zijn alle vier exact te tellen, en
       een schatting die naast een geteld getal staat leest als even hard.
       Vandaar geteld, zonder tilde, met erbij WAT er geteld is -- "API-routes"
       zegt iets anders dan "endpoints", en het verschil is 1800. */
    .replace(/\| API-endpoints \| [^|]*\|/,
      '| API-routes (uit de router) | **' + tel.api + '** |')
    .replace(/\| Kernmodules \(`server\/kern\/\*\*`\) \| [^|]*\|/,
      '| Kernmodules (`server/kern/**`) | **' + tel.kern + '** |')
    .replace(/\| App-pagina's \(`public\/apps\/\*\*\.html`\) \| [^|]*\|/,
      "| App-pagina's (`public/apps/**.html`) | **" + tel.schermen + '** |')
    .replace(/\| Testbestanden \| [^|]*\|/,
      '| Testbestanden | **' + tel.toetsen + '** |');
}

function bouw() {
  const oud = fs.readFileSync(DOEL, 'utf8');
  const start = oud.indexOf('\n# 1. ');
  const eind = oud.indexOf('\n# 4. ');
  if (start < 0 || eind < 0)
    throw new Error('FUNCTIES.md mist de kop "# 1. " of "# 4. "; dit script knipt daarop en durft niet te raden');
  const kop = kopMetGetallen(oud.slice(0, start + 1));
  const staart = oud.slice(eind + 1);
  return kop + [schakelaars(), apps(), genres()].join('\n') + '\n' + staart;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const nieuw = bouw();
  if (argv.includes('--uit')) { process.stdout.write(nieuw); process.exit(0); }
  if (argv.includes('--controle')) {
    const opSchijf = fs.readFileSync(DOEL, 'utf8');
    if (opSchijf === nieuw) { console.log('FUNCTIES.md is gelijk aan de bron.'); process.exit(0); }
    console.error('FUNCTIES.md loopt achter op de bron -- draai: npm run functielijst');
    process.exit(1);
  }
  fs.writeFileSync(DOEL, nieuw);
  console.log('FUNCTIES.md geschreven: ' + FUNCTIES.length + ' schakelaars, ' +
    APPS.length + ' apps, ' + Object.keys(GENRES).length + ' genres.');
}

module.exports = { DOEL, bouw };
