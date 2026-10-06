'use strict';

/* Neemt nieuwere collectieversies van andere SQLite-processen over.

   De poll leest versies en alleen de externe payloads in ÉÉN SQLite-snapshot.
   Zonder de readtransactie kan een externe multicollectiecommit tussen twee
   leespogingen een oud saldo naast een nieuw grootboek publiceren. De readlock
   eindigt vóór het toepassen en de sessiecallback; WAL-schrijvers kunnen tijdens
   het lezen blijven werken. Eigen al toegepaste payloads worden niet geladen.

   Een lokale, nog niet gecommitte mutatie wint niet stil van een externe
   versie: gewone versies worden samengevoegd. Een nieuwere verwijdering wint
   altijd van een oudere werkkopie; anders kan een tweede instance een
   intrekking of AVG-verwijdering laten herrijzen. */
function snapshot(kvdb, werk) {
  kvdb.exec('BEGIN');
  try {
    const uit = werk();
    kvdb.exec('COMMIT');
    return uit;
  } catch (error) {
    try { kvdb.exec('ROLLBACK'); } catch (rollbackError) { /* de lezing blijft mislukt */ }
    throw error;
  }
}
function externeCollecties(kvdb, statements, toegepast, leesAudit) {
  return snapshot(kvdb, () => {
    const rows = [];
    for (const versie of statements.versies.all()) {
      if (versie.ver <= (toegepast.get(versie.key) || 0)) continue;
      const rij = statements.lees.get(versie.key);
      if (rij && rij.ver > (toegepast.get(versie.key) || 0))
        rows.push({ key: versie.key, val: rij.val, ver: rij.ver, deleted: rij.deleted });
    }
    return { rows, audit: leesAudit() };
  });
}

/* `lees` geeft { rows, audit } uit één snapshot (of null zonder verbinding);
   `publiceerAudit` zet de auditprojecties pas om nadat alles voorbereid is. */
function maakPoll(deps) {
  const { lees, publiceerAudit, toegepast, laatsteJson, db, uitStore, merge3,
    voorcheck, mutaties, externCb } = deps;

  return function pollSqlite() {
    try {
      const gelezen = lees();
      if (!gelezen) return;
      const vuil = new Set(mutaties.snapshot().map(r => r.collectie));
      const voorbereid = [];
      for (const r of gelezen.rows) {
        const sleutel = r.key;
        if (Number(r.deleted) === 1) { voorbereid.push({ sleutel, weg: true, ver: r.ver }); continue; }
        const basis = laatsteJson.get(sleutel);
        const hunJson = uitStore(r.val);
        const lokaalOpenstaand = vuil.has(sleutel) ||
          (basis !== undefined && JSON.stringify(db.data[sleutel]) !== basis);
        const waarde = lokaalOpenstaand
          ? merge3(basis === undefined ? undefined : JSON.parse(basis), db.data[sleutel], JSON.parse(hunJson))
          : JSON.parse(hunJson);
        voorbereid.push({ sleutel, waarde, hunJson, lokaalOpenstaand, ver: r.ver });
      }
      publiceerAudit(gelezen.audit || []);
      let sessieGewijzigd = false;
      for (const v of voorbereid) {
        if (v.weg) {
          /* Een nieuwere tombstone is een autoritatieve verwijdering. Een
             verouderde lokale werkkopie mag haar nooit stil terugschrijven.
             Expliciet herscheppen kan alleen via de autoritatieve
             collectiepoort, die onder een SQLite-slot vanaf een lege basis werkt. */
          laatsteJson.delete(v.sleutel);
          if (Object.prototype.hasOwnProperty.call(db.data, v.sleutel)) delete db.data[v.sleutel];
          mutaties.vergeet(v.sleutel);
        } else {
          db.data[v.sleutel] = v.waarde;
          // Openstaand lokaal werk blijft vuil, zodat de volgende save het wegschrijft.
          if (!v.lokaalOpenstaand) { laatsteJson.set(v.sleutel, v.hunJson); mutaties.vergeet(v.sleutel); }
        }
        toegepast.set(v.sleutel, v.ver);
        // De inhoud komt van BUITEN: wat de voorcheck van deze collectie meende te
        // weten, geldt niet meer. Vergeten, zodat de volgende save hem exact nakijkt.
        voorcheck.vergeet(v.sleutel);
        if (v.sleutel === 'sessions') sessieGewijzigd = true;
      }
      if (sessieGewijzigd) { const cb = externCb(); if (cb) cb(); }
    } catch (e) {
      console.warn('[db] sqlite-sync mislukt:', e.message);
    }
  };
}

module.exports = maakPoll;
module.exports.snapshot = snapshot;
module.exports.externeCollecties = externeCollecties;
