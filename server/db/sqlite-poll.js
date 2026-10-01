'use strict';

/* De poll leest versies en alleen de externe payloads in ÉÉN SQLite-snapshot.
   Zonder de readtransactie kan een externe multicollectiecommit tussen twee
   leespogingen een oud saldo naast een nieuw grootboek publiceren. De readlock
   eindigt vóór het toepassen en de sessiecallback; WAL-schrijvers kunnen tijdens
   het lezen blijven werken. Eigen al toegepaste payloads worden niet geladen. */
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
module.exports = function externeCollecties(kvdb, statements, toegepast, leesAudit) {
  return snapshot(kvdb, () => {
    const rows = [];
    for (const versie of statements.versies.all()) {
      if (versie.ver <= (toegepast.get(versie.key) || 0)) continue;
      const rij = statements.lees.get(versie.key);
      if (rij && rij.ver > (toegepast.get(versie.key) || 0)) rows.push({ key: versie.key, val: rij.val, ver: rij.ver });
    }
    return { rows, audit: leesAudit() };
  });
};
module.exports.snapshot = snapshot;
