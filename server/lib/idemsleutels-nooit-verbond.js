/* HET VERBOND bij ./idemsleutels-nooit-gemeenschap.js -- vier routes die het
   ZELF al weten. Elk geeft bij een herhaling `al: true` zonder tweede
   tijdlijnregel of melding (kern/verbond/, gemeten in
   test/verbond-server.test.js toets 5). Een duplicaatlaag hoort daar NIET
   tussen: binnen haar venster past een wijziging en een terugwijziging, en dan
   speelt zij het eerste antwoord af terwijl de stand al anders is. */
'use strict';

const ZELF = 'herkent een herhaling zelf (al: true, geen tweede tijdlijnregel of melding); een afgespeeld ' +
  'eerder antwoord zou een tussentijdse wijziging binnen het venster stil ongedaan maken';

module.exports = Object.freeze({
  'POST /api/verbond/voorstel': ZELF + ' (zelfde kanten en doel, nog lopend, is hetzelfde verbond; na een opzegging is het een nieuw)',
  'POST /api/verbond/teken': ZELF + ' (wijzigen zet de tekens terug; een tweede teken moet dan echt gezet worden)',
  'POST /api/verbond/wijzig': ZELF + ' (tekst A, tekst B, weer tekst A zou op B blijven staan)',
  'POST /api/verbond/zeg-op': ZELF + '; de eerste opzegging en haar reden blijven leidend'
});
