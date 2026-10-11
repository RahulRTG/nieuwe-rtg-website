/* DE RECENTE LAGEN VAN DE IDEMPOTENTIEVERKLARINGEN, voor ./idemsleutels.js.

   Afgesplitst omdat ./idemsleutels.js na de samenvoeging van oktober 2026 over de
   omvanggrens van keuringsregel 13 ging. Dezelfde volgorde als daar stond: deze
   lijst komt als laatste, en Object.assign laat de laatste winnen. */
'use strict';

const SLEUTELS = Object.assign({},
  require('./idemsleutels-connection-final').SLEUTELS,
  require('./idemsleutels-leerhuis').SLEUTELS,
  require('./idemsleutels-loop-fabric').SLEUTELS,
  require('./idemsleutels-conciergelus').SLEUTELS,
  require('./idemsleutels-eigengezin').SLEUTELS,
  require('./idemsleutels-toestemming').SLEUTELS,
  require('./idemsleutels-reisteruggave').SLEUTELS,
  require('./idemsleutels-vrijgave').SLEUTELS,
  require('./idemsleutels-horecateruggave').SLEUTELS,
  // RTG Office in en uit: exporteer en importeer zijn met opzet een tweede handeling
  require('./idemsleutels-officeformaten').SLEUTELS,
  /* De TURN-uitgifte: elk antwoord is een vers geheim. Zie de kop daar. */
  require('./idemsleutels-rtc').SLEUTELS,
  /* Vier routes uit de samenvoeging van #542. Zie de kop daar. */
  require('./idemsleutels-samenvoeging').SLEUTELS);

module.exports = { SLEUTELS };
