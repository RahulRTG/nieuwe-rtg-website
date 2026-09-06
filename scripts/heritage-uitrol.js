#!/usr/bin/env node
/* RTG Heritage staat vanaf de eerste paint op ieder echt appscherm.

   De gedeelde basis blijft de runtime-uitwijk, maar zij wordt `defer` geladen.
   Een premium scherm mag daarvoor niet eerst één frame in zijn oude materiaal
   tekenen. Deze mechanische uitrol zet daarom de vaste wereld op <body> en het
   centrale blad als laatste stylesheet in <head>. De routekaart blijft de ene
   autoriteit; redirects krijgen bewust geen volledige appschil.

   Controle:    node scripts/heritage-uitrol.js
   Vastleggen:  node scripts/heritage-uitrol.js --vastleggen */
'use strict';

const fs = require('fs');
const path = require('path');
const identiteit = require('../public/shared/rtg-world-identity');

const WORTEL = path.join(__dirname, '..');
const APPS = path.join(WORTEL, 'public', 'apps');
const LINK = '<link id="rtgHeritageCss" href="/shared/rtg-heritage.css" rel="stylesheet">';
const VASTLEGGEN = process.argv.includes('--vastleggen');

function htmlBestanden(map, uit = []) {
  for (const naam of fs.readdirSync(map).sort()) {
    const volledig = path.join(map, naam);
    const stat = fs.statSync(volledig);
    if (stat.isDirectory()) htmlBestanden(volledig, uit);
    else if (naam.endsWith('.html')) uit.push(volledig);
  }
  return uit;
}

function appPad(bestand) {
  return '/' + path.relative(path.join(WORTEL, 'public'), bestand).split(path.sep).join('/');
}

function attribuut(tag, naam) {
  const gevonden = tag.match(new RegExp('\\s' + naam + '=["\']([^"\']*)["\']', 'i'));
  return gevonden ? gevonden[1] : null;
}

function voegAttribuutToe(tag, naam, waarde) {
  if (attribuut(tag, naam) !== null) return tag;
  return tag.replace(/>$/, ' ' + naam + '="' + waarde + '">');
}

function zetAttribuut(tag, naam, waarde) {
  if (attribuut(tag, naam) === null) return voegAttribuutToe(tag, naam, waarde);
  return tag.replace(new RegExp('(\\s' + naam + '=["\\\'])[^"\\\']*(["\\\'])', 'i'), '$1' + waarde + '$2');
}

function verwijderLinkregel(bron, link) {
  const positie = bron.indexOf(link);
  if (positie === -1) return bron;

  const regelBegin = bron.lastIndexOf('\n', positie - 1) + 1;
  const regelEindeTeken = bron.indexOf('\n', positie + link.length);
  const regelEinde = regelEindeTeken === -1 ? bron.length : regelEindeTeken + 1;
  const voor = bron.slice(regelBegin, positie);
  const na = bron.slice(positie + link.length, regelEindeTeken === -1 ? bron.length : regelEindeTeken);

  /* Verwijder de volledige eigen regel, inclusief zijn regeleinde. Zo laat een
     volgende uitrol geen extra lege regel achter voordat de link opnieuw op
     zijn canonieke plek voor </head> wordt gezet. */
  if (/^[\t ]*$/.test(voor) && /^[\t ]*\r?$/.test(na)) {
    return bron.slice(0, regelBegin) + bron.slice(regelEinde);
  }
  return bron.slice(0, positie) + bron.slice(positie + link.length);
}

function gewenst(bestand, bron) {
  const route = appPad(bestand);
  const wereld = identiteit.classify(route);
  if (!wereld) throw new Error('Ongeclassificeerd appscherm: ' + route);
  if (wereld === 'redirect') return bron;

  const body = bron.match(/<body\b[^>]*>/i);
  if (!body) throw new Error('Geen <body> in ' + route);
  const bestaandeWereld = attribuut(body[0], 'data-rtg-world');
  const bestaandeSkin = attribuut(body[0], 'data-rtg-skin');
  if (bestaandeWereld && bestaandeWereld !== wereld && bestaandeWereld !== 'core') {
    throw new Error(route + ' noemt ' + bestaandeWereld + ', routekaart noemt ' + wereld);
  }
  if (bestaandeSkin && bestaandeSkin !== 'heritage') {
    throw new Error(route + ' gebruikt onverwachte skin ' + bestaandeSkin);
  }

  let bodyNieuw = zetAttribuut(body[0], 'data-rtg-world', wereld);
  bodyNieuw = voegAttribuutToe(bodyNieuw, 'data-rtg-skin', 'heritage');
  let uit = bron.replace(body[0], bodyNieuw);

  const heritageLinks = uit.match(/<link\b[^>]*href=["']\/?shared\/rtg-heritage\.css(?:[?#][^"']*)?["'][^>]*>/gi) || [];
  if (heritageLinks.length > 1) throw new Error('Dubbel Heritage-blad in ' + route);
  if (heritageLinks.length === 1) {
    uit = uit.replace(heritageLinks[0], LINK);
    /* Het blad moet werkelijk als laatste stylesheet winnen. */
    uit = verwijderLinkregel(uit, LINK);
  }
  if (!/<\/head>/i.test(uit)) throw new Error('Geen </head> in ' + route);
  uit = uit.replace(/<\/head>/i, LINK + '\n</head>');
  return uit;
}

function voerUit() {
  const verschillen = [];
  let echte = 0;
  let redirects = 0;
  for (const bestand of htmlBestanden(APPS)) {
    const route = appPad(bestand);
    const soort = identiteit.classify(route);
    if (soort === 'redirect') redirects += 1;
    else echte += 1;
    const bron = fs.readFileSync(bestand, 'utf8');
    const nieuw = gewenst(bestand, bron);
    if (nieuw === bron) continue;
    verschillen.push(route);
    if (VASTLEGGEN) fs.writeFileSync(bestand, nieuw);
  }

  console.log('RTG Heritage-uitrol: ' + echte + ' schermen, ' + redirects + ' redirects.');
  if (!verschillen.length) {
    console.log('PASS: wereld en stylesheet staan vanaf de eerste paint vast.');
    return 0;
  }
  console.log((VASTLEGGEN ? 'BIJGEWERKT' : 'ACHTER') + ': ' + verschillen.length + ' schermen.');
  verschillen.slice(0, 20).forEach(route => console.log('  ' + route));
  if (verschillen.length > 20) console.log('  ... +' + (verschillen.length - 20));
  return VASTLEGGEN ? 0 : 1;
}

if (require.main === module) process.exitCode = voerUit();
module.exports = { gewenst, appPad, voerUit, LINK, zetAttribuut };
