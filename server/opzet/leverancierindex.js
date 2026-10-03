'use strict';

// Pure index: de poort levert de actuele voorraad; deze module kent geen datastore.
module.exports = bronGeef => {
  /* Zonder centrale mutatieversie vraagt de lokale voorraad O(N) validatie:
     gelijke lengte sluit vervanging, herordening en codewijziging niet uit.
     Ongewijzigde rijen alloceren niets; gewone veldmutaties blijven zichtbaar
     via dezelfde rij. Pas na volledige herbouw wisselt de index atomair mee.
     De laatste rij met dezelfde code wint, zoals bij de oorspronkelijke Map. */
  let _supIndex = null, _supBron = null, _supRijen = [], _supCodes = [];
  function supplierIndex() {
    const bron = bronGeef();
    let gelijk = _supIndex && bron === _supBron && bron.length === _supRijen.length;
    if (gelijk) {
      for (let i = 0; i < bron.length; i++) {
        const rij = bron[i];
        if (rij !== _supRijen[i] || rij.code !== _supCodes[i]) { gelijk = false; break; }
      }
    }
    if (!gelijk) {
      const index = new Map(), rijen = [], codes = [];
      for (const rij of bron) {
        const code = rij.code;
        index.set(code, rij);
        rijen.push(rij);
        codes.push(code);
      }
      _supIndex = index; _supBron = bron; _supRijen = rijen; _supCodes = codes;
    }
    return _supIndex;
  }
  return supplierIndex;
};
