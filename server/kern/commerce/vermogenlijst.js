/* ============================================================================
   DE LIJST VAN VERMOGENS -- de acht, en wat er met opzet niet bestaat.

   Pure data. De logica die hem gebruikt (verklaren, aftrekken, uitleggen) staat
   in ./vermogens.js; dezelfde tweedeling als kern/persoonseis.js met zijn
   -lijst.js, en om dezelfde reden: een tabel die je zonder de motor kunt lezen,
   is een tabel die een toets kan voeren met wat hij zelf verzint.

   DIT IS GEEN INTERFACE. Het voorstel voor deze laag zette acht werkwoorden
   achter een Koopbaar-protocol dat elk verkoopbaar ding zou implementeren.
   scripts/commerce.js heeft gemeten of dat protocol in deze code bestaat, en
   het antwoord staat in COMMERCE.json: van de 99 domeinen met een koopbare
   vorm voert er GEEN ENKELE alle acht werkwoorden uit, GEEN ENKEL werkwoord
   staat in alle domeinen, en er zijn 42 verschillende combinaties. Een
   interface van acht verplichte methodes zou 84 lege `lever` en 93 lege
   `retour` opleveren -- of erger, implementaties die doen alsof.

   Dus draait het om: een koopbaar VERKLAART welke vermogens hij heeft, en de
   afrekening past zich aan. Dat is dezelfde vorm als het enige contract dat dit
   huis al had -- kern/appstore/machtigingen.js, waar een machtiging zegt wat ze
   GEEFT en wat ze NOOIT geeft -- en met dezelfde reden: een gesloten lijst is te
   vergelijken, te doorzoeken en te diffen, en vrije tekst levert "om u beter van
   dienst te zijn" op.

   WAT `nooit` HIER DOET. Het is geen slag om de arm maar de grens die de
   afrekening afdwingt. Staat er bij `prijs` dat hij nooit uit de browser komt,
   dan is dat precies wat kern/commerce/afrekening.js controleert. Een regel hier
   die nergens wordt afgedwongen, laat test/commerce-vermogens.test.js zakken.

   `vereist` IS DE ENIGE AFHANKELIJKHEID DIE ER IS, en hij is TEGEN DE METING
   GEHOUDEN in plaats van bedacht. Dat was nodig ook: de eerste opzet liet
   `bevestig` afhangen van `prijs` -- "je bevestigt geen bedrag dat niemand heeft
   berekend" -- en dat klonk sluitend. COMMERCE.json zegt iets anders: er zijn
   25 domeinen die bevestigen ZONDER prijs. Dat is geen uitzondering maar een
   kwart van alles wat hier verkoopt, en het is ook gewoon waar: een tafel, een
   bezichtiging en een afspraak worden bevestigd zonder dat er geld aan te pas
   komt. Die afhankelijkheid is eruit.

   De vier die overblijven zijn ook tegengesproken, maar door 2 tot 5 domeinen in
   plaats van 25, en bij elk is na te gaan waarom:

     reserveer -> beschikbaarheid   5 tegenvoorbeelden, en ze gaan alle vijf over
       GELD dat wordt vastgehouden (kern/directpay, kern/geldbeleid) en niet over
       een ding dat op naam komt. Dat is de naamsbotsing waar de kop van
       scripts/commerce.js voor waarschuwt: een gedeelde NAAM is geen gedeelde
       BETEKENIS. Zie ook kern/waarde/reserve.js, waar een reservering iets
       anders is dan hier.
     lever/annuleer/retour -> bevestig   2 tot 4 tegenvoorbeelden, en het zijn
       stuk voor stuk de KOERIER- of GEZAGSKANT: kern/modebezorg bezorgt en neemt
       retour voor bestellingen die in kern/retail zijn bevestigd. Per DOMEIN
       klopt het tegenvoorbeeld dus, per KOOPBAAR niet -- en dit is een
       eigenschap van een koopbaar. Je stuurt niets terug wat nooit is gekocht.

   Meer dwang dan deze vier zou de 42 gemeten combinaties terugbrengen tot de ene
   combinatie die niemand heeft, en dan is dit alsnog een interface.

   WAT HIER DUS NIET STAAT: dat een PRODUCT zonder prijs niet te kopen is. Dat is
   waar, maar het is een regel van het TYPE (aanbodvorm.js belooft "Kopen") en
   niet van het vermogen. Hij wordt afgedwongen in ./koopbaar.js, waar de belofte
   van het type langs de rij gaat.
   ========================================================================== */
'use strict';

const V = (id, label, wat, nooit, vereist) => ({ id, label, wat, nooit, vereist: vereist || [] });

/* De acht. De volgorde is die van een koop en niet die van het alfabet: zo
   leest een vermogenlijst als een verhaal en zie je meteen waar hij ophoudt. */
const VERMOGENS = [
  V('toon',
    'Te zien',
    'dit ding heeft een titel, een aanbieder en een plek waar je het bekijkt',
    'een prijs suggereren die er niet is, of een voorraad tonen die niemand heeft gemeten'),
  V('prijs',
    'Kost iets',
    'een bedrag in centen dat de server uitrekent, met de btw uit kern/fiscaal/tarief.js',
    'een bedrag geloven dat uit de browser komt, of een tarief raden bij een onbekend land'),
  V('beschikbaarheid',
    'Is er wel of niet',
    'een gemeten stand: voorraad, een vrij tijdslot, of een open zaak',
    'stilte uitleggen als beschikbaar -- een bron die niets zegt, weet niets'),
  V('reserveer',
    'Kan vastgehouden worden',
    'het ding staat een afgesproken tijd op naam van deze koper en vervalt daarna',
    'onbeperkt vasthouden; een reservering zonder vervaltijd is een verkoop zonder betaling',
    ['beschikbaarheid']),
  V('bevestig',
    'Kan vastgelegd worden',
    'er ontstaat een afspraak tussen deze koper en deze verkoper, met of zonder bedrag',
    'bevestigen namens een verkoper die zelf niets heeft bevestigd'),
  V('lever',
    'Komt ergens aan',
    'bezorgen, afhalen, digitaal uitgeven of uitvoeren op een tijdstip',
    'geleverd melden zonder dat iemand dat heeft vastgesteld',
    ['bevestig']),
  V('annuleer',
    'Kan afgezegd worden',
    'de afspraak vervalt, en wat er is gereserveerd komt vrij',
    'annuleren nadat er is geleverd -- dat is een retour en niet een annulering',
    ['bevestig']),
  V('retour',
    'Kan terug',
    'er ontstaat een RECHT op teruggave; een mens van de verkoper handelt het af',
    'zelf geld terugsturen. Geld verlaat het huis nooit vanzelf (GELD.md par. 3)',
    ['bevestig'])
];

/* WAT EEN KOOPBAAR NIET KAN VERKLAREN, met de reden. Net als NIET_GEBOUWD in
   kern/appstore/machtigingen.js is dit geen wensenlijst maar het antwoord dat
   een domein krijgt wanneer het zoiets toch aanmeldt -- zodat niemand hoeft te
   raden waarom het niet werd overgenomen. Een regel verdwijnt hier pas als de
   laag hem werkelijk uitvoert. */
const NIET_GEBOUWD = {
  ruil: 'Ruilen is een retour en een nieuwe koop in een handeling, en die twee hebben verschillende bewijsmomenten. Zolang er geen retourstroom met inspectie is, zou "ruilen" een teruggave beloven op een ding dat nog niet terug is.',
  abonnement: 'Een terugkerende afschrijving is een doorlopende machtiging op andermans rekening. Dat is een bevoegdheidsvraag (kern/bevoegdheid/lijst.js) en geen veld op een koopbaar.',
  veiling: 'Een biedproces heeft een eigen tijdlijn, een eigen onherroepelijkheid en een eigen toezicht. kern/markt kent het bieden al; het opnieuw declareren zou een tweede waarheid maken (LAT-regel 4).',
  levering_derden: 'Een externe vervoerder melden als geleverd zou een bewering van buiten als gemeten stand opvoeren. Zie kern/mall/extern.js: een melding is vers of hij telt niet.'
};

module.exports = { VERMOGENS, NIET_GEBOUWD };
