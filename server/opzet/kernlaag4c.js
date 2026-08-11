/* DE KERN SAMENSTELLEN -- deel 4c: de drie kamers van RTG Kantoren.
   Uit deel 4b geknipt op de 10 kB-grens toen de belasting- en ondernemersronde
   dat deel eroverheen duwden. De knip valt op een naad: deze drie kamers
   gebruiken `bankregie` niet (de reden dat 4b als geheel bestaat), alleen de
   kern die er na 4b al ligt -- regering leest kern.bank en kern.opvang, en die
   staan er dan allebei. Wordt NA kernlaag4b aangeroepen; zie server.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { LANDEN, crypto, db, ledenAantal, save } = hulp;

/* De Opvang-afdeling (AZC/COA), het Regeringskantoor van de
   minister-president en het eigen hotel van elke afdeling -- alle drie
   kamers van RTG Kantoren. */
Object.assign(kern, require('../kern/opvang')({ db, save, crypto }));
Object.assign(kern, require('../kern/afdelingshotel')({ db, save, crypto }));
Object.assign(kern, require('../kern/regering')({ db, save, crypto, LANDEN,
  regelwacht: kern.regelwacht, bank: kern.bank, opvang: kern.opvang, afdelingen: kern.afdelingen, ledenAantal }));
};
