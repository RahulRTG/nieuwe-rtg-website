/* DE RTG LINK-DRAGER bij ./idemsleutels-nooit-routes.js (link.capability_aanvaarden,
   RELEASEKANDIDAAT.md B15). Het maken geeft een 128-bit code precies een keer
   terug; aanvaarden en intrekken beslissen in een collectietransactie op de
   verse stand (kern/link/cap-bak.js). Een generieke antwoordcache zou een code
   heronthullen, een claim overslaan of een intrekking herhalen die al niet meer
   klopt. Eigen bestand, zodat parallelle migraties elkaars lijst niet raken. */
'use strict';

const CLAIM = 'de claim beslist in de collectietransactie van kern/link/cap-bak.js op de verse stand; ' +
  'een tweede keer is een toestandscontrole (gebruikt, bezig, ingetrokken of verlopen) en geen gecachet antwoord';

module.exports = Object.freeze({
  'POST /api/link/cap/maak':
    'elk antwoord draagt een nieuwe 128-bit drager die daarna alleen als hash bestaat; een herhaald antwoord zou een code heronthullen, en een tweede oproep is met opzet een tweede code',
  'POST /api/link/cap/aanvaard': CLAIM + '; de handeling eronder (RTG Pay) draagt haar eigen sleutel cap:<id>',
  'POST /api/supplier/link/cap/aanvaard': CLAIM + ', en de inning eronder is de claim-saga van kern/pay/kas-claim.js met sleutel cap:<id>',
  'POST /api/link/cap/trek':
    'intrekken leest de actuele stand in kern/link/cap-bak.js; een geclaimde of gebruikte code trekt niet meer in, en dat antwoord mag geen cache overschrijven'
});
