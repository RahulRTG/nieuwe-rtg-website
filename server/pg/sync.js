/* PostgreSQL-opslag, deel "sync": de SCHRIJFKANT, de write-behind flush naar
   Postgres. Per collectie een transactie met advisory lock + row-lock en
   dezelfde 3-weg-merge (merge3) als de SQLite-opslag, zodat twee instances
   elkaar niet overschrijven. De leeskant (wijzigingen van andere instances
   ophalen) staat in ./inlezen.js. Afgesplitst uit pg/index.js; de pool, de
   kluis-helpers en de gedeelde staat-maps komen via de context binnen. */
const KANAAL = 'rtg_kv';

/* DE SNELLE RIJSTROOK: collecties die nooit achter tientallen megabytes mogen
   wachten. Dit zijn de idempotentie-boeken van RTG Pay en RTG Bank.

   Waarom uitgerekend deze. De uitstelregel hierboven redeneert dat een late
   schrijf geen duurzaamheid kost, "want elk nieuw item staat al DIRECT als
   eigen rij in het transactie-grootboek (tx_ledger)". Dat klopt voor orders en
   boekingen. Het klopt NIET voor payIdem: die heeft geen rij-voor-rij
   grootboek achter zich en bestaat alleen als kv-blob. Uitstel is daar dus wel
   degelijk duurzaamheidsverlies.

   Gemeten op 100M leden: na een overboeking duurde het ~35 seconden voordat de
   idem-sleutel in Postgres stond, omdat elke flush-ronde eerst de grote blobs
   (directBetalingen 25 MB, betaalVerzoeken 13 MB, boekingen 10 MB) wegschrijft
   en een volgende ronde daarop wacht. Herstart de server binnen dat venster --
   in De Beproeving gebeurt dat, en in het echt heet het "deploy" -- dan is de
   sleutel weg en boekt een client die opnieuw probeert VOOR DE TWEEDE KEER.

   Deze sleutels zijn klein (tientallen kB's) en gaan daarom in een eigen,
   losse flush die niet achter de grote blobs aansluit. Elke schrijf is een
   eigen transactie met een advisory lock per collectie, dus twee flushes over
   verschillende sleutels zitten elkaar niet in de weg. */
const VOORRANG = new Set(['payIdem', 'payIdemAfdruk', 'bankIdem', 'bankIdemAfdruk',
  'paySaldi', 'betaalIdem', 'muntIdem']);

/* Is deze collectie bij een herstart opnieuw op te bouwen? Alleen wat een
   rij-voor-rij grootboek achter zich heeft (vensterTopUp vult die bij). De
   lijst komt uit het grootboek zelf, zodat er maar een waarheid is. Lukt de
   require niet, dan noemen we niets herstelbaar -- dan schrijft de afsluiting
   alles in de oude volgorde weg, wat hooguit trager is en nooit onveiliger. */
let GEDEKT = null;
function herstelbaar(k) {
  if (GEDEKT === null) {
    try { GEDEKT = new Set(Object.keys(require('../db/tx/ledger').TX_SOORT || {})); }
    catch (e) { GEDEKT = new Set(); }
  }
  return GEDEKT.has(k);
}

module.exports = (ctx) => {
  const { pool, merge3, uitStore, naarStore, vlag,
    toegepast, laatsteJson, laatsteGrootte, laatsteLengte, laatsteCheck } = ctx;

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
  /* Grote collecties bovendien hooguit eens per GROOT_FLUSH_MS wegschrijven: de
     stringify van een venster van tienduizenden orders (~10 MB) bij elke
     flush-cyclus van 150 ms blokkeert de event-loop structureel.

     HIER STOND EEN VERANTWOORDING DIE TE RUIM WAS. Er stond dat uitstel geen
     duurzaamheid kost, "want elk nieuw item staat al DIRECT als eigen rij in
     het transactie-grootboek". Dat gold voor ORDERS en BOEKINGEN, en onder
     dezelfde regel vielen directBetalingen (25 MB), betaalVerzoeken (13 MB),
     notifications en reviews: samen 55 MB zonder enig grootboek erachter,
     waarvan 38 MB betalingen.

     De twee betaalcollecties staan er inmiddels wel in (db/tx/collecties.js) en
     gaan bij aanmaak als eigen rij mee; voor hen klopt de verantwoording nu.
     Voor notifications en reviews niet, en uitstel kost daar dus echt
     duurzaamheid. Daarom sorteert de afsluit-flush op herstelbaarheid en niet op
     grootte, en leidt hij die AF uit het grootboek in plaats van uit een eigen
     lijstje. Wat uitgesteld is, meldt heeftUitgesteld(). */
  const GROOT_BYTES = 512 * 1024, GROOT_MS = 2000;
  const GROOT_FLUSH_MS = Number(process.env.PG_GROOT_FLUSH_MS || 5000);
  const laatsteSchrijf = new Map(); // collectie -> tijdstip van de laatste echte schrijf
  const lengteVan = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
  async function flush(dataNu, force, alleen) {
    let geschreven = 0;
    const gewijzigd = [];
    const nu = Date.now();
    if (!alleen) vlag.uitgesteld = false;
    for (const k of Object.keys(dataNu)) {
      // `alleen`: de snelle rijstrook schrijft uitsluitend haar eigen sleutels,
      // de gewone flush slaat die juist over (die zijn dan al weg)
      if (alleen ? !alleen.has(k) : VOORRANG.has(k)) continue;
      /* `!alleen`: de SNELLE RIJSTROOK kent geen uitstel. Die bestaat omdat de
         idempotentie-sleutels van geld nu weg moeten -- nog niet gedeeld is het
         verschil tussen een keer en twee keer afschrijven. De twee remmen
         hieronder keken alleen naar GROOTTE, dus zodra payIdem over 512 kB
         groeide stelde de snelle rijstrook zichzelf uit: juist onder de drukte
         waarvoor hij bedoeld is. De gewone flush blijft ongewijzigd. */
      const groot = (laatsteGrootte.get(k) || 0) > GROOT_BYTES;
      if (groot && !force && !alleen && nu - (laatsteSchrijf.get(k) || 0) < GROOT_FLUSH_MS) { vlag.uitgesteld = true; continue; }
      if (groot && !alleen && lengteVan(dataNu[k]) === laatsteLengte.get(k) && nu - (laatsteCheck.get(k) || 0) < GROOT_MS) continue;
      const j = JSON.stringify(dataNu[k]);
      laatsteCheck.set(k, nu); laatsteGrootte.set(k, j.length); laatsteLengte.set(k, lengteVan(dataNu[k]));
      if (laatsteJson.get(k) !== j) gewijzigd.push([k, j]);
    }
    /* DE VOLGORDE. Normaal klein-eerst: de kleine, gezaghebbende collecties
       landen dan binnen de eerste milliseconden.

       BIJ HET AFSLUITEN (force) telt iets anders zwaarder dan grootte:
       HERSTELBAARHEID. Een afsluit-flush van tientallen megabytes haalt het
       grace-venster niet -- De Beproeving kapt na acht seconden af, en een
       deploy wacht ook niet. Wat er dan nog in de rij staat, is weg.

       Dus gaat eerst wat NIET terug te halen is, en pas daarna wat wel uit het
       transactie-grootboek wordt bijgevuld (vensterTopUp). Op klein-eerst
       gesorteerd stond directBetalingen met zijn 25 MB juist achteraan -- de
       plek die als eerste sneuvelt. Achtendertig megabyte aan betalingen en
       betaalverzoeken had geen enkel grootboek achter zich en stond op de
       slechtste plaats in de rij.

       De dekkingslijst komt uit db/tx/ledger.js zelf. Hem hier overschrijven
       zou een tweede waarheid maken, en dat is precies hoe de uitstelregel ooit
       collecties is gaan verantwoorden die er nooit in stonden. */
    gewijzigd.sort((a, b) => {
      if (force) {
        const ha = herstelbaar(a[0]) ? 1 : 0, hb = herstelbaar(b[0]) ? 1 : 0;
        if (ha !== hb) return ha - hb;
      }
      return a[1].length - b[1].length;
    });
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

  return { flush, VOORRANG };
};
