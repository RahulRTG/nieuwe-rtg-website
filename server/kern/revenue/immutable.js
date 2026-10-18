'use strict';

/* Revenue-projecties delen één onveranderlijke uitvoergrens. Dit is geen
   autorisatie: iedere broncontrole gebeurt vóór de projectie wordt bevroren. */
function bevriesRevenue(waarde) {
  if (!waarde || typeof waarde !== 'object' || Object.isFrozen(waarde)) return waarde;
  for (const deel of Object.values(waarde)) bevriesRevenue(deel);
  return Object.freeze(waarde);
}

module.exports = bevriesRevenue;
