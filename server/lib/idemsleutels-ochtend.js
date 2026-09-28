/* DE OCHTENDKAART (PERSONEEL.md par. 4, kern/ochtendkaart.js).

   `leest: true`, en dat is een BESLUIT en geen gat: de route is een POST omdat
   dit huis geen GET met een sessie kent, niet omdat hij iets verandert (zie het
   contract in ./mutatiecontracten-ochtend.js). Een tweede oproep hoort de kaart
   van NU te krijgen -- wie inklokt of wie zich net ziek meldde, moet er meteen op
   staan -- dus de idempotentiepoort speelt hier geen bewaard antwoord terug. */
'use strict';
const SLEUTELS = {
  'POST /api/staff/ochtend': { leest: true }
};
module.exports = { SLEUTELS };
