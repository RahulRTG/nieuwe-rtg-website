'use strict';

const zaakregiebeeld = require('../zaakregiebeeld');

/* De leesprojectie bezit geen zaakdata. Zij zet dezelfde bronlijst alleen om
   naar het bestaande dossierbeeld en het read-only regiebeeld. */
function maakCaseOverzicht(alle, openCase, statussen, soorten) {
  return {
    status: 200,
    zaken: alle,
    regiebeelden: alle.map(zaakregiebeeld.bureau),
    open: alle.filter(openCase).length,
    beslissingen: alle.filter(c => c.beslissing.nodig).length,
    statussen,
    soorten
  };
}

module.exports = maakCaseOverzicht;
