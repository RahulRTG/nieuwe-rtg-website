/* Neemt nieuwere collectieversies van andere SQLite-processen over.

   Een lokale, nog niet gecommitte mutatie wint niet stil van een externe
   versie: gewone versies worden samengevoegd. Een nieuwere verwijdering wint
   altijd van een oudere werkkopie; anders kan een tweede instance een
   intrekking of AVG-verwijdering laten herrijzen. */
'use strict';

module.exports = function maakPoll(deps) {
  const { verbinding, toegepast, laatsteJson, db, uitStore, merge3,
    voorcheck, mutaties, externCb } = deps;

  return function pollSqlite() {
    const kvdb = verbinding();
    if (!kvdb) return;
    try {
      let laagst = 0;
      for (const v of toegepast.values()) if (v < laagst || laagst === 0) laagst = v;
      const rows = kvdb.prepare('SELECT key, val, ver, deleted FROM kv WHERE ver > ?').all(laagst);
      const vuil = new Set(mutaties.snapshot().map(r => r.collectie));
      let sessieGewijzigd = false;
      for (const r of rows) {
        if (r.ver <= (toegepast.get(r.key) || 0)) continue;
        const heeft = Object.prototype.hasOwnProperty.call(db.data, r.key);
        const basis = laatsteJson.get(r.key);
        const lokaalOpenstaand = vuil.has(r.key) ||
          (basis !== undefined && JSON.stringify(db.data[r.key]) !== basis);

        if (r.deleted) {
          /* Een nieuwere tombstone is een autoritatieve verwijdering. Een
             verouderde lokale werkkopie mag haar nooit stil terugschrijven:
             dat zou onder meer een intrekking of AVG-verwijdering op een
             tweede instance kunnen laten herrijzen. Expliciet herscheppen kan
             alleen via de autoritatieve collectiepoort, die onder een SQLite-
             slot vanaf een lege basis werkt. */
          laatsteJson.delete(r.key);
          if (heeft) delete db.data[r.key];
          mutaties.vergeet(r.key);
        } else {
          const hunJson = uitStore(r.val);
          if (lokaalOpenstaand) {
            db.data[r.key] = merge3(basis === undefined ? undefined : JSON.parse(basis),
              db.data[r.key], JSON.parse(hunJson));
          } else {
            db.data[r.key] = JSON.parse(hunJson);
            laatsteJson.set(r.key, hunJson);
            mutaties.vergeet(r.key);
          }
        }
        toegepast.set(r.key, r.ver);
        voorcheck.vergeet(r.key);
        if (r.key === 'sessions') sessieGewijzigd = true;
      }
      if (sessieGewijzigd) { const cb = externCb(); if (cb) cb(); }
    } catch (e) {
      console.warn('[db] sqlite-sync mislukt:', e.message);
    }
  };
};
