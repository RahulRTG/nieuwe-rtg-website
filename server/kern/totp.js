/* Tweede factor (TOTP, RFC 6238) voor de gevoeligste deur: de backoffice.
   Zelfde techniek als bankieren-apps en authenticator-apps (Google/Microsoft
   Authenticator, 1Password): een geheime sleutel op het toestel, een code van
   zes cijfers die elke 30 seconden verspringt. Puur Node-crypto, geen
   afhankelijkheden.

   Aanzetten: zet OFFICE_TOTP_SECRET (base32, bijv. via `openssl rand` +
   base32) in de omgeving en voer dezelfde sleutel in een authenticator-app
   in. Zonder de omgeving-variabele blijft de tweede factor uit (demo). */
const crypto = require('crypto');

// base32 (RFC 4648) decoderen: zo delen authenticator-apps hun sleutels
function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, waarde = 0;
  const uit = [];
  for (const ch of String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    waarde = (waarde << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) { uit.push((waarde >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(uit);
}

// de zescijferige code voor een tijdvak (stap = 30 seconden)
function totpCode(secretBase32, tMs, stap) {
  const teller = Math.floor((tMs == null ? Date.now() : tMs) / 1000 / (stap || 30));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(teller));
  const h = crypto.createHmac('sha1', base32Decode(secretBase32)).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const code = ((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000;
  return String(code).padStart(6, '0');
}

/* EEN CODE IS EENMALIG, EN DAT WAS HIJ NIET.

   Een TOTP-code is negentig seconden geldig (het venster van een stap voor en
   na, tegen klokdrift van het toestel). Zonder verder iets was hij in die
   negentig seconden ook ONBEPERKT HERBRUIKBAAR. Wie hem een keer zag -- over
   iemands schouder, in een screenshot, in een logregel, of via een phishing-
   pagina die hem meteen doorspeelde -- kon er zelf mee naar binnen zolang het
   venster liep. Dan is de tweede factor iets wat je WEET in plaats van iets wat
   je HEBT, en dat is precies wat hij niet hoort te zijn.

   RFC 6238 zegt het met zoveel woorden: een geaccepteerde code mag binnen zijn
   venster geen tweede keer worden aangenomen. Dus onthouden we welke codes zijn
   gebruikt, tot ze toch verlopen. Alleen de GESLAAGDE: een foute code onthouden
   zou een aanvaller de kans geven een geldige code alvast te blokkeren.

   Het geheugen is klein en zelfopruimend -- hooguit een handvol codes per
   venster -- en de sleutel wordt gehasht, zodat het geheim zelf nergens als
   kaartsleutel rondslingert. In het geheugen, dus een herstart vergeet het:
   dat is dezelfde beperking als elke andere rem in dit huis, en oneindig veel
   beter dan niets onthouden. */
const gebruikt = new Map();   // 'hash(secret):code' -> geldig tot (ms)
const VENSTER_MS = 90000;     // -1, 0 en +1 stap van 30 seconden

function veeg(nu) {
  if (gebruikt.size < 64) return;         // pas opruimen als het iets voorstelt
  for (const [k, tot] of gebruikt) if (tot <= nu) gebruikt.delete(k);
}

function totpOk(secretBase32, invoer, tMs) {
  const inv = String(invoer || '').trim();
  if (!/^\d{6}$/.test(inv)) return false;
  const nu = tMs == null ? Date.now() : tMs;
  let raak = false;
  for (const d of [-1, 0, 1]) {
    const verwacht = totpCode(secretBase32, nu + d * 30000, 30);
    // geen vroege uitstap: alle drie de stappen doorlopen, zodat de duur niets
    // verklapt over WELKE stap klopte
    if (crypto.timingSafeEqual(Buffer.from(verwacht), Buffer.from(inv))) raak = true;
  }
  if (!raak) return false;
  const sleutel = crypto.createHash('sha256').update(String(secretBase32 || '')).digest('hex').slice(0, 16) + ':' + inv;
  const tot = gebruikt.get(sleutel);
  if (tot != null && tot > nu) return false;   // deze code is al gebruikt
  veeg(nu);
  gebruikt.set(sleutel, nu + VENSTER_MS);
  return true;
}

module.exports = { totpCode, totpOk, base32Decode };
