/* Achterkant "sqlite" van het transactie-grootboek: dezelfde vier bewegingen als
   de Postgres-kant (schema, upsert, bladzijde, tellen), maar op een eigen
   SQLite-bestand in de datamap.

   Waarom dit bestaat: in de SQLite-stand is elke collectie EEN rij. Een collectie
   die alleen maar groeit (`orders`) werd daardoor bij elke nieuwe order in zijn
   geheel opnieuw geserialiseerd en weggeschreven -- gemeten 460 KB na 1050
   orders, en dat groeit lineair mee. Het grootboek bestond al, maar alleen voor
   Postgres ("zonder Postgres is dit inert"), dus juist de standaardopslag hield
   de laatste O(alles)-serialisatie. Nu houdt het RAM een VENSTER van de recentste
   items en staat de rest hier als geindexeerde rij.

   Eigen bestand (grootboek.db), niet store.db: de kv-schrijvers en het grootboek
   hoeven dan niet op dezelfde schrijflock te wachten, en het blijft even goed
   gedeeld tussen losse processen. node:sqlite is synchroon; de aanroepende
   veegronde is daarom gepaced (brokken met een adempauze), zodat een grote
   achterstand de event-loop nooit seconden vasthoudt. */
const path = require('path');

const KOLOM = { klant: 'klant', zaak: 'zaak' };
const BROK = Number(process.env.TX_SQLITE_BROK || 400); // rijen per transactie
const adem = () => new Promise(r => setImmediate(r));

module.exports = function maakSqliteAchter(opslag) {
  const { DATA_DIR, besloten, beslotenMap } = opslag;
  let sdb = null, st = null;

  function verbind() {
    if (sdb) return;
    const { DatabaseSync } = require('node:sqlite');
    beslotenMap(DATA_DIR);
    const bestand = path.join(DATA_DIR, 'grootboek.db');
    sdb = new DatabaseSync(bestand);
    besloten(bestand);
    /* De wachttijd VOOR het aanzetten van WAL: dat aanzetten neemt zelf een
       exclusief slot, en twee processen die tegelijk opstarten botsen daar
       zonder geduld meteen op "database is locked". Zie de kop van
       server/db/sqlite.js, waar dat als eerste werd opgeschreven. */
    sdb.exec('PRAGMA busy_timeout=5000');
    sdb.exec('PRAGMA journal_mode=WAL');
    sdb.exec('PRAGMA synchronous=NORMAL');
    sdb.exec('PRAGMA journal_size_limit=' + Number(process.env.RTG_SQLITE_WAL_MAX || 8 * 1024 * 1024));
  }

  return {
    naam: 'sqlite',
    /* De WAL in het hoofdbestand vouwen, zodat een backup die grootboek.db
       kopieert ook de recentste boekingen meeneemt. Zonder dit staat verse
       data alleen in grootboek.db-wal -- precies de val die de backup van
       store.db en rtg.db al een keer leeg heeft laten lopen (zie de kop van
       db/sqlite.js checkpointSqlite). Faalt het omdat een ander proces nog
       leest, dan vangt de meegekopieerde -wal het op. */
    checkpoint() {
      if (!sdb) return false;
      try { sdb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); return true; } catch (e) { return false; }
    },
    async schema() {
      verbind();
      // `at` is een ISO-tijdstempel als tekst: die sorteert lexicografisch gelijk
      // aan chronologisch, dus ORDER BY at DESC klopt zonder datumtype.
      sdb.exec(`CREATE TABLE IF NOT EXISTS tx_ledger(
        soort TEXT NOT NULL, ref TEXT NOT NULL, klant TEXT, zaak TEXT,
        paid INTEGER, status TEXT, totaal REAL, at TEXT, data TEXT NOT NULL,
        PRIMARY KEY(soort, ref))`);
      sdb.exec('CREATE INDEX IF NOT EXISTS tx_ledger_klant ON tx_ledger(soort, klant, at DESC)');
      sdb.exec('CREATE INDEX IF NOT EXISTS tx_ledger_zaak ON tx_ledger(soort, zaak, at DESC)');
      st = {
        up: sdb.prepare(`INSERT INTO tx_ledger(soort,ref,klant,zaak,paid,status,totaal,at,data) VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(soort,ref) DO UPDATE SET klant=excluded.klant, zaak=excluded.zaak, paid=excluded.paid,
          status=excluded.status, totaal=excluded.totaal, at=excluded.at, data=excluded.data`),
        vanKlant: sdb.prepare('SELECT data FROM tx_ledger WHERE soort=? AND klant=? ORDER BY at DESC LIMIT ? OFFSET ?'),
        vanZaak: sdb.prepare('SELECT data FROM tx_ledger WHERE soort=? AND zaak=? ORDER BY at DESC LIMIT ? OFFSET ?'),
        telAlles: sdb.prepare('SELECT count(*) AS c FROM tx_ledger WHERE soort=?'),
        telKlant: sdb.prepare('SELECT count(*) AS c FROM tx_ledger WHERE soort=? AND klant=?'),
        recent: sdb.prepare('SELECT data FROM tx_ledger WHERE soort=? ORDER BY at DESC LIMIT ?')
      };
    },
    async upsert(rijen) {
      verbind();
      for (let i = 0; i < rijen.length; i += BROK) {
        const brok = rijen.slice(i, i + BROK);
        sdb.exec('BEGIN IMMEDIATE');
        try {
          for (const r of brok) {
            st.up.run(r.soort, r.ref, r.klant, r.zaak, r.paid ? 1 : 0, r.status, r.totaal, r.at, r.data);
          }
          sdb.exec('COMMIT');
        } catch (e) { try { sdb.exec('ROLLBACK'); } catch (x) {} throw e; }
        if (i + BROK < rijen.length) await adem(); // de event-loop even teruggeven
      }
    },
    async vanSleutel(soort, kolom, waarde, limit, offset) {
      verbind();
      const kol = KOLOM[kolom];
      if (!kol) return [];
      const q = kol === 'klant' ? st.vanKlant : st.vanZaak;
      return q.all(soort, String(waarde || ''), limit, offset).map(x => x.data);
    },
    async tel(soort, klant) {
      verbind();
      const r = klant != null ? st.telKlant.get(soort, String(klant)) : st.telAlles.get(soort);
      return Number((r && r.c) || 0);
    },
    async recent(soort, limit) {
      verbind();
      return st.recent.all(soort, limit).map(x => x.data);
    },
    // Netjes afronden: de WAL in het hoofdbestand vouwen zodat de volgende start
    // niets hoeft in te lezen. Mislukt hij omdat een ander proces nog leest, dan
    // is dat geen probleem -- de rijen staan al gecommit.
    afronden() {
      if (!sdb) return;
      try { sdb.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}
    }
  };
};
