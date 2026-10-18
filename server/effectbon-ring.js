/* De effectbon, deel "ring": de bonnen van de laatste verzoeken, begrensd en
   alleen in het geheugen. Afgesplitst uit ./effectbon.js: dat bestand MAAKT een
   bon (welke collecties bewogen, welke klasse), dit HOUDT er een paar vast om op
   te vragen. GEEN collectie in de database: een bon die blijft staan is een
   journaal, en daarvoor is dit niet gebouwd. Wie hem wil bewaren, neemt dat
   besluit apart en met een bewaartermijn. */
'use strict';

const RING = [];
const RING_MAX = 200;

function bewaar(bon) {
  RING.push(bon);
  while (RING.length > RING_MAX) RING.shift();
  return bon;
}
function bonnen({ limit = 50 } = {}) {
  const n = Math.min(RING_MAX, Math.max(1, Number(limit) || 50));
  return RING.slice(-n);
}
function laatste(verzoek) {
  for (let i = RING.length - 1; i >= 0; i--) if (RING[i].verzoek === verzoek) return RING[i];
  return null;
}

module.exports = { bewaar, bonnen, laatste, RING_MAX };
