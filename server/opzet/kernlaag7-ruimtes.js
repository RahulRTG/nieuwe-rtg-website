/* DE KERN SAMENSTELLEN -- deel 7, de overkoepelende werkruimtes.

   Uit ./kernlaag7.js geknipt op de 10 kB-grens, en op een onderwerp: daar
   worden de diensten aan de kern gehangen, hier de werkruimtes die er
   overheen liggen (RTG One, Magnaat Wereld) plus de Media OS die de vier
   mediadomeinen LEEST en dus als laatste moet.

   HIJ HEET GEEN 7c EN DAT IS MET OPZET: 7b hangt de ROUTERS op en staat na dit
   punt. Wie hier iets bij zet, zet het dus nog steeds VOOR de routers -- precies
   de volgorde die de kop van kernlaag7b uitlegt. */
'use strict';

module.exports = (kern, hulp) => {
  const { db, save, crypto, bewerkCollectie, findSupplier, sseToCustomer } = hulp;

/* RTG One en Magnaat Wereld zijn overkoepelende werkruimtes. Ze worden hier
   opgebouwd voordat kernlaag7b de routers ophangt, zodat de domeingrens nooit
   een half gemonteerde motor kan doorgeven. */
Object.assign(kern, require('../kern/rtgone')({ db, save, crypto }));
const partnerstudio = require('../kern/magnaat-partnerstudio')({ db, save, crypto, findSupplier });
Object.assign(kern, partnerstudio);
Object.assign(kern, require('../kern/magnaatwereld')({
  db, save, bewerkCollectie, crypto, functies: require('../functies'), sseToCustomer,
  partnerstudio: partnerstudio.magnaatPartnerstudio, codenaamVan: kern.codenaamVan
}));

/* De positie van de RTFoundation in RTG Pay (kern/rtfwallet.js): waar een gift
   landt en wie hem uitbetaalt. Hij hangt hier en niet bij de andere
   supplier-wegen in kernlaag2b, omdat het aanmaken twee dingen nodig heeft die
   pas later bestaan: de giftstand uit kern/rtfos (de ontvanger wordt meteen
   ingevuld) en de economielaag uit kernlaag4 (de stichting hoort niet als
   commerciele klant in de firewall te belanden). */
Object.assign(kern, require('../kern/rtfwallet').maakRtfWallet({
  db: hulp.db, save: hulp.save, accounts: hulp.accounts,
  ensureSupplierDefaults: kern.ensureSupplierDefaults, makeSupplierCode: kern.makeSupplierCode,
  economie: kern.economie, rtfos: kern.rtfos }));

// De Media OS hangt HIER, als laatste: hij LEEST de vier media-domeinen en
// die moeten er dus al zijn. Uitleg: ./mediaos.js.
require('./mediaos')(kern, hulp);
};
