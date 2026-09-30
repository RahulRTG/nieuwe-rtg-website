'use strict';
/* Alleen de draaier stelt een vers journaal en run-id beschikbaar. Een gewoon
   node --test commando doet dezelfde assertions zonder een bewijsbestand. */
module.exports = (proef, dimensies, details = {}) => {
  if (!process.env.RTG_OPERATIONEEL_JOURNAAL) return;
  require('node:fs').appendFileSync(process.env.RTG_OPERATIONEEL_JOURNAAL, JSON.stringify({
    run: process.env.RTG_OPERATIONEEL_RUN, bron: process.env.RTG_OPERATIONEEL_BRON,
    proef, dimensies, ...details, at: new Date().toISOString()
  }) + '\n');
};
