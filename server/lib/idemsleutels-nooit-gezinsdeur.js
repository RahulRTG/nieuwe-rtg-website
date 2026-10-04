/* DE GEZINSDEUR (B18/B19, foundation/gezinsdeur.js) bij ./idemsleutels-nooit-routes.js.
   Elk antwoord hier draagt een vers geheim dat daarna alleen als hash bestaat (een
   gezinscode, een stroomticket, een verlengde sessie), of beslist over de actuele
   stand van een credential. Een generieke antwoordcache mag daar niets van
   herhalen. Eigen bestand, zodat parallelle migraties elkaars lijst niet raken. */
'use strict';

module.exports = Object.freeze({
  'POST /api/foundation/gezin/code/roteer':
    'elke oproep maakt een NIEUWE 128-bit gezinscode (foundation/gezinscode.js) en vervangt de vorige; ' +
    'een afgespeeld antwoord zou een vervangen code heronthullen alsof hij nog gold',
  'POST /api/foundation/gezin/code/intrek':
    'intrekken leest de actuele stand in een collectietransactie; een tweede keer is een toestandscontrole ' +
    '(ingetrokken: 1 of 0 naar wat er DAN gebeurde), geen gecachet antwoord',
  'POST /api/foundation/gezin/stroom/ticket':
    'elke oproep geeft een NIEUW eenmalig stroomticket van een minuut (foundation/gezinsstroom.js); ' +
    'een cache zou een al ingewisseld ticket teruggeven dat niets meer opent',
  'POST /api/foundation/gezin/sessie/verleng':
    'verlengen vraagt een verse passkeyceremonie en geeft een NIEUWE gezinssessie terwijl de oude wordt ' +
    'ingetrokken; een herhaling met de oude sessie vindt haar niet meer (403)',
  'POST /api/foundation/gezin/passkey/weg':
    'ontkoppelen is een stand; een tweede keer zegt ontkoppeld: 0, geen gecachet antwoord',
  'POST /api/rtf/gezin/passkey':
    'koppelen vraagt een eenmalige passkeyceremonie (kern/zwaarbewijs.js); een herhaald antwoord zou een ' +
    'koppeling melden waar geen ceremonie bij hoorde'
});
