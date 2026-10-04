'use strict';

const { controleer, bevries } = require('./bewaking');

/* Eén rollbackgrens voor alle levenshandelingen. De kopie loopt bewust langs
   dezelfde JSON-grens als duurzame opslag, omdat SQLite zijn staat proxyt. */
function maakLevenstransactie({ boek, save, meld, koppel }) {
  return function voerBeschermdeLevenshandelingUit(st, doe) {
    const voor = JSON.parse(JSON.stringify(st));
    const volgorde = st.boek.boekVolgorde;
    try {
      const resultaat = doe();
      const schending = resultaat && resultaat.nieuw ? [] : controleer(st, boek);
      if (!schending.length) return resultaat;
      bevries(st, schending[0], meld);
      save();
      return { status: 409, error: 'Dit leven is bevroren: ' + schending[0] + '.' };
    } catch (e) {
      if (st.boek.boekVolgorde === volgorde) {
        for (const sleutel of Object.keys(st)) delete st[sleutel];
        Object.assign(st, voor);
        koppel(st, boek);
        return { status: 500, error: 'Er ging iets mis bij deze handeling. Er is niets veranderd.' };
      }
      bevries(st, 'een handeling brak af nadat er al geboekt was', meld);
      save();
      return { status: 500, error: 'Er ging iets mis na een boeking. Dit leven is bevroren om je boeken te beschermen; begin opnieuw.' };
    }
  };
}

module.exports = { maakLevenstransactie };
