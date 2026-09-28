/* De machine- en herstelsleutels bij ./idemsleutels-nooit-routes.js: de API-poort,
   de Stadsdoos, de herstelsleutel van de algemene pin, de SCIM-sleutel en de
   IMAP-apparaatsleutel (CODECREDENTIALS.json). Elk van deze routes geeft een kaal
   geheim eenmaal, roteert of trekt in; een antwoordcache zou een ingetrokken
   geheim heronthullen of een intrekking als "gelukt" herhalen zonder te kijken.
   Alleen de domeinkern beoordeelt een herhaling. Eigen bestand, zodat de
   hoofdlijst onder de 10 kB blijft en naast de andere deuren additief groeit. */
'use strict';

module.exports = Object.freeze({
  'POST /api/command/apipoort/sleutel':
    'maakt elke keer een nieuwe machinesleutel die eenmaal kaal in het antwoord staat; een herhaald antwoord zou dat geheim uit een cache heronthullen',
  'POST /api/command/apipoort/roteer':
    'roteren geeft een nieuwe sleutel en trekt de vorige in dezelfde opslagronde in; een tweede keer weigert de kern met 409 in plaats van het geheim te herhalen',
  'POST /api/command/apipoort/intrekken':
    'intrekken leest de actuele stand in kern/command/apipoort.js; een tweede keer is een toestandscontrole (409), geen gecachet antwoord',
  'POST /api/office/stad/sleutel':
    'geeft een nieuwe apparaatsleutel en manifestsleutel eenmaal en laat de vorige kort overlappen; een herhaald antwoord zou een vervangen sleutel tonen',
  'POST /api/office/stad/node/aanmeld':
    'meldt elke keer een nieuwe Stadsdoos aan met een eigen serienummer en sleutel die eenmaal te zien zijn; de tweede opslikken zou een geheim uit een cache heronthullen',
  'POST /api/pin/vergeten':
    'uitgeven trekt atomair elke eerdere herstelsleutel van het lid in (kern/algpin-herstel.js); een herhaald antwoord zou een ingetrokken link herhalen in plaats van een nieuwe te sturen',
  'POST /api/pin/herstel':
    'de sleutel wordt in een collectietransactie eenmaal geclaimd; een tweede keer hoort 400 te zijn en nooit het gecachete ok van de eerste',
  'POST /api/techniek/sso/scimsleutel':
    'draaien vervangt de SCIM-sleutel van de organisatie en toont hem eenmaal; een herhaald antwoord zou een net vervangen sleutel heronthullen',
  'DELETE /api/techniek/sso/scimsleutel/:org':
    'intrekken leest de actuele stand; een tweede keer is 404 (er is geen sleutel meer), geen gecachet ok',
  'POST /api/member/rtmail/imap/roteer':
    'roteren geeft het apparaat een nieuwe sleutel en maakt de oude meteen waardeloos; een herhaald antwoord zou een ingetrokken geheim tonen',
  'POST /api/supplier/rtmail/imap/roteer':
    'zelfde reden als de ledenkant: geen antwoordcache mag een vervangen apparaatsleutel heronthullen',
  'POST /api/member/rtmail/imap/intrekken':
    'intrekken leest de actuele rij in kern/mailsleutel.js; een tweede keer is een toestandscontrole (400), geen gecachet antwoord',
  'POST /api/supplier/rtmail/imap/intrekken':
    'zelfde reden als de ledenkant: een intrekking wordt nooit uit een cache als gelukt herhaald'
});
