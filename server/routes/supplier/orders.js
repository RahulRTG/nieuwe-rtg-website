/* Supplier-submodule "orders": Orders op de vloer: tafelbestellingen, spoed, overschot, de lijn, secties
   en stations (KDS), de statusketen en terugbetalingen.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
module.exports = (kern) => {

/* De keukenlijn- en afhandelingslaag draaien als submodules op de
   gedeelde kern. */
require('./orders/keukenlijn')(kern);
require('./orders/afhandeling')(kern);
};
