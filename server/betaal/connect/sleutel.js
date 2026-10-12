/* DE SLEUTELS VAN EEN PARTNERAFREKENING: afgeleid, nooit willekeurig.

   Twee soorten, en ze beschermen tegen twee verschillende dubbelingen:

   1. DE IDEMPOTENCY-KEY BIJ STRIPE. Iedere poging om DEZELFDE transfer of
      DEZELFDE payout te maken -- een retry na een time-out, een tweede instantie
      die de veeg draait, een herstart halverwege -- stuurt exact dezelfde
      sleutel. Stripe geeft dan het eerste antwoord terug in plaats van een
      tweede transfer. Een random UUID per poging zou die bescherming precies
      weggooien op het moment dat hij nodig is.

   2. DE ECONOMISCHE SLEUTEL BIJ HET GROOTBOEK. Een economische gebeurtenis
      (reserveren, afrekenen, terugboeken) heeft hoogstens EEN effect, hoe vaak
      de melding ook binnenkomt. De vorm is die van server/db/economische-
      identiteit.js (`<klasse>:<64 hex>`); de klasse `pay-uitbetaling` staat daar
      NOG NIET in de SLEUTEL-regex -- dat is een integratiepunt en geen
      vergissing (zie het eindverslag van deze tak).

   Beide afgeleid uit het ZAKELIJKE id van de afrekening, met een domeinlabel
   ervoor, zodat een transfer- en een payoutsleutel nooit op elkaar kunnen
   lijken en geen enkele sleutel het id zelf prijsgeeft. */
'use strict';
const crypto = require('node:crypto');

const KLASSE = 'pay-uitbetaling';
const h = t => crypto.createHash('sha256').update(t).digest('hex');

function geldigId(id) { return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/.test(id); }

const idemTransfer = id => 'rtg-connect-transfer-' + h('rtg-connect|transfer|' + id).slice(0, 48);
const idemPayout = id => 'rtg-connect-payout-' + h('rtg-connect|payout|' + id).slice(0, 48);
/* soort: reservering | afgerekend | teruggeboekt */
const economisch = (id, soort) => KLASSE + ':' + h('rtg-connect|economisch|' + soort + '|' + id);

module.exports = { KLASSE, geldigId, idemTransfer, idemPayout, economisch };
