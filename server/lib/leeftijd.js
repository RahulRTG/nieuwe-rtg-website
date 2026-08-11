/* Leeftijdshulp: zuivere functies, losgetrokken uit de kern. De leeftijd komt
   uit de geverifieerde paspoortdatum en stuurt welke functies een lid mag.

   DEZE MODULE VRAAGT DE TIJD AAN DE KLOK (server/lib/klok.js) EN NIET AAN HET
   BESTURINGSSYSTEEM, en dat is hier geen detail maar de reden dat de klok
   bestaat. Hierop hangt de 18+-poort: CLAUDE.md legt vast dat alles wat een
   prestatie bewaart buiten het potje pas mag als iemand achttien is. Wat er
   gebeurt op de dag dat een lid precies achttien wordt, was tot nu toe niet te
   toetsen -- je kunt niet wachten tot de jarige jarig is. Met de klok wel. */

const { datum } = require('./klok');

// Hele jaren tussen een geboortedatum (YYYY-MM-DD) en vandaag; null bij ongeldig.
function leeftijdVan(geboren) {
  if (!geboren || !/^\d{4}-\d{2}-\d{2}$/.test(String(geboren))) return null;
  const g = new Date(geboren);
  if (isNaN(g)) return null;
  const nu = datum();
  let j = nu.getFullYear() - g.getFullYear();
  if (nu.getMonth() < g.getMonth() || (nu.getMonth() === g.getMonth() && nu.getDate() < g.getDate())) j--;
  return j;
}

// Leeftijdsgroep die functies stuurt: jeugd (15-17), jongvolwassen (18-21), 21+.
function leeftijdsgroepVan(lft) {
  if (lft == null) return null;
  if (lft < 18) return '15-17';
  if (lft <= 21) return '18-21';
  return '21+';
}

module.exports = { leeftijdVan, leeftijdsgroepVan };
