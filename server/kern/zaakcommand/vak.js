/* Zaak Command, deel "vak": waar de eigen gegevens van EEN zaak wonen.

   HET VAK ONTSTAAT BIJ SCHRIJVEN, NIET BIJ KIJKEN. In ./index.js stond
   `if (!vakken[code]) vakken[code] = {}`: een leeg vakje, en toch een MUTATIE --
   op het LEESpad. PostgreSQL weigert dat terecht met PG_SAVE_ONTBREEKT, en dat
   waren alle serverfouten op /api/supplier/backoffice in de 100M-ronde van
   9 september 2026 (8x daar, 95x in de 200k-ronde). In sqlite bewaakt niets die
   grens, dus het stond daar jaren groen: geen postgres-bug maar een
   postgres-DETECTIE.

   Een leeg vak draagt geen informatie -- het bestaan ervan zegt niets wat je niet
   uit de afwezigheid kunt afleiden. Daarom komt het er pas zodra er echt iets in
   wordt gezet. Tot die tijd gedraagt de schil hieronder zich als een leeg vak:
   lezen geeft undefined, schrijven maakt het vak alsnog aan, en vanaf dat moment
   is het een gewoon object. */
'use strict';

module.exports = function maakVak(eigen) {
  return function vakVan(code) {
    /* kijk() leest zonder te scheppen; bak() maakt de collectie aan, en dat is
       zelf al een mutatie. Op het leespad hoort dus kijk(). */
    const bestaand = eigen.kijk('zaakCommand')[code];
    if (bestaand) return bestaand;
    const echt = () => eigen.kijk('zaakCommand')[code] || null;
    const schrijf = () => {
      const vakken = eigen.bak('zaakCommand');
      return vakken[code] || (vakken[code] = {});
    };
    return new Proxy({}, {
      get: (_d, k) => { const v = echt(); return v ? v[k] : undefined; },
      has: (_d, k) => { const v = echt(); return v ? k in v : false; },
      set: (_d, k, w) => { schrijf()[k] = w; return true; },
      deleteProperty: (_d, k) => { const v = echt(); if (v) delete v[k]; return true; },
      ownKeys: () => Reflect.ownKeys(echt() || {}),
      getOwnPropertyDescriptor: (_d, k) => {
        const b = Object.getOwnPropertyDescriptor(echt() || {}, k);
        return b ? Object.assign({}, b, { configurable: true }) : undefined;
      }
    });
  };
};
