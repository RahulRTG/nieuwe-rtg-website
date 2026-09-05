/* De opslag-onafhankelijke ingang voor één collectietransactie.

   PostgreSQL en SQLite hebben een eigen database-slot. De éénprocesmotoren
   werken op een kopie en publiceren pas nadat save() de wijziging aannam, zodat
   een gooiende save geen halve RAM-toestand achterlaat. */
'use strict';

module.exports = ({ store, postgres, sqlite, db, save }) =>
  function bewerkCollectie(sleutel, werk) {
    sleutel = String(sleutel || '').trim();
    if (!sleutel || sleutel.length > 120 || typeof werk !== 'function')
      throw new Error('Collectietransactie vereist een geldige sleutel en bewerker.');
    if (store === 'postgres') return postgres.bewerkCollectiePostgres(sleutel, werk);
    if (store === 'sqlite') return sqlite.bewerkCollectieSqlite(sleutel, werk);
    if (!db.writable) throw new Error('De opslag is niet schrijfbaar.');
    const oud = db.data[sleutel];
    const waarde = JSON.parse(JSON.stringify(oud == null ? {} : oud));
    const voor = JSON.stringify(waarde);
    const resultaat = werk(waarde);
    if (resultaat && typeof resultaat.then === 'function')
      throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
    if (JSON.stringify(waarde) === voor) return resultaat;
    db.data[sleutel] = waarde;
    try { save(); }
    catch (e) { db.data[sleutel] = oud; throw e; }
    return resultaat;
  };
