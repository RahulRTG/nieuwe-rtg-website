/* Een ontbrekende collectie is leeg voor het bord, geen opdracht om haar te
   maken. Bestaande records blijven dezelfde objecten voor hun schrijvers. */
'use strict';
module.exports = d => {
  function kaart(sleutel) {
    const waarde = d()[sleutel];
    if (waarde === undefined) return {};
    if (!waarde || typeof waarde !== 'object' || Array.isArray(waarde))
      throw new Error(sleutel + ' heeft geen geldige kaartvorm.');
    return waarde;
  }
  function grootboek() {
    const waarde = d().bankBoekingen;
    if (waarde === undefined) return [];
    if (!Array.isArray(waarde)) throw new Error('bankBoekingen heeft geen geldige lijstvorm.');
    return waarde;
  }
  return { saldi: () => kaart('bankSaldi'), rekeningen: () => kaart('bankRekeningen'), grootboek };
};
