/* DE DEMO-PERSONA'S: wie een demosessie per pas is.

   Codenaam: elke klant krijgt een pseudoniem. Reserveringen, betalingen en
   reisdata staan in onze systemen op de codenaam; de echte naam ligt in een
   gescheiden kluis en wordt pas bij ticketing/check-in eenmalig gekoppeld.
   Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam.

   Deze tabel geldt alleen voor een DEMOsessie zonder account: die heeft geen
   kluisrij, dus staat hier per pas wat die sessie te zien krijgt. Een echt
   account leest dit nooit (server.js geborenVan, kern/lid.js).

   WAAROM EEN EIGEN BESTAND. De tabel stond in server/server.js en ging van
   daaruit via de kern-tas naar vijftig functies. scripts/activering.js kon
   daardoor niet zeggen waar `PERSONAS` vandaan kwam -- een object zonder
   functies, gebouwd in de bedrading -- en elke functie die hem las, kreeg een
   envelop met een ondergrens. Als eigen module is de herkomst een require en
   dus te meten, en is server.js een onderwerp lichter.

   module.exports IS de tabel zelf, en geen object eromheen: wat de tas
   meekrijgt moet hetzelfde object zijn als wat require() teruggaf, anders is
   de herkomst opnieuw onzichtbaar. */
'use strict';

module.exports = {
  guest:     { name: 'Gast',         full: 'Gast',               since: null,             number: null,                codename: 'GAST' },
  rtg:       { name: 'K. Kiss',    full: 'Katja Kiss',    since: 'Maart 2026',     number: 'RTG · 2026 · 8841', codename: 'Amberen Vos',      geboren: '1994-09-14' },
  lifestyle: { name: 'F. Johanna', full: 'Fleur Johanna', since: 'Augustus 2025',  number: 'LSP · 2025 · 0217', codename: 'Gouden Ibis',      geboren: '1957-02-20' },
  business:  { name: 'R. Imran',   full: 'Rahul Imran',   since: 'November 2025',  number: 'BSP · 2025 · 1104', codename: 'Noordelijke Ster', geboren: '1992-11-30' }
};
