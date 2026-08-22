/* School: wat een waarneming is, op een plek.

   Een collega die een klas overneemt bij ziekte krijgt toegang tot die klas.
   Dat hoort TIJDELIJK te zijn: zonder einddatum is een overname een tweede
   vaste leraar via de achterdeur -- ze begint als "even invallen" en staat er
   een half jaar later nog.

   De einddatum wordt gezet in ./verbonden.js en gecontroleerd in de
   klas-poort van ../school.js. Dat zijn twee plekken, dus staat de regel hier:
   een begrip met twee kopieen loopt vroeg of laat uit elkaar. */
const WAARNEEM_DAGEN = 14;
const MAX_DAGEN = 90;

/* Een waarneming zonder 'tot' is er een van voor deze regel; die blijft staan
   tot iemand hem stopt. Bestaande toegang stilletjes intrekken bij een
   herstart is erger dan de kwaal. */
function loopt(w, nu) {
  return !!(w && (!w.tot || w.tot > nu));
}

const totWanneer = (dagen, vanaf) =>
  new Date(vanaf + Math.min(MAX_DAGEN, Math.max(1, Number(dagen) || WAARNEEM_DAGEN)) * 86400000).toISOString();

module.exports = { loopt, totWanneer, WAARNEEM_DAGEN, MAX_DAGEN };
