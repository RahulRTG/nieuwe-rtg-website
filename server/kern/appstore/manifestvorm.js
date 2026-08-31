/* ============================================================================
   DE VORM VAN EEN MANIFEST -- welke velden er zijn en hoe ze eruitzien.

   Afgesplitst van ./manifest.js toen die over de 10 KB-keuringsgrens ging, en
   langs een echte naad: hier staat WAT er mag, daar staat wat er met een
   inzending gebeurt. Wie wil weten of een veld bestaat, leest een lijst; wie wil
   weten waarom zijn inzending werd geweigerd, leest de lezer.

   De lijst is GESLOTEN, en dat is een besluit dat in ./manifest.js wordt
   afgedwongen: een onbekende sleutel wordt geweigerd en niet genegeerd. Negeren
   betekent dat een uitgever een veld kan meesturen dat vandaag niets doet en
   morgen wel -- en dan werkt zijn app anders zonder dat hij iets heeft ingezonden.
   ========================================================================== */
'use strict';

const SLEUTELS = ['sleutel', 'naam', 'versie', 'uitleg', 'categorie', 'start', 'icoon', 'machtigingen', 'taal', 'prijsCenten', 'arena'];
const CATEGORIEEN = ['sociaal', 'reizen', 'eten', 'media', 'geld', 'spelen', 'leven', 'veiligheid'];
const TALEN = ['nl', 'en'];

const SLEUTEL_VORM = /^[a-z][a-z0-9-]{2,39}$/;
const VERSIE_VORM = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
/* Een pad in de bundel: geen wortel, geen `..`, geen backslash, geen dubbele
   punt (dus ook geen `data:` of `https:`), geen stuurtekens, hooguit drie mappen
   diep. Dezelfde vorm bewaakt ./bundel.js bij het wegschrijven; hier gaat het om
   wat het manifest AANWIJST, daar om wat er echt binnenkomt. */
const PAD_VORM = /^(?!\/)(?!.*\.\.)(?:[a-z0-9][a-z0-9._-]{0,39}\/){0,3}[a-z0-9][a-z0-9._-]{0,59}$/;

/* De grenzen van een prijs. Niet omdat EUR 500 een magisch getal is, maar omdat
   een bedrag zonder bovengrens een typefout is die niemand tegenhoudt -- en een
   prijs onder de vijftig cent kost meer aan afhandeling dan hij opbrengt. */
const PRIJS_MAX = 50000;
const PRIJS_MIN = 50;

module.exports = { SLEUTELS, CATEGORIEEN, TALEN, SLEUTEL_VORM, VERSIE_VORM, PAD_VORM, PRIJS_MAX, PRIJS_MIN };
