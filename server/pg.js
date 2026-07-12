/* PostgreSQL-opslag voor de gedeelde data (db.data).

   Waarom naast SQLite/JSON: Postgres is de bewezen keuze voor echte productie:
   meerdere app-instances praten met één database, met transacties, row-locks en
   LISTEN/NOTIFY voor live cross-instance-updates. Dat schaalt waar een lokaal
   bestand dat niet doet.

   Ontwerp (belangrijk): de app roept save()/load() SYNCHROON aan, maar de
   pg-driver is asynchroon. Daarom werkt deze laag als een write-behind cache:
   - het geheugen (db.data) blijft de werkkopie;
   - save() schrijft lokaal (duurzaam) én plant een async flush naar Postgres;
   - Postgres is de gedeelde waarheid: bij het opstarten wint Postgres, en
     wijzigingen van andere instances komen via LISTEN/NOTIFY binnen.
   Valt Postgres even weg, dan draait de app door op de lokale snapshot en
   probeert opnieuw te verbinden (graceful degradation).

   Het samenvoegen bij gelijktijdige schrijvers gebruikt exact dezelfde
   3-weg-merge (merge3) als de SQLite-opslag, zodat twee instances die
   verschillende, of dezelfde, collecties schrijven elkaar niet overschrijven.
   Opgeslagen waarden gaan door de kluis (versleuteling-at-rest), net als elders. */

const KANAAL = 'rtg_kv';

function maakPg({ merge3, kluis, log, url }) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 10) });
  let luisterClient = null;
  const toegepast = new Map();   // collectie -> versie die dit proces al toepaste
  const laatsteJson = new Map(); // collectie -> laatst gesynchroniseerde JSON
  const uitStore = (v) => kluis.ontsleutel(v);
  const naarStore = (j) => kluis.versleutel(j);

  async function schema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      val TEXT NOT NULL,
      ver BIGINT NOT NULL DEFAULT 0,
      bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await pool.query('CREATE SEQUENCE IF NOT EXISTS kv_ver_seq');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_kv_ver ON kv(ver)');
  }

  // Laad alle collecties uit Postgres in een gewoon object (of null als leeg).
  async function laadAlles() {
    const { rows } = await pool.query('SELECT key, val, ver FROM kv');
    if (!rows.length) return null;
    const data = {};
    for (const r of rows) {
      const j = uitStore(r.val);
      data[r.key] = JSON.parse(j);
      laatsteJson.set(r.key, j);
      toegepast.set(r.key, Number(r.ver));
    }
    return data;
  }

  /* Schrijf de gewijzigde collecties weg. Per collectie in een transactie met een
     row-lock: schreef een ander proces ondertussen een nieuwere versie, dan
     voegen we per item samen (merge3) in plaats van te overschrijven. Elke schrijf
     krijgt een nieuw, globaal oplopend versienummer en seint de andere instances
     via NOTIFY. Geeft terug hoeveel collecties echt zijn weggeschreven. */
  async function flush(dataNu) {
    let geschreven = 0;
    const gewijzigd = [];
    for (const k of Object.keys(dataNu)) {
      const j = JSON.stringify(dataNu[k]);
      if (laatsteJson.get(k) !== j) gewijzigd.push([k, j]);
    }
    for (const [k, jOns] of gewijzigd) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Transactie-brede advisory lock per collectie. Cruciaal: bij de ALLEREERSTE
        // schrijf bestaat de rij nog niet, en dan zou "SELECT ... FOR UPDATE" niets
        // vergrendelen -- twee gelijktijdige schrijvers zouden dan allebei "geen rij"
        // zien, de merge overslaan en elkaars insert overschrijven (verloren update).
        // De advisory lock serialiseert schrijvers naar dezelfde collectie, rij of niet.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [k]);
        const huidig = await client.query('SELECT val, ver FROM kv WHERE key = $1 FOR UPDATE', [k]);
        let j = jOns;
        if (huidig.rows.length && Number(huidig.rows[0].ver) > (toegepast.get(k) || 0)) {
          const base = laatsteJson.has(k) ? JSON.parse(laatsteJson.get(k)) : undefined;
          const samen = merge3(base, dataNu[k], JSON.parse(uitStore(huidig.rows[0].val)));
          dataNu[k] = samen;
          j = JSON.stringify(samen);
        }
        const nv = await client.query("SELECT nextval('kv_ver_seq') AS v");
        const ver = Number(nv.rows[0].v);
        await client.query(
          `INSERT INTO kv(key, val, ver, bijgewerkt) VALUES($1, $2, $3, now())
           ON CONFLICT(key) DO UPDATE SET val = EXCLUDED.val, ver = EXCLUDED.ver, bijgewerkt = now()`,
          [k, naarStore(j), ver]
        );
        await client.query(`SELECT pg_notify($1, $2)`, [KANAAL, k]);
        await client.query('COMMIT');
        laatsteJson.set(k, j);
        toegepast.set(k, ver);
        geschreven++;
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (x) {}
        throw e;
      } finally {
        client.release();
      }
    }
    return geschreven;
  }

  /* Haal collecties op die een ander proces sinds onze laagst-toegepaste versie
     schreef en werk db.data bij (met merge als wij lokaal iets openstaan hebben).
     Wordt getriggerd door NOTIFY en als vangnet ook periodiek. */
  async function haalNieuwer(dataNu, opSessieWijziging) {
    let laagst = 0;
    for (const v of toegepast.values()) if (v < laagst || laagst === 0) laagst = v;
    const { rows } = await pool.query('SELECT key, val, ver FROM kv WHERE ver > $1', [laagst]);
    let sessie = false;
    for (const r of rows) {
      const ver = Number(r.ver);
      if (ver <= (toegepast.get(r.key) || 0)) continue;
      const baseJson = laatsteJson.get(r.key);
      const hunJson = uitStore(r.val);
      const lokaalOpen = baseJson !== undefined && JSON.stringify(dataNu[r.key]) !== baseJson;
      if (lokaalOpen) {
        dataNu[r.key] = merge3(JSON.parse(baseJson), dataNu[r.key], JSON.parse(hunJson));
      } else {
        dataNu[r.key] = JSON.parse(hunJson);
        laatsteJson.set(r.key, hunJson);
      }
      toegepast.set(r.key, ver);
      if (r.key === 'sessions') sessie = true;
    }
    if (sessie && opSessieWijziging) opSessieWijziging();
    return rows.length;
  }

  // Luister op NOTIFY zodat wijzigingen van andere instances vrijwel direct
  // binnenkomen (geen puur pollen). De aparte client blijft open staan.
  async function luister(onWijziging) {
    luisterClient = await pool.connect();
    luisterClient.on('notification', () => { onWijziging(); });
    luisterClient.on('error', (e) => { if (log) log.warn('pg-listen fout', { fout: e.message }); });
    await luisterClient.query('LISTEN ' + KANAAL);
  }

  async function sluit() {
    try { if (luisterClient) luisterClient.release(); } catch (e) {}
    try { await pool.end(); } catch (e) {}
  }

  return { schema, laadAlles, flush, haalNieuwer, luister, sluit, pool,
    _staat: { toegepast, laatsteJson } };
}

module.exports = { maakPg };
