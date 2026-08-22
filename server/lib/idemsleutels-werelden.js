/* HET IDEM-REGISTER, deel "werelden" -- zelfde register, eigen bestand.

   Afgesplitst uit ./idemsleutels.js op de 10 kB-grens, en op een echte naad:
   hiernaast staan DE REGELS (de drie vormen, het venster, wat dit register wel
   en niet is) plus de verklaringen uit de idemproef-ronde; hier staan de
   verklaringen van de wereld-routes die met de samenvoegronde van 18 augustus
   2026 binnenkwamen -- de contactpin, het reisbureau, het vakbewijs, de
   instellingen en de onboarding. Ze veranderen met hun wereld mee, niet met de
   regels.

   Het blijft EEN register: ./idemsleutels.js voegt dit deel samen met zijn
   eigen lijst voor er ook maar iets opzoekbaar is. Twee losse Maps met elk een
   eigen opzoekweg zouden precies de tweede waarheid zijn die dit register moet
   voorkomen. Lees de kop hiernaast voor de vormen; elke regel hieronder is op
   de HANDLER nagelezen, niet op de naam van de route. */
'use strict';

const SLEUTELS = {
  /* ---- de samenvoegronde van 18 augustus 2026 ----

     Negen PR-takken kwamen samen; vijf daarvan brachten routes mee uit de tijd
     dat deze lijst nog niet bestond, en de schuldteller wees ze allemaal aan.
     Elke verklaring hieronder is op de HANDLER nagelezen, niet op de naam van
     de route -- de les van /api/muziek/maak hierboven.

     De leest-groep is hier groot, en dat is geen gemakzucht: dit huis doet ook
     leesverzoeken met POST, en een lijst of een kaart opvragen verandert niets. */

  // -- de contactpin (leden- en gezinskant delen dezelfde kern, kern/sociaal/pin*) --
  'POST /api/member/pin': { leest: true },                       // de eigen pinkaart
  'POST /api/member/pin/zoek': { leest: true },                  // kijken wie erachter zit; het verzoek komt later
  'POST /api/member/pin/live/kijk': { leest: true },             // idem, voor een gescande livecode
  'POST /api/member/pin/uit': { zelfdeVerzoek: true },           // aan/uit met de stand in de body: herhalen zet dezelfde stand
  'POST /api/member/pin/connect': { zelfdeVerzoek: true },       // vriendverzoek op een pin: dubbeltik is een herhaling
  'POST /api/member/pin/live/verbind': { zelfdeVerzoek: true },  // idem, via de livecode
  'POST /api/member/pin/nieuw': { nietIdempotent: true,
    waarom: 'vernieuwen IS het intrekken van het oude adres: elke aanroep een nieuwe pin, en wie de vorige had kan er niets meer mee. Twee aanroepen zijn twee intrekkingen' },
  'POST /api/member/pin/live': { nietIdempotent: true,
    waarom: 'elke aanroep munt een nieuwe kortlevende code met een eigen vervaltijd; de herhaling is een nieuwe code en geen herlevering van de oude' },
  'POST /api/rtf/social/pin': { leest: true },
  'POST /api/rtf/social/pin/zoek': { leest: true },
  'POST /api/rtf/social/pin/live/kijk': { leest: true },
  'POST /api/rtf/social/pin/uit': { zelfdeVerzoek: true },
  'POST /api/rtf/social/pin/connect': { zelfdeVerzoek: true },
  'POST /api/rtf/social/pin/live/verbind': { zelfdeVerzoek: true },
  'POST /api/rtf/social/pin/nieuw': { nietIdempotent: true,
    waarom: 'zelfde kern als /api/member/pin/nieuw: elke aanroep trekt het oude adres in' },
  'POST /api/rtf/social/pin/live': { nietIdempotent: true,
    waarom: 'zelfde kern als /api/member/pin/live: elke aanroep een nieuwe kortlevende code' },

  // -- het reisbureau, de reisbalie en de reisuitnodiging --
  'POST /api/office/reisaanbod': { leest: true },                // de kantoorlijst van het aanbod
  'POST /api/office/reisaanbod/zet': { zelfdeVerzoek: true },    // een reis neerzetten; de body draagt wat er ontstaat
  'POST /api/office/reisaanbod/weg': { zelfdeVerzoek: true },    // weghalen op id; de tweede keer is hij al weg
  'POST /api/office/reisbureau/besluit': { zelfdeVerzoek: true },   // een tweede besluit kaatst af op 409 (kern/reisbureau-besluit.js)
  'POST /api/office/reisbureau/bevestig': { zelfdeVerzoek: true },  // idem, langs de losse ingang
  'POST /api/office/reisbureau/afwijzen': { zelfdeVerzoek: true },  // idem
  'POST /api/office/reisbureau/lees': { leest: true },           // voorlezen bewaart niets (zie kern/reisuitnodiging.js)
  'POST /api/office/reisbureau/klaarzetten': { zelfdeVerzoek: true }, // de klaargezette reis; dubbeltik is een herhaling
  'POST /api/office/reisbureau/uitnodigingen': { leest: true },
  'POST /api/office/reisbureau/uitnodiging-weg': { zelfdeVerzoek: true }, // intrekken op id
  'POST /api/reis/reizen': { leest: true },                      // mijn reizen
  'POST /api/reis/wacht': { leest: true },                       // de reiswacht zegt zelf: alleen lezen, een momentopname
  'POST /api/reis/los': { leest: true },                         // de oplosser LEEST en stelt voor; uitvoeren is /los/doe
  'POST /api/reis/los/doe': { zelfdeVerzoek: true },             // voert een servervoorstel uit; dat voorstel is eenmalig
  'POST /api/reis/invoer/mijn': { leest: true },
  'POST /api/reis/invoer/lees': { zelfdeVerzoek: true },         // GEEN leest: het origineel wordt als bestand weggelegd (kern/invoer.js)
  'POST /api/reis/invoer/bevestig': { zelfdeVerzoek: true },     // bevestigen op id
  'POST /api/reis/invoer/weg': { zelfdeVerzoek: true },          // weghalen op id
  'POST /api/reis/uitnodiging/open': { leest: true },            // kijken wat er klaarstaat; bewaart niets
  'POST /api/reis/uitnodiging/mijn': { leest: true },
  'POST /api/reis/uitnodiging/nodig-uit': { zelfdeVerzoek: true }, // de onderdelen in de body bepalen wat er ontstaat
  'POST /api/reis/uitnodiging/eisop': { zelfdeVerzoek: true },   // opeisen op code; een gebruikte code is op
  'POST /api/reis/uitnodiging/weg': { zelfdeVerzoek: true },     // intrekken op id

  // -- het vakbewijs en de persoonseis --
  'POST /api/vakbewijs': { leest: true },                        // de eigen stukkenlijst
  'POST /api/vakbewijs/zet': { zelfdeVerzoek: true },            // een stuk indienen; soort komt uit een register
  'POST /api/office/vakbewijzen': { leest: true },               // de open stapel van het kantoor
  'POST /api/office/vakbewijs/teken': { zelfdeVerzoek: true },   // aftekenen; de tweede keer is hij al afgetekend
  'POST /api/office/vakbewijs/intrek': { zelfdeVerzoek: true },  // idem, de andere kant op
  'POST /api/office/vakbewijs/nummer': { zelfdeVerzoek: true },  // inzage met verplichte reden; dubbeltik hoort geen tweede journaalregel te maken
  'POST /api/supplier/persoonseis': { leest: true },             // welke eisen gelden hier, en wie voldoet

  // -- aanmelding, instellingen en de catalogus-wens --
  'POST /api/aanmelding/bewijs/herkeuring': { leest: true },     // de herkeuringslijst: wat verloopt er binnen N dagen
  'POST /api/inzagekaart': { leest: true },                      // de AVG-inzagekaart van het eigen dossier
  'POST /api/office/instellingen': { leest: true },
  'POST /api/office/instelling/genres': { leest: true },
  'POST /api/office/instelling/aansluiten': { zelfdeVerzoek: true }, // een instelling aansluiten; naam+genre in de body
  'POST /api/office/catalogus-wensen': { leest: true },
  'POST /api/office/catalogus-wens/besluit': { zelfdeVerzoek: true },

  // -- onboarding, activiteiten en de rest van de ronde --
  'POST /api/onboarding/inrichten': { leest: true },             // de stand van het inrichten
  'POST /api/onboarding/meebouwen': { leest: true },             // de stand van het meebouwen
  'POST /api/onboarding/inricht': { zelfdeVerzoek: true },       // velden zetten; herhalen zet dezelfde velden
  'POST /api/onboarding/bedrijf': { zelfdeVerzoek: true },       // het bedrijf uit de wizard; de body draagt wat er ontstaat
  'POST /api/onboarding/salonpost': { zelfdeVerzoek: true },     // het eerste Salon-bericht; dubbeltik is een herhaling
  'POST /api/supplier/activiteit/open': { zelfdeVerzoek: true },  // een dag openzetten; herhalen zet dezelfde dag open
  'POST /api/supplier/activiteit/sluit': { zelfdeVerzoek: true }, // en dichtzetten
  'POST /api/theater/ondertitels': { zelfdeVerzoek: true },      // de regels voor dit stuk vervangen; herhalen zet hetzelfde vel
  'POST /api/rtgid/stapop/opties': { nietIdempotent: true,
    waarom: 'elke aanroep munt een nieuwe WebAuthn-uitdaging; de herhaling hoort een nieuwe uitdaging te geven en niet de oude terug' },
};

module.exports = { SLEUTELS };
