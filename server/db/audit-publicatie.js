'use strict';
/* De SQL-COMMIT mag niet gevolgd worden door een door de caller ingevoerde
   getter/setter. Bereid resultaatpublicatie en opslagbewaking vóór COMMIT voor;
   de synchrone publicatie daarna bevat uitsluitend bekende data-eigenschappen. */
const { isProxy } = require('node:util').types;

function bereidResultaat(doel, waarde) {
  if (!doel || typeof doel !== 'object' || isProxy(doel)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(doel)))
    throw new Error('Auditresultaat vereist een gewoon schrijfbaar data-object.');
  const bron = Object(waarde), velden = [];
  if (isProxy(bron)) throw new Error('Auditresultaat mag geen Proxy-bron bevatten.');
  for (const sleutel of Reflect.ownKeys(bron)) {
    const van = Object.getOwnPropertyDescriptor(bron, sleutel);
    if (!van.enumerable) continue;
    const naar = Object.getOwnPropertyDescriptor(doel, sleutel);
    if (!Object.hasOwn(van, 'value') || (naar && (!Object.hasOwn(naar, 'value') || !naar.writable))
        || (!naar && !Object.isExtensible(doel)))
      throw new Error('Auditresultaat bevat een accessor of niet-schrijfbaar veld.');
    velden.push([sleutel, naar ? { value: van.value }
      : { value: van.value, writable: true, enumerable: true, configurable: true }]);
  }
  return () => {
    // Geen Object.assign: ook een eigen __proto__-veld is gewone data.
    for (const [sleutel, descriptor] of velden) Object.defineProperty(doel, sleutel, descriptor);
  };
}

module.exports = ({ db, cache, leesBinnen }) => {
  function publicaties(results) {
    const snapshots = [...new Set(results.map(r => r.op.naam))].map(naam => {
      const nieuw = leesBinnen(naam);
      require('../opzet/begroting').toetsOpslag(db.data, naam, nieuw.waarde);
      return [naam, nieuw];
    });
    // Als een caller zijn preview intussen heeft bevroren of van accessors
    // voorzien, faalt de transactie hier, vóór de native COMMIT.
    return { snapshots, resultaten: results.map(r => bereidResultaat(r.op.resultaat, r.resultaat)) };
  }
  function naCommit(_results, doos, voorbereid) {
    for (const publiceer of voorbereid.resultaten) publiceer();
    if (doos?.auditOps) { doos.auditOps.length = 0; doos.auditViews.clear(); }
    for (const [naam, nieuw] of voorbereid.snapshots) {
      db.data[naam] = nieuw.waarde; nieuw.root = db.data; nieuw.pending = null; cache.set(naam, nieuw);
    }
  }
  return { publicaties, naCommit,
    resultaat: (doel, waarde) => bereidResultaat(doel, waarde)() };
};
module.exports.bereidResultaat = bereidResultaat;
