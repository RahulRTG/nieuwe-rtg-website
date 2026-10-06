/* De weg terug van geld: de horecacorrectie die een teruggaverecht klaarzet,
   en de twee loketten waar een mens dat recht uitvoert (de manager van de zaak
   per betaalwijze, en het kantoor voor een afgezegde reis met passkey en vier
   ogen vanaf duizend euro). Samengebracht toen ./mutatiecontracten.js na de
   samenvoeging van 4 oktober 2026 over de bestandsgrens ging; de contracten
   zelf staan ongewijzigd in hun eigen bestanden. */
'use strict';

module.exports = {
  CONTRACTEN: Object.assign({},
    require('./mutatiecontracten-horeca-correctie').CONTRACTEN,
    require('./mutatiecontracten-horecateruggave').CONTRACTEN,
    require('./mutatiecontracten-reisteruggave').CONTRACTEN)
};
