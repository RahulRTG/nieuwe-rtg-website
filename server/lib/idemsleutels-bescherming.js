/* ============================================================================
   WAT IS "HETZELFDE VERZOEK" -- de beschermlaag, de knelpuntmotor, de
   ouderingang en de bewijsmap.

   Zelfde register als ./idemsleutels.js, eigen bestand; zie de kop daar voor de
   vier vormen en waarom idempotentie verklaard moet worden in plaats van
   geraden. Twintig routes, en ze zijn met opzet niet alle twintig hetzelfde --
   die verschillen zijn de hele inhoud van dit bestand.

   DE MEESTE LEZEN. Elf van de twintig veranderen niets: een lijst opvragen, een
   stand opvragen, een dossier lezen. `{ leest: true }` is daarvoor een BESLUIT
   en niet hetzelfde als geen verklaring -- dat laatste is een gat, dit is
   iemand die heeft gekeken.

   DE VOORDEUR IS HET INTERESSANTE GEVAL. /api/bescherming/deur/start maakt een
   zaak aan, en dat is precies waar de verleiding zit om `zelfdeVerzoek` op te
   plakken zodat een dubbeltik geen twee zaken maakt. Dat is hier ook zo, en
   toch met een kanttekening die in de route zelf staat: een geweigerde melding
   is erger dan een dubbele. Het venster van vijf seconden vangt de dubbeltik;
   wie na een minuut opnieuw begint omdat hij denkt dat het niet werkte, hoort
   een tweede zaak te krijgen en geen stilte.

   TWEE ZIJN MET OPZET NIET IDEMPOTENT, en allebei om dezelfde reden: de tweede
   aanroep IS een tweede handeling en het samenvoegen zou er stil een weggooien.
   Een ouder die twee dagdelen nodig heeft vraagt twee keer; een hulpverlener die
   een tweede stap in een dossier zet, zet een tweede stap.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- de voordeur van de beschermzaak: zonder account, zonder BSN ---- */
  'POST /api/bescherming/deur/steden': { leest: true },
  'POST /api/bescherming/deur/stand': { leest: true },
  /* De zaak zelf. Vijf seconden vangt de dubbeltik van een mens die niet zeker
     weet of zijn tik aankwam; alles daarbuiten is een nieuwe poging en die hoort
     te lukken. Vrije tekst telt niet mee in de vergelijking (BUITEN_AFDRUK in
     ./idem-poort.js), dus een andere aanleidingstekst maakt er geen ander
     verzoek van -- en dat is hier goed: het gaat om dezelfde mens in dezelfde
     minuut. */
  'POST /api/bescherming/deur/start': { zelfdeVerzoek: true },
  /* Intrekken twee keer laat dezelfde stand achter als een keer. */
  'POST /api/bescherming/deur/intrekken': { zelfdeVerzoek: true },

  /* ---- de kantoorkant van de beschermzaak ---- */
  'POST /api/rtfos/bescherming/zaken': { leest: true },
  'POST /api/rtfos/bescherming/lees': { leest: true },
  'POST /api/rtfos/bescherming/stand': { leest: true },
  /* Een zaak openen is een handeling met een auditregel; twee keer openen binnen
     het venster is een dubbeltik en geen tweede inzage. */
  'POST /api/rtfos/bescherming/open': { zelfdeVerzoek: true },
  'POST /api/rtfos/bescherming/veiligheid': { zelfdeVerzoek: true },
  'POST /api/rtfos/bescherming/toestemming': { zelfdeVerzoek: true },
  'POST /api/rtfos/bescherming/toestemming-weg': { zelfdeVerzoek: true },
  'POST /api/rtfos/bescherming/overdracht': { zelfdeVerzoek: true },
  'POST /api/rtfos/bescherming/sluit': { zelfdeVerzoek: true },
  /* De brug naar de meldcode maakt een MELDCODEDOSSIER aan uit een zaak. Twee
     keer dezelfde zaak overzetten binnen het venster is een dubbeltik; daarbuiten
     is het een tweede dossier, en dat hoort te kunnen -- een zaak kan later
     opnieuw langs de meldcode gaan. */
  'POST /api/rtfos/bescherming/meldcode': { zelfdeVerzoek: true },

  /* ---- de knelpuntmotor: rekent, bewaart niets ---- */
  'POST /api/knelpunt': { leest: true },

  /* ---- de ouderingang op de kinderopvang ---- */
  'POST /api/opvang': { leest: true },
  'POST /api/opvang/mijn': { leest: true },
  /* NIET IDEMPOTENT, EN DAT IS DE BEDOELING. Een ouder die twee dagdelen nodig
     heeft, of een tweede kind heeft, zet twee aanvragen klaar met dezelfde datum
     en hetzelfde tijdvak. Wie die twee samenvoegt tot een, gooit er stil een weg
     en noemt dat een verbetering. De aanvraag heeft bovendien geen enkel gevolg
     tot een mens bij de opvang hem bevestigt, dus een dubbele kost niemand iets
     behalve een regel die de opvang zelf kan wegzetten. */
  'POST /api/opvang/vraag': { nietIdempotent: true,
    waarom: 'Twee keer aanvragen is twee aanvragen: een tweede dagdeel of een tweede kind valt samen ' +
      'op datum en tijdvak. Samenvoegen laat een aanvraag verdwijnen zonder het te zeggen, en de ' +
      'aanvraag doet niets tot een mens bij de opvang hem bevestigt.' },
  /* Intrekken twee keer laat dezelfde stand achter; de tweede keer is de
     aanvraag er niet meer en het antwoord is een 404. */
  'POST /api/opvang/weg': { zelfdeVerzoek: true },

  /* ---- de bewijsmap ---- */
  'POST /api/rtgid/bewijzen': { leest: true }
};

module.exports = { SLEUTELS };
