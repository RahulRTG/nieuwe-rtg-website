/* Photo preferences replace a slot; uploads append bytes and must not retry automatically. */
'use strict';
const SLEUTELS = {
  'POST /api/ik/beelden': { leest: true },
  'POST /api/ik/beelden/zet': { zelfdeVerzoek: true }
};
for (const suffix of ['', '/mijn', '/haal']) SLEUTELS['POST /api/foundation/gezin/beelden' + suffix] = { leest: true };
SLEUTELS['POST /api/foundation/gezin/beelden/zet'] = { zelfdeVerzoek: true };
for (const suffix of ['/upload', '/upstart', '/updeel', '/upklaar']) {
  SLEUTELS['POST /api/foundation/gezin/beelden' + suffix] = { nietIdempotent: true,
    waarom: 'De bestaande privékluis maakt een upload of voegt het volgende stuk toe; automatisch herhalen kan een tweede bestand of dubbele bytes maken. De foto-editor herhaalt deze handelingen niet automatisch.' };
}
module.exports = { SLEUTELS };
