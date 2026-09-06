/* De gedeelde dispatch voor collecties met een bewezen mergecontract.

   Zowel een requestcommit als de LISTEN/poll-leeskant moet exact dezelfde
   betekenis gebruiken. Twee losse lijsten zouden bij de eerste nieuwe
   meetcollectie weer uiteenlopen en kunnen dan readiness sluiten. */
'use strict';

const { voegSpoorSamen } = require('./verzoeksporen');
const { voegKostenSamen } = require('./verzoekmeters');
const { voegRtgaiSamen } = require('./verzoekrtgai');

function voegBijzonderSamen(sleutel, basis, ons, hun) {
  if (sleutel === 'kosten') return voegKostenSamen(basis, ons, hun);
  if (sleutel === 'rtgai') return voegRtgaiSamen(basis, ons, hun);
  return voegSpoorSamen(sleutel, basis, ons, hun);
}

module.exports = { voegBijzonderSamen };
