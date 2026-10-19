/* Photo preferences replace a slot; uploads append bytes and must not retry automatically.
   A slot setter is not deduplicated: kiezen, herstellen en weer kiezen binnen het venster
   liet de derde keuze stil vallen (test/beeldkeuze-aba.test.js). */
'use strict';
const ZETTER = { nietIdempotent: true,
  waarom: 'de handler zet zelf de gekozen stand van de plek; cachen maakt kiezen-herstellen-kiezen binnen vijf seconden onwaar doordat de derde keuze wordt overgeslagen' };
const SLEUTELS = {
  'POST /api/ik/beelden': { leest: true },
  'POST /api/ik/beelden/zet': ZETTER
};
for (const suffix of ['', '/mijn', '/haal']) SLEUTELS['POST /api/foundation/gezin/beelden' + suffix] = { leest: true };
SLEUTELS['POST /api/foundation/gezin/beelden/zet'] = ZETTER;
for (const suffix of ['/upload', '/upstart', '/updeel', '/upklaar']) {
  SLEUTELS['POST /api/foundation/gezin/beelden' + suffix] = { nietIdempotent: true,
    waarom: 'De bestaande privékluis maakt een upload of voegt het volgende stuk toe; automatisch herhalen kan een tweede bestand of dubbele bytes maken. De foto-editor herhaalt deze handelingen niet automatisch.' };
}
module.exports = { SLEUTELS };
