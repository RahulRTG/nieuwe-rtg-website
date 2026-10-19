/* Alle personeelsplekken van een lid, OOK de oude (active = 0).

   Alleen voor wat de medewerker over ZICHZELF leest, zoals zijn eigen
   loonstroken: na uit dienst blijven die van hem, zeven jaar lang (art. 52
   AWR). Inloggen gaat nooit via deze functie; daarvoor blijft staffPositions
   in ./staff.js de regel, en die geeft alleen actieve plekken.

   Afgesplitst van ./staff.js, dat anders over de 10 KB ging. */
'use strict';
const S = require('./state');

module.exports = function staffHistorie(memberId) {
  if (memberId == null) return [];
  return S.zin('SELECT * FROM supplier_staff WHERE member_id = ? ORDER BY supplier_code')
    .all(Number(memberId));
};
