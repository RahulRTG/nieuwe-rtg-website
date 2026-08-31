/* ============================================================================
   EEN ROUTE, EEN VERKLARING.

   ./idemsleutels.js voegt zes zijbestanden samen met Object.assign, en die laat
   de laatste winnen -- STIL. Drie kosten-routes stonden zowel in
   ./idemsleutels-kosten.js als `{ leest: true }` als in
   ./idemsleutels-kaleronde-b.js als `nietIdempotent`: twee tegengestelde
   uitspraken over dezelfde route, en welke gold hing af van de volgorde van de
   requires. Dat is geen verklaring meer maar een loterij.

   Deze controle draait bij het laden en GOOIT. Dat is streng, en met opzet: een
   duplicaatregel stuurt de idem-poort, en een poort die van een require-volgorde
   afhangt is erger dan geen poort.

   De lijst met delen staat hier en niet in de aanroeper, zodat een nieuw
   zijbestand op EEN plek wordt toegevoegd -- de fout die dit huis eerder maakte
   met de vier hardgecodeerde contractbestanden in scripts/effectcontracten.js.
   ========================================================================== */
'use strict';

const DELEN = ['werelden', 'geld', 'kosten', 'commerce', 'kaleronde', 'kaleronde-b'];

module.exports = function eenmaal() {
  const zien = new Map();
  for (const d of DELEN) {
    for (const route of Object.keys(require('./idemsleutels-' + d).SLEUTELS || {})) {
      if (zien.has(route)) {
        throw new Error('idemsleutels: ' + route + ' staat in twee bestanden (' + zien.get(route) +
          ' en ' + d + '). Twee verklaringen over dezelfde route is geen verklaring maar een ' +
          'loterij -- haal er een weg.');
      }
      zien.set(route, d);
    }
  }
  return zien.size;
};
