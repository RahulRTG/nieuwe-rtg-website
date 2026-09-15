/* ============================================================================
   DE ZES NAKLANKEN -- de tabel, apart van de motor die hem afdwingt.

   Uit ./naklank.js geknipt toen die over de 10 kB-grens ging (keuringsregel 13),
   op dezelfde naad als ./werkwoordlijst.js tegenover ./lus.js en
   ./tredenlijst.js tegenover ./leerdossier.js: hier staat WAT een naklank is,
   daar wat ermee gebeurt. Wie iets aan deze laag wil veranderen, verandert
   bijna altijd deze tabel.

   DE VOLGORDE IS DE VOLGORDE OP HET SCHERM en verder niets -- hij loopt van licht
   naar zwaar. Er hangt GEEN gewicht aan die volgorde: de zes worden nergens
   opgeteld, gewogen of tot een cijfer verwerkt, ook niet intern om iets op te
   sorteren. Wie hier een `punten`-veld bij zet, heeft de like teruggebouwd met
   zes ingangen.

   ============ `trede`: WELKE NAKLANK TELT ALS OVERDRACHT, EN WELKE NIET ======

   Vijf van de zes schrijven een regel in het dossier van de MAKER; een niet.

     mooi          -> null. Waardering is AANDACHT, en wij tellen aandacht niet
                     als ontwikkeling. Dit is de scherpste regel van deze tabel
                     en hij kostte het meest: `mooi` is de soort die het vaakst
                     gegeven wordt, en juist daarom mag hij niets opleveren.
     geleerd       -> gebruikt
     geprobeerd    -> gebruikt
     gemaakt       -> gebruikt
     geholpen      -> gebruikt    (een ander deed er aantoonbaar iets mee)
     doorgegeven   -> doorgegeven (het leidde aantoonbaar tot iets verderop)

   VIER SOORTEN OP EEN TREDE, EN DAT LEVERT EEN REGEL OP EN GEEN VIER. De bron
   van zo'n dossierregel is `naklank:<ding>:<trede>` en niet `:<soort>`, dus
   `gebruikt` bestaat hoogstens EEN keer per werk. Dat is de regel van
   ./tredenlijst.js in de praktijk: deze ladder legt OVERGANGEN vast en nooit
   volumes. "Iemand heeft hier iets mee gedaan" is een feit; "veertien mensen"
   is een score, en een score op een mens bestaat hier niet.
   ========================================================================== */
'use strict';

const SOORTEN = [
  { id: 'mooi',        teken: 'hart',   naam: 'Mooi', trede: null,
    grond: 'Waardering, en verder niets. Hij staat er omdat hij bestaat -- weglaten maakt de andere vijf niet zuiverder, het maakt ze alleen de enige uitweg. En hij levert de maker GEEN dossierregel op: dit is aandacht, en aandacht is geen ontwikkeling.' },
  { id: 'geleerd',     teken: 'lamp',   naam: 'Iets geleerd', trede: 'gebruikt',
    grond: 'De kijker zegt iets te hebben begrepen. Dit is de eerste van de vier die een maker werkelijk iets vertellen.' },
  { id: 'geprobeerd',  teken: 'proef',  naam: 'Geprobeerd', trede: 'gebruikt',
    grond: 'Er is iets gedaan met wat hier stond. Van kijken naar doen -- de stap waar de hele lus op draait.' },
  { id: 'gemaakt',     teken: 'hamer',  naam: 'Afgemaakt', trede: 'gebruikt',
    grond: 'Het is af gekomen. Een veel scherper getal dan bereik: van duizend kijkers maken er tien iets.' },
  { id: 'doorgegeven', teken: 'pijl',   naam: 'Doorgegeven', trede: 'doorgegeven',
    grond: 'Aan iemand anders laten zien. Geen deelknop met bereik erachter -- alleen de mededeling dat het verderging. De zwaarste trede die er is: het werk leidde aantoonbaar tot iets verderop.' },
  { id: 'geholpen',    teken: 'handen', naam: 'Hierdoor geholpen', trede: 'gebruikt',
    grond: 'De sterkste vorm van gebruiken: het heeft iemand verder geholpen. Schrijft bij de maker de trede "Gebruikt", en kan daarom niet door de maker zelf worden gegeven.' }
];

module.exports = { SOORTEN };
