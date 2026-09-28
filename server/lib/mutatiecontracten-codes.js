/* Deel van ./mutatiecontracten.js: de codes als credential (CODECREDENTIALS.json).
   Twaalf zijbestanden die samen een familie vormen -- tegoedbon, afhaalcode,
   cadeaukaart, ticketcodes, kascode, arrival, zaakdoos, werksleutels,
   machinesleutels, horecabon, restdeuren en codedeuren -- hier gebundeld
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
  require('./mutatiecontracten-zaakdoos').CONTRACTEN,
  require('./mutatiecontracten-werksleutels').CONTRACTEN,
  require('./mutatiecontracten-machinesleutels').CONTRACTEN,
  require('./mutatiecontracten-horecabon').CONTRACTEN,
  require('./mutatiecontracten-restdeuren').CONTRACTEN,
  require('./mutatiecontracten-codedeuren').CONTRACTEN);
module.exports = { CONTRACTEN };
