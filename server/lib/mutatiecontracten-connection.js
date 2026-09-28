/* Deel van ./mutatiecontracten.js: Connection OS (edge, media en de
   releasekandidaten), gebundeld zodat het hoofdbestand onder de omvanggrens
   blijft. De contracten zelf staan ongewijzigd in hun eigen bestand. */
'use strict';
const CONTRACTEN = Object.assign({},
  require('./mutatiecontracten-connection-edge').CONTRACTEN,
  require('./mutatiecontracten-connection-media').CONTRACTEN,
  require('./mutatiecontracten-connection-final').CONTRACTEN);
module.exports = { CONTRACTEN };
