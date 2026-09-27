/* HET IDEM-REGISTER, deel leerhuis (RTG Academy) -- zelfde register, eigen bestand.

   Drie routes, drie vormen:
     - `lees` verandert niets: de kern leest met kijk() en schept geen collectie.
     - `doe` draagt een VERPLICHTE sleutel en de kern is daarop idempotent: een
       tweede oproep met dezelfde sleutel schrijft niets en geeft het eerste
       antwoord terug. De poort hoeft er dus niets te dedupliceren buiten die
       sleutel om; `velden` zegt welke velden de handeling identificeren.
     - `open` kan per organisatie precies een keer slagen (409 daarna), en de
       route geeft zelf een vaste sleutel mee. */
'use strict';

const SLEUTELS = {
  'POST /api/leerhuis/lees': { leest: true },
  'POST /api/leerhuis/doe': { velden: ['org', 'actie', 'sleutel'] },
  'POST /api/office/leerhuis/open': { velden: ['id'] }
};

module.exports = { SLEUTELS };
