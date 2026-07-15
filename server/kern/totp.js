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

/* controle met een venster van een stap voor en na (klokdrift van het
   toestel), tijd-veilig vergeleken */
function totpOk(secretBase32, invoer, tMs) {
  const inv = String(invoer || '').trim();
  if (!/^\d{6}$/.test(inv)) return false;
  const nu = tMs == null ? Date.now() : tMs;
  for (const d of [-1, 0, 1]) {
    const verwacht = totpCode(secretBase32, nu + d * 30000, 30);
    if (crypto.timingSafeEqual(Buffer.from(verwacht), Buffer.from(inv))) return true;
  }
  return false;
}

module.exports = { totpCode, totpOk, base32Decode };
