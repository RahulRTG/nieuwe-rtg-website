/* Leeftijdshulp: zuivere functies, losgetrokken uit de kern. De leeftijd komt
   uit de geverifieerde paspoortdatum en stuurt welke functies een lid mag. */

// Hele jaren tussen een geboortedatum (YYYY-MM-DD) en vandaag; null bij ongeldig.
function leeftijdVan(geboren) {
  if (!geboren || !/^\d{4}-\d{2}-\d{2}$/.test(String(geboren))) return null;
  const g = new Date(geboren);
  if (isNaN(g)) return null;
  const nu = new Date();
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
