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

/* FOUNDATION CONNECT (kern/connect/): de ontdeklus over bestaande domeinen --
   ontdekken, begrijpen, doen, maken, delen, verbinden, helpen, groeien. Hij
   hoort hier en niet bij de diensten in kernlaag7.js, want hij is precies zo'n
   overkoepelende werkruimte als RTG One: hij BEZIT geen inhoud en LEEST er
   twee (kern/leerstof.js en kern/rtfos/publiek.js).

   DAAROM STAAT HIJ NA DE RTFOUNDATION. `rtfos` wordt in kernlaag7.js opgehangen
   en de lokale bron leest `rtfos.publiek.stad()`; een kopie op montagemoment
   zou hier undefined bevriezen, en dan meldt de mixer stil dat die motor niets
   vond terwijl hij er gewoon niet bij kon (de fout die de kop van kernlaag7b
   beschrijft).

   `DOELEN` komt RECHTSTREEKS uit de module en niet uit de kern, en dat is geen
   slordigheid: het is een statische tabel van 166 leerdoelen zonder db-greep,
   geen draaiende motor. De leerstof-INSTANTIE (sessies, voortgang) blijft van
   routes/leerstof.js -- deze laag leest alleen de catalogus, en kan dus per
   constructie niemands oefensessie aanraken. */
/* HIJ HANGT NA DE MEDIA OS, en dat is sinds 15 september de volgorde die
   telt. `makerVan` en `werkenVan` komen uit kern/mediaos/werkherkomst.js --
   het register waar vijf domeinen via `nieuwWerk()` zelf vertellen dat DEZE
   maker DIT heeft gemaakt. Connect LEEST dat en stelt het nooit zelf vast
   (besluit van de eigenaar: auteurschap consumeren, niet uitvinden).

   Een kopie op montagemoment zou hier undefined bevriezen, en dan zegt de
   naklank stil dat er geen maker is terwijl het register er gewoon staat --
   precies de stille faalvorm die de kop van kernlaag7b beschrijft. Vandaar
   functies die de kern bij AANROEP lezen. */
require('./mediaos')(kern, hulp);

Object.assign(kern, require('../kern/connect').maakConnect({
  db, save, crypto,
  DOELEN: require('../kern/leerstof').DOELEN,
  rtfos: kern.rtfos,
  /* Het voorvoegsel gaat eraf: een ontdekking draagt `herkomst:id`
     (kern/connect/ontdekking.js), het register kent alleen het id. */
  makerVan: (id) => kern.mediaMakerVanWerk
    ? kern.mediaMakerVanWerk(String(id || '').replace(/^mediaos:/, '')) : null,
  werkenVan: (sleutel, max) => kern.mediaWerkenVan ? kern.mediaWerkenVan(sleutel, max) : [] }));

// De Media OS hing HIER als laatste en staat nu BOVEN Foundation Connect: hij
// LEEST de vier media-domeinen (die moeten er dus al zijn) en Connect leest op
// zijn beurt zijn werkherkomst. Uitleg: ./mediaos.js.
};
