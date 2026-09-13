/* WELKE BRONGEBEURTENIS MAG DE PUBLIEKE RAIL OP -- en welke met opzet niet.

   DE VRAAG DIE DIT REGISTER BEANTWOORDT. STAGE.md par. 0 meet dat 5 van de 11
   publieke domeinen de wekhaak `nieuwWerk()` aanroepen en 6 niet. De verleiding
   is om die zes "aan te sluiten" en klaar te zijn. Dat zou fout zijn op een
   manier die pas maanden later opvalt: dan betekent aansluiten langzaam dat
   IEDERE databasewijziging content wordt, en dan is de publieke rail een
   feed van administratieve ruis.

   Niet elke mutatie verdient een melding. Daarom drie klassen, en de middelste
   is de belangrijkste omdat hij vandaag nergens bestaat:

     moment   PUBLIEK MOMENT. Mag Stage bereiken en mag wekken.
     stil     PUBLIEK MAAR STIL. Stage mag het tonen wanneer iemand kijkt;
              er gaat geen melding uit. Dit is geen halve `moment` maar een
              eigen besluit -- "zichtbaar" en "de moeite van een onderbreking
              waard" zijn twee verschillende vragen.
     niet     NIET PUBLIEK. Mag de publieke rail uberhaupt niet op.

   DE BRON BEPAALT DAT IETS GEBEURD IS; STAGE BEPAALT ALLEEN HOE DAT PUBLIEKE
   FEIT WORDT GEPRESENTEERD. Dit register zegt dus nooit WAT er gebeurt (dat
   weet het domein) en het bewaart geen toestand. Het zegt alleen of een
   bestaande brongebeurtenis de publieke rail op mag.

   WAAROM EEN JS-BESTAND EN GEEN JSON. Hetzelfde als bij ./metingen.js: een
   besluit zonder reden is over een half jaar niet meer na te lopen, en een
   JSON-bestand draagt geen commentaar. scripts/wekdekking.js LEEST dit en
   houdt het tegen de code; wat hier staat is het besluit, wat daar uitkomt is
   de meting. Die twee worden nooit opgeteld.

   WAT HIER NIET IN HOORT. Een gok. Een gebeurtenis waarvan je niet weet in
   welke klasse hij hoort, laat je eruit -- dan telt zijn domein mee in
   `zonderUitspraak`, en dat is precies wat die teller moet laten zien. Het
   getal hoort te dalen doordat er besluiten bijkomen, niet doordat er regels
   bijkomen. */
'use strict';

/* Elke regel draagt:
     domein      de map onder server/kern waar de bron woont
     gebeurtenis de naam zoals een mens hem zou noemen (domein.werkwoord)
     klasse      moment | stil | niet
     bron        het bestand waar die gebeurtenis ONTSTAAT -- na te trekken
     grond       waarom deze klasse, in een zin die een bestuurder kan lezen
     aanleiding  ALLEEN bij klasse `moment`: het stukje code dat de gebeurtenis
                 VEROORZAAKT, als tekst die letterlijk in `bron` moet staan.
                 scripts/wekdekking.js zoekt hem op. Een moment beloven waarvan
                 de oorzaak nergens staat, is een wachter zonder bron -- en die
                 hoort te zeggen dat hij niet kijkt (REIZEN.md). Dit veld heeft
                 meteen zijn nut bewezen: `salon.post_uitgelicht` leek het enige
                 aansluitbare moment, en toen bleek dat `featured` NERGENS wordt
                 gezet behalve in de seed. */
const BESLUITEN = [
  /* ---- kern/festival ----------------------------------------------------
     De scherpste regel van dit domein staat al in kern/festival/artiest.js en
     wordt hier niet herhaald maar GEVOLGD: een boeking die de artiest niet
     heeft bevestigd is een VOORNEMEN. CLAUDE.md verbiedt te doen alsof een
     boeking rond is, en kern/festival/gast.js houdt voornemens al uit het
     gastprogramma. Een voornemen hoort dus ook buiten Stage -- anders is Stage
     de achterdeur om de regel heen. */
  { domein: 'kern/festival', gebeurtenis: 'festival.boeking_bevestigd', klasse: 'moment',
    bron: 'server/kern/festival/artiest.js', aanleiding: 'bevestigd',
    grond: 'Een mens van de organisatie heeft vastgelegd DAT de artiest bevestigd heeft. Pas dan is er een programmapunt en geen wens.' },
  { domein: 'kern/festival', gebeurtenis: 'festival.boeking_voorgenomen', klasse: 'niet',
    bron: 'server/kern/festival/artiest.js',
    grond: 'Een voornemen is geen boeking. Wie dit publiek maakt, laat iemand een kaartje kopen voor een naam die er niet staat.' },
  { domein: 'kern/festival', gebeurtenis: 'festival.verkoop_geopend', klasse: 'moment',
    bron: 'server/kern/festival/verkoop.js', aanleiding: 'reserveer',
    grond: 'Dat de kaartverkoop opengaat is het moment waarop iemand iets KAN doen. Dat is de enige soort melding die geen verzonnen urgentie is.' },
  { domein: 'kern/festival', gebeurtenis: 'festival.changeover_gewijzigd', klasse: 'niet',
    bron: 'server/kern/festival/terrein.js',
    grond: 'Werkverkeer van de organisatie. Raakt geen bezoeker en hoort de publieke rail niet op.' },

  /* ---- kern/sportclub ---------------------------------------------------- */
  { domein: 'kern/sportclub', gebeurtenis: 'stadion.wedstrijd_gepland', klasse: 'moment',
    bron: 'server/kern/sportclub/sportief.js', aanleiding: 'wedstrijdMaak',
    grond: 'Een vastgelegde wedstrijd is een publiek feit met een datum, en de supporter kan er iets mee (komen, kaartje, reizen).' },
  { domein: 'kern/sportclub', gebeurtenis: 'stadion.uitslag_vastgelegd', klasse: 'stil',
    bron: 'server/kern/sportclub/sportief.js',
    grond: 'Publiek, en met opzet zonder melding: wie de uitslag wil weten, kijkt. Een duwbericht over een verloren wedstrijd is geen dienst.' },
  { domein: 'kern/sportclub', gebeurtenis: 'stadion.veld_afgekeurd', klasse: 'niet',
    bron: 'server/kern/sportclub/sportief.js',
    grond: 'Veldbeheer is werk van de club. Wordt er een wedstrijd door afgelast, dan is DAT de gebeurtenis en niet de veldstatus.' },

  /* ---- kern/salon --------------------------------------------------------
     Het enige van de zes met een ECHTE volgrelatie op ledensleutels
     (`volgtLid` in kern/salon/index.js, gelezen door ./profiel.js). Zie
     scripts/wekdekking.js: die relatie hangt vandaag niet aan de medialaag. */
  { domein: 'kern/salon', gebeurtenis: 'salon.post_geplaatst', klasse: 'stil',
    bron: 'server/kern/salon/index.js',
    grond: 'De Salon heeft echte volgers, maar een melding per post maakt van een gesprek een feed. Zichtbaar voor wie kijkt; geen onderbreking.' },
  { domein: 'kern/salon', gebeurtenis: 'salon.post_uitgelicht', klasse: 'moment',
    bron: 'server/kern/salonpromo.js', aanleiding: 'featured =',
    grond: 'Uitlichten is een menselijk besluit van RTG (geen algoritme), en het is zeldzaam. Precies daarom mag het wekken. LET OP: die handeling BESTAAT vandaag niet -- `featured` wordt nergens gezet behalve in de seed, terwijl salonviraal.js en CLAUDE.md allebei zeggen dat RTG cureert. De meter telt dit daarom als een moment zonder aanleiding, en dat is een gat in een bestaande merkregel en niet in Stage.' },

  /* ---- kern/creator ------------------------------------------------------
     LET OP DE NAAMVAL DIE HIER BIJNA IS GEMAAKT. `creator.volgers` is een
     GETAL over een extern platform (het bereik dat de creator zelf opgeeft),
     geen relatie met RTG-leden. Wie dat veld voor een volgerslijst aanziet,
     bedraadt een wekhaak die niemand wekt -- en dat valt niet op, want nul
     meldingen ziet er hetzelfde uit als nul volgers. */
  { domein: 'kern/creator', gebeurtenis: 'creator.kalender_gewijzigd', klasse: 'niet',
    bron: 'server/kern/creator.js',
    grond: 'De contentkalender is de werkvoorbereiding van de maker. Wat er uit die kalender KOMT verschijnt via Clips, Theater of Klankwerk, en daar hangt de haak al.' },
  { domein: 'kern/creator', gebeurtenis: 'creator.tarief_gewijzigd', klasse: 'niet',
    bron: 'server/kern/creator.js',
    grond: 'Een commercieel gegeven tussen maker en opdrachtgever. Geen publiek feit.' },

  /* ---- kern/galerij ------------------------------------------------------ */
  { domein: 'kern/galerij', gebeurtenis: 'galerij.werk_getoond', klasse: 'stil',
    bron: 'server/kern/galerij.js',
    grond: 'Publiek te zien, en er is geen volgrelatie om te wekken. Stil is hier de eerlijke klasse: de rail toont het, hij onderbreekt niemand.' },

  /* ---- kern/events -------------------------------------------------------
     GEEN PUBLIEKE GEBEURTENIS, en dat is een uitspraak en geen gat.
     kern/events/ is het DRAAIBOEK en de coach van een organisatie: wie doet wat
     wanneer achter de schermen. Het publieke gezicht van een bijeenkomst woont
     in kern/objectlaag/eventwereld.js en in de ticketrails. */
  { domein: 'kern/events', gebeurtenis: 'events.draaiboek_gewijzigd', klasse: 'niet',
    bron: 'server/kern/events/draaiboek.js',
    grond: 'Een draaiboek is intern werkverkeer. Het publieke feit is het evenement zelf, en dat woont elders.' }
];

/* De publieke domeinen waarover dit register een uitspraak MOET doen. Met opzet
   dezelfde lijst als scripts/stagevorm.js hem meet -- daar staat hij als regex
   en hier als namen, en scripts/wekdekking.js houdt ze tegen elkaar. Loopt er
   een uit elkaar, dan zakt de meting liever dan dat er stil een domein wegvalt. */
const MOETEN = ['kern/festival', 'kern/sportclub', 'kern/salon', 'kern/creator', 'kern/galerij', 'kern/events'];

module.exports = { BESLUITEN, MOETEN, KLASSEN: ['moment', 'stil', 'niet'] };
