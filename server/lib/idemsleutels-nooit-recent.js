/* DE RECENTE DEELLIJSTEN VAN DE NOOIT-HERHAALBARE ROUTES, voor ./idemsleutels-nooit-routes.js.

   Afgesplitst omdat dat bestand na de samenvoeging van oktober 2026 over de
   omvanggrens van keuringsregel 13 ging. Zelfde volgorde als daar stond. */
'use strict';

module.exports = Object.assign({},
  require('./idemsleutels-nooit-codes'),
  require('./idemsleutels-nooit-sessies'),
  require('./idemsleutels-nooit-machinesleutels'),
  require('./idemsleutels-nooit-codedeuren'),
  require('./idemsleutels-nooit-linkcap'),
  require('./idemsleutels-nooit-ssogeheim'),
  require('./idemsleutels-nooit-lesfamilie'),
  require('./idemsleutels-nooit-gezinstoken'),
  require('./idemsleutels-nooit-eigengezin'),
  require('./idemsleutels-nooit-gezinsdeur'),
  require('./idemsleutels-nooit-lesstroom'),
  require('./idemsleutels-nooit-sessiestroom'),
  require('./idemsleutels-nooit-connect'));
