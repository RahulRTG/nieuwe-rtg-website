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

   DE VOORDEUR IS HET INTERESSANTE GEVAL, EN HIJ STOND ER EERST FOUT IN.
   /api/bescherming/deur/start maakt een zaak aan, en daar zit de verleiding om
   `zelfdeVerzoek` op te plakken zodat een dubbeltik geen twee zaken maakt. Dat
   stond er ook, en het is teruggedraaid nadat de toets liet zien wat het kost:
   de poort speelt bij een treffer het EERDERE antwoord terug zonder de handler
   aan te roepen, en maskeerde zo een weigering die inmiddels terecht was. Zie de
   regel zelf. De les is algemener dan deze route: `zelfdeVerzoek` is geen
   dubbeltikbescherming maar een ANTWOORDHERHALING, en dat mag alleen waar het
   antwoord binnen het venster niet kan veranderen.

   TWEE ZIJN MET OPZET NIET IDEMPOTENT (de voordeur en de opvangaanvraag), en om
   verschillende redenen: bij de voordeur omdat het antwoord kan veranderen, bij
   de opvang omdat de tweede aanroep echt een tweede handeling is -- een ouder die
   twee dagdelen nodig heeft, vraagt twee keer.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- de voordeur van de beschermzaak: zonder account, zonder BSN ---- */
  'POST /api/bescherming/deur/steden': { leest: true },
  'POST /api/bescherming/deur/stand': { leest: true },
  /* DE ZAAK ZELF IS NIET IDEMPOTENT, EN DAT IS EEN GECORRIGEERD BESLUIT.

     Hier stond `{ zelfdeVerzoek: true }`, met de redenering dat vijf seconden de
     dubbeltik vangt van iemand die niet zeker weet of zijn tik aankwam. Die
     redenering klinkt goed en is hier fout, want de idempotentiepoort speelt bij
     een treffer het EERDERE ANTWOORD terug zonder de handler aan te roepen.

     test/beschermzaak.test.js liet zien wat dat kost: twee pogingen met dezelfde
     aanleiding binnen het venster, waarvan de tweede had MOETEN worden geweigerd
     omdat de stad de module inmiddels uit had. De poort gaf het eerdere "ok" en
     de weigering kwam nooit aan. Een mens zou dan een code hebben gekregen voor
     een zaak die nergens landt.

     Vrije tekst telt bovendien niet mee in de vergelijking (BUITEN_AFDRUK in
     ./idem-poort.js). Twee mensen achter dezelfde router, met dezelfde
     aanleiding en een andere toelichting, zijn voor die vergelijking hetzelfde
     verzoek -- en de tweede zou stil het antwoord van de eerste krijgen.

     De regel die in de route zelf staat, geldt dus ook hier: een geweigerde
     melding is erger dan een dubbele. Een tweede poging is een tweede poging. */
  'POST /api/bescherming/deur/start': { nietIdempotent: true,
    waarom: 'De poort zou het eerdere antwoord terugspelen zonder de handler aan te roepen, en daarmee ' +
      'een weigering maskeren die inmiddels terecht is (een stad die de module uitzette). Vrije tekst ' +
      'telt niet mee in de vergelijking, dus twee mensen achter dezelfde router met dezelfde aanleiding ' +
      'gelden als een verzoek. Een geweigerde melding is erger dan een dubbele.' },
  /* Intrekken twee keer laat dezelfde stand achter als een keer. */
  'POST /api/bescherming/deur/intrekken': { zelfdeVerzoek: true },

  /* ---- de kantoorkant van de beschermzaak ---- */
  'POST /api/rtfos/bescherming/zaken': { leest: true },
  'POST /api/rtfos/bescherming/lees': { leest: true },
  'POST /api/rtfos/bescherming/stand': { leest: true },
  /* OOK NIET IDEMPOTENT, EN OM DEZELFDE REDEN ALS DE VOORDEUR. Hier stond
     `zelfdeVerzoek`, en dat is de gevaarlijkste van de twee geweest: deze route
     MAAKT een zaak en krijgt geen id mee uit het verzoek. Twee medewerkers die
     binnen vijf seconden twee mensen aanmelden met dezelfde aanleiding, kregen
     dus EEN zaak -- de tweede mens werd stil de eerste. De toets liep er precies
     op vast (twee meldcodes op een zaak die er een hoorde te hebben).

     Daaruit volgt de regel die voor dit hele bestand geldt: een route die iets
     AANMAAKT en zijn identiteit niet uit het verzoek krijgt, mag nooit
     `zelfdeVerzoek` dragen. De routes hieronder mogen het wel: die dragen
     allemaal een `id`, dus twee verschillende zaken zijn twee verschillende
     verzoeken en alleen een echte dubbeltik valt samen. */
  'POST /api/rtfos/bescherming/open': { nietIdempotent: true,
    waarom: 'Deze route maakt een zaak en krijgt geen id uit het verzoek. Twee medewerkers die binnen ' +
      'het venster twee mensen aanmelden met dezelfde aanleiding, zouden een zaak krijgen en de tweede ' +
      'mens zou stil de eerste worden. Een dubbele zaak is te sluiten; een verdwenen mens niet.' },
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
