/* De boekhouding van een accountwerkkopie (./transactie.js): TEMP-triggers die
   per tabel vastleggen welke rijen een verzoek raakte, met hun basis van vóór
   het verzoek, en de lijst wijzigingen die daaruit volgt voor de
   PostgreSQL-commit. Afgesplitst omdat dit het SQL-werk is en transactie.js de
   levensloop (slot, deelnemer, wachten, verval). */
'use strict';

const q = naam => '"' + String(naam).replace(/"/g, '""') + '"';

module.exports = function maakVolgerLaag(fout) {
  function kolommen(db, tabel) {
    return db.prepare('PRAGMA table_info(' + q(tabel) + ')').all().map(r => String(r.name));
  }

  function maakVolgers(db, tabel, prefix) {
    const cols = kolommen(db, tabel);
    if (!cols.includes('id')) throw fout('PG_ACCOUNTS_SCHEMA', tabel + ' heeft geen id-kolom.');
    const lijst = cols.map(q).join(', ');
    const oud = cols.map(c => 'OLD.' + q(c)).join(', ');
    db.exec(`CREATE TEMP TABLE ${q(prefix + '_basis')} AS SELECT ${lijst} FROM main.${q(tabel)} WHERE 0;
      CREATE UNIQUE INDEX ${q(prefix + '_basis_id')} ON ${q(prefix + '_basis')}(id);
      CREATE TEMP TABLE ${q(prefix + '_geraakt')}(id INTEGER PRIMARY KEY);
      CREATE TEMP TABLE ${q(prefix + '_nieuw')}(id INTEGER PRIMARY KEY);
      CREATE TEMP TRIGGER ${q(prefix + '_bi')} BEFORE INSERT ON main.${q(tabel)} BEGIN
        INSERT OR IGNORE INTO ${q(prefix + '_geraakt')}(id) VALUES(NEW.id);
        INSERT OR IGNORE INTO ${q(prefix + '_nieuw')}(id) VALUES(NEW.id);
      END;
      CREATE TEMP TRIGGER ${q(prefix + '_bu')} BEFORE UPDATE ON main.${q(tabel)} BEGIN
        INSERT OR IGNORE INTO ${q(prefix + '_geraakt')}(id) VALUES(OLD.id);
        INSERT OR IGNORE INTO ${q(prefix + '_basis')}(${lijst})
          SELECT ${oud} WHERE NOT EXISTS(SELECT 1 FROM ${q(prefix + '_nieuw')} WHERE id=OLD.id);
      END;
      CREATE TEMP TRIGGER ${q(prefix + '_bd')} BEFORE DELETE ON main.${q(tabel)} BEGIN
        INSERT OR IGNORE INTO ${q(prefix + '_geraakt')}(id) VALUES(OLD.id);
        INSERT OR IGNORE INTO ${q(prefix + '_basis')}(${lijst})
          SELECT ${oud} WHERE NOT EXISTS(SELECT 1 FROM ${q(prefix + '_nieuw')} WHERE id=OLD.id);
      END;`);
    return { tabel, prefix, cols };
  }

  function rij(db, sql, id) { return db.prepare(sql).get(id) || null; }

  function wijzigingenVan(tx, volg) {
    const ids = tx.db.prepare(`SELECT id FROM ${q(volg.prefix + '_geraakt')} ORDER BY id`).all();
    const basisSql = `SELECT * FROM ${q(volg.prefix + '_basis')} WHERE id=?`;
    const naSql = `SELECT * FROM main.${q(volg.tabel)} WHERE id=?`;
    const uit = [];
    for (const x of ids) {
      const basis = rij(tx.db, basisSql, x.id);
      const na = rij(tx.db, naSql, x.id);
      if (!basis && !na) continue; // binnen hetzelfde verzoek gemaakt en weer gewist
      uit.push({ tabel: volg.tabel, id: Number(x.id), basis, na });
    }
    return uit;
  }

  return { q, maakVolgers, wijzigingenVan };
};
