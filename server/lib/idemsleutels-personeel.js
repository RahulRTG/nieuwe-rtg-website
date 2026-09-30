/* DE PERSONEELSLUS (PERSONEEL.md): twee routes, twee verschillende besluiten.

   `POST /api/office/beleidsmotor/huis/zet` -- welke entiteit RTG zelf is
   (besluit B1, kern/kantoor/huis.js). `velden: ['entiteit']`: het id van de
   entiteit is de hele handeling. Twee keer dezelfde aanwijzing binnen het
   venster is een dubbeltik, en de route zelf antwoordt dan al met
   `ongewijzigd: true` zonder `sinds` te verzetten (het contract in
   ./mutatiecontracten-personeel.js zegt PROTECTED). Een ANDERE entiteit is
   wel een nieuw besluit van de eigenaar en hoort door te komen; daarom telt
   alleen dat ene veld.

   `POST /api/staff/ochtend` -- de ochtendkaart (par. 4, kern/ochtendkaart.js).
   `leest: true`, en dat is een BESLUIT en geen gat: de route is een POST omdat
   dit huis geen GET met een sessie kent, niet omdat hij iets verandert (zie het
   contract in ./mutatiecontracten-personeel.js). Een tweede oproep hoort de kaart
   van NU te krijgen -- wie inklokt of zich net ziek meldde, moet er meteen op
   staan -- dus de idempotentiepoort speelt hier geen bewaard antwoord terug. */
'use strict';
const SLEUTELS = {
  'POST /api/office/beleidsmotor/huis/zet': { velden: ['entiteit'] },
  'POST /api/staff/ochtend': { leest: true }
};
module.exports = { SLEUTELS };
