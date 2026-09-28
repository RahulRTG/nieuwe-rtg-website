/* DE SESSIE- EN PASROUTES bij ./idemsleutels-nooit-routes.js -- eigen bestand,
   omdat die lijst anders over de 10 kB gaat. Elk antwoord hier draagt een kaal
   geheim dat maar een keer bestaat, of beslist over de actuele stand van zo'n
   geheim; een generieke antwoordcache mag daar niets van herhalen. */
'use strict';

module.exports = Object.freeze({
  'POST /api/arrival/request':
    'de aanvraag toont de Arrival Pass eenmaal; een herhaling met dezelfde aanvraagcode roteert in kern/arrivalpas.js en een antwoordcache zou de eerste pass heronthullen',
  'POST /api/arrival/pass/roteer':
    'roteren geeft een nieuwe pass en trekt de vorige in; een herhaald antwoord zou een ingetrokken pass tonen',
  'POST /api/arrival/pass/intrek':
    'intrekken leest de actuele stand in kern/arrivalpas.js; een tweede keer is een toestandscontrole, geen gecachet antwoord',
  'POST /api/bedrijf/sleutel/roteer':
    'roteren geeft een nieuwe werkruimtesessie en trekt de gebruikte in (bedrijf/sleutels.js); een herhaald antwoord zou een ingetrokken sleutel tonen',
  'POST /api/bedrijf/sleutel/intrek':
    'intrekken leest de actuele sessie; een tweede keer vindt haar niet meer en is een toestandscontrole, geen gecachet antwoord'
});
