/* HET LEESPAD VAN DE RESIDENCE -- opzoeken zonder aanleggen.

   WAAROM DIT EEN EIGEN BESTAND IS. Dezelfde naad als bij spellen/opslag.js:
   `index.js` stond op 8974 byte en de twee lezers hieronder duwden hem over de
   9400 waar keuringsregel 13 begint te waarschuwen. Die waarschuwing bestaat
   juist om te zeggen dat een bestand groot wordt, dus hem wegpoetsen door de
   uitleg in te korten tot het er een byte onder past, is de meter bedienen in
   plaats van de code. Waar de opslag woont is geen orkestratie -- en waar het
   LEZEN van die opslag woont evenmin.

   WAT HET REPAREERT. `R()` in index.js materialiseert: hij roept eigen.bak()
   aan en zet daarna nog `wie` neer. Voor schrijven hoort dat zo; voor een
   OPZOEKING is het een stille bijwerking, en die is gemeten. STAATPROEF.json
   zag `/api/residentie/spel/antwoord` keurig 404 geven ("er is geen uitnodiging
   meer") en ondertussen de collectie `residentie` aanleggen -- want die
   opzoeking loopt via kamerVan() en potjes(), en allebei gaan ze door R().
   ROLLBACK stond daarop GEZAKT.

   Er komt geen gegeven bij, alleen leeg meubilair, en toch is het een echte
   bevinding: zolang een weigering iets verandert, kan geen enkele meter leeg
   meubilair onderscheiden van een half uitgevoerde mutatie.

   HET LEESPAD HOEFDE NIET BEDACHT TE WORDEN. `kijk()` in ../eigencollectie.js
   is precies dit -- dezelfde eigenaars- en vormcontrole, maar afwezig blijft
   afwezig. De lege waarde is BEVROREN met opzet: wie erin duwt krijgt een fout
   in plaats van een wijziging die nergens terechtkomt. */
'use strict';

const LEEG = Object.freeze({});

module.exports = function maakResidentieLezen(eigen) {
  const Rlees = () => eigen.kijk('residentie');
  const kamerVanLees = (key) => {
    const kamers = Rlees().kamers || LEEG;
    return Object.keys(kamers).find(id => ((kamers[id] || LEEG).leden || LEEG)[key]) || null;
  };
  const potjesLees = () => Rlees().potjes || LEEG;
  return { LEEG, Rlees, kamerVanLees, potjesLees };
};
