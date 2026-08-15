/* Autoritatieve read-modify-write op één SQLite-collectie. De SQLite-motor
   levert zijn reeds geopende verbinding, statements en cachekaarten aan. */
'use strict';

module.exports = ({ db, verbinding, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck }) => function collectieSlotSqlite(sleutel, werk) {
  if (!db.writable) throw new Error('De SQLite-opslag is niet schrijfbaar.');
  const kv = verbinding();
  const { bump, huidig, lees, up } = statements();
  let waardeNa, antwoord, jsonNa, versieNa = null;
  kv.exec('BEGIN IMMEDIATE');
  try {
    const rij = lees.get(sleutel);
    const jsonVoor = rij ? uitStore(rij.val) : JSON.stringify(db.data[sleutel] == null ? {} : db.data[sleutel]);
    waardeNa = JSON.parse(jsonVoor);
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
  db.data[sleutel] = waardeNa;
  laatsteJson.set(sleutel, jsonNa);
  if (versieNa != null) toegepast.set(sleutel, Number(versieNa));
  voorcheck.vergeet(sleutel);
  return antwoord;
};
