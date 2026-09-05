/* Autoritatieve read-modify-write op één SQLite-collectie. De SQLite-motor
   levert zijn reeds geopende verbinding, statements en cachekaarten aan. */
'use strict';

const publiceerCollectie = require('./collectie-publicatie');
const { merge3 } = require('./merge');

module.exports = ({ db, verbinding, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck }) => function collectieSlotSqlite(sleutel, werk) {
  if (!db.writable) throw new Error('De SQLite-opslag is niet schrijfbaar.');
  const kv = verbinding();
  const { bump, huidig, lees, up } = statements();
  let waardeNa, antwoord, jsonVoor, publicatieBasisJson, jsonNa, versieNa = null;
  kv.exec('BEGIN IMMEDIATE');
  try {
    const rij = lees.get(sleutel);
    jsonVoor = rij ? uitStore(rij.val) : JSON.stringify(db.data[sleutel] == null ? {} : db.data[sleutel]);
    const dbBasis = JSON.parse(jsonVoor);
    const cacheBasis = laatsteJson.has(sleutel)
      ? JSON.parse(laatsteJson.get(sleutel)) : dbBasis;
    const liveVoor = db.data[sleutel] == null ? {} : db.data[sleutel];
    publicatieBasisJson = JSON.stringify(liveVoor);
    waardeNa = JSON.parse(JSON.stringify(merge3(cacheBasis, liveVoor, dbBasis)));
    antwoord = werk(waardeNa);
    if (antwoord && typeof antwoord.then === 'function')
      throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
    jsonNa = JSON.stringify(waardeNa);
    if (jsonNa !== jsonVoor) {
      bump.run();
      versieNa = huidig.get().v;
      up.run(sleutel, naarStore(jsonNa), versieNa);
    } else if (rij) versieNa = rij.ver;
    kv.exec('COMMIT');
  } catch (e) {
    try { kv.exec('ROLLBACK'); } catch (x) {}
    throw e;
  }
  /* Ook zonder async callback kan een gewone, door de grote-collectie-rem nog
     openstaande mutatie al in db.data staan. Houd die boven op de zojuist
     gecommitte DB-waarde en laat laatsteJson naar de DB-basis wijzen. */
  publiceerCollectie({ dataNu: db.data, sleutel, basisJson: publicatieBasisJson,
    commitWaarde: waardeNa, commitJson: jsonNa, versie: versieNa,
    toegepast, laatsteJson });
  voorcheck.vergeet(sleutel);
  return antwoord;
};
