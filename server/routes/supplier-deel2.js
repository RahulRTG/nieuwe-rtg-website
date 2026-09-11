/* DE TWEEDE HELFT VAN DE SUPPLIER-MONTAGE (zie ./supplier.js).

   Dit is GEEN tweede domein en geen tweede kern: het is dezelfde montagelijst,
   doormidden. ./supplier.js liep over de 10 KB van keuringsregel 13, en die
   grens zegt normaal "hier zit een tweede onderwerp in". Hier zegt hij iets
   anders, en dat hoort erbij te staan: een lijst van vijfenzestig montageregels
   HEEFT geen tweede onderwerp -- hij is gegroeid tot een bestand vol.

   DE VOLGORDE IS ONAANGETAST. De regels staan hier woordelijk in de stand waarin
   ze in ./supplier.js stonden, en dat bestand roept dit bestand aan op precies
   de plek waar de eerste verhuisde regel stond. Express monteert op volgorde,
   dus dat is geen netheid maar de enige manier waarop een knip als deze niets
   verandert.

   Wie hier een route bijzet: onderaan, net als hiervoor. */
'use strict';

module.exports = (kern) => {
  require('./supplier/retail')(kern);
  require('./supplier/paspoort')(kern);
  require('./supplier/salon')(kern);
  require('./supplier/events')(kern);
  require('./supplier/financien')(kern);
  require('./supplier/btw')(kern);
  require('./supplier/vervoer')(kern);
  require('./supplier/kassa')(kern);
  require('./supplier/horeca')(kern); // RTG Horeca OS: rekeningen, keuken, bezorging, club, hotel-folio
  /* De retourstroom, verkoperkant (kern/commerce/retour.js, COMMERCE.md par. 6).
     De ledenkant staat in routes/commerce.js; de standen die de VERKOPER zet,
     komen alleen langs deze deur. */
  require('./supplier/retour')(kern);
  /* Een club, bond of label bevestigt een regel in het ledger van een mens
     (kern/carriereledger/). Het LID levert het regelnummer aan: er is met opzet
     geen route waarmee een zaak een ledger kan doorzoeken. */
  require('./supplier/carriereledger')(kern);
  /* De verkoopwegen van de zaak (kern/commerce/verkoopweg.js): waarlangs zij
     verkoopt. Publiek verkopen weigert de motor met de reden; zie de kop daar. */
  require('./supplier/verkoopweg')(kern);
  require('./supplier/werving')(kern);
  /* "Vooruit": dezelfde Control Tower als de ledenkant, op de code van de zaak.
     Zie de kop van ./supplier/vooruit.js. */
  require('./supplier/vooruit')(kern);
};
