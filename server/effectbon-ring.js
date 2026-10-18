/* DE BONNENRING -- waar de effectbonnen van de laatste verzoeken blijven, en hoe lang.

   WAAROM DIT APART STAAT VAN ./effectbon.js: die module STELT VAST wat een verzoek
   veroorzaakte (maak, haak). Hoe lang een vaststelling blijft bestaan en wie haar terug
   kan lezen, is een ander besluit -- een bewaarbesluit -- en dat hoort niet verstopt te
   zitten tussen de waarneming. Wie de ring ooit wil vervangen door iets dat blijft,
   verandert dit bestand en raakt de waarneming niet. */
'use strict';

/* De bonnen van de laatste verzoeken, begrensd. GEEN collectie in de database: een bon
   die blijft staan is een journaal, en daarvoor is dit niet gebouwd. Wie hem wil bewaren,
   neemt dat besluit apart en met een bewaartermijn. */
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
