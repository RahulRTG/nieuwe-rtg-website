/* Een publiek contract voor twee opslaggeneraties en twee gezichten.
   Dit module slaat niets op: klant en partner krijgen een projectie van
   dezelfde rekening of, tijdens migratie, van dezelfde oudere order. */
'use strict';
const basis = require('./orderbeeld-basis');
const projecteerRekening = require('./orderbeeld-rekening');
const projecteerLegacy = require('./orderbeeld-legacy');

function zonderIntern(order) {
  const uit = Object.assign({}, order);
  delete uit._rekening; delete uit._legacy;
  return uit;
}

module.exports = { OPEN_KANALEN:basis.OPEN_KANALEN, REGEL_STAND:basis.REGEL_STAND,
  totalen:basis.totalen, projecteerRekening, projecteerLegacy, zonderIntern };
