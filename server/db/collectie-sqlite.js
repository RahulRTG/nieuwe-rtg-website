/* Autoritatieve read-modify-write op één SQLite-collectie. De SQLite-motor
   levert zijn reeds geopende verbinding, statements en cachekaarten aan. */
'use strict';

const publiceerCollectie = require('./collectie-publicatie');
const { merge3 } = require('./merge');
const { melder } = require('./botsing'); // C6: een botsing is hoorbaar, ook hier

module.exports = ({ db, verbinding, statements, uitStore, naarStore,
  laatsteJson, toegepast, voorcheck, mutaties }) => function collectieSlotSqlite(sleutel, werk) {
  if (!db.writable) throw new Error('De SQLite-opslag is niet schrijfbaar.');
  const kv = verbinding();
  const { bump, huidig, lees, up } = statements();
  let waardeNa, antwoord, jsonVoor, publicatieBasisJson, jsonNa, versieNa = null;
  let grafsteenGevonden = false;
  kv.exec('BEGIN IMMEDIATE');
  try {
    const gevonden = lees.get(sleutel);
    const rij = gevonden && !gevonden.deleted ? gevonden : null;
    const grafsteen = !!(gevonden && gevonden.deleted);
    grafsteenGevonden = grafsteen;
    /* Een tombstone is niet hetzelfde als "geen rij". Bij geen rij mag de
       bestaande lokale beginstand de eerste commit vormen. Bij een tombstone
       is die lokale stand juist aantoonbaar verouderd: een expliciete
       domeintransactie mag de collectie herscheppen, maar uitsluitend vanaf
       een lege waarde met dezelfde container-vorm. */
    const leeg = Array.isArray(db.data[sleutel]) ? [] : {};
    jsonVoor = rij ? uitStore(rij.val)
      : JSON.stringify(grafsteen ? leeg : (db.data[sleutel] == null ? {} : db.data[sleutel]));
    const dbBasis = JSON.parse(jsonVoor);
    // Een collectie die dit proces nooit las heeft nog geen lokale basis.
    // De verse DB-rij als basis nemen ziet haar afwezigheid in RAM ten
    // onrechte als verwijdering en wist de eerste commit van een ander proces.
    const liveVoor = db.data[sleutel] == null ? (Array.isArray(dbBasis) ? [] : {}) : db.data[sleutel];
    const cacheBasis = laatsteJson.has(sleutel)
      ? JSON.parse(laatsteJson.get(sleutel)) : (Array.isArray(liveVoor) ? [] : {});
    publicatieBasisJson = JSON.stringify(liveVoor);
    waardeNa = grafsteen ? JSON.parse(jsonVoor)
      : JSON.parse(JSON.stringify(merge3(cacheBasis, liveVoor, dbBasis, melder(sleutel))));
    antwoord = werk(waardeNa);
    if (antwoord && typeof antwoord.then === 'function')
      throw new Error('De bewerker van een collectietransactie mag niet asynchroon zijn.');
    jsonNa = JSON.stringify(waardeNa);
    if (jsonNa !== jsonVoor) {
      bump.run();
      versieNa = huidig.get().v;
      up.run(sleutel, naarStore(jsonNa), versieNa);
    } else if (gevonden) versieNa = gevonden.ver;
    kv.exec('COMMIT');
  } catch (e) {
    try { kv.exec('ROLLBACK'); } catch (x) {}
    throw e;
  }
  /* Ook zonder async callback kan een gewone, door de grote-collectie-rem nog
     openstaande mutatie al in db.data staan. Houd die boven op de zojuist
     gecommitte DB-waarde en laat laatsteJson naar de DB-basis wijzen. */
  if (grafsteenGevonden && jsonNa === jsonVoor && versieNa != null) {
    /* Een no-op boven een tombstone is geen herschepping. Neem de verwijdering
       in de levende cache over; publiceerCollectie zou anders zonder DB-write
       een lege collectie als gecommitte waarheid presenteren. */
    delete db.data[sleutel];
    toegepast.set(sleutel, Number(versieNa));
    mutaties.vergeet(sleutel);
    voorcheck.vergeet(sleutel);
    return antwoord;
  }
  publiceerCollectie({ dataNu: db.data, sleutel, basisJson: publicatieBasisJson,
    commitWaarde: waardeNa, commitJson: jsonNa, versie: versieNa,
    toegepast, laatsteJson });
  voorcheck.vergeet(sleutel);
  return antwoord;
};
