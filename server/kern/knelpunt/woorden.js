/* ============================================================================
   DE ZINNEN VAN DE KNELPUNTMOTOR -- wat hij zegt, los van wat hij uitrekent.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js was op 14 september 2026 over de
   bandbreedte van keuringsregel 13 gegaan, en het antwoord daarop is niet
   commentaar wegschaven maar de naad zoeken die er toch al lag. Die naad is
   deze: de motor REDENEERT (welke voorwaarde ontbreekt, welke weg is daardoor
   geblokkeerd) en hij SPREEKT (de zin die een mens leest). Dat zijn twee
   dingen, en ze veranderen om verschillende redenen -- een zin wordt bijgesteld
   omdat hij verkeerd gelezen werd, een regel omdat de logica niet klopte.

   Hetzelfde patroon als ./openingen-kaart.js naast ./openingen.js: de gemeten
   tekst apart van de code die hem gebruikt.

   WAT HIER NIET IN HOORT: geen enkele beslissing. Elke functie hier krijgt een
   uitkomst die al vaststaat en geeft er woorden bij. Zodra een functie hier
   bepaalt WELKE stand iets krijgt, is de scheiding weg en is dit een tweede
   motor met een mooie naam. De vijf regels uit ./index.js blijven daar wonen.
   ========================================================================== */
'use strict';

/* De twee aannames waarmee elke uitslag begint. Ze staan vooraan omdat ze voor
   ELKE berekening gelden, en niet alleen als er iets ontbreekt. */
const AANNAMES_VAST = [
  'Alleen wat u zelf heeft opgegeven is meegenomen. Er is geen opleidingsduur, geen tarief en ' +
  'geen wachttijd bijgezocht; die getallen heeft dit huis niet.',
  'Een randvoorwaarde die u niet heeft ingevuld geldt als NIET nagegaan, en dus niet als geregeld.'
];

/* Manieren die een voorwaarde noemen die nergens beschreven staat. De
   slordigheid verdwijnt niet in het antwoord, maar hij stopt de berekening ook
   niet: het zijn gewoon ONBEKENDEN. */
const aannameOnbekend = (ids) =>
  'Deze manieren noemen voorwaarden die u niet heeft beschreven (' + ids.slice(0, 8).join(', ') +
  '). Die zijn als NIET nagegaan geteld.';

/* Een lijst van EEN is geen keuze maar een gegeven, en dat hoort de lezer te
   weten -- anders leest een lijst van een als een advies. */
const AANNAME_EEN_MANIER =
  'Er is maar EEN manier opgegeven. Dit is dus geen keuze tussen wegen maar een ' +
  'beoordeling van die ene; er kunnen manieren zijn die hier niet staan.';

/* De stilste aanname die er is: een weg waarvan de voorwaarden niet gemeten
   zijn, ziet er in de lijst uit als elke andere. */
const aannameOngemeten = (n, totaal) =>
  'Van ' + n + ' van de ' + totaal + ' manieren is niet nagegaan wát zij vergen. Die staan daarom op ' +
  '`onbepaald` en nooit op open: niet omdat er iets op tegen is, maar omdat dit huis die ' +
  'voorwaarden niet heeft gemeten.';

/* De zin onder een manier. Krijgt de stand die al bepaald is en kiest er de
   woorden bij -- zie de kop: hier wordt niets beslist. */
function uitleg(stand, voorwaardenOnbekend, heeftOnbekende) {
  if (stand === 'open') return 'Alles wat deze manier nodig heeft, staat volgens uw eigen opgave geregeld.';
  if (stand === 'geblokkeerd') {
    return 'Deze manier ligt niet open zolang het bovenstaande niet geregeld is. Hij blijft in de ' +
      'lijst staan, want dat kan veranderen.';
  }
  if (voorwaardenOnbekend && !heeftOnbekende) {
    return 'Van deze manier is niet nagegaan wát hij vergt. Dat is iets anders dan dat hij niets ' +
      'vergt, en iets heel anders dan dat hij openligt.';
  }
  return 'Hier is niets van bekend dat hem blokkeert, maar ook niet alles nagegaan. Dat is iets anders dan open.';
}

/* REGEL 4, en hij staat in het ANTWOORD en niet alleen in de code: een lezer
   die de volgorde voor een oordeel aanziet, doet dat anders alsnog. Het eerste
   deel is een woord eerlijker geworden -- "in de volgorde waarin u ze opgaf"
   klopt alleen zolang de mens ze zelf aandroeg. */
const ordening = (bron) => (bron === 'samengesteld'
  ? 'Deze manieren zijn door dit huis samengesteld uit de bronnen die het heeft, en staan in de ' +
    'volgorde van die bronnen. '
  : 'Deze manieren staan in de volgorde waarin u ze opgaf. ') +
  'Er is niets gerangschikt en er is geen beste weg aangewezen; die keuze is aan u.';

/* De zin die zegt wat dit NIET is. Zonder hem leest een lijst met "open" en
   "geblokkeerd" als een uitspraak over wat gaat lukken. */
const GRENS = 'Dit rekent alleen met wat u zelf heeft opgegeven. Het zegt niets over hoe lang iets ' +
  'duurt, wat het kost of of het u gaat lukken.';

const GEEN_DOEL = 'Waar wilt u naartoe? Zonder doel is er niets om wegen naartoe te zoeken.';
const GEEN_MANIEREN = 'Welke manieren zijn er? Zonder manieren valt er niets te vergelijken.';
const dubbel = (id) => 'De randvoorwaarde "' + id + '" staat er twee keer in. ' +
  'Welke van de twee geldt, is dan niet vast te stellen.';

module.exports = { AANNAMES_VAST, AANNAME_EEN_MANIER, aannameOnbekend, aannameOngemeten,
  uitleg, ordening, GRENS, GEEN_DOEL, GEEN_MANIEREN, dubbel };
