/* DE OPSLAG VAN DE SPELLEN -- de wortel `spellen` met zijn twee vaste takken.

   WAAROM DIT EEN EIGEN BESTAND IS. Toen de spellenlaag achter kern/eigencollectie.js
   ging, kwam spellen.js op 10.319 byte uit en dat is over de grens van
   keuringsregel 13. Het bestand stond daarvoor op 10.238 -- twee byte eronder,
   dus elke wijziging had hem geraakt. De grens verplaatsen zou dat verbergen;
   deze naad haalt hem echt weg, en het is dezelfde naad als bij payroll,
   command en livinglab: waar de opslag woont, is geen orkestratie.

   POTJES EN WACHTRIJ ZIJN VASTE TAKKEN en geen losse collecties. Ze horen bij
   elkaar (een wachtrij levert een potje op) en worden altijd samen aangemaakt,
   dus staan ze onder een wortel. De zaai-callback draait alleen bij het
   AANMAKEN -- daarna is de vorm van de takken domeinkennis van spellen.js. */
'use strict';

module.exports = function maakSpelOpslag({ db }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/spellen', bezit: { spellen: 'kaart' } });
  const S = () => eigen.bak('spellen', (b) => { b.potjes = {}; b.wachtrij = {}; });
  return { S };
};
