/* DE HERHAALSLEUTEL VAN EEN MELDER, voor ./zaken.js waarneming().

   Optioneel: een kanaal dat hem niet stuurt (het gemeenteloket, de dozen)
   merkt niets. De sleutel staat op de waarneming (`idem`, melder|sleutel) en
   overleeft dus een herstart -- anders dan de geheugenlaag voor de route.
   Dezelfde sleutel geeft dezelfde waarneming terug; dezelfde sleutel voor
   een andere categorie of een ander gebied is een andere melding, en dat is
   een 409 (scripts/lib/voltooi/stad.js). */
'use strict';

function herhaling(zaken, melder, sleutel, categorie, gebied, publiek) {
  const idem = melder && sleutel ? melder + '|' + String(sleutel).slice(0, 80) : undefined;
  if (!idem) return { idem };
  for (const z of zaken) {
    const w = (z.waarnemingen || []).find(x => x.idem === idem);
    if (!w) continue;
    if (z.categorie !== categorie || (gebied && z.gebied && gebied !== z.gebied))
      return { uit: { status: 409, error: 'Deze herhaalsleutel hoort bij een andere melding.' } };
    return { uit: { ok: true, herhaald: true, duplicaat: false, zaak: publiek(z), waarneming: w } };
  }
  return { idem };
}

module.exports = { herhaling };
