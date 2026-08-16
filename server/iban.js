/* Kleine IBAN-controle voor uitgaande rails. Vorm alleen is niet genoeg: het
   controlegetal moet modulo 97 precies 1 opleveren. */
'use strict';

function normaliseer(v) { return String(v || '').replace(/\s+/g, '').toUpperCase(); }

function geldig(v) {
  const iban = normaliseer(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const verplaatst = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const c of verplaatst) {
    const stuk = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const d of stuk) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

module.exports = { normaliseer, geldig };
