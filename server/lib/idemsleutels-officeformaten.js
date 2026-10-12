/* ============================================================================
   RTG OFFICE IN EN UIT -- exporteer en importeer, voor de vijf ingangen.

   Beide zijn met opzet een tweede handeling (zie ook
   ./mutatiecontracten-officeformaten.js, met de meting in
   test/office-formaten.test.js toets 4):
   - een export is een bestand dat het huis verlaat, en het documentspoor hoort
     elke keer te kennen; een herhaling samenvouwen zou er een verzwijgen;
   - inlezen maakt altijd een nieuw rekenblad en overschrijft nooit; een dubbeltik
     kost hoogstens een extra blad, dat de eigenaar weggooit.
   ========================================================================== */
'use strict';

const EXPORT = { nietIdempotent: true, waarom: 'elke export is een bestand dat het huis verlaat en een eigen regel in het documentspoor; samenvouwen zou een download verzwijgen' };
const IMPORT = { nietIdempotent: true, waarom: 'inlezen maakt altijd een NIEUW rekenblad en overschrijft nooit; een dubbeltik kost een extra blad en geen werk van een ander' };

const SLEUTELS = {};
for (const pad of ['/api/kantoorpakket/', '/api/supplier/kantoorpakket/', '/api/office/kantoorpakket/',
  '/api/rtf/kantoorpakket/', '/api/werkplek/kantoorpakket/']) {
  SLEUTELS['POST ' + pad + 'exporteer'] = EXPORT;
  SLEUTELS['POST ' + pad + 'importeer'] = IMPORT;
}

module.exports = { SLEUTELS };
