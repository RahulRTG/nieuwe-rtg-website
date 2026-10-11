/* RTG CONCERN (kern/concern): het dak boven de onderneming (CONCERN.md), uit
   ./kernlaag4b.js geknipt toen die over de 10 kB-grens stond en het dienstverband
   er een leesweg bij kreeg -- over de grens mag je repareren, niet uitbreiden.

   Hangt DIRECT ACHTER de onderneming en die volgorde is niet vrij:
   entiteitOnderneming() wijst een bestaande onderneming aan. Andersom leest de
   onderneming niets van het concern -- de oude weg blijft dus werken zonder dat
   er ooit een entiteit bestaat. */
'use strict';

module.exports = function bindConcern(kern, hulp) {
  const { db, save, crypto, schoon, findSupplier, bewerkCollectie } = hulp;
  Object.assign(kern, require('../kern/concern')({ db, save, crypto, schoon, findSupplier, bewerkCollectie,
    // Discovery leest de onderneming van de aanvrager (./voorstel.js)
    ondernemingVind: kern.ondernemingVind,
    // het dienstverband leest een ledensleutel ook als codenaam (employment-wie.js)
    codenaamVan: (x) => kern.codenaamVan(x) }));
};
