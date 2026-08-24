/* ============================================================================
   DE NAAD TUSSEN DE STORE EN HET GELD.

   Een eigen bestand omdat dit geen laag is maar een NAAD: de enige plek waar de
   store en de betaallaag elkaar raken. Wie wil weten wat een aanschaf met de
   rest van de App Store doet, hoeft maar hier te kijken.

   Twee dingen gebeuren hier, en allebei zouden ze op de verkeerde plek staan als
   ze ergens anders stonden:

   1. DE BETAALDE KANT WORDT ALLEEN OPGEBOUWD ALS ER EEN BETAALLAAG IS. Draait
      een proces zonder RTG Pay (een kale toets, een domeinproces), dan is dit
      een gratis store en zegt hij dat ook. Geen stille terugval naar een prijs
      die niemand int (LAT-regel 5).

   2. INTREKKEN ZET TERUGGAVERECHTEN KLAAR. Dat hangt hier en niet in
      ./besluit.js: die laag hoort niet van geld te weten. Zie ./teruggave.js
      voor waarom het een recht is en geen automatische terugboeking.
   ========================================================================== */
'use strict';

module.exports = function maakNaad({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier, intrekkenKaal }) {
  const geld = pay && typeof pay.verkoop === 'function'
    ? require('./geld')({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier })
    : null;

  function intrekken(a) {
    const r = intrekkenKaal(a);
    if (r.ok && geld) {
      const n = geld.rechtenBijIntrekken(a.sleutel, (a && a.reden) || null, r.app.ingetrokken.door);
      if (n) {
        r.teruggaverechten = n;
        r.let += ' ' + n + ' lid(eren) had(den) deze app gekocht; er staat nu een teruggaverecht open dat een mens van RTG afhandelt.';
      }
      save();
    }
    return r;
  }

  return { geld, intrekken };
};
