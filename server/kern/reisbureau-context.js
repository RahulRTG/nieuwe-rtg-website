/* DE REISAANVRAAG ALS SOORT IN EEN GESPREK -- wat Rahul over een aanvraag mag
   weten als het lid hem op zijn scherm aanwijst (kern/stuur/menscontext-opzoek.js,
   EDGE.md par. 14.4).

   De app stuurt alleen soort en ref mee. Rahul zoekt de aanvraag HIER op, bij
   elke vraag opnieuw, via dezelfde lezer die het reisbureau zelf gebruikt
   (aanvraagVan). Van wie hij is beslist `customerKey`, dezelfde sleutel die
   mijn() en annuleer() lezen: een lid ziet in een gesprek precies de aanvragen
   die het ook in "Mijn aanvragen" ziet.

   DE VELDEN, OP NAAM. Geen notitie (vrije tekst van het lid), geen bericht van
   de adviseur, geen toelichting bij een wijziging: vrije tekst in een prompt kan
   een opdracht dragen. Geen codenaam en geen customerKey: Rahul praat met het
   lid zelf. Wat wel mee mag is wat het lid op het scherm ziet en waar hij naar
   kan vragen -- welke reis, hoeveel mensen, wanneer, de stand en de prijs per
   persoon. */
'use strict';

module.exports = function reisaanvraagContext({ aanvraagVan }) {
  return {
    soort: 'reisaanvraag',
    velden: ['titel', 'bestemming', 'personen', 'vertrek', 'stand', 'prijsPerPersoon'],
    zoek: (ref) => aanvraagVan(ref),
    eigenaar: (a) => a.customerKey,
    mag: () => true,
    beeld: (a) => ({ titel: a.titel, bestemming: a.bestemming, personen: a.personen,
      vertrek: a.vertrek, stand: a.status, prijsPerPersoon: a.prijs && a.prijs.pp })
  };
};
