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
   Opgeslagen waarden gaan door de kluis (versleuteling-at-rest), net als elders.

   De write-behind flush en het inlezen van andermans wijzigingen staan in
   ./sync; hier de pool, het schema, het laden, het luisteren en het afsluiten. */

const KANAAL = 'rtg_kv';

function maakPg({ merge3, kluis, log, url }) {
  const { Pool } = require('pg');
  // Pool-grootte: de kv-flush, het transactie-grootboek en de ledengids delen
  // deze pool; onder gelijktijdige last is 10 te krap (wachtrij = latentie).
  // Time-outs zijn er om te falen-en-herstellen in plaats van eeuwig te blokkeren:
  //  - connectionTimeoutMillis: is de pool vol/de database traag, dan geeft
  //    pool.connect() na deze tijd een fout (de flush blijft vuil en herprobeert)
  //    in plaats van de event-loop-callback voor onbepaalde tijd te laten hangen;
  //  - statement_timeout/query_timeout: een query (of het wachten op een advisory
  //    lock) die vastloopt breekt af i.p.v. een verbinding voorgoed te bezetten en
  //    zo de hele pool leeg te trekken -- precies het pad naar een p99-explosie;
  //  - idleTimeoutMillis: inactieve verbindingen sluiten netjes af.
  // Allemaal ruim gekozen en per env te tunen; de startup-load en de veegrondes
  // zijn bewust begrensd (LIMIT), dus 30 s statement-time-out raakt niets normaals.
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 20),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_MS || 5000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 30000),
    statement_timeout: Number(process.env.PG_STATEMENT_MS || 30000),
    query_timeout: Number(process.env.PG_QUERY_MS || 30000)
  });
  // Zonder deze handler laat node-postgres een fout op een INACTIEVE client (bijv.
  // de database sluit de verbinding, een netwerk-drop) opborrelen als een
  // 'error'-event op de pool -- en een onafgehandeld 'error'-event laat het hele
  // proces crashen. We loggen het; de pool vervangt de verbinding zelf.
  pool.on('error', (e) => { if (log && log.warn) log.warn('pg-pool: fout op inactieve verbinding', { fout: e.message }); });
  let luisterClient = null;
  const toegepast = new Map();   // collectie -> versie die dit proces al toepaste
  const laatsteJson = new Map(); // collectie -> laatst gesynchroniseerde JSON
  const laatsteGrootte = new Map(); // collectie -> bytes van de laatste JSON (voor de grote-collectie-voorcheck)
  const laatsteLengte = new Map();  // collectie -> aantal items bij de laatste volledige check
  const laatsteCheck = new Map();    // collectie -> tijdstip van de laatste volledige check
  const vlag = { uitgesteld: false }; // gedeeld met de flush: staat er nog een grote collectie uitgesteld?
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

  // de write-behind flush en het inlezen van andermans wijzigingen (zie ./sync)
  const { flush, haalNieuwer } = require('./sync')({ pool, merge3, uitStore, naarStore, vlag,
    toegepast, laatsteJson, laatsteGrootte, laatsteLengte, laatsteCheck });

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

  // Pool-verzadiging in cijfers: waitingCount > 0 betekent dat verzoeken op een
  // vrije verbinding staan te wachten -- de vroege waarschuwing voor het
  // p99-blocking-scenario. Zichtbaar via /api/ready en de techniek-pagina.
  function poolStatus() {
    return { totaal: pool.totalCount, inactief: pool.idleCount, wachtend: pool.waitingCount, max: pool.options.max };
  }
  return { schema, laadAlles, flush, haalNieuwer, luister, sluit, pool, poolStatus,
    heeftUitgesteld: () => vlag.uitgesteld,
    _staat: { toegepast, laatsteJson } };
}

module.exports = { maakPg };
