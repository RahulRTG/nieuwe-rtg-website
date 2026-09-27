/* WELKE ENTITEIT IS RTG ZELF (besluit B1, PERSONEEL.md; kern/kantoor/huis.js).

   `velden: ['entiteit']`: het id van de entiteit is de hele handeling. Twee
   keer dezelfde aanwijzing binnen het venster is een dubbeltik, en de route
   zelf antwoordt dan al met `ongewijzigd: true` zonder `sinds` te verzetten
   (het contract in ./mutatiecontracten-kantoorhuis.js zegt PROTECTED). Een
   ANDERE entiteit is wel een nieuw besluit van de eigenaar en hoort door te
   komen; daarom telt alleen dat ene veld. */
'use strict';
const SLEUTELS = {
  'POST /api/office/beleidsmotor/huis/zet': { velden: ['entiteit'] }
};
module.exports = { SLEUTELS };
