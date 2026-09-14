/* DE INZAGEKAART, DE WOORDEN -- wat een lid leest waar de code een sleutel ziet.

   Los van ./inzagekaart.js langs een naad in het ONDERWERP: daar wordt de kaart
   SAMENGESTELD uit vier sporen, hier staat hoe die sporen in het Nederlands
   heten. Twee verschillende soorten wijziging, twee verschillende lezers -- wie
   een zin bijstelt omdat hij onduidelijk was, hoeft de samenstelling niet te
   begrijpen, en andersom.

   ER WORDT HIER NIETS AFGELEID. Dit is een woordenlijst en geen vertaallaag:
   een soort die er niet in staat, krijgt in inzagekaart.js zijn eigen naam te
   zien en verdwijnt niet stilletjes van de kaart. Dat gedrag hoort daar, bij de
   samenstelling, want het is een besluit over de KAART en niet over de woorden. */
'use strict';

/* Wat er in de paspoortlaag gebeurde, in de woorden van het lid. De sleutel is
   de `soort` die kern/paspoort logt. */
const PASPOORT_TEKST = {
  bevestiging: 'controleerde of u RTG-geverifieerd bent (ja/nee, geen gegevens gedeeld)',
  aanvraag: 'vroeg uw identiteitsbewijs op',
  goedgekeurd: 'u keurde die aanvraag goed',
  geweigerd: 'u weigerde die aanvraag',
  ingetrokken: 'u trok de toegang weer in',
  inzage: 'opende uw identiteitsbewijs',
  'incident-ingediend': 'eiste uw identiteit op na een incident',
  'incident-vrijgegeven': 'RTG gaf uw identiteit vrij na beoordeling van dat incident',
  'incident-afgewezen': 'RTG wees dat incident af; er is niets gedeeld'
};

/* Regels die over uw EIGEN handeling gaan in plaats van over een kijker. Ze
   staan wel op de kaart -- zonder uw goedkeuring is een inzage erboven niet te
   begrijpen -- maar ze tellen niet mee als "er is in mijn gegevens gekeken". */
const EIGEN_HANDELING = new Set(['goedgekeurd', 'geweigerd', 'ingetrokken']);

module.exports = { PASPOORT_TEKST, EIGEN_HANDELING };
