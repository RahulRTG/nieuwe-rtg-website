/* Domein "supplier" (deelmodule): de kassa (POS: verkoop, RTG-code innen,
   uitchecken) en cadeaukaarten. Draait op de gedeelde kern. */
module.exports = (kern) => {

/* De verkoop- en afrekenlaag draaien als submodules op de gedeelde kern. */
require('./kassa/verkoop')(kern);
require('./kassa/afrekenen')(kern);
require('./kassa/cadeaukaart')(kern);
require('./kassa/modus')(kern);
require('./kassa/premium')(kern);
};
