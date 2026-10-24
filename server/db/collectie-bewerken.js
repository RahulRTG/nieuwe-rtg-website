/* De opslag-onafhankelijke ingang voor één collectietransactie.

   PostgreSQL en SQLite hebben een eigen database-slot. De éénprocesmotoren
   werken op een kopie en publiceren pas nadat save() de wijziging aannam, zodat
   een gooiende save geen halve RAM-toestand achterlaat. */
'use strict';
const contractVan = require('./collectie-contract');

module.exports = ({ store, postgres, sqlite, db, save }) =>
  function bewerkCollectie(sleutel, werk) {
    const contract = contractVan(sleutel, werk);
    if (!contract.getypeerd) sleutel = contract.sleutels[0];
    if (store === 'postgres') return postgres.bewerkCollectiePostgres(sleutel, werk);
    if (store === 'sqlite') return sqlite.bewerkCollectieSqlite(sleutel, werk);
    if (!db.writable) throw new Error('De opslag is niet schrijfbaar.');
    const waarden = Object.create(null), standen = [];
    for (const k of contract.sleutels) {
      const bestaat = Object.hasOwn(db.data, k), oud = db.data[k];
      if (contract.getypeerd && bestaat) contract.controleer(k, oud);
      const waarde = JSON.parse(JSON.stringify(oud == null ? contract.leeg(k) : oud));
      waarden[k] = waarde; standen.push({ k, bestaat, oud, voor: JSON.stringify(waarde) });
    }
    const resultaat = contract.getypeerd
      ? werk(waarden, contract.context(standen.map(s => [s.k, s.bestaat]))) : werk(waarden[sleutel]);
    if (resultaat && typeof resultaat.then === 'function')
      throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
    contract.controleerMap(waarden);
    const gewijzigd = standen.filter(s => JSON.stringify(waarden[s.k]) !== s.voor);
    if (!gewijzigd.length) return resultaat;
    for (const s of gewijzigd) db.data[s.k] = contract.getypeerd
      ? JSON.parse(JSON.stringify(waarden[s.k])) : waarden[s.k];
    try { save(); }
    catch (e) {
      for (const s of gewijzigd) {
        if (s.bestaat) db.data[s.k] = s.oud; else delete db.data[s.k];
      }
      throw e;
    }
    return resultaat;
  };
