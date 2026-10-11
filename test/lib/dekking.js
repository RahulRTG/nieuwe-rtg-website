/* Voor toetsen die een deelbestand van kern/pay met een eigen ctx bouwen: zet
   er dezelfde betaalMetDekking in als kern/pay/index.js doet -- de ECHTE
   ./dekking.js, op de boekAsync en zorgSaldo van die ctx. Geen nagemaakte
   volgorde: dan zou de toets een andere dekking meten dan productie draait.
   Buiten motorstand reserveert de echte boeking geen sleutel, dus null. */
'use strict';
const maakDekking = require('../../server/kern/pay/dekking');

module.exports = function metDekking(ctx) {
  return Object.assign(ctx, { betaalMetDekking: maakDekking({ boekAsync: (...a) => ctx.boekAsync(...a),
    zorgSaldo: (...a) => ctx.zorgSaldo(...a), reserveerSleutel: () => null }) });
};
