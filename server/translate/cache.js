/* DE TWEELAAGSE VERTAALCACHE.

   Twee lagen met verschillende levensduur, en met opzet niet dezelfde:

   1. HET GEHEUGEN. Een LRU met een vaste bovengrens: bij een hit schuift de
      sleutel naar achteren, boven de grens valt de oudste eruit. Zonder grens
      groeit de Map met elke unieke (taal, tekst)-combinatie mee en lekt de
      server geheugen onder vuur van willekeurige teksten. Deze laag is er voor
      de LOSSE BERICHTEN -- de weg waar ingetypte tekst langskomt -- en dat is
      precies het geval waarvoor die grens werd geschreven.

   2. DE KAST (server/lib/vertaalkast.js). Vertaalde INTERFACE die een herstart
      overleeft. Bewust optioneel: zonder kast werkt alles zoals eerder, alleen
      koud. Alleen wie `bewaar: true` zegt mag erin, en dat zegt uitsluitend
      /api/vertaal/ui -- wat een lid TYPT is geen interface en hoort niet op
      schijf naast de knoppen van het huis.

   EEN TREFFER UIT DE KAST KLIMT NIET NAAR HET GEHEUGEN. De kast houdt zijn
   tabel per taal zelf in het geheugen, dus dat zou dezelfde regel een tweede
   keer opslaan. Alleen de eerste lezing van een taal raakt de schijf. */
'use strict';

const cache = new Map();
const CACHE_MAX = 5000;

let kast = null;
function setVertaalkast(k) { kast = k; }

function cacheLees(key) {
  if (!cache.has(key)) return null;
  const hit = cache.get(key);
  cache.delete(key); cache.set(key, hit);
  return hit;
}
function cacheSchrijf(key, waarde) {
  cache.set(key, waarde);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

/* De kast staat NAAST het geheugen en BOVEN het woordenboek: een eerder
   gemaakte vertaling is beter dan een terugval en kost geen model. */
function kastLees(mag, taal, tekst) {
  return (mag && kast) ? kast.lees(taal, tekst) : null;
}
function kastSchrijf(mag, taal, bron, vertaling) {
  if (mag && kast) kast.schrijf(taal, bron, vertaling);
}

module.exports = { setVertaalkast, cacheLees, cacheSchrijf, kastLees, kastSchrijf, CACHE_MAX };
