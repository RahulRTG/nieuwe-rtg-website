/* De domeingescheiden vingerafdruk van een ingetrokken RTG PIN. Staat apart
   omdat zowel de PIN-kern als het recht-op-vergetelheid-pad exact dezelfde
   tombstone moeten schrijven; twee vergelijkbare hashes zijn twee registers
   die na een accountverwijdering uit elkaar kunnen lopen. */
'use strict';

function vingerafdruk(crypto, pin) {
  return crypto.createHash('sha256')
    .update('rtg-contactpin-retired-v1\0' + String(pin || ''))
    .digest('hex');
}

module.exports = { vingerafdruk };
