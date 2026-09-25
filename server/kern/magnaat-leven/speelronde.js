/* Magnaat FROM ZERO: DE SPEELRONDE -- hoe snel de tijd gaat, en doorspoelen.

   De klok rekent bij en tikt niet (./index.js). Voor een speelronde zijn er twee
   hulpen, en geen van beide verandert wat er in een dag gebeurt:
     - het TEMPO: hoe lang een speldag echt duurt (./regels.js, TEMPO);
     - DOORSPOELEN: de dagen lopen door tot er iets gebeurt dat je aandacht
       vraagt -- een kans, een vraag, geldnood of slecht nieuws -- en hooguit
       twee weken. Wat je gepland had, gebeurt; vrije tijd die je niet plande is
       weg. Doorspoelen is dus niet gratis: het is tijd laten liggen. */
'use strict';
const R = require('./regels');
const { meld } = require('./staat');
const { volgendeDag } = require('./dag');

const AANDACHT = ['kans', 'vraag', 'nood', 'slecht'];

function tempo(st, z, nu) {
  if (!R.TEMPO[z.stand]) return { status: 400, error: 'Kies een tempo: ' + Object.keys(R.TEMPO).join(', ') + '.' };
  st.tempo = z.stand;
  st.dagMs = R.TEMPO[z.stand];
  st.gerekendTot = nu;
  meld(st, 'Tempo ' + z.stand + ': een dag duurt nu ' + Math.round(st.dagMs / 1000) + ' seconden. Wat er in een dag gebeurt, blijft hetzelfde.');
  return { ok: true };
}

function doorspoelen(st, nu) {
  const begin = st.dag;
  for (let i = 0; i < R.DOORSPOELEN_MAX; i++) {
    const laatste = st.meldingen[0];
    volgendeDag(st);
    const nieuw = [];
    for (const m of st.meldingen) { if (m === laatste) break; nieuw.push(m); }
    if (nieuw.some(m => AANDACHT.includes(m.soort))) break;
  }
  st.gerekendTot = nu;
  meld(st, 'Doorgespoeld van dag ' + begin + ' naar dag ' + st.dag + '.');
  return { ok: true };
}

module.exports = { tempo, doorspoelen, AANDACHT };
