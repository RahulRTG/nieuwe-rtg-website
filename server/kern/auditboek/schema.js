/* ============================================================================
   HET SCHEMA van het auditboek in PostgreSQL.

   VIER TABELLEN, en elk heeft een eigen reden:
     auditboek             de regels zelf, met een keten (vorige/hash) en het
                           volledige record als TEXT (de exacte bytes die zijn
                           gehasht -- geen JSONB, want die herschrijft getallen
                           en volgorde);
     auditboek_checkpoint  waar het boek na de bewaartermijn BEGINT: de hash van
                           de laatst verwijderde regel, zodat de eerstvolgende
                           blijft wijzen naar iets dat aantoonbaar bestond;
     auditboek_anker       wat er naar buiten is gegaan, met de ontvangsten;
     auditboek_meta        de boek-id (een anker van een ander boek telt niet).

   WAT DE TRIGGERS DOEN EN NIET DOEN. UPDATE en TRUNCATE zijn altijd verboden,
   DELETE alleen binnen een bewaringstransactie die dat zelf aanzet. Dat houdt
   een BUG, een verdwaalde query of een kwetsbaarheid in de app tegen. Het houdt
   een beheerder van de database NIET tegen: wie superuser is, zet de trigger
   uit. Daarvoor is het externe anker er (./anker.js), en nergens anders voor --
   een trigger die doet alsof hij daarvoor bestaat, is een schijnbewaker.

   AANBEVOLEN ROL: een eigen databaserol voor het auditboek met INSERT en SELECT
   op auditboek*, geen DELETE, geen TRIGGER, en een aparte rol voor de
   bewaartaak. De verbinding is los instelbaar (RTG_AUDIT_DATABASE_URL).
   ========================================================================== */
'use strict';

const SCHEMA_VERSIE = 1;
/* Eén slot voor schrijvers (volgnummers zijn aaneengesloten, dus geen sequence). */
const SLOT = 7311905;

const DDL = [
  `CREATE TABLE IF NOT EXISTS auditboek (
     nr BIGINT PRIMARY KEY,
     tijd TIMESTAMPTZ NOT NULL,
     type TEXT NOT NULL,
     categorie TEXT NOT NULL,
     actor TEXT NOT NULL,
     regel TEXT NOT NULL,
     vorige TEXT,
     hash TEXT NOT NULL UNIQUE
   )`,
  'CREATE INDEX IF NOT EXISTS idx_auditboek_tijd ON auditboek(tijd)',
  `CREATE TABLE IF NOT EXISTS auditboek_checkpoint (
     nr BIGINT PRIMARY KEY,
     hash TEXT NOT NULL,
     tijd TIMESTAMPTZ NOT NULL,
     reden TEXT NOT NULL,
     anker_nr BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS auditboek_anker (
     anker_nr BIGINT PRIMARY KEY,
     nr BIGINT NOT NULL,
     hash TEXT NOT NULL,
     tijd TIMESTAMPTZ NOT NULL,
     verklaring TEXT NOT NULL,
     ontvangsten TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS auditboek_meta (
     sleutel TEXT PRIMARY KEY,
     waarde TEXT NOT NULL
   )`,
  `CREATE OR REPLACE FUNCTION auditboek_onveranderlijk() RETURNS trigger AS $f$
   BEGIN
     IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'auditboek'
        AND current_setting('rtg.auditboek_bewaring', true) = 'toegestaan' THEN
       RETURN OLD;
     END IF;
     RAISE EXCEPTION 'auditboek is append-only (% op %)', TG_OP, TG_TABLE_NAME
       USING ERRCODE = 'restrict_violation';
   END;
   $f$ LANGUAGE plpgsql`,
  ...['auditboek', 'auditboek_checkpoint', 'auditboek_anker', 'auditboek_meta'].flatMap(t => [
    `DROP TRIGGER IF EXISTS ${t}_wijzig ON ${t}`,
    `CREATE TRIGGER ${t}_wijzig BEFORE UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION auditboek_onveranderlijk()`,
    `DROP TRIGGER IF EXISTS ${t}_leeg ON ${t}`,
    `CREATE TRIGGER ${t}_leeg BEFORE TRUNCATE ON ${t} FOR EACH STATEMENT EXECUTE FUNCTION auditboek_onveranderlijk()`
  ])
];

/* Idempotent. Draait onder een advisory lock zodat twee instanties die tegelijk
   opstarten elkaars CREATE OR REPLACE niet in de weg zitten. */
async function init(pool, { boekId } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [SLOT]);
    for (const q of DDL) await client.query(q);
    const id = boekId || require('crypto').randomUUID();
    await client.query("INSERT INTO auditboek_meta(sleutel, waarde) VALUES('boek_id', $1) ON CONFLICT DO NOTHING", [id]);
    await client.query("INSERT INTO auditboek_meta(sleutel, waarde) VALUES('schema', $1) ON CONFLICT DO NOTHING", [String(SCHEMA_VERSIE)]);
    const r = await client.query("SELECT waarde FROM auditboek_meta WHERE sleutel = 'boek_id'");
    await client.query('COMMIT');
    return { boekId: r.rows[0].waarde };
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} throw e; }
  finally { client.release(); }
}

module.exports = { init, DDL, SLOT, SCHEMA_VERSIE };
