/* DE VERTROUWDE MODELSLEUTELS -- de publieke helften, en alleen die.
   TOESTEL.md par. 9.3 en besluit 6.

   Deze lijst begint met opzet LEEG. Een sleutel komt er pas in als een mens
   hem offline heeft gemaakt (node scripts/toestel-artefact.js nieuwe-sleutel)
   en de private helft buiten de repo en buiten elke server bewaart. Zolang de
   lijst leeg is, laadt geen enkel toestel een model: de grendel in
   ./manifest.js weigert bij stap 1, met de reden. Dat is de juiste kant om naar
   te falen.

   Een regel: { id, publiek (base64, 32 bytes Ed25519), vanaf, stand }, met
   stand actief, uitgefaseerd of ingetrokken. Een wissel of intrekking is een
   RELEASE en geen configuratie: de lijst komt van dezelfde plek als de code
   die hem leest, en niet uit een antwoord van de server. */
(function (root) {
  'use strict';
  var SLEUTELS = Object.freeze([]);
  if (typeof module === 'object' && module.exports) module.exports = SLEUTELS;
  else root.RTGToestelSleutels = SLEUTELS;
}(typeof globalThis !== 'undefined' ? globalThis : this));
