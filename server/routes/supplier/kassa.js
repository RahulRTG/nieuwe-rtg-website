/* Domein "supplier" (deelmodule): de kassa (POS: verkoop, RTG-code innen,
   uitchecken) en cadeaukaarten. Draait op de gedeelde kern. */
module.exports = (kern) => {

/* EEN herhalingslaag voor de hele kassa, en met opzet niet een per deur: de
   vlucht-tabel binnen lib/idem.js (twee verzoeken die tegelijk binnenkomen)
   werkt alleen als beide deuren dezelfde instantie gebruiken. Zie
   kern/kassa/herhaling.js. */
const herhaling = require('../../kern/kassa/herhaling')({
  db: kern.db, save: kern.save, bijeen: require('../../db').bijeen
});

/* De verkoop- en afrekenlaag draaien als submodules op de gedeelde kern. */
require('./kassa/verkoop')(kern, herhaling);
require('./kassa/innen')(kern);
require('./kassa/afrekenen')(kern, herhaling);
require('./kassa/cadeaukaart')(kern, herhaling);
require('./kassa/modus')(kern);
require('./kassa/premium')(kern);
};
