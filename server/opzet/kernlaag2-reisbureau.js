/* DE KERN SAMENSTELLEN -- het volledige reisbureau.

   Dit is een echte domeinnaad uit kernlaag2: het bestaande reisbureau, zijn
   betaling en de federatieve reisketen delen dezelfde opslag en late haken.
   De routes krijgen een enkele reisketen-facade; toegang en export zijn
   onderdelen daarvan en verbreden de publieke kern dus niet afzonderlijk. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, anthropic, crypto, db, save } = hulp;

  Object.assign(kern, require('../kern/reisbureau').maakReisbureau({ db, save, crypto, anthropic, accounts,
    bewerkCollectie: hulp.bewerkCollectie,
    visumtaakVan: () => kern.visumtaak, meldLidVan: () => kern.meldLid, reisbetalingVan: () => kern.reisbetaling }));
  Object.assign(kern, require('../kern/reisbureau-betaling').maakReisbetaling({
    db, save, crypto, bewerkCollectie: hulp.bewerkCollectie, payVan: () => kern.pay, reisbureauVan: () => kern.reisbureau }));

  const toegang = require('../kern/reisbureau-toegang').maakReisToegang(kern);
  const keten = require('../kern/reisbureau-keten').maakReisketen({
    bewerkCollectie: hulp.bewerkCollectie, toegang, payVan: () => kern.pay });
  keten.toegang = toegang;
  keten.export = require('../kern/reisbureau-ketenexport')({
    bewerkCollectie: hulp.bewerkCollectie, toegang,
    uitgangVan: () => kern.tenant && kern.tenant.uitgang });
  kern.reisbureau.keten = keten;
};
