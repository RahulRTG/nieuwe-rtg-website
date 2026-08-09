/* DE BEDRADING VAN HET THEATER (kern/theater/).

   De videobibliotheek van het huis: kanalen na menselijke goedkeuring, en de
   bytes blijven origineel -- geen hercompressie, ze staan als bestanden in de
   datamap en nooit in git.

   Sinds Media for Business hangt er een tweede wereld aan hetzelfde domein: de
   INTERNE bibliotheek van een organisatie (kern/theater/zaak.js). Daarom gaan
   `accounts` en `findSupplier` mee -- daar leest kern/werkplekken.js uit wie
   waar werkt, dezelfde bron die het Podium voor zone 'zaak' gebruikt.

   Eigen bestand om dezelfde reden als ./mediaos.js: het is een eigen onderwerp,
   en ./kernlaag7.js blijft er onder de omvangregel mee. Aangeroepen vanuit
   kernlaag7, VOOR de Media OS -- die leest het Theater. */
'use strict';

module.exports = (kern, hulp) => {
  const { db, save, crypto, schoon, notify, sseToOffice, sseToCustomer, accounts, findSupplier, path } = hulp;
  Object.assign(kern, require('../kern/theater').maakTheater({
    db, save, crypto, schoon, codenaamVan: kern.codenaamVan, notify, sseToOffice, sseToCustomer,
    accounts, findSupplier,
    mediaDir: path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'theater'),
    // de Media-OS-haak: nieuw werk wekt volgers (./mediaos.js)
    nieuwWerk: (k2, s2, t2) => (kern.mediaNieuwWerk ? kern.mediaNieuwWerk(k2, s2, t2) : null)
  }));
};
