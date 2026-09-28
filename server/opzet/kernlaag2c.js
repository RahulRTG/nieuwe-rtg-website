/* DE KERN SAMENSTELLEN -- deel 2c: DE WERKDAG.

   De ochtendkaart (kern/ochtendkaart.js, PERSONEEL.md par. 4) leest het
   rooster, het verzuimregister en de klok. Het register (kern.payrollOS) bestaat
   pas na kernlaag2, dus deze laag hangt aan het eind van kernlaag2b. De kaart
   krijgt de regel `inplanbaar` hier aangereikt -- dezelfde die de planners
   lezen -- en haalt hem niet zelf op: een kernmodule die een andere kernmodule
   requiret, is een rand tussen twee domeinen. */
'use strict';

module.exports = (kern, hulp) => {
  const { db } = hulp;
  const afwezigOp = require('../kern/payroll/afwezig-laat')(() => kern);
  kern.ochtendkaart = require('../kern/ochtendkaart').maakOchtendkaart({
    db, scheduleFor: kern.scheduleFor, klokVan: kern.klokVan,
    inplanbaar: require('../kern/payroll/inplanbaar').maakInplanbaar(afwezigOp),
    vrij: require('../kern/personeel').SHIFT_NAMES[2]
  }).kaart;
};
