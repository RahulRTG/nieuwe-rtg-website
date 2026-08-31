#!/usr/bin/env node
/* ============================================================================
   HET ROOSTER VAN EEN WERELD, IN DE PAGINA ZELF.

   WAAROM DIT EEN BOUWSTAP IS EN GEEN SCRIPT IN DE BROWSER. Eerst vulde
   shared/wereldrooster.js dit blok in de browser uit shared/sprongindex.json.
   Dat werkte, en het zakte alsnog: test/beginscherm.test.js leest de HTML van
   een wereldhuis en eist dat elk onderdeel uit die wereld er een ingang heeft.
   Een link die pas na een fetch bestaat, is voor die toets geen ingang -- en de
   toets heeft gelijk. Een ingang die van JavaScript afhangt, is er niet voor wie
   geen JavaScript krijgt, en hij staat ook niet in de pagina die je opslaat of
   doorstuurt.

   Dus staat het rooster nu gewoon in de vier huizen, geschreven door dit script
   tussen twee merktekens, en gecontroleerd door --controle. De bron blijft
   dezelfde afgeleide van MAPPEN (shared/sprongindex.json); er komt geen tweede
   lijst bij, alleen een tweede plek waar diezelfde lijst wordt uitgeschreven --
   en die kan niet verouderen zonder dat een toets zakt.

   Het redactionele rooster op elk huis blijft ernaast staan: dat is gemaakt om
   te verleiden, dit om compleet te zijn.

   Draai: node scripts/wereldrooster.js            (schrijft de vier huizen bij)
          node scripts/wereldrooster.js --controle (zakt als een huis achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const INDEX = path.join(WORTEL, 'public', 'shared', 'sprongindex.json');
const controle = process.argv.includes('--controle');

const HUIZEN = [
  ['public/apps/rtg.html', 'LivingOS'],
  ['public/apps/kantoor.html', 'WorkOS'],
  ['public/apps/reizen.html', 'TravelOS'],
  ['public/apps/foundation/os-publiek.html', 'FoundationOS']
];

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function rooster(items, wereld) {
  const mijn = items.filter((i) => i.wereld === wereld && i.url && !i.huis);
  const rijen = mijn.map((i) => '    <a class="kaart" href="' + esc(i.url) + '"><b>' + esc(i.naam) + '</b>' +
    (i.label ? '<span class="laaglabel">' + esc(i.label) + '</span>' : '') + '</a>').join('\n');
  return rijen;
}

function bijgewerkt(html, wereld, items) {
  const start = '<!-- WERELDROOSTER:' + wereld + ' -->';
  const eind = '<!-- /WERELDROOSTER -->';
  const i = html.indexOf(start), j = html.indexOf(eind);
  if (i < 0 || j < 0) return null;                 // geen merktekens: dit huis doet niet mee
  return html.slice(0, i + start.length) + '\n' + rooster(items, wereld) + '\n  ' + html.slice(j);
}

const items = JSON.parse(fs.readFileSync(INDEX, 'utf8')).items;
const achter = [];
let geschreven = 0;
for (const [rel, wereld] of HUIZEN) {
  const pad = path.join(WORTEL, rel);
  const html = fs.readFileSync(pad, 'utf8');
  const nieuw = bijgewerkt(html, wereld, items);
  if (nieuw === null) { achter.push(rel + ' mist de merktekens WERELDROOSTER:' + wereld); continue; }
  if (nieuw === html) continue;
  if (controle) achter.push(rel + ' loopt achter op MAPPEN');
  else { fs.writeFileSync(pad, nieuw); geschreven++; }
}

if (controle) {
  if (achter.length) { console.error(achter.join('\n') + '\nDraai: npm run wereldrooster'); process.exit(1); }
  console.log('wereldrooster: de vier huizen zijn gelijk aan MAPPEN.');
} else {
  console.log('wereldrooster: ' + geschreven + ' huis(zen) bijgewerkt.');
  if (achter.length) { console.error(achter.join('\n')); process.exit(1); }
}
