/* DE GEBIEDSINDEX VAN SCHIJF -- wat de bron ons kan leveren.

   Afgesplitst van ./gebieden.js, dat de catalogus en de licentiepoort houdt:
   dit bestand doet EEN ding, namelijk het bestand lezen dat
   scripts/navigatie-index.js wegschrijft, en het onthouden zolang het niet
   verandert. `indexStempel()` gaat ook naar buiten, want de catalogus hangt
   zijn eigen cache aan dezelfde stempel -- twee keer uitrekenen wat "is dit
   bestand veranderd" betekent, is twee antwoorden op een vraag (LAT.md regel 4). */
'use strict';

const fs = require('node:fs');
const { indexPad } = require('./pakket');

/* Wat de bron ons kan leveren. Ontbreekt de index, dan is het antwoord LEEG met
   een reden -- nooit stilzwijgend nul, want dat leest als "er is niets aan te
   bieden" in plaats van "wij hebben niet gekeken".

   GECACHET OP DE WIJZIGINGSTIJD, en dat is geen optimalisatie om de
   optimalisatie: de dekkingsregel hangt aan navStatus, dus dit bestand zou bij
   ELK statusverzoek van schijf komen. Op de mtime en niet blind -- een cache
   die nooit vervalt, vraagt een herstart na een import, en dat is precies het
   soort stille voorwaarde waar iemand een uur aan kwijt is. */
let cache = null;
function indexStempel() {
  const p = indexPad();
  try { return fs.existsSync(p) ? String(fs.statSync(p).mtimeMs) + ':' + p : 'weg:' + p; }
  catch (e) { return 'onleesbaar:' + p; }
}
function index() {
  const p = indexPad();
  const stempel = indexStempel();
  if (cache && cache.stempel === stempel) return cache.uit;
  const uit = leesIndex(p);
  cache = { stempel, uit };
  return uit;
}
function leesIndex(p) {
  if (!fs.existsSync(p)) {
    return { gebieden: [], reden: 'Er is nog geen gebiedsindex ingelezen; draai `npm run navigatie:index`. ' +
      'Zonder index weet RTG niet wat de bron kan leveren, en dat is iets anders dan dat er niets is.' };
  }
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const rij = Array.isArray(j.gebieden) ? j.gebieden : [];
    /* `naamsvermelding` hoort hier net zo hard bij als `licentie`: een bron
       die zijn plicht op de index verklaart (OpenStreetMap doet dat) verliest
       hem anders bij het inlezen, en dan weigert `mag()` alles. */
    return { gebieden: rij, bron: j.bron || null, licentie: j.licentie || null,
      naamsvermelding: j.naamsvermelding || null, gelezenAt: j.gelezenAt || null };
  } catch (e) {
    return { gebieden: [], reden: 'De gebiedsindex is niet te lezen (' + e.message + '); hij wordt niet geraden.' };
  }
}

module.exports = { index, indexStempel, leesIndex };
