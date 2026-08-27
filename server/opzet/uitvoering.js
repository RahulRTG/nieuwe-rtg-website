/* DE BEDRADING VAN UITVOERENDE MEDIA (kern/uitvoering/).

   Een maker publiceert een PARTITUUR (fragmenten, wat onmisbaar is, wat RTG
   ermee mag, wie het mag zien); RTG maakt daar op het moment van vragen één
   UITVOERING van. De redenering staat in UITVOEREND.md.

   WAT HIER STAAT, EN WAAROM HET DUN IS. Deze laag bezit geen mediadomein. Hij
   krijgt één ding mee dat hij zelf niet mag namaken: de catalogus van de Media
   OS, waarmee elk fragment wordt opgelost met de sessie van de KIJKER. Dat is
   de hele koppeling -- en dat het er maar één is, is het punt: zou deze laag
   zijn eigen catalogus bouwen uit dezelfde bronnen, dan bestonden er twee
   antwoorden op "wat mag dit lid zien" (LAT.md regel 4).

   Aangeroepen vanuit ./kernlaag7.js, direct na ./mediaos.js. Staat de Media OS
   uit (de schakelaar in de boardroom), dan is er geen catalogus en komt deze
   laag er niet -- de routes zien dan geen `uitvoering` in de kern en hangen
   zichzelf niet op. */
'use strict';
module.exports = (kern, hulp) => {
  const { crypto } = hulp;
  const { db, save, schoon, keyVanCodenaam, mediaCatalogus } = kern;
  if (!mediaCatalogus) return;
  Object.assign(kern, require('../kern/uitvoering').maakUitvoering({
    db, save, schoon, crypto,
    /* De catalogus van de Media OS, alleen om te LEZEN. Hij komt uit
       kern/mediaos/index.js en wordt hier niet opnieuw opgebouwd. */
    catalogus: mediaCatalogus,
    /* De gids die een codenaam aan een sleutel koppelt -- nodig om een
       aanspraak aan iemand te verlenen. Async, zoals overal in dit huis. */
    keyVanCodenaam
  }));
};
