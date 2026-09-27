/* Deel van ./mutatiecontracten.js: de codes als credential (CODECREDENTIALS.json).
   Zeven zijbestanden die samen een familie vormen -- tegoedbon, afhaalcode,
   cadeaukaart, ticketcodes, kascode, arrival en werksleutels -- hier gebundeld
   zodat het hoofdbestand onder de omvanggrens blijft. De contracten zelf staan
   ongewijzigd in hun eigen bestand. */
'use strict';
const CONTRACTEN = Object.assign({},
  require('./mutatiecontracten-tegoedbon').CONTRACTEN,
  require('./mutatiecontracten-afhaalcode').CONTRACTEN,
  require('./mutatiecontracten-cadeaukaart').CONTRACTEN,
  require('./mutatiecontracten-ticketcodes').CONTRACTEN,
  require('./mutatiecontracten-kascode').CONTRACTEN,
  require('./mutatiecontracten-arrival').CONTRACTEN,
  require('./mutatiecontracten-werksleutels').CONTRACTEN);
module.exports = { CONTRACTEN };
