/* Uploadgrens vóór base64-decodering. Vier tekens dragen hooguit drie bytes;
   door de tekstlaag eerst te meten kan een aanvaller geen grote allocatie
   afdwingen om pas daarna te worden geweigerd. */
'use strict';

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const MAX_UPLOAD_BASE64 = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;

function teGroot(base64) {
  if (String(base64 || '').length <= MAX_UPLOAD_BASE64) return null;
  return { verdict: 'besmet', redenen: ['upload groter dan de harde grens van 16 MB'],
    bytes: Math.floor(String(base64).length * 3 / 4), sha256: '', entropie: 0 };
}

module.exports = { teGroot, MAX_UPLOAD_BYTES, MAX_UPLOAD_BASE64 };
