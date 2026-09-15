/* ============================================================================
   DE ZES NAKLANKEN -- de tabel, apart van de motor die hem afdwingt.

   Uit ./naklank.js geknipt toen die over de 10 kB-grens ging (keuringsregel 13),
   op dezelfde naad als ./werkwoordlijst.js tegenover ./lus.js en
   ./tredenlijst.js tegenover ./leerdossier.js: hier staat WAT een naklank is,
   daar wat ermee gebeurt. Wie iets aan deze laag wil veranderen, verandert
   bijna altijd deze tabel.

   DE VOLGORDE IS DE VOLGORDE OP HET SCHERM en verder niets -- hij loopt van licht
   naar zwaar, en `geholpen` staat achteraan omdat hij de enige is met een gevolg
   buiten deze module. Er hangt GEEN gewicht aan die volgorde: de zes worden
   nergens opgeteld, gewogen of tot een cijfer verwerkt, ook niet intern om iets
   op te sorteren. Wie hier een `punten`-veld bij zet, heeft de like teruggebouwd
   met zes ingangen.
   ========================================================================== */
'use strict';

const SOORTEN = [
  { id: 'mooi',        teken: 'hart',   naam: 'Mooi',
    grond: 'Waardering, en verder niets. Hij staat er omdat hij bestaat -- weglaten maakt de andere vijf niet zuiverder, het maakt ze alleen de enige uitweg.' },
  { id: 'geleerd',     teken: 'lamp',   naam: 'Iets geleerd',
    grond: 'De kijker zegt iets te hebben begrepen. Dit is de eerste van de vier die een maker werkelijk iets vertellen.' },
  { id: 'geprobeerd',  teken: 'proef',  naam: 'Geprobeerd',
    grond: 'Er is iets gedaan met wat hier stond. Van kijken naar doen -- de stap waar de hele lus op draait.' },
  { id: 'gemaakt',     teken: 'hamer',  naam: 'Afgemaakt',
    grond: 'Het is af gekomen. Een veel scherper getal dan bereik: van duizend kijkers maken er tien iets.' },
  { id: 'doorgegeven', teken: 'pijl',   naam: 'Doorgegeven',
    grond: 'Aan iemand anders laten zien. Geen deelknop met bereik erachter -- alleen de mededeling dat het verderging.' },
  { id: 'geholpen',    teken: 'handen', naam: 'Hierdoor geholpen',
    grond: 'De zwaarste, en de enige met een gevolg: hij schrijft bij de maker de trede "Doorgegeven" in zijn leerdossier. Daarom kan hij niet door de maker zelf worden gegeven.' }
];

module.exports = { SOORTEN };
