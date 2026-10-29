'use strict';

/* Chromium rapporteert afgebroken document-overgangen soms als pageerror,
   hoewel de pagina de ViewTransition-promise al afhandelt en de navigatie is
   voltooid. Houd deze lijst klein en letterlijk: alleen browsermeldingen met
   een exact bekende tekst worden genegeerd. Iedere applicatiefout en iedere
   onbekende browservariant blijft daardoor zichtbaar in de proeven. */
const MELDINGEN = new Set([
  'Transition was skipped',
  'Transition was aborted because of invalid state. ViewTransition opt-in disabled',
  'Transition was aborted because of invalid state. Page already revealed'
]);

function isBrowserruis(fout) {
  return MELDINGEN.has(String((fout && fout.message) || fout));
}

module.exports = { isBrowserruis, meldingen: Object.freeze([...MELDINGEN]) };
