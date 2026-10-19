'use strict';
/* Afgesplitst van ./tijdzone.js (10 KB-grens); daar blijft instantIn de ingang.
   kern/move/naad.js las een afspraak als UTC en zat in de zomer twee uur mis. */
const T = require('./tijdzone');

/* De omgekeerde vraag: welk tijdstip is "om 10:00 op deze dag" in deze zone?
   Twee rondes lokaal(): de tweede vangt een zomertijdwissel. Anders null. */
function instantIn(zone, datum, tijd) {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(datum || ''));
  const u = /^(\d{2}):(\d{2})/.exec(String(tijd || ''));
  if (!d || !u) return null;
  const doel = Date.UTC(+d[1], +d[2] - 1, +d[3], +u[1], +u[2]);
  if (!Number.isFinite(doel)) return null;
  const z = T.geldigeZone(zone) ? zone : T.TERUGVAL;
  let t = doel;
  for (let i = 0; i < 2; i++) {
    const l = T.lokaal(z, new Date(t));
    t += doel - (Date.parse(l.datum + 'T00:00:00Z') + l.minuten * 60000);
  }
  return t;
}

module.exports = instantIn;
