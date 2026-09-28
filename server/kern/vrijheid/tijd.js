/* VRIJHEID: TIJDREKENEN -- minuten vanaf een vast nulpunt, zodat een nachtdienst
   die om 23:00 begint en om 07:00 eindigt gewoon een interval is en niet twee
   halve dagen. Dezelfde les als kern/beveiliging/rooster/rust.js: wie per
   kalenderdatum rekent, ziet de rust over middernacht niet. */
'use strict';

const DAG = 24 * 60;
const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const isKlok = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const dagIndex = (datum) => Math.round(Date.parse(datum + 'T00:00:00Z') / 86400000);
const datumVan = (idx) => new Date(idx * 86400000).toISOString().slice(0, 10);
const klok = (t) => { const [u, m] = String(t).split(':').map(Number); return u * 60 + m; };
const klokVan = (min) => { const m = ((min % DAG) + DAG) % DAG; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const punt = (datum, t) => dagIndex(datum) * DAG + klok(t);
const weekdag = (datum) => new Date(datum + 'T00:00:00Z').getUTCDay(); // 0 = zondag
const plusDagen = (datum, n) => datumVan(dagIndex(datum) + n);

/* Een dienst {datum, van, tot}: eindigt hij voor of op zijn begin, dan loopt
   hij door tot de volgende dag. */
function interval(d) {
  if (!d || !isDatum(d.datum) || !isKlok(d.van) || !isKlok(d.tot)) return null;
  const van = punt(d.datum, d.van);
  let tot = punt(d.datum, d.tot);
  if (tot <= van) tot += DAG;
  return { van, tot };
}
const overlapt = (a, b) => a.van < b.tot && b.van < a.tot;
const uren = (iv) => (iv.tot - iv.van) / 60;

module.exports = { DAG, isDatum, isKlok, dagIndex, datumVan, klok, klokVan, punt, weekdag, plusDagen, interval, overlapt, uren };
