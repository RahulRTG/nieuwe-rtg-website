/* DE KERN SAMENSTELLEN -- deel 2c: DE WERKDAG.

   De ochtendkaart (kern/ochtendkaart.js, PERSONEEL.md par. 4) leest het
   rooster, de verzuimlaag en de klok. De verzuimlaag (kern.payrollOS) bestaat
   pas na kernlaag2, dus deze laag hangt aan het eind van kernlaag2b. De kaart
   krijgt de verzuimregel hier aangereikt en haalt hem niet zelf op: een kern-
   module die een andere kernmodule requiret, is een rand tussen twee domeinen. */
'use strict';

module.exports = (kern, hulp) => {
  const { db } = hulp;
  const verzuim = require('../kern/verzuimrooster').uitKern(() => kern);
  kern.ochtendkaart = require('../kern/ochtendkaart').maakOchtendkaart({
    db, scheduleFor: kern.scheduleFor, klokVan: kern.klokVan, verzuim,
    vrij: require('../kern/personeel').SHIFT_NAMES[2]
  }).kaart;
};
