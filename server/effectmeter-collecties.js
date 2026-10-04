/* Welke top-level collecties bewogen er in dit verzoek (./effectmeter.js).

   De opslagtracker meldt uitsluitend de top-level collectienaam. Geen rij,
   sleutel of waarde komt hier binnen. Daardoor kan de effectbon exact zeggen
   WELKE soort toestand bewoog zonder twee volledige wereldscans per verzoek.

   Eén waarnemingsweg voor iedere opslagmotor: de tracker zit om db.data en de
   teller zit om het verzoek. Registreren gebeurt pas als effectmeter.js zijn
   exports heeft gezet; dat voorkomt een modulekring tijdens het opstarten van
   db/state. */
'use strict';

const { huidig } = require('./effectmeter');

function wijziging(feit) {
  const t = huidig();
  if (!t || !t.collecties || !feit || typeof feit.collectie !== 'string') return false;
  t.collecties.add(feit.collectie); return true;
}

try { require('./db/mutatietracker').voegWaarnemerToe(wijziging); } catch (e) {}

module.exports = { wijziging };
