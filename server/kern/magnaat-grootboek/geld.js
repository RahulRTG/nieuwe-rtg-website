/* Magnaat Grootboek -- geld is een geheel aantal eurocenten.

   Op EEN plek, zodat de motor en elke consument dezelfde afronding gebruiken.
   In ronde A2.0 is dit nog exact het oude gedrag (afronden naar het dichtstbij
   gelegen gehele getal); ronde A2.1 maakt er een harde grens van: binnen het
   grootboek bestaat dan geen geld met drijvende komma meer (MAGNAAT.md). */
'use strict';

const rond = n => Math.round(Number(n) || 0);
const geld = n => rond(n);
const som = waarden => waarden.reduce((t, n) => t + rond(n), 0);

module.exports = { rond, geld, som };
