/* Begrensde data-URL-poort van De Ontsmetter. De lengtegrens geldt vóór regex
   en Buffer.from, zodat een aanvaller niet eerst een enorme allocatie afdwingt. */
'use strict';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4;
const leeg = (verdict, reden, bytes) => ({ verdict, redenen: [reden], bytes: bytes || 0, sha256: '', entropie: 0 });

module.exports = (verwerk) => function scanDataUrl(s, meta) {
  const waarde = String(s || '');
  const komma = waarde.indexOf(',');
  if (komma < 0) return leeg('verdacht', 'geen geldige data-URL');
  if (waarde.length - komma - 1 > MAX_BASE64)
    return leeg('besmet', 'bestand is groter dan 16 MB');
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(waarde);
  if (!m) return leeg('verdacht', 'geen geldige data-URL');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) return leeg('besmet', 'bestand is groter dan 16 MB', buf.length);
  return verwerk(buf, Object.assign({ mime: m[1] }, meta || {}));
};
