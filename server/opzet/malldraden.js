/* De late bindingen van de RTG Mall.

   De Mall wordt in kernlaag2 gebouwd, maar vier dingen die zij leest bestaan op
   dat moment nog niet: de landentabel van de Reiswijzer (kernlaag4b), de agenda
   van de vakgenres (kernlaag3), de tafels van de Food Court (verderop in
   kernlaag2) en de aan/uit-schakelaars van de zaak (server.js). Ze komen daarom
   als functie binnen en worden pas bij het eerste verzoek opgehaald.

   Waarom dat hier staat en niet als vier regels in kernlaag2: die laag zat op
   een byte of twintig van de bestandsgrens, en comments wegschaven om eronder
   te blijven is de meter bedriegen in plaats van hem gehoorzamen. Bovendien
   horen deze vier bij elkaar -- het is een draadboom, geen viertal losse regels.

   ELKE DRAAD GEEFT null ALS HIJ ER NIET IS, en dat blijft zichtbaar: de Mall
   meldt in `standbron` welke draden hangen, en test/mall-supplieros.test.js
   eist dat dat er op een echte server drie van de drie zijn. Zonder die toets
   zou een losgeraakte draad de hele koppeling stil uitzetten en zou de Mall er
   precies zo uitzien als ervoor (LAT-regel 3). */
'use strict';

module.exports = function mallDraden(kern) {
  return {
    // de landbepaling van de Reiswijzer: van welke bestemming ligt in welk land
    haalLandVind: () => (typeof kern.landVind === 'function' ? kern.landVind : null),
    // de verdieping RTG Thuis (kern/thuis), met haar eigen commerciele aanbod
    haalThuis: () => (kern.thuis && typeof kern.thuis.thuisMallAanbod === 'function' ? kern.thuis.thuisMallAanbod() : null),
    // de Supplier OS-koppeling: agenda, tafels en de schakelaars van de zaak
    haalVakwerk: () => (kern.vakwerk && typeof kern.vakwerk.slots === 'function' ? kern.vakwerk : null),
    haalFoodcourt: () => (kern.foodcourt && typeof kern.foodcourt.tijden === 'function' ? kern.foodcourt : null),
    haalZaakFunctie: () => (typeof kern.zaakFunctieAan === 'function' ? kern.zaakFunctieAan : null)
  };
};
