/* DE DRAGER EN DE GEZINSDEUR bij ./idemsleutels-nooit-gemeenschap.js -- vijf
   routes die het ZELF al weten. Vier herkennen een herhaling en geven
   `al: true` zonder iets te veranderen; vertrekken weigert een tweede keer op de
   stand. Alle vijf gemeten in test/genootschap-drager-server.test.js (toets 4,
   5 en 6). Een duplicaatlaag hoort daar NIET tussen: binnen haar venster past
   een handeling en haar tegendeel (vragen en losmaken, binnen en vertrekken),
   en dan speelt zij het eerste antwoord af terwijl de stand al anders is. */
'use strict';

const ZELF = 'herkent een herhaling zelf (al: true) en verandert dan niets; een afgespeeld eerder antwoord ' +
  'zou een tussentijdse wijziging binnen het venster stil ongedaan maken';

module.exports = Object.freeze({
  'POST /api/genootschap/drager/vraag': ZELF + ' (vragen, losmaken en weer vragen zou op ingetrokken blijven staan)',
  'POST /api/genootschap/drager/los': ZELF + '; het eerste losmaken blijft leidend',
  'POST /api/rtfos/portaal/partner/genootschap/erken': ZELF + '; de beheerders horen het een keer en niet bij elke herhaling',
  'POST /api/rtf/genootschap/binnen': ZELF + ' (binnen, vertrekken en weer binnen zou buiten blijven staan)',
  'POST /api/rtf/genootschap/vertrek':
    'een tweede vertrek is een toestandscontrole (400: geen lid meer), geen herhaling; een afgespeeld succes ' +
    'zou een gezinslid dat intussen weer binnentrad laten denken dat het vertrok'
});
