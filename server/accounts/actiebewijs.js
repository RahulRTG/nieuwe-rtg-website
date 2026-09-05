/* Bind een doelgebonden actietoken aan precies de aanvraag die openstaat.
   Alleen een SHA-256-vingerafdruk ligt in het dossier; vergelijken gebeurt op
   vaste lengte. Zo kan een oudere mailboxlink nooit een latere aanvraag voor
   een ander adres bevestigen. */
'use strict';
const crypto = require('crypto');
const { veiligGelijk } = require('../kern/util');

const hash = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const klopt = (verwacht, token) => /^[a-f0-9]{64}$/.test(String(verwacht || '')) &&
  veiligGelijk(verwacht, hash(token));

module.exports = { hash, klopt };
