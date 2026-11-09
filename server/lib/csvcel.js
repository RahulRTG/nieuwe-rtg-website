/* Gedeelde CSV-celveiligheid. De export bepaalt zijn bestaande getal- en
   quotecontract; deze helper verandert geen bedragen of toegangsrechten. */
'use strict';

module.exports = function csvcel(waarde, { behoudGetallen = false, altijdQuotes = false } = {}) {
  let tekst = String(waarde == null ? '' : waarde);
  if (/^[=+\-@\t\r]/.test(tekst) && !(behoudGetallen && /^[-+]?[\d.,]+%?$/.test(tekst))) tekst = "'" + tekst;
  return altijdQuotes || /[",\n;]/.test(tekst) ? '"' + tekst.replace(/"/g, '""') + '"' : tekst;
};
