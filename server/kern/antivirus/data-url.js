/* De data-URL-poort van De Ontsmetter. Grootte controleren VOOR Buffer.from:
   anders moet de server een te grote, door een aanvaller gekozen tekenreeks
   eerst volledig uitpakken om hem daarna pas te weigeren. De base64-lengte
   verklapt de binaire grootte al. */
const MAX_BYTES = 16 * 1024 * 1024;

module.exports = ({ legVast, verwerk }) => function scanDataUrl(s, meta) {
  const m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) return { verdict: 'verdacht', redenen: ['geen geldige data-URL'], bytes: 0, sha256: '', entropie: 0 };
  const padding = m[2].endsWith('==') ? 2 : (m[2].endsWith('=') ? 1 : 0);
  const geschatteBytes = Math.max(0, Math.floor(m[2].length * 3 / 4) - padding);
  if (geschatteBytes > MAX_BYTES) {
    return legVast({ verdict: 'besmet', redenen: ['bestand groter dan 16 MB'],
      bytes: geschatteBytes, sha256: '', entropie: 0 }, meta);
  }
  const buf = Buffer.from(m[2], 'base64');
  return verwerk(buf, Object.assign({ mime: m[1] }, meta || {}));
};
