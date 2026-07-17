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
  // Verandering opsporen kost een JSON.stringify per collectie. Bij een grote
  // collectie (bijv. een miljoen orders, honderden MB's) is dat elke flush een
  // event-loop-stall van seconden, terwijl die collectie meestal niet wijzigt.
  // Daarom een goedkope voorcheck voor GROTE collecties: is de lengte gelijk en
  // hebben we hem recent volledig gecontroleerd, dan slaan we de dure stringify
  // over. Een toevoeging (nieuwe order) verandert de lengte en wordt dus meteen
  // opgepikt; een wijziging-op-zijn-plaats (statuswissel) wordt bij de volgende
  // volledige check binnen GROOT_MS alsnog weggeschreven. In-memory blijft de
  // waarheid (write-behind), dus die kleine persist-vertraging is acceptabel.
  // Grote collecties bovendien hooguit eens per GROOT_FLUSH_MS wegschrijven: de
  // stringify van een venster van tienduizenden orders (~10 MB) bij elke
  // flush-cyclus van 150 ms blokkeert de event-loop structureel. De kv-blob is
  // voor die collecties enkel een grof snapshot -- elk nieuw item staat al
  // DIRECT als eigen rij in het transactie-grootboek (tx_ledger), dus dit
  // uitstel kost geen duurzaamheid. Wat uitgesteld is, meldt heeftUitgesteld()
  // zodat de schrijver vuil blijft en het na de pauze alsnog weggaat; de
  // afsluit-flush forceert alles.
  const GROOT_BYTES = 512 * 1024, GROOT_MS = 2000;
  const GROOT_FLUSH_MS = Number(process.env.PG_GROOT_FLUSH_MS || 5000);
  const laatsteSchrijf = new Map(); // collectie -> tijdstip van de laatste echte schrijf
  let uitgesteld = false;
  const lengteVan = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
  async function flush(dataNu, force) {
    let geschreven = 0;
    const gewijzigd = [];
    const nu = Date.now();
    uitgesteld = false;
    for (const k of Object.keys(dataNu)) {
      const groot = (laatsteGrootte.get(k) || 0) > GROOT_BYTES;
      if (groot && !force && nu - (laatsteSchrijf.get(k) || 0) < GROOT_FLUSH_MS) { uitgesteld = true; continue; }
      if (groot && lengteVan(dataNu[k]) === laatsteLengte.get(k) && nu - (laatsteCheck.get(k) || 0) < GROOT_MS) continue;
      const j = JSON.stringify(dataNu[k]);
      laatsteCheck.set(k, nu); laatsteGrootte.set(k, j.length); laatsteLengte.set(k, lengteVan(dataNu[k]));
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
        laatsteSchrijf.set(k, Date.now());
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

  // Pool-verzadiging in cijfers: waitingCount > 0 betekent dat verzoeken op een
  // vrije verbinding staan te wachten -- de vroege waarschuwing voor het
  // p99-blocking-scenario. Zichtbaar via /api/ready en de techniek-pagina.
  function poolStatus() {
    return { totaal: pool.totalCount, inactief: pool.idleCount, wachtend: pool.waitingCount, max: pool.options.max };
  }
  return { schema, laadAlles, flush, haalNieuwer, luister, sluit, pool, poolStatus,
    heeftUitgesteld: () => uitgesteld,
    _staat: { toegepast, laatsteJson } };
}

module.exports = { maakPg };
