/* De eerste zestien domeinbestanden van ./mutatiecontracten.js, in dezelfde
   volgorde. Geknipt omdat dat bestand over de 10 kB van keuringsregel 13 ging;
   de vorm en de regels staan daar in de kop. */
'use strict';

const CONTRACTEN = Object.assign({},
  require('./mutatiecontracten-library').CONTRACTEN,
  require('./mutatiecontracten-loop-fabric').CONTRACTEN,
  require('./mutatiecontracten-living-world').CONTRACTEN,
  require('./mutatiecontracten-mall-aanvraag').CONTRACTEN,
  require('./mutatiecontracten-beelden').CONTRACTEN,
  require('./mutatiecontracten-document').CONTRACTEN,
  require('./mutatiecontracten-officeformaten').CONTRACTEN,
  require('./mutatiecontracten-storingen').CONTRACTEN,
  /* Opgesplitst omdat scripts/check.js een bestandsgrens kent en die terecht
     aansloeg: een lijst die naar duizenden regels groeit, hoort niet in een
     bestand dat ook nog de vorm en de regels uitlegt. Zelfde vorm als
     ./idemsleutels.js. */
  require('./mutatiecontracten-beschermd').CONTRACTEN,
  require('./mutatiecontracten-leest').CONTRACTEN,
  require('./mutatiecontracten-connection').CONTRACTEN,
  require('./mutatiecontracten-beleidsmotor').CONTRACTEN,
  require('./mutatiecontracten-werkbetaling').CONTRACTEN,
  require('./mutatiecontracten-vertegenwoordiging').CONTRACTEN,
  require('./mutatiecontracten-staffgemoed').CONTRACTEN,
  require('./mutatiecontracten-zaakkant').CONTRACTEN,
  require('./mutatiecontracten-rugdekking').CONTRACTEN);

module.exports = { CONTRACTEN };
