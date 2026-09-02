/* ============================================================================
   DE TWEEDE FACTOR, HELFT EEN: DE CODES ZELF.

   Dit bestand maakt de dingen die een lid in handen krijgt -- het base32-geheim
   voor de authenticator-app en de tien herstelcodes -- en niets anders. Het
   weet niet van leden, standen of poorten; dat is ./tweefactor.js, dat dit
   bestand leest. De knip ligt hier omdat het een echte naad is (wat er wordt
   GEMAAKT tegenover wat er wordt BEWAAKT) en omdat tweefactor.js met de
   toelichting op de scheve trekking over de tien kilobyte van regel 13 van
   scripts/check.js heen ging. Een uitzondering in die lijst was de goedkope
   uitweg; deze knip was er toch al een die het huis wilde.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

const CODES = 10;            // genoeg om er een paar te verliezen, weinig genoeg om te bewaren
const CODE_LENGTE = 10;
/* Zonder I, L, O, U en 0/1: een herstelcode wordt overgetypt van papier, en een
   nul die voor een O wordt aangezien is een lid dat denkt dat zijn laatste
   uitweg niet werkt. */
const ALFABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

const hashVan = (v) => crypto.createHash('sha256').update(String(v || '')).digest('hex');
const schoon = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* VERWERPEN EN NIET RESTDELEN, en dat verschil is hier geen muggenzifterij.

   Een byte loopt van 0 tot 255, en 256 is geen veelvoud van 30. Wie `byte % 30`
   neemt, deelt 256 waarden over 30 letters: de eerste zestien letters krijgen er
   negen, de laatste veertien maar acht. Dat is een scheve trekking van ruim
   twaalf procent, en dan draagt een code van tien tekens minder willekeur dan
   zijn lengte belooft -- terwijl dit de LAATSTE uitweg van een lid is als het
   toestel met zijn tweede factor weg is.

   De verwerping haalt de scheve staart eraf: alles boven de laatste hele ronde
   (240 voor een alfabet van 30) gaat overboord in plaats van omgevouwen te
   worden. Elke letter heeft daarna precies dezelfde kans. Verwerpen kost hooguit
   een tweede greep bytes; dat mag, want dit gebeurt tien keer bij het aanzetten
   van de tweede factor en nooit in een lus die telt.

   Ter vergelijking: kern/rtfos/basis.js doet hetzelfde restdelen met een alfabet
   van 32, en 256 deelt daar wel op -- daar is geen scheefheid en dus niets te
   repareren. Het gaat niet om het restdelen zelf maar om de maat van het
   alfabet. */
function nieuweCode() {
  let uit = '';
  const drempel = 256 - (256 % ALFABET.length);
  while (uit.length < CODE_LENGTE) {
    for (const b of crypto.randomBytes(CODE_LENGTE * 2)) {
      if (b >= drempel) continue;
      uit += ALFABET[b % ALFABET.length];
      if (uit.length === CODE_LENGTE) break;
    }
  }
  return uit;
}

/* Een base32-geheim voor de authenticator-app. 20 bytes is wat RFC 4226
   aanbeveelt en wat elke app aankan. */
function nieuwGeheim() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const b = crypto.randomBytes(20);
  let uit = '', bits = 0, waarde = 0;
  for (const byte of b) {
    waarde = (waarde << 8) | byte; bits += 8;
    while (bits >= 5) { uit += A[(waarde >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) uit += A[(waarde << (5 - bits)) & 31];
  return uit;
}

module.exports = { nieuweCode, nieuwGeheim, hashVan, schoon, CODES, CODE_LENGTE, ALFABET };
