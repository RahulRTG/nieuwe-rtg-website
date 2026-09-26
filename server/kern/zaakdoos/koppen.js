/* DE KOPPEN VAN EEN DOOS NAAR DE CLOUD -- op een plek (AUTHORITY.md fase 7).

   Zeven aanroepen stuurden elk zelf `x-doos-sleutel` mee. Met een eigen sleutel
   per doos (../zaakdoos/sleutels.js) komen er twee koppen bij, en die horen niet
   op zeven plekken apart: een plek die ze vergeet, meldt zich dan als een
   onbewezen doos zonder dat iemand het merkt.

   De eigen sleutel gaat alleen mee als de doos er een HEEFT (RTG_DOOS_ID plus
   RTG_DOOS_EIGEN_SLEUTEL); anders verandert er niets aan wat er al ging. De
   gedeelde sleutel gaat altijd mee zolang hij is ingesteld: de schaduw van
   fase 7 houdt die weg open tot een apart besluit. */
'use strict';

function doosKoppen(extra, sleutel) {
  const k = Object.assign({}, extra || {});
  const gedeeld = sleutel != null ? sleutel : process.env.RTG_DOOS_SLEUTEL;
  if (gedeeld) k['x-doos-sleutel'] = gedeeld;
  const id = process.env.RTG_DOOS_ID, eigen = process.env.RTG_DOOS_EIGEN_SLEUTEL;
  if (id && eigen) { k['x-doos-id'] = id; k['x-doos-eigen-sleutel'] = eigen; }
  return k;
}

module.exports = { doosKoppen };
