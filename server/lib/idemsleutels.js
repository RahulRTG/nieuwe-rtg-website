/* ============================================================================
   WAT IS "HETZELFDE VERZOEK"? -- de verklaring per schrijfroute.

   HET PROBLEEM, en waarom de voor de hand liggende oplossing fout is.

   De idemproef vond 94 schrijfroutes waar een herhaling het werk gewoon nog een
   keer deed: dubbeltik op /api/concern/nieuw, twee concerns. De verleiding is om
   dat generiek op te lossen -- dedupliceer elk verzoek dat binnen een paar
   seconden identiek terugkomt van dezelfde afzender, en geen enkele route hoeft
   iets te doen.

   Dat breekt op EEN voorbeeld, en dat voorbeeld is genoeg: `{}` twee keer naar
   een dobbelworp is TWEE LEGITIEME WORPEN. Hetzelfde geldt voor elke teller en
   elke "voeg er nog een toe". Een laag die op inhoud dedupliceert slikt die
   tweede handeling stil op, en dat is erger dan het probleem dat hij oplost --
   want een dubbele boeking valt op en een verdwenen worp niet.

   Idempotentie is dus een eigenschap van de HANDELING, en die valt niet te
   raden. Ze moet verklaard worden. Dit bestand is die verklaring.

   ------------------------------------------------------------------------
   DE DRIE VORMEN

     { zelfdeVerzoek: true }
       Een woordelijk gelijk verzoek binnen het venster is een HERHALING en geen
       tweede handeling. Dit past op vrijwel elke "maak"-route: twee keer
       hetzelfde concern oprichten met dezelfde naam, binnen vijf seconden, is
       een dubbeltik. Vrije tekst telt niet mee in de vergelijking (zie
       BUITEN_AFDRUK in ./idem-poort.js): een andere notitie maakt er geen ander
       verzoek van.

     { velden: ['naam', 'datum'] }
       Fijner: alleen DEZE velden bepalen de identiteit. Voor een route waar de
       rest van de body meelift (een tijdstempel van de client, een teller) en
       twee verzoeken toch dezelfde handeling zijn.

     { leest: true }
       Een POST die niets verandert. Herhalen is per definitie veilig en er valt
       niets te dedupliceren; de poort doet hier niets. Apart van "geen
       verklaring", want dat is een gat en dit is een besluit.

     { nietIdempotent: true, waarom: '...' }
       Een herhaling is een ECHTE tweede handeling. De worp, de teller, het
       trekken van een kaart. `waarom` is verplicht: zonder reden is dit veld
       een plek om onder de verklaring uit te komen.

   ------------------------------------------------------------------------
   WAT DEZE LIJST NIET IS

   Geen dekking. Er zijn 3650 schrijfroutes en hieronder staan er een fractie
   van. Wat hier NIET in staat is niet "veilig" maar ONVERKLAARD, en dat is
   precies wat scripts/idemschuld.js telt en wat IDEMSCHULD.json vasthoudt: een
   getal dat alleen mag krimpen. Zonder die teller zou deze lijst een goed
   gevoel geven over 94 routes en zwijgen over de rest.

   EN LET OP DE VOLGORDE BIJ EEN NIEUWE ROUTE: eerst de verklaring, dan de
   route. Een schrijfroute zonder verklaring laat de keuring zakken, en dat is
   de bedoeling -- zo kan het gat niet stil weer groeien.
   ========================================================================== */
'use strict';

/* Het venster: hoe lang een woordelijk gelijk verzoek als herhaling telt.

   Vijf seconden is de maat van een dubbeltik, een haperend netwerk en een
   ongeduldige gebruiker -- niet de maat van iemand die bewust twee keer
   hetzelfde aanmaakt. Langer maken slikt echte tweede handelingen op; korter
   laat de trage retry er doorheen. Dit is bewust GEEN uur: dat is het domein
   van een expliciete Idempotency-Key, en die heeft zijn eigen venster. */
const VENSTER_MS = 5000;

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

  /* ---- geverifieerd: de body draagt de identiteit van wat er gemaakt wordt ----

     Van elk van deze routes is de handler nagelezen: er staat een veld in de
     body dat bepaalt WAT er ontstaat (een naam, een titel, een datum). Twee
     woordelijk gelijke verzoeken binnen vijf seconden zijn dan een dubbeltik en
     geen tweede bedoeling. */
  'POST /api/concern/nieuw': { zelfdeVerzoek: true },              // naam
  'POST /api/concern/entiteit/nieuw': { zelfdeVerzoek: true },     // naam + rechtsvorm
  'POST /api/gewoonten/maak': { zelfdeVerzoek: true },             // naam
  'POST /api/genootschap/richt-op': { zelfdeVerzoek: true },       // naam + soort
  'POST /api/agenda/toevoegen': { zelfdeVerzoek: true },           // titel + datum + tijd
  'POST /api/gemeente/meld': { zelfdeVerzoek: true },              // de melding zelf
  'POST /api/member/leren/project-maak': { zelfdeVerzoek: true },  // titel
  'POST /api/mall/lijst/nieuw': { zelfdeVerzoek: true },           // naam, verplicht (kern/mall/lijsten.js)
  'POST /api/mediaos/lijst/maak': { zelfdeVerzoek: true },         // naam, verplicht (kern/mediaos/lijsten.js)
  'POST /api/office/architect/maak': { zelfdeVerzoek: true },      // naam, verplicht (kern/architect/index.js)
  'POST /api/office/atelier/maak': { zelfdeVerzoek: true },        // naam, verplicht (kern/atelier/index.js)
  'POST /api/office/hardware/maak': { zelfdeVerzoek: true },       // naam, verplicht (kern/hardwarelab/index.js)
  'POST /api/office/ideeen/maak': { zelfdeVerzoek: true },         // titel, verplicht (kern/ideeen.js)

  /* ---- bewust NIET idempotent, met de reden erbij ----

     /api/muziek/maak stond hier eerst als "zelfde verzoek is een herhaling", en
     dat was fout. Hij maakt uit een LEGE body elke keer een nieuw stuk; twee
     oproepen zijn twee stukken. test/mediaos.test.js ving het meteen.

     Dat is precies de fout waar de kop van dit bestand voor waarschuwt, en ik
     liep er zelf in: de verklaring was op de NAAM van de route gebaseerd ("maak"
     klinkt als aanmaken met inhoud) en niet op de handler. Een verklaring die je
     niet hebt nagelezen, is een gok met een net gezicht. */
  'POST /api/muziek/maak': { nietIdempotent: true,
    waarom: 'maakt uit een lege body elke keer een NIEUW stuk; twee oproepen zijn twee stukken, ' +
      'en een laag die de tweede opslikt laat werk verdwijnen zonder dat iemand het merkt' },
  'POST /api/command/sonde/draai': { nietIdempotent: true,
    waarom: 'een sonde draaien is een MEETHANDELING: twee keer draaien hoort twee metingen op te leveren, ' +
      'anders meet de tweede ronde de eerste' },
  'POST /api/command/puls': { nietIdempotent: true,
    waarom: 'de puls is een momentopname; twee keer vragen hoort twee momenten te geven' },
  'POST /api/live/start': { nietIdempotent: true,
    waarom: 'een tweede start is een nieuwe uitzending, niet dezelfde nog eens' },

  /* Dezelfde toets als hierboven, andere uitkomst: bij deze vier staat er GEEN
     verplicht veld in de body dat bepaalt wat er ontstaat. Wie zonder inhoud
     een tweede maakt, krijgt met recht een tweede -- en een laag die dat
     opslikt, laat werk verdwijnen. */
  'POST /api/office/kantoorpakket/maak': { nietIdempotent: true,
    waarom: 'de titel is optioneel en valt terug op "Nieuw document"; twee lege oproepen zijn ' +
      'twee verse documenten, niet dezelfde nog eens (kern/office/docs.js)' },
  'POST /api/meet/maak': { nietIdempotent: true,
    waarom: 'zonder agendaId ontstaat er elke keer een verse kamer met een eigen toegangscode; ' +
      'MET agendaId dedupliceert de route zelf al (kern/meet.js geeft dan bestond:true terug), ' +
      'dus er valt hier niets te winnen en wel iets te verliezen' },
  'POST /api/concern/opname/maak': { nietIdempotent: true,
    waarom: 'een opname is een momentopname van het concern; twee keer vragen hoort met recht ' +
      'twee momenten op te leveren, anders is de tweede opname stil de eerste' },

  /* ---- routes die niets veranderen ----

     Een POST die alleen leest. Herhalen is per definitie veilig, en er valt
     niets te dedupliceren: de poort doet hier dan ook niets. Ze staan hier
     omdat "geen verklaring" en "verklaard als leesroute" twee verschillende
     dingen zijn, en de schuldteller dat verschil hoort te zien. */
  'POST /api/office/anker': { leest: true },
  'POST /api/office/anker/reken': { leest: true },
  'POST /api/office/handelingen': { leest: true }
};

function sleutelVoor(methode, pad) {
  return SLEUTELS[String(methode || '').toUpperCase() + ' ' + String(pad || '')] || null;
}

/* De verklaring nakijken bij het laden: een `nietIdempotent` zonder reden is
   geen verklaring maar een ontsnapping, en een lege veldenlijst zegt niets. */
for (const [sleutel, v] of Object.entries(SLEUTELS)) {
  if (v.nietIdempotent && !v.waarom)
    throw new Error('idemsleutels: "' + sleutel + '" is nietIdempotent zonder waarom');
  if (v.velden && (!Array.isArray(v.velden) || !v.velden.length))
    throw new Error('idemsleutels: "' + sleutel + '" heeft een lege veldenlijst');
  if (!v.nietIdempotent && !v.zelfdeVerzoek && !v.velden && !v.leest)
    throw new Error('idemsleutels: "' + sleutel + '" verklaart niets');
}

module.exports = { SLEUTELS, sleutelVoor, VENSTER_MS };
