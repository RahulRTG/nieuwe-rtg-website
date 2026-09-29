/* RTG Vonk-bedrading, uit kernlaag7 gehouden zodat die samenstellingslaag alleen
   de volgorde bewaakt. Alle productlogica blijft in kern/vonk. */
'use strict';

module.exports = function bindVonk(kern, hulp) {
  const { db, save, crypto, schoon, accounts, leeftijdVan, keyVanCodenaam,
    haversine, etaMinutes, media, notify, sseToCustomer, sseToOffice } = hulp;
  Object.assign(kern, require('../kern/vonk').maakVonk({
    db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan: kern.codenaamVan,
    keyVanCodenaam, haversine, etaMinutes, reserveerTafel: kern.reserveerTafel,
    pay: kern.pay, notify, sseToCustomer, sseToOffice,
    connectionBlocking: kern.connectionBlocking, media,
    connectionMediaTicketSecret: process.env.RTG_ENC_KEY
  }));
};
