/* Leest de persistentiestand uit SQLite zelf, nooit uit de werkkopie.

   Alleen dit oplopende databasegetal kan bevestigen dat een schrijfactie echt
   door de opslag is aanvaard. `null` betekent daarom niet "in orde", maar dat
   de opslag geen bewijs kon leveren. */
'use strict';

module.exports = function maakPersistentieStand({ init, huidig }) {
  return function persistentieStandSqlite() {
    try {
      init();
      const rij = huidig();
      return rij ? Number(rij.v) : null;
    } catch (e) {
      return null;
    }
  };
};
