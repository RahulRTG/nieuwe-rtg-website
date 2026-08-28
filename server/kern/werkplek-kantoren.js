/* De enterprise-campus van de werkplek.

   Een kantoor is geen tweede app, maar de herkenbare ingang van een afdeling:
   rollen, opdracht en bestaande RTG-producten. De catalogus staat in twee
   verdiepingsvleugels zodat elk bestand binnen de leesbaarheidsgrens blijft. */
'use strict';

const bovenbouw = require('./werkplek-kantoren-bovenbouw');
const onderbouw = require('./werkplek-kantoren-onderbouw');

module.exports = function werkplekKantoren(code, mensen, taken) {
  const m = Array.isArray(mensen) ? mensen : [];
  const t = Array.isArray(taken) ? taken : [];
  return bovenbouw(code).concat(onderbouw(code)).map(k => Object.assign({}, k, {
    mensen: m.filter(x => x && (x.afdeling || 'operations') === k.id).length,
    takenOpen: t.filter(x => x && (x.afdeling || 'operations') === k.id && !x.af).length
  }));
};
