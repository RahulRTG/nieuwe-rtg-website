/* Een eigen ontvangstjournaal naast store.db: dezelfde SQLite/kluis-architectuur,
   met een unieke event-id en FULL-fsync voordat een ontvangstbewijs uitgaat.
   Los van de bedrijfsdatabase, zodat een storing daarin nog opgeslagen kan worden.
   Delen tussen processen op dezelfde host; geen claim van opslag over hosts. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const kluis = require('../kluis');
const { hash } = require('./protocol');
const DAGEN = 30 * 86400000;
function openOpslag(map, opts = {}) {
  fs.mkdirSync(map, { recursive: true, mode: 0o700 });
  const bestand = path.join(map, 'storingen.db');
  if (!fs.existsSync(bestand)) fs.closeSync(fs.openSync(bestand, 'wx', 0o600));
  const db = new DatabaseSync(bestand);
  try {
    fs.chmodSync(bestand, 0o600);
    db.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    db.exec('CREATE TABLE IF NOT EXISTS ontvangsten (id TEXT PRIMARY KEY, digest TEXT NOT NULL, inhoud TEXT NOT NULL, ontvangen INTEGER NOT NULL)');
    db.exec('CREATE INDEX IF NOT EXISTS ontvangsten_tijd ON ontvangsten(ontvangen)');
    db.exec('CREATE TABLE IF NOT EXISTS rem (sleutel TEXT PRIMARY KEY, venster INTEGER NOT NULL, aantal INTEGER NOT NULL)');
  } catch (e) { db.close(); throw e; }
  function bewaar(id, raw, inhoud, nu = Date.now()) {
    const digest = hash(raw), venster = Math.floor(nu / 60000);
    db.exec('BEGIN IMMEDIATE');
    try {
      const rem = db.prepare("SELECT * FROM rem WHERE sleutel='alle'").get();
      if (rem && rem.venster === venster && rem.aantal >= (opts.limiet || 120)) {
        db.exec('ROLLBACK'); return { status: 429 };
      }
      db.prepare("INSERT INTO rem VALUES ('alle',?,1) ON CONFLICT(sleutel) DO UPDATE SET venster=excluded.venster,aantal=CASE WHEN rem.venster=excluded.venster THEN rem.aantal+1 ELSE 1 END").run(venster);
      db.prepare('DELETE FROM ontvangsten WHERE ontvangen < ?').run(nu - DAGEN);
      const oud = db.prepare('SELECT digest FROM ontvangsten WHERE id=?').get(id);
      if (oud) {
        db.exec('COMMIT'); return { status: oud.digest === digest ? 200 : 409, herhaald: true, digest };
      }
      if (db.prepare('SELECT count(*) AS n FROM ontvangsten').get().n >= (opts.max || 50000)) {
        db.exec('ROLLBACK'); return { status: 503 };
      }
      db.prepare('INSERT INTO ontvangsten VALUES (?,?,?,?)').run(id, digest, kluis.versleutel(JSON.stringify(inhoud)), nu);
      db.exec('COMMIT');
      return { status: 201, herhaald: false, digest };
    } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; }
  }
  return { bewaar, close: () => db.close() };
}
module.exports = { openOpslag };
