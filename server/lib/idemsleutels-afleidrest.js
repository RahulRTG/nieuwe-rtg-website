/* ============================================================================
   IDEM-SLEUTELS -- DE VIJF DUBBELTIKKEN UIT DE LEESRONDE VAN 13 SEPTEMBER 2026.

   Deel van ./idemsleutels.js; zie de kop daar voor de vorm en voor waarom een
   verklaring op de NAAM van een route een gok is met een net gezicht. Zelfde
   soort bestand als ./idemsleutels-kaleronde.js, en om dezelfde reden.

   WAAR ZE VANDAAN KOMEN. Bij het klasseren van de zevenenveertig routes die uit
   de afleidgang van scripts/mutatiecontract.js vielen (zie
   ./mutatiecontracten-afleidrest.js), bleven er vijf over die GEMETEN
   onbeschermd zijn. Het register zegt het met zoveel woorden:

     zonderSleutel.reden = "een woordelijk gelijke herhaling ZONDER sleutel deed
     het werk opnieuw -- dit is de dubbeltik"

   Met een idem-sleutel worden ze wel opgevangen; het gat is dus de KALE
   dubbeltik van een ongeduldige gebruiker die twee keer op dezelfde knop drukt.

   DAT IS GEEN UITZONDERING MAAR SCHULD, en het besluit van de eigenaar is om ze
   ook zo te behandelen: niet in een uitzonderingsbak als "een tweede uitvoering
   is betekenisvol" -- want dat is hier onwaar -- maar repareren. Bij alle vijf
   staat er een veld in de body dat bepaalt WAT er ontstaat, en twee identieke
   verzoeken binnen het dubbeltikvenster zijn dan een dubbeltik.

   HET VELD STAAT ER PER REGEL BIJ. Dat is geen versiering: het is waar een
   volgende lezer op moet controleren als de handler verandert.

   WAT EEN TWEEDE AANROEP VANDAAG DOET, per route gelezen -- want zonder dat is
   "dit is een dubbeltik" zelf een gok:

     leerling/overstap  l.overstappen krijgt er een regel bij. De tweede regel
                        leest "van klas X naar klas X", want de eerste heeft de
                        leerling al verplaatst. Een overstapgeschiedenis is
                        precies wat een school later nodig heeft, en een
                        verzonnen regel erin is erger dan een ontbrekende.
     leraar/klas/maak   klasCode() geeft elke aanroep een verse code, dus twee
                        keer drukken is twee klassen met dezelfde naam.
     dossier/contact    de contactgegevens worden HEEL overschreven (dus op
                        zichzelf idempotent), maar log() zet elke keer een
                        journaalregel "contact-gewijzigd". Twee regels voor een
                        wijziging die een keer gebeurde.
     zorg/zet           log() altijd, en met `doel` of `notitie` erbij een verse
                        id per aanroep: hetzelfde leerdoel twee keer in het plan.
     bekendmaking       gemeenteBekend groeit met een per aanroep -- dezelfde
                        bekendmaking twee keer gepubliceerd.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  'POST /api/foundation/school/leerling/overstap': { zelfdeVerzoek: true },   // leerlingId + naarKlas
  'POST /api/foundation/school/leraar/klas/maak': { zelfdeVerzoek: true },    // naam + fase
  'POST /api/foundation/school/dossier/contact': { zelfdeVerzoek: true },     // leerlingId + contact
  'POST /api/foundation/school/zorg/zet': { zelfdeVerzoek: true },            // leerlingId + doel/notitie
  'POST /api/gemeente/bekendmaking': { zelfdeVerzoek: true }                  // titel + tekst
};

module.exports = { SLEUTELS };
