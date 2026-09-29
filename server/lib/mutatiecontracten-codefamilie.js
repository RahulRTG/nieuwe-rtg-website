/* De gemigreerde geld- en toegangscodes (RELEASEKANDIDAAT.md B9, B11, B12 en
   B14) als een blok, zodat ./mutatiecontracten.js onder de tienkilobytegrens van
   keuringsregel 13 blijft. Elke familie houdt haar eigen bestand met haar eigen
   kop; hier worden ze alleen samengevoegd, in dezelfde volgorde als voorheen. */
'use strict';
const CONTRACTEN = Object.assign({},
  require('./mutatiecontracten-tegoedbon').CONTRACTEN,
  require('./mutatiecontracten-afhaalcode').CONTRACTEN,
  require('./mutatiecontracten-cadeaukaart').CONTRACTEN,
  require('./mutatiecontracten-horecabon').CONTRACTEN,
  require('./mutatiecontracten-ticketcodes').CONTRACTEN,
  require('./mutatiecontracten-kascode').CONTRACTEN,
  require('./mutatiecontracten-arrival').CONTRACTEN,
  require('./mutatiecontracten-zaakdoos').CONTRACTEN,
  require('./mutatiecontracten-partnerkanaal').CONTRACTEN
);
module.exports = { CONTRACTEN };
