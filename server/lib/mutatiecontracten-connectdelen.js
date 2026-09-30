/* Deel van ./mutatiecontracten.js: Foundation Connect (CONNECT.md), vier
   zijbestanden gebundeld zodat het hoofdbestand onder de omvanggrens blijft.
   De contracten zelf staan ongewijzigd in hun eigen bestand. */
'use strict';
const CONTRACTEN = Object.assign({},
  require('./mutatiecontracten-connect').CONTRACTEN,
  require('./mutatiecontracten-connect2').CONTRACTEN,
  require('./mutatiecontracten-connect3').CONTRACTEN,
  require('./mutatiecontracten-connect4').CONTRACTEN);
module.exports = { CONTRACTEN };
