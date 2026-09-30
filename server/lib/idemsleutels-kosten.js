/* ============================================================================
   WAT IS "HETZELFDE VERZOEK" IN DE KOSTPRIJSLAAG (KOSTEN.md, ECONOMIE.md).

   Apart bestand omdat ./idemsleutels.js tegen de omvangsgrens aan zit; de vorm
   en de drie verklaringen staan daar uitgelegd en gelden hier onverkort.

   TWEE DERDE VAN DEZE LAAG LEEST ALLEEN. Dat is geen toeval maar de opzet: de
   meter houdt tellers en een MENS boekt (KOSTEN.md par. 6). Alles wat een bord
   vult -- het overzicht, de herkomstketen, de vooruitblik, het notaoverzicht --
   verandert niets en is per definitie veilig te herhalen. Ze staan hier als
   `leest` en niet als "geen verklaring", want dat eerste is een besluit en het
   tweede een gat.

   DE SCHRIJVERS ZIJN ALLEMAAL ZETTERS EN GEEN OPTELLERS. Een nota, een tarief,
   een beleidstand, een grens, een relatie: tweemaal dezelfde waarde zetten is
   dezelfde eindstand. huisrekening.js zegt het met zoveel woorden -- "een
   stroomnota wordt gecorrigeerd, niet opgeteld". Daarom `zelfdeVerzoek` en
   nergens `nietIdempotent`: er zit in deze laag geen enkele teller die je met
   een dubbeltik een tik verder zet.

   DRIE HANDELINGEN DRAGEN HUN EIGEN SLOT, en dat is sterker dan dit venster:
   vrijgeven weigert een tweede keer met 409 (de maand is dan al vrijgegeven),
   en periode/sluit en periode/heropen kunnen alleen vanuit de andere stand. Ze
   staan hier toch, want een verklaring hoort er te staan ook als de route
   zichzelf al beschermt -- anders leest de afwezigheid als een gat.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- lezen: een POST die niets verandert ---- */
  'POST /api/kosten/mij': { leest: true },
  'POST /api/kosten/grens': { leest: true },
  'POST /api/kosten/herkomst': { leest: true },
  'POST /api/kosten/vooruitblik': { leest: true },
  'POST /api/foundation/kosten': { leest: true },
  'POST /api/supplier/kosten': { leest: true },
  'POST /api/supplier/kosten/herkomst': { leest: true },
  'POST /api/supplier/kosten/vooruitblik': { leest: true },
  'POST /api/office/kosten/overzicht': { leest: true },
  'POST /api/office/kosten/gebruiker': { leest: true },
  'POST /api/office/kosten/herkomst': { leest: true },
  'POST /api/office/kosten/vooruitblik': { leest: true },
  'POST /api/office/kosten/tarieven': { leest: true },
  'POST /api/office/kosten/nota': { leest: true },
  'POST /api/office/kosten/beleid': { leest: true },
  'POST /api/office/kosten/periode': { leest: true },
  'POST /api/office/kosten/voorstel': { leest: true },
  'POST /api/office/kosten/leveranciersfacturen': { leest: true },
  'POST /api/office/economie/werelden': { leest: true },
  'POST /api/office/economie/journaal': { leest: true },
  /* De proef rekent een doorbelasting DOOR zonder hem te doen -- dat is de hele
     bedoeling van een firewallproef, en dus leest hij. */
  'POST /api/office/economie/proef': { leest: true },
  /* De bedrijfsmaten (AUTONOMIE.md): een stand uitrekenen verandert niets. */
  'POST /api/office/bedrijfsmaat': { leest: true },
  /* Het banksaldo van RTG (besluit C4): lezen leest; zetten met hetzelfde saldo van
     hetzelfde afschrift is een keer (kern/bankpositie.js geeft ongewijzigd terug). */
  'POST /api/office/bankpositie': { leest: true },
  'POST /api/office/rtgboek': { leest: true },                               // het boek van RTG lezen (C8)
  'POST /api/office/rtgcampagne': { leest: true },                           // het campagneregister lezen (C12)
  'POST /api/office/aanmeldkanaal': { leest: true },                          // een telling lezen (C6)
  /* Het streefbeeld (C7): lezen leest; tekenen gaat over een vingerafdruk en
     intrekken is een stand, dus een tweede gelijke oproep is dezelfde. */
  'POST /api/office/streefbeeld': { leest: true },
  'POST /api/office/streefbeeld/teken': { zelfdeVerzoek: true },
  'POST /api/office/streefbeeld/intrek': { zelfdeVerzoek: true },
  /* Het beslisgeheugen (C13): hetzelfde besluit nog eens is hetzelfde besluit;
     intrekken een tweede keer verandert niets. */
  'POST /api/office/beslisgeheugen': { leest: true },
  'POST /api/office/beslisgeheugen/leg': { zelfdeVerzoek: true },
  'POST /api/office/beslisgeheugen/intrek': { zelfdeVerzoek: true },
  /* De cadeaubon (C14): lezen leest. De stand zetten volgt de terugstortstand
     (idemsleutels-geld.js): dicht, open, weer dicht binnen het venster zijn drie
     bewuste zetten over de e-geldpositie, en de derde mag niet als herhaling van de
     eerste verdwijnen. Dezelfde stand nog eens vangt de kern zelf (ongewijzigd). */
  'POST /api/office/cadeaubon': { leest: true },
  'POST /api/office/cadeaubon/stand': { nietIdempotent: true,
    waarom: 'een herhaalde zet is een bewuste zet over de e-geldpositie: terugzetten binnen het venster zou stil verdwijnen, samen met de auditregel' },
  'POST /api/office/bankpositie/zet': { zelfdeVerzoek: true },             // maand + saldo + afschrift
  'POST /api/office/rtgboek/zet': { zelfdeVerzoek: true },                  // maand + post + bedrag + bron
  'POST /api/office/rtgboek/campagne': { zelfdeVerzoek: true },             // maand + campagne + bedrag + bron (C12)
  'POST /api/office/rtgcampagne/maak': { zelfdeVerzoek: true },             // dezelfde campagne nog eens: ongewijzigd (C12)
  /* Naar gast (besluit C5, server/routes/naargast.js): de standcontrole weet het al. */
  'POST /api/office/pas/gast/regels': { leest: true },
  'POST /api/office/pas/gast/regels/zet': { zelfdeVerzoek: true },          // regel + aan + getal
  /* Het kantoorstuur (besluit C2): het model mag alleen de drie tonen-paden
     lezen, maar een tweede vraag is een tweede gesprek met een nieuw antwoord. */
  'POST /api/office/doe': { nietIdempotent: true,
    waarom: 'elke vraag aan Rahul is een nieuw gesprek met een nieuw antwoord; er verandert niets in ' +
      'de opslag (alleen tonen-paden), maar een laag die de tweede vraag opslikt geeft een oud antwoord' },
  'POST /api/office/doe/kaart': { leest: true },

  /* ---- zetten: dezelfde waarde tweemaal is dezelfde eindstand ---- */
  'POST /api/kosten/grens/zet': { zelfdeVerzoek: true },                    // het eigen plafond
  'POST /api/office/kosten/grens/zet': { zelfdeVerzoek: true },             // het plafond van een ander
  'POST /api/office/kosten/tarief/zet': { zelfdeVerzoek: true },            // soort + prijs per eenheid
  'POST /api/office/kosten/nota/zet': { zelfdeVerzoek: true },              // maand + soort + bedrag
  'POST /api/office/kosten/beleid/zet': { zelfdeVerzoek: true },            // pas + stand
  'POST /api/office/kosten/leveranciersfactuur/zet': { zelfdeVerzoek: true }, // factuurnummer + bedrag
  'POST /api/office/kosten/periode/verklaar': { zelfdeVerzoek: true },      // maand + soort + verklaring
  'POST /api/office/economie/relatie/zet': { zelfdeVerzoek: true },         // van + naar + grondslag
  'POST /api/office/economie/relatie/weg': { zelfdeVerzoek: true },         // van + naar
  /* Peilen overschrijft de staande meterstand met een verse; twee peilingen
     achter elkaar leveren dezelfde stand op en geen tweede meting. */
  'POST /api/office/kosten/peil': { zelfdeVerzoek: true },

  /* ---- met een eigen slot, en toch verklaard ---- */
  'POST /api/office/kosten/vrijgeven': { zelfdeVerzoek: true },      // tweede keer: 409
  'POST /api/office/kosten/periode/sluit': { zelfdeVerzoek: true },  // kan alleen vanuit open
  'POST /api/office/kosten/periode/heropen': { zelfdeVerzoek: true } // kan alleen vanuit dicht
};

module.exports = { SLEUTELS };
