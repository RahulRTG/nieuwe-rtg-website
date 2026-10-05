/* HET GEZIN AAN EEN OUDERACCOUNT (foundation/gezinseigenaar.js en
   foundation/gezinmeenemen.js) bij ./idemsleutels-nooit-routes.js. Alle drie
   geven een NIEUWE gezinssessie terug (gezinstoken.geef) die daarna alleen als
   hash bestaat, en staan in lib/eenmalig-geheim-routes.js. Een generieke
   antwoordcache mag daar niets van herhalen. Eigen bestand, zelfde reden als
   ./idemsleutels-nooit-gezinsdeur.js. */
'use strict';

module.exports = Object.freeze({
  'POST /api/rtf/eigen-gezin/maak':
    'maken geeft een nieuwe gezinssessie; een herhaling is een toestandscontrole (409: dit account heeft ' +
    'al een gezin) en geen afgespeeld antwoord met een sessie erin',
  'POST /api/rtf/eigen-gezin/sessie':
    'elke oproep opent een NIEUWE 128-bit gezinssessie, net als inloggen; een afgespeeld antwoord zou een ' +
    'sessie heronthullen die intussen kan zijn ingetrokken',
  'POST /api/rtf/eigen-gezin/koppel':
    'meenemen claimt de gezinscode en geeft een nieuwe gezinssessie; een herhaling is een toestandscontrole ' +
    '(409: dit account heeft al een gezin, of het gezin al een eigenaar), nooit een gecachet geheim'
});
