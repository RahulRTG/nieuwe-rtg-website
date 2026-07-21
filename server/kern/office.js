/* Kern-module "office": RTG Office, het eigen kantoorpakket voor het hele
   ecosysteem. Leden (RTG, Lifestyle en Business Pass) werken op hun eigen
   account; elke leverancier en partner heeft een team-drive per zaak
   (sleutel 'sup:CODE'); de eigen RTG-kantoren delen de kantoor-drive
   ('rtg:kantoor'); en RTF-leden werken per gezinsprofiel
   ('rtf:CODE:handle'), met een kring per gezin. Drie soorten: tekst,
   rekenblad en presentatie.

   De onderdelen wonen onder ./office/: basis.js (grenzen, sjablonen,
   rechten-helpers), docs.js (mappenlijst, maken, openen, bewaren,
   verwijderen) en delen.js (versies, delen op codenaam, gezinskring,
   AI-schrijfhulp). maakOffice(state) voegt ze samen; de API blijft gelijk. */

const { maakBasis } = require('./office/basis');

function maakOffice(state) {
  const basis = maakBasis(state);
  return {
    ...require('./office/docs')(state, basis),
    ...require('./office/delen')(state, basis)
  };
}

module.exports = { maakOffice };
