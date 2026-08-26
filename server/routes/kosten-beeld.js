/* HET EIGEN KOSTENBEELD -- een antwoord, drie lezers.

   Een lid, een zaak en het kantoor stellen dezelfde vraag ("wat kost deze
   gebruiker, en wie betaalt dat") en horen hetzelfde antwoord te krijgen. Alleen
   de vraag WIE erom mag vragen verschilt, en die staat in de routes.

   Een eigen bestandje omdat ./kosten.js en ./kosten-kantoor.js hem allebei
   nodig hebben en dat eerste bestand door de omvangsgrens ging. Twee kopieen van
   dit antwoord zouden op een dag iets anders zeggen over dezelfde gebruiker --
   en dan is de vraag welke van de twee op de factuur staat. */
'use strict';

module.exports = (kosten) => function eigenBeeld(drager, periode) {
    const o = kosten.voorDrager(periode, drager);
    const dek = kosten.dekkingVoor(periode, drager);
    /* Alleen de stand van DEZE gebruiker, en niet het hele voorstel waar hij
       uitgevist wordt: dat laatste rekent bij elke paginaweergave de maand van
       alle gebruikers door. */
    const stand = kosten.standVoor(periode, drager);
    /* De stand van de verbruiksgrens hoort in HETZELFDE antwoord als het
       verbruik: een waarschuwing die je op een ander scherm moet gaan zoeken,
       ziet niemand voordat de deur dichtgaat. */
    const grens = kosten.grensStand(drager);
    return {
      ok: true, periode, overzicht: o, dekking: dek, grens,
      wieBetaalt: { stand: stand.stand, uitleg: stand.uitleg, opDeRekening: !!stand.factureren,
        waaromNiet: stand.waaromNiet },
      /* Wat dit overzicht NIET zegt, staat er even groot bij. Een kostenbeeld
         dat alleen zijn eigen getallen toont, leest als volledig -- en dat is
         het niet zolang er soorten zijn die niemand meet. */
      zegtNiet: {
        nietGemeten: o.nietGemeten,
        toegerekend: 'Elektriciteit en serverhuur zijn niet per gebruiker te meten. Wat daarvan bij u staat, is een verdeling van de echte nota naar uw gemeten verbruik, en draagt daarom de graad "vermoed".'
      }
    };
};
