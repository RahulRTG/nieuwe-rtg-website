/* De maten die na de eerste sensor kwamen, elk in hun eigen bestand, zodat
   ./stand.js niet elke keer groeit: de marge per lid (C15, ./stand-marge.js) en
   de betalingen waarvan de afloop niet vaststaat (./stand-risico.js). De bronnen
   komen als lezers binnen, net als in ./stand.js. */
'use strict';

const MARGE = require('./stand-marge');
const RISICO = require('./stand-risico');

module.exports = ({ m, peilmoment, maat, kosten, later }) => {
  const l = later || {};
  return [MARGE({ m, peilmoment, maat, kosten, omzetPerPas: l.omzetPerPas }), RISICO({ maat, betalingen: l.betalingen })];
};
