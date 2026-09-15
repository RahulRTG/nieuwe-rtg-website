/* ============================================================================
   DE ONDERNEMERSLUS -- vier routes, en drie verschillende antwoorden op
   "wat is hetzelfde verzoek?".

   Deel van ./idemsleutels.js; zie de kop daar voor de vier vormen en het
   venster. Ze staan in een eigen bestand om dezelfde reden als de rondes
   ernaast: een lijst die naar duizenden regels groeit hoort niet in het bestand
   dat ook de regels uitlegt.

   ZE KOMEN UIT EEN GEMETEN SCHULD EN NIET UIT EEN OPRUIMBUI.
   test/idemschuld.test.js zag de teller van 4436 naar 4440 gaan toen de
   dagcheck-in een tweede deur kreeg (ONDERNEMEN.md par. 7) en de werkvloer de
   onderneming achter zijn zaak leerde kennen (par. 1). Die teller mag alleen
   KRIMPEN, en de weg omlaag is verklaren -- niet de stand opnieuw vastleggen,
   want dat mag pas als de schuld werkelijk kleiner is geworden.

   ------------------------------------------------------------------------
   DE TWEE LEZERS zijn het makkelijkst en toch geen `zelfdeVerzoek`. Een POST
   die niets verandert hoort het antwoord van NU te krijgen en niet dat van vijf
   seconden geleden -- dezelfde redenering als in ./idemsleutels-move.js. Van
   allebei is GEMETEN dat ze niets achterlaten: het staat in
   ./mutatiecontracten-staffgemoed.js en ./mutatiecontracten-zaakkant.js met de
   toetsen erbij.

   ------------------------------------------------------------------------
   `/zet` DRAAGT VRIJE TEKST, EN DAAR ZIT DE VAL.

   `zelfdeVerzoek: true` zou hier een NOTITIE laten verdwijnen. De afdruk van een
   verzoek laat vrije tekst met opzet buiten beschouwing (BUITEN_AFDRUK in
   ./handelingsspoor.js kent `notitie`), dus iemand die binnen het venster zijn
   stemming laat staan en alleen zijn notitie bijwerkt, stuurt een verzoek met
   EEN ANDERE inhoud en DEZELFDE afdruk. De poort zou de tweede opslokken en de
   bijgewerkte notitie zou nooit worden bewaard.

   Vandaar `velden`: die bouwt de sleutel uit precies de genoemde velden en gaat
   niet door de afdruk, dus de notitie telt hier wel mee. Twee woordelijk gelijke
   aanroepen zijn een dubbeltik; een gewijzigde notitie is een nieuw verzoek.

   ------------------------------------------------------------------------
   `/weg` VERANDERT HIERDOOR ZIJN ANTWOORD, en dat hoort er hardop bij te staan.

   Zonder verklaring gaf een tweede aanroep 404 ("voor die dag staat er niets").
   Met deze verklaring krijgt een dubbeltik binnen het venster het eerste
   antwoord terug: 200 met de gewiste dag. De STAND was al hetzelfde -- de dag is
   weg en blijft weg -- maar het ANTWOORD is nu ook hetzelfde, en dat is voor wie
   twee keer tikt het eerlijkere van de twee: hij vroeg om die dag weg te halen,
   en die dag is weg.

   ./mutatiecontracten-staffgemoed.js is daarop bijgewerkt. Zou dat register
   blijven zeggen dat er geen dubbeltik wordt HERKEND, dan stond er een
   verklaring die niet meer klopt -- en een register dat liegt is erger dan een
   register dat ontbreekt.

   Buiten het venster valt hij terug op 404, en dat is geen inconsistentie maar
   het venster: vijf seconden is de maat van een dubbeltik, niet van iemand die
   morgen nog eens dezelfde dag wil wissen.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* LEZEN. Zie hierboven: het antwoord van nu, niet dat van zojuist. */
  'POST /api/staff/gemoed': { leest: true },
  'POST /api/supplier/onderneming': { leest: true },

  /* SCHRIJVEN, met de notitie IN de sleutel. Zonder haar verdwijnt een
     bijgewerkte notitie binnen het venster. */
  'POST /api/staff/gemoed/zet': { velden: ['stemming', 'notitie'] },

  /* WISSEN. `op` is de dag; ontbreekt hij, dan is het vandaag, en dan hebben
     twee kale aanroepen dezelfde sleutel -- precies wat een dubbeltik is. */
  'POST /api/staff/gemoed/weg': { velden: ['op'] }
};

module.exports = { SLEUTELS };
