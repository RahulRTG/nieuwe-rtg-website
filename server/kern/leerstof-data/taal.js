/* RTG School, leerlijn taal en spelling groep 1 t/m 8 -- het tweede vak op de
   Learning Fabric, na rekenen.

   De leerlijn zelf staat per twee groepen in ./taal-g12.js, -g34, -g56 en -g78;
   dit bestand voegt ze samen.

   Wat er veranderde ten opzichte van de eerste versie: de spellingdoelen
   draaiden op 'kies' met vijf handgeschreven woordparen, en dat is na twee
   sessies een geheugenspel. Nu staat er per doel een woordbank met een REGEL
   ('cht' wordt fout 'gt'), en maakt de motor de foute variant zelf. Een bank
   uitbreiden is dan een regel tekst.

   De ids zijn ongewijzigd: het leerpaspoort verwijst ernaar, en
   test/leerfabric.test.js bewaakt dat ze blijven bestaan. */
const { TAAL_G12 } = require('./taal-g12');
const { TAAL_G34 } = require('./taal-g34');
const { TAAL_G56 } = require('./taal-g56');
const { TAAL_G78 } = require('./taal-g78');

module.exports.TAAL = TAAL_G12.concat(TAAL_G34, TAAL_G56, TAAL_G78);
