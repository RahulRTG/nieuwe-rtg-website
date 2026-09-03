/* DE KRITIEKE GEBRUIKERSVERHALEN -- de gezinskant van de RTFoundation.

   Los van ./verhalen.js omdat het een eigen DEUR is: een ouder komt binnen met
   een gezinscode en niet met een ledentoken, leest via GET waar zijn kind is, en
   zit in een portaal dat met FOUNDATION.md meegroeit in plaats van met de
   ledenapp. Een lid ziet deze rijen wel (de ledenroute vraagt de banen
   iedereen/lid/gezin), maar ze schuiven om een andere reden.

   DE METHODE STAAT IN HET PAD, en juist hier moest dat: dit zijn de enige
   verhalen van dit huis die op GET-routes rusten. De meter legde elk pad hard op
   POST, dus zonder dit onderscheid zou een ouder die zijn kind zoekt een
   strenger antwoord krijgen dan de werkelijkheid.

   LEVEN.md par. 2 staat hierboven: een kind is geen profiel. Deze verhalen meten
   of een OUDER erbij kan, en er komt hier nooit een verhaal bij dat over het kind
   zelf gaat als onderwerp. */
'use strict';

const GEZIN = [
  { id: 'kind-bereiken', wie: 'gezin', wat: 'zien waar mijn kind is', moetHeel: false,
    paden: ['/api/foundation/gezin/inloggen', 'GET /api/foundation/gezin/:code/locaties',
      'GET /api/foundation/gezin/:code/berichten'],
    waarom: 'BESLUIT VAN DE EIGENAAR, 2 september 2026. De DEUR (/inloggen) ging onder isolatie ' +
      'dicht terwijl de reads erachter openbleven -- wie al binnen was las door, wie erbuiten stond ' +
      'kwam er niet in. Een half gesloten deur beschermt niemand en houdt alleen de ouder tegen die ' +
      'er nog niet was. Hij staat nu in FYSIEKE_DEUR.' },
  { id: 'kind-bericht-sturen', wie: 'gezin', wat: 'mijn kind een bericht sturen', moetHeel: false,
    paden: ['/api/foundation/gezin/bericht'] },
  { id: 'kind-gezondheid-lezen', wie: 'gezin', wat: 'de gezondheidsgegevens van mijn kind lezen', moetHeel: false,
    paden: ['/api/foundation/gezin/inloggen', 'GET /api/foundation/gezin/:code/gezondheid'] },
  { id: 'kind-medicijn-aftekenen', wie: 'gezin', wat: 'aftekenen dat een medicijn is gegeven', moetHeel: false,
    paden: ['/api/foundation/gezin/gezondheid/medicijn/gegeven'] },
  { id: 'kind-ziekmelden', wie: 'gezin', wat: 'mijn kind ziekmelden', moetHeel: false,
    paden: ['/api/foundation/school/ziekmelden', '/api/foundation/school/absentie/meld'] }
];

module.exports = { GEZIN };
