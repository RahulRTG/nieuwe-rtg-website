/* Eén samenstelling van de persoonlijke agenda en haar kalender/projecties.
   De domeinen blijven eigenaar van boekingen en reserveringen; hun lezers
   worden geïnjecteerd. De reserveringslezer is tijdens startup laat gebonden. */
'use strict';
module.exports = deps => Object.assign(
  require('./agenda').maakAgenda(deps),
  require('./agenda-pro').maakAgendaPro(deps)
);
