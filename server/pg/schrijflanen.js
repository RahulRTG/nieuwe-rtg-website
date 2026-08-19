/* PostgreSQL-opslag, deel "schrijflanen": HOE een gewijzigde collectie de
   schijf op gaat. Het slot, de 3-weg-merge, het versienummer, de NOTIFY, en de
   twee lanen waarin dat gebeurt -- de rijstrook als EEN transactie, de trage
   laan met een transactie per collectie.

   WAAROM DIT EEN EIGEN BESTAND IS

   ./sync.js stond op 11935 byte, ruim over de 10 kB-grens uit keuringsregel 13.
   Dit is niet zomaar het grootste blok: het is de snede die dit huis zelf al
   had opgeschreven. scripts/check.js zegt bij de uitzondering voor sync.js
   letterlijk "de snede bestaat (schrijfEen + de twee schrijflanen naar een
   eigen deel) en staat in TAKEN.md 4.23". Dat is hier uitgevoerd, niet een
   nieuwe naad bedacht.

   HET IS OOK DE NAAD IN HET ONDERWERP. Wat in sync.js overblijft is BELEID:
   welke collectie mee mag, hoe lang een grote mag wachten, welke sleutels een
   snelle rijstrook krijgen, en in welke volgorde ze gaan. Hier staat het
   MECHANISME: hoe een enkele schrijf veilig is tegen een tweede schrijver.
   Die twee stonden door elkaar heen, en juist daar kwam de fout vandaan die de
   rijstrook-transactie hieronder afdwingt.

   WAT ER BINNENKOMT. Dezelfde ctx als sync.js krijgt, plus de map
   `laatsteSchrijf`. Die map wordt hier bijgewerkt (naCommit) en in sync.js
   gelezen (de uitstelrem op grote collecties): het is EEN map die wordt
   doorgegeven, geen tweede boekhouding.

   HET KANAAL WOONT HIER. `rtg_kv` stond twee keer in de code -- hier bij de
   NOTIFY en in ./index.js bij de LISTEN. Twee kopieen van dezelfde waarheid:
   wie er een hernoemt, zet de zender en de luisteraar stil uit elkaar zonder
   dat er iets stukgaat dat opvalt. De NOTIFY staat hieronder, dus de naam
   staat hier, en index.js haalt hem hier op.
   ========================================================================== */
'use strict';

const KANAAL = 'rtg_kv';

module.exports = maakSchrijflanen;
/* De kanaalnaam hangt aan de fabriek zelf: ./index.js heeft hem nodig voor de
   LISTEN, en heeft daar geen ctx voor. */
module.exports.KANAAL = KANAAL;

function maakSchrijflanen(ctx, laatsteSchrijf) {
  const { pool, merge3, uitStore, naarStore, toegepast, laatsteJson } = ctx;

  /* Geeft terug hoeveel collecties er echt zijn weggeschreven. `gewijzigd` is
     de lijst die sync.js heeft samengesteld en gesorteerd; `alleen` is gezet
     als dit de snelle rijstrook is. */
  async function schrijfLanen(dataNu, gewijzigd, alleen) {
    let geschreven = 0;
    /* Een collectie schrijven, binnen een al geopende transactie. De advisory
       lock is cruciaal: bij de ALLEREERSTE schrijf bestaat de rij nog niet, en
       dan zou "SELECT ... FOR UPDATE" niets vergrendelen -- twee gelijktijdige
       schrijvers zouden dan allebei "geen rij" zien, de merge overslaan en
       elkaars insert overschrijven (verloren update). De lock serialiseert
       schrijvers naar dezelfde collectie, rij of niet. De caches (laatsteJson,
       toegepast) werkt de AANROEPER pas na de COMMIT bij: een rollback mag
       geen bijgewerkte cache achterlaten. */
    async function schrijfEen(client, k, jOns) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [k]);
      const huidig = await client.query('SELECT val, ver FROM kv WHERE key = $1 FOR UPDATE', [k]);
      /* De lijst `gewijzigd` is vóór het wachten op het slot gemaakt. Een
         directe collectietransactie in DIT proces kan intussen al gecommit en
         de lokale werkkopie vervangen hebben. Schrijf dan de verse werkkopie,
         nooit de oude JSON die vóór het slot werd berekend. */
      const liveJson = JSON.stringify(dataNu[k]);
      let j = liveJson === jOns ? jOns : liveJson;
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
      return { j, ver };
    }
    const naCommit = (k, r) => { laatsteJson.set(k, r.j); laatsteSchrijf.set(k, Date.now()); toegepast.set(k, r.ver); geschreven++; };
    /* DE RIJSTROOK IS EEN GEHEEL. paySaldi en payIdem elk in een eigen
       transactie committen liet een venster staan: een kill -9 tussen die twee
       commits gaf een schijf waarop het geld staat en de idem-sleutel niet, en
       de crashproef boekte er prompt dubbel door (+137 centen, herhaalbaar).
       Daarom gaan de rijstrook-sleutels in EEN transactie: alles of niets.
       De slotvolgorde is de sleutelNAAM, niet de grootte -- groottes verschillen
       per instance, en twee instances die dezelfde locks in verschillende
       volgorde nemen zetten elkaar klem. De trage laan hieronder houdt zijn
       transactie per collectie: grote blobs in een groepstransactie zouden de
       locks seconden vasthouden. */
    if (alleen && gewijzigd.length) {
      gewijzigd.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const client = await pool.connect();
      const geslaagd = [];
      try {
        await client.query('BEGIN');
        for (const [k, jOns] of gewijzigd) geslaagd.push([k, await schrijfEen(client, k, jOns)]);
        await client.query('COMMIT');
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (x) {}
        throw e;
      } finally {
        client.release();
      }
      for (const [k, r] of geslaagd) naCommit(k, r);
      return geschreven;
    }
    for (const [k, jOns] of gewijzigd) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await schrijfEen(client, k, jOns);
        await client.query('COMMIT');
        naCommit(k, r);
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (x) {}
        throw e;
      } finally {
        client.release();
      }
    }
    return geschreven;
  }

  return { schrijfLanen };
}
