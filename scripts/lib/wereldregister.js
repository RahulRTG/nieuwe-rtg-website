'use strict';
/* HET WERELDREGISTER, EEN KEER GELEZEN.

   `MAPPEN` in de app-main-bundel is de enige lijst werelden (WERELD.md), en er
   waren twee plekken die hem wilden lezen: test/wereldregister.test.js, die
   bewaakt dat elk item ergens op uitkomt, en scripts/wereldlijst.js, die de
   precieze lijst per wereld uitschrijft. Twee lezers van dezelfde lijst is
   precies LAT.md regel 4 -- ze lopen uiteen op het moment dat de bundel
   verschuift, en dan is er niet meer te zien welke van de twee gelijk heeft.

   Dus staat de lezer hier, en gebruiken ze hem allebei.

   DE SNEDES ZIJN GEEN BESTANDEN MAAR STUKKEN VAN EEN BUNDEL. `app-main-23.js`
   telt 22 openende en 21 sluitende accolades: LINKS begint daar en eindigt in
   `app-main-24.js`. Wie een snede los parseert, krijgt een object dat nooit
   sluit. scripts/bundel.js plakt ze in de juiste volgorde -- dezelfde bundelaar
   die de bouw gebruikt, dus er ontstaat hier geen tweede waarheid over de
   volgorde. */
const fs = require('fs');
const path = require('path');
const { bundel } = require('../bundel');

const WORTEL = path.join(__dirname, '..', '..');
const PUB = path.join(WORTEL, 'public');

/* String(): de bundelaar levert een Buffer, want hij is gemaakt om te SCHRIJVEN
   en niet om te lezen. Een Buffer heeft .length en .indexOf, dus hij komt een
   heel eind mee voordat hij op .replace struikelt. */
const BRON = String(bundel('apps/app-main.js'))
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function blok(na, open, dicht) {
  const st = BRON.indexOf(na);
  if (st < 0) throw new Error(na + ' hoort in de app-main-bundel te staan');
  const o = BRON.indexOf(open, st);
  let d = 0;
  for (let i = o; i < BRON.length; i++) {
    if (BRON[i] === open) d++;
    else if (BRON[i] === dicht) { d--; if (!d) return BRON.slice(o, i + 1); }
  }
  throw new Error(na + ' sluit nergens');
}

/* Uitvoeren en niet met een regex raden: deze objecten bevatten uitdrukkingen
   (encodeURIComponent(pas)), en dan is elke regex een gok. Wat we willen weten
   is welke SLEUTELS er zijn en waar ze heen wijzen, niet met welke querystring. */
function draai(code) {
  return Function('"use strict";var pas="rtg";' +
    'var encodeURIComponent=function(x){return x};return (' + code + ');')();
}

const LINKS = draai(blok('const LINKS', '{', '}'));
const OSAPPS = draai(blok('const OSAPPS', '{', '}'));
const MAPPEN = draai(blok('const MAPPEN', '[', ']'));
const WERELDEN = MAPPEN.filter((m) => m.wereld);

const APP_HTML = fs.readFileSync(path.join(PUB, 'apps/app.html'), 'utf8');

/* De tabnaam komt uit de knop zelf (app-main: `tabNaam`), niet uit een tweede
   lijstje hier -- anders heet een tab in dit document iets anders dan op het
   scherm. */
const TABS = {};
for (const m of APP_HTML.matchAll(/<button[^>]*data-tab="([a-z]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
  const sp = /<span[^>]*>([^<]*)<\/span>/.exec(m[2]);
  TABS[m[1]] = sp ? sp[1].trim() : m[1];
}

const kaal = (u) => String(u).split('?')[0].split('#')[0];
const bestaat = (u) => u.startsWith('/') && fs.existsSync(path.join(PUB, u.replace(/^\//, '')));

/* Een item oplossen naar wat een mens ervan ziet: zijn naam en waar hij
   uitkomt. Lost hij niet op, dan zegt dit dat -- stilte is hier de fout die
   test/wereldregister.test.js juist moet vangen. */
function los(item) {
  if (item.startsWith('tab:')) {
    const t = item.slice(4);
    return { soort: 'tab', sleutel: t, naam: TABS[t] || t, url: '/apps/app.html (stand ' + t + ')', bestaat: !!TABS[t] };
  }
  const sleutel = item.slice(item.indexOf(':') + 1);
  /* EEN OS-APP IS GEEN ADRES MAAR EEN KEUZE. `os:rtf` opent een leeftijdskeuze
     en daarna pas een scherm; `os:werk` opent de kiezer met je werkplekken.
     Ze een url toedichten zou een lijst opleveren die stellig is over iets wat
     de code niet zegt. */
  if (item.startsWith('os:')) {
    const def = OSAPPS[sleutel];
    return { soort: 'os', sleutel, naam: def ? def.naam || sleutel : null,
      url: def ? 'kiezer in de app' : null, bestaat: !!def };
  }
  const def = LINKS[sleutel];
  if (!def) return { soort: 'link', sleutel, naam: null, url: null, bestaat: false };
  return { soort: 'link', sleutel, naam: def.naam || sleutel, url: def.url || null,
    bestaat: def.url ? (!kaal(def.url).startsWith('/') || bestaat(kaal(def.url))) : false };
}

module.exports = { LINKS, OSAPPS, MAPPEN, WERELDEN, TABS, APP_HTML, BRON, blok, draai, kaal, bestaat, los, PUB, WORTEL };
