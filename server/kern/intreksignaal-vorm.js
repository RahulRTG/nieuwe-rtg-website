'use strict';
const goedeVinger = waarde => /^[a-f0-9]{64}$/.test(String(waarde || ''));
const goedeSid = waarde => /^[A-Za-z0-9_-]{12}$/.test(String(waarde || ''));
function geldig(bericht) {
  if (!bericht || bericht.versie !== 1) return false;
  if (!Number.isFinite(Number(bericht.verloopt)) || Number(bericht.verloopt) <= Date.now()) return false;
  if (bericht.soort === 'token') return goedeVinger(bericht.waarde);
  if (bericht.soort === 'sessie') return goedeSid(bericht.waarde);
  return false;
}
module.exports = { goedeVinger, goedeSid, geldig };
