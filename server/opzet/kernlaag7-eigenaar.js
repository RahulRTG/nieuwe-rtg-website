/* DE EIGENAARSLAAG -- twee mounts die bij elkaar horen en samen te groot zijn
   voor ./kernlaag7.js (keuringsregel 13). Zelfde patroon als ./kernlaag7-ruimtes.js.

   DE ZWARE POORT (kern/zwaarbewijs.js), EEN keer gebouwd voor het hele huis.
   Elk domein reikt daardoor naar EEN naam in GRENZEN.json in plaats van naar
   accounts/beveilig/appUrl -- drie domeingrenzen verbreden om een poort te
   bedraden zou het kantoor rechtstreeks in de identiteitskluis zetten, en dan
   bewaakt die grens niets meer.

   HET HERSTELQUORUM (kern/eigenaarherstel.js) is de weg terug als er geen
   toestel meer is: twee van de drie delen, een wachttijd van zeven dagen, en
   elke nog werkende passkey breekt hem af. Zie EIGENAAR.md par. 5.

   `appUrl`, `beveilig` en `mail` gaan als GETTER mee: alle drie bestaan ze op
   dit punt in de montage nog niet, en een waarde meegeven zou ze voorgoed op
   `undefined` zetten -- dan verdwijnt juist de melding en de mail die een
   herstel luidruchtig moeten maken. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, db, log, mail, save } = hulp;
  const eigenaar = require('../eigenaar');

  kern.zwaarbewijs = require('../kern/zwaarbewijs')({ zwaarBeveiliging: kern.zwaarBeveiliging,
    accounts, log, appUrl: (req) => kern.appUrl(req), beveiligVan: () => kern.beveilig });

  kern.eigenaarherstel = require('../kern/eigenaarherstel')({
    db, save, log,
    beveiligVan: () => kern.beveilig,
    mailVan: () => mail,
    eigenaarEmail: () => eigenaar.eigenaarEmail()
  });
};
