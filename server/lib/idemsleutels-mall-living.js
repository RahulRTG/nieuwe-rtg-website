/* ============================================================================
   DE LIVING MALL-PROJECTIE.

   POST /api/mall/living gebruikt POST omdat de bestaande browserclient en de
   Mall-routes via dezelfde JSON-posthulp lopen. De handler muteert niets: hij
   leest Mall, App-Bibliotheek, eigen catalogus en leveranciersgids en bouwt
   daaruit een sessiegebonden etalage. Een herhaling hoort daarom de actuele
   projectie opnieuw te lezen en mag niet als dubbele handeling worden gezien.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  'POST /api/mall/living': { leest: true },
};

module.exports = { SLEUTELS };
