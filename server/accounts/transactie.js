/* Voorbereiding voor een request-lokale werkkopie van users en supplier_staff.

   Deze participant is nog niet aangesloten op de centrale requestcommit.
   duurzaamheid.js activeert hem daarom niet en houdt productiewrites dicht.

   SQLite is hier nadrukkelijk GEEN waarheid. Een productieverzoek schrijft op
   een aparte verbinding binnen een nog niet gecommitte SQLite-transactie. De
   globale verbinding blijft daardoor de laatst bevestigde cache en andere
   verzoeken kunnen nooit half werk lezen. Aan het einde levert deze module de
   exacte geraakte rijen plus hun basis aan de PostgreSQL-requesttransactie.
   Alleen als DIE commit slaagt, committen we ook de lokale cache.

   Eén proces laat maximaal één accountwerkkopie tegelijk schrijven. SQLite kan
   een tweede synchrone schrijver anders laten wachten terwijl de eerste op een
   asynchrone PostgreSQL-commit wacht: de event-loop zou zichzelf dan blokkeren.
   De tweede schrijver krijgt daarom direct een herhaalbare 503. Lezers blijven
   door WAL gewoon op de laatst bevestigde cache werken. */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const verzoekcontext = require('../db/verzoekcontext');
const S = require('./state');

let actief = null;

const fout = (code, tekst, status = 503) =>
  Object.assign(new Error(tekst), { code, status });
const q = naam => '"' + String(naam).replace(/"/g, '""') + '"';

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

function ruim(tx, commit) {
  if (!tx || tx.afgerond) return;
  tx.afgerond = true;
  try { tx.db.exec(commit ? 'COMMIT' : 'ROLLBACK'); } catch (e) {
    /* PostgreSQL kan al gecommit zijn. Een cache-publicatiefout mag dan nooit
       een 503 over een geslaagde autoritatieve commit veroorzaken. De eigen
       NOTIFY/pull of een herstart bouwt de cache opnieuw op. */
    if (!commit) throw e;
    console.error('[accounts] lokale cachepublicatie na PostgreSQL-commit mislukt:', e.message);
  }
  try { tx.db.close(); } catch (e) {}
  if (actief === tx) actief = null;
}

function begin() {
  const ctx = verzoekcontext.huidige();
  if (!ctx || !ctx.open) throw fout('PG_ACCOUNTS_GEEN_REQUEST',
    'Een productie-accountmutatie moet binnen de PostgreSQL-requestgrens vallen.');
  if (actief && actief.ctx === ctx) return actief;
  if (actief) throw fout('PG_ACCOUNTS_BEZET',
    'Een andere accountmutatie wordt nog duurzaam bevestigd; probeer opnieuw.');
  const mirror = require('./mirror');
  if (!mirror.authoriteitKlaar()) throw fout('PG_ACCOUNTS_NIET_KLAAR',
    'De gedeelde PostgreSQL-accountwaarheid is nog niet gereed.');
  if (!S.DB_FILE) throw fout('PG_ACCOUNTS_CACHEPAD',
    'De request-lokale accountcache heeft geen databasepad.');
  if (typeof verzoekcontext.registreerDeelnemer !== 'function')
    throw fout('PG_ACCOUNTS_DEELNEMER_ONTBREEKT',
      'De accountlaag is nog niet verbonden met de PostgreSQL-requesttransactie.');

  const db = new DatabaseSync(S.DB_FILE);
  let tx;
  try {
    db.exec('PRAGMA busy_timeout=0; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
    tx = { ctx, db, afgerond: false, toegepast: false,
      volgers: [maakVolgers(db, 'users', 'rtg_users'),
        maakVolgers(db, 'supplier_staff', 'rtg_staff')] };
    actief = tx;
    const deelnemer = {
      naam: 'accounts',
      heeftWerk: () => tx.volgers.some(v =>
        tx.db.prepare(`SELECT 1 AS ja FROM ${q(v.prefix + '_geraakt')} LIMIT 1`).get()),
      pasToe: async client => {
        const lijst = tx.volgers.flatMap(v => wijzigingenVan(tx, v));
        if (!lijst.length) return { geschreven: 0 };
        const uit = await mirror.commitAccountWijzigingen(client, lijst);
        tx.toegepast = true;
        return uit;
      },
      publiceer: () => ruim(tx, true),
      annuleer: () => ruim(tx, false)
    };
    if (!verzoekcontext.registreerDeelnemer('accounts', deelnemer)) {
      ruim(tx, false);
      throw fout('PG_ACCOUNTS_DEELNEMER_DUPLICAAT',
        'De accountdeelnemer kon niet aan dit verzoek worden gebonden.');
    }
    return tx;
  } catch (e) {
    if (tx && !tx.afgerond) { try { ruim(tx, false); } catch (x) {} }
    else { try { db.close(); } catch (x) {} }
    throw e;
  }
}

function database() {
  const ctx = verzoekcontext.huidige();
  return actief && actief.ctx === ctx && !actief.afgerond ? actief.db : null;
}

function resetVoorToets() {
  if (actief) { try { ruim(actief, false); } catch (e) {} }
  actief = null;
}

module.exports = { begin, database, resetVoorToets };
