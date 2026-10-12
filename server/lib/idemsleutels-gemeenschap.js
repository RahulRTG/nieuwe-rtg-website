/* HET IDEM-REGISTER, deel de gemeenschapslaag -- zelfde register, eigen bestand.

   Het verbond, het beraad en de drager (GEMEENSCHAP-FASE0.md par. 4) verklaren
   hun routes elk in een eigen deelbestand, en die hangen HIER en niet elk met
   een eigen regel in ./idemsleutels.js. Dat bestand staat vlak onder de
   omvanggrens; drie lagen die er elk een regel bij zetten, duwen hem erover.
   Een deelbestand per laag houdt ook parallelle takken uit elkaars lijst. */
'use strict';

const SLEUTELS = Object.assign({},
  require('./idemsleutels-verbond').SLEUTELS,
  require('./idemsleutels-beraad').SLEUTELS,
  require('./idemsleutels-drager').SLEUTELS);

module.exports = { SLEUTELS };
