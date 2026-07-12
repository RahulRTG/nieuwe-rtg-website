/* Geo-rekenhulp: zuivere functies zonder toegang tot de database of de app.
   Losgetrokken uit de kern zodat ze op zichzelf te lezen en te testen zijn. */

function toRad(d) { return d * Math.PI / 180; }

// Afstand in meters tussen twee {lat,lng}-punten (haversine). null bij ongeldige invoer.
function haversine(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

// Reistijd in minuten voor een afstand, per vervoerswijze (lopen/vliegen/rijden).
function etaMinutes(meters, mode) {
  if (meters == null) return null;
  const kmh = mode === 'walking' ? 4.8 : mode === 'flying' ? 700 : 26;
  return Math.max(1, Math.round((meters / 1000) / kmh * 60));
}

module.exports = { toRad, haversine, etaMinutes };
