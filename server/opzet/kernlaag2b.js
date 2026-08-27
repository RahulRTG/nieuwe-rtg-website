/* DE KERN SAMENSTELLEN -- deel 2b van 7.

   Afgesplitst van ./kernlaag2.js om dezelfde reden als ./kernlaag3b.js van
   kernlaag3: die kwam met het commerce-blok erbij op 11115 byte en dus over de
   omvangregel van scripts/check.js. De grens verzetten zou de goedkope uitweg
   zijn; die lijst hoort te krimpen en niet te groeien (zie de kop van
   uitschieters() daar).

   EEN MODULE, EN DE PLEK IS GEDRAG. RTG Commerce leest de aanbodlaag van de
   Mall, dus hij hoort NA kernlaag2 en niet ervoor. Verder naar achteren zou ook
   kunnen; hier is het dichtst bij de laag waar hij op leunt, en dat is waar
   iemand hem zoekt.
   ========================================================================== */
'use strict';

module.exports = (kern, hulp) => {
  const { db, findSupplier, save } = hulp;

/* RTG Commerce (kern/commerce/): de verkooplaag boven de domeinen -- vermogens
   per koopbaar, een mand over verkopers heen, en een afrekening PER verkoper.
   Leest de Mall en schrijft daar niets terug; zie COMMERCE.md.

   Meteen achter de Mall omdat hij haar aanbodlaag leest, en `aanbodAlles` gaat
   als FUNCTIE mee: de mall-api is een regel hierboven samengesteld, en een
   vastgehouden verwijzing zou die van dat moment zijn.

   De fiscale functies komen rechtstreeks uit kern/fiscaal/tarief.js en niet uit
   de fiscale laag (kernlaag4c): dat bestand is puur en draagt geen state, en het
   is met opzet de ENIGE bron van een btw-tarief in dit huis. */
Object.assign(kern, require('../kern/commerce').maakCommerce({
  db, save, nu: require('../lib/klok').nu,
  aanbodAlles: () => kern.mall.aanbodAlles(),
  tariefVan: require('../kern/fiscaal/tarief').tariefVan,
  basisCat: require('../kern/fiscaal/tarief').basisCat,
  zaakVan: findSupplier,
  capsVan: (s) => db.capsVan(s)
}));
};
