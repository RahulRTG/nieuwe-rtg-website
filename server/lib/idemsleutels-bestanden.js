/* HET IDEM-REGISTER, deel "bestanden" -- de kluis van het lid
   (routes/bestanden.js, kern/bestanden.js).

   GEVONDEN DOOR DE TESTWERELD (18 oktober 2026). De voltooiproef van Wonen
   (scripts/lib/voltooi/wonen.js) tikte twee keer tegelijk op "document
   toevoegen" aan het woningdossier en kreeg twee documenten met dezelfde naam
   en dezelfde inhoud. Geen van deze routes had een verklaring, dus de
   idem-poort liet ze allebei door. Elke regel hieronder is op de handler in
   kern/bestanden.js nagelezen.

   zelfdeVerzoek: een map of een bestand met woordelijk dezelfde naam en
   dezelfde inhoud binnen het venster is een dubbeltik; wijzigen, weghalen en
   herstellen op id zijn de tweede keer al gebeurd. De stuksgewijze upload
   (upstart/updeel/upklaar) staat er met opzet NIET in: elk stuk draagt zijn
   eigen volgnummer en de afronding is per uploadId een eenmalige handeling die
   de kern zelf bewaakt; /actie en /wis staan al in ./idemsleutels-document.js. */
'use strict';

const zelfde = { zelfdeVerzoek: true };
const SLEUTELS = {};
for (const pad of ['map', 'upload', 'wijzig', 'weg', 'herstel']) SLEUTELS['POST /api/bestanden/' + pad] = zelfde;

module.exports = { SLEUTELS };
