/* Het gezin aan een ouderaccount: de twee routes die GEEN geheim teruggeven.
   De drie die dat wel doen staan in ./idemsleutels-nooit-eigengezin.js.

   - lezen verandert niets;
   - een kind toevoegen is bepaald door naam en geboortedatum: de kern geeft bij
     dezelfde twee het profiel terug dat er al staat (foundation/gezinseigenaar.js),
     dus de dubbeltik is ook zonder deze poort geen tweede kind. */
'use strict';
const SLEUTELS = {
  'POST /api/rtf/eigen-gezin': { leest: true },
  'POST /api/rtf/eigen-gezin/kind': { velden: ['naam', 'geboortedatum'] }
};
module.exports = { SLEUTELS };
