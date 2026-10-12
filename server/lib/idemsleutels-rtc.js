/* HET IDEM-REGISTER, deel "rtc" -- de vier uitgifteroutes van een kortlevend
   TURN-credential (docs/turn-server.md). Zelfde register, eigen bestand.

   Waarom `nietIdempotent` en geen `zelfdeVerzoek`: het antwoord IS een geheim
   (een HMAC-credential met een eigen verlooptijd), en die vier routes staan
   daarom ook in ./eenmalig-geheim-routes.js. Een duplicaatlaag die het eerste
   antwoord bewaart en terugspeelt, zou dat geheim in een cache leggen en een
   credential met een oudere verlooptijd opnieuw uitgeven. Elke aanroep geeft
   dus een vers credential; het plafond per actor (30 per minuut, 429) is de
   rem, niet een sleutel. Er verandert verder niets in de opslag. */
'use strict';

const WAAROM = 'het antwoord is een vers kortlevend TURN-credential (een geheim, ook in ' +
  'eenmalig-geheim-routes): terugspelen zou het in een cache leggen en een oudere verlooptijd ' +
  'opnieuw uitgeven. Elke aanroep is een nieuwe uitgifte; het plafond per actor is de rem';

const SLEUTELS = {
  'POST /api/ice': { nietIdempotent: true, waarom: WAAROM },
  'POST /api/rtf/ice': { nietIdempotent: true, waarom: WAAROM },
  'POST /api/foundation/gezin/ice': { nietIdempotent: true, waarom: WAAROM },
  'POST /api/foundation/school/ice': { nietIdempotent: true, waarom: WAAROM }
};

module.exports = { SLEUTELS };
