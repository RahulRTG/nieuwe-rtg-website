/* RTG School, leerlijn rekenen groep 1 t/m 8 -- het vak waarop de Learning
   Fabric is uitgeprobeerd, en daarmee het bewijs dat de structuur draagt.

   De leerlijn zelf staat per twee groepen in ./rekenen-g12.js, -g34, -g56 en
   -g78; dit bestand voegt ze samen. Waarom opgeknipt: elk leerdoel draagt nu
   niet alleen een les maar ook zijn voorkennis en twee of drie manieren om
   hetzelfde uit te leggen, en dan wordt een vak van veertig doelen simpelweg
   te groot voor een bestand.

   Wat er per doel bij is gekomen ten opzichte van de eerste versie:
   - `vereist`: de voorkennisgraaf. Een kind dat vastloopt op optellen tot 20
     mist meestal niet oefening maar het splitsen dat eronder ligt, en dat kan
     het systeem nu zeggen in plaats van twintig extra sommen geven.
   - `uitleg`: dezelfde stof anders. Wie de eerste uitleg niet snapt, is niet
     geholpen met diezelfde uitleg nog een keer.

   De ids zijn ongewijzigd gebleven: het leerpaspoort van elk kind verwijst
   ernaar, en test/leerfabric.test.js bewaakt dat ze blijven bestaan. */
const { REKENEN_G12 } = require('./rekenen-g12');
const { REKENEN_G34 } = require('./rekenen-g34');
const { REKENEN_G56 } = require('./rekenen-g56');
const { REKENEN_G78 } = require('./rekenen-g78');

module.exports.REKENEN = REKENEN_G12.concat(REKENEN_G34, REKENEN_G56, REKENEN_G78);
