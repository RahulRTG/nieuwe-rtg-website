/* HET GEZINSPROFIELTOKEN (B17) bij ./idemsleutels-nooit-routes.js: elk antwoord
   hier draagt een VERSE gezinssessie die daarna alleen als hash bestaat
   (foundation/gezinstoken.js), of beslist over de actuele stand ervan. Een
   generieke antwoordcache mag daar niets van herhalen: dan stond de kale sessie
   in de cache en was hash-only een belofte. Eigen bestand, zodat parallelle
   migraties elkaars lijst niet raken. */
'use strict';

const VERS = 'elke oproep geeft een NIEUWE gezinssessie (foundation/gezinstoken.js) die alleen in dit antwoord kaal bestaat; ' +
  'een afgespeeld antwoord zou haar uit een cache heronthullen';

module.exports = Object.freeze({
  'POST /api/foundation/gezin/maak': VERS + '; een tweede oproep is een tweede gezin, met de IP-rem uit foundation/gezin.js',
  'POST /api/foundation/gezin/inloggen': VERS + ', na de pincode; een tweede inlog is een tweede apparaat',
  'POST /api/foundation/gezin/profiel/kies': VERS + ', na de pincode van dat profiel',
  'POST /api/foundation/gezin/uitnodiging/accepteer':
    'de claim beslist in een collectietransactie op de verse stand (foundation/gezinsclaim.js); een tweede keer vindt de uitnodiging gebruikt en krijgt 404 zonder token, en een cache zou de sessie van de eerste heronthullen',
  'POST /api/rtf/uitnodiging/accepteer':
    'de claim beslist in een collectietransactie op de verse stand (foundation/gezinsclaim.js); een tweede keer is een toestandscontrole (gebruikt of verlopen), geen gecachet antwoord',
  'POST /api/rtf/kanaal': VERS + ' van twaalf uur voor de gekoppelde oppas',
  'POST /api/foundation/gezin/sessie/roteer':
    'roteren geeft een nieuwe sessie en trekt de gebruikte in; een herhaling met de oude vindt haar niet meer (403), en een herhaald antwoord zou een ingetrokken of een tweede kopie tonen',
  'POST /api/foundation/gezin/sessie/intrek':
    'intrekken leest de actuele sessie of hoogt de epoch op; een tweede keer is een toestandscontrole (gesloten: 0), geen gecachet antwoord dat zegt dat er nu iets sloot'
});
