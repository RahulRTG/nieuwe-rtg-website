/* HET TERUGGAVERECHT VAN EEN REIS (routes/kantoren/reisteruggave.js) -- wat is
   hier "hetzelfde verzoek"?

   De lijst leest. Het loket munt een verse uitdaging, en een herhaalde
   challenge is een herbruikbare challenge. Het besluit krijgt geen
   deduplicatie van de poort: een herhaling stuit in de handler op de
   toestand (409), en de geldboeking eronder is al idempotent op het id van het
   recht. Een poort die een woordelijk gelijke herhaling opslokt, zou daar
   alleen een tweede aanvraag voor de tweede handtekening wegpoetsen die de
   aanvrager bewust deed. */
'use strict';
const SLEUTELS = {
  'POST /api/office/reisbureau/teruggaven': { leest: true },
  'POST /api/office/reisbureau/teruggave/opties': { nietIdempotent: true,
    waarom: 'de ceremonie voor een teruggave, gebonden aan dat recht; een herhaalde challenge is een herbruikbare challenge' },
  'POST /api/office/reisbureau/teruggave': { nietIdempotent: true,
    waarom: 'een tweede besluit over hetzelfde recht stuit in de handler op de toestand (409), en de geldboeking is idempotent op het id van het recht; de poort voegt niets toe' }
};
module.exports = { SLEUTELS };
