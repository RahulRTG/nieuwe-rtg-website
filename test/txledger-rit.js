/* Driver voor de tx_ledger-integratietest (GEEN .test.js: draait als kindproces
   vanuit test/txledger.pg.test.js). Bestuurt de db-laag rechtstreeks in-process
   tegen een echte Postgres en print een JSON-resultaat op de laatste regel.
   Een apart proces omdat de pg-pool en LISTEN-client de event-loop openhouden;
   dit proces sluit hard af, de testrunner blijft schoon. */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-txledger-'));
process.env.RTG_STORE = 'postgres';
process.env.TX_RAM_ORDERS = '10';
process.env.TX_RAM_BOEKINGEN = '8';
process.env.TX_KOP = '3';
process.env.TX_KAP = '1000';

(async () => {
  // schone lei in de testdatabase: het grootboek en de kv-collecties van vorige runs
  const { Pool } = require('../server/pgwire');
  const schoonmaak = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await schoonmaak.query('DROP TABLE IF EXISTS tx_ledger');
  await schoonmaak.query('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT NOT NULL, ver BIGINT NOT NULL DEFAULT 0, bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now())');
  await schoonmaak.query('DELETE FROM kv');
  await schoonmaak.end();

  const dbmod = require('../server/db');
  const { db, load, startPostgres, ordersVoegToe, orderMetRef, boekingenVoegToe,
    payBoekingenVoegToe, txLedgerTel, txLedgerVanKlant, txLedgerVanZaak, txVeegNu } = dbmod;
  const { vensterTopUp } = require('../server/db/tx');
  load();
  await startPostgres();
  db.data.orders = []; db.data.boekingen = []; db.data.payBoekingen = [];

  const BASIS = Date.parse('2026-01-01T00:00:00Z');
  const maakOrder = i => ({ ref: 'RTG-O-IT' + i, supplierCode: 'KIKUNOI', customerKey: 'user-1', customerTier: 'rtg',
    total: 10 + i, paid: true, status: 'geserveerd', at: new Date(BASIS + i * 1000).toISOString() });
  for (let i = 0; i < 30; i++) ordersVoegToe(maakOrder(i));
  for (let i = 0; i < 15; i++) boekingenVoegToe({ ref: 'RTG-B-IT' + i, kind: 'ticket', supplierCode: 'PONTO',
    customerKey: 'user-2', price: 40, paid: true, status: 'bevestigd', at: new Date(BASIS + i * 1000).toISOString() });

  await txVeegNu();   // staart eerst naar het grootboek, dan pas uit het RAM

  const ramOrders = db.data.orders.length;
  const ramBoekingen = db.data.boekingen.length;
  const ledgerOrders = await txLedgerTel('orders');
  const ledgerBoekingen = await txLedgerTel('boekingen');
  // historie voorbij het venster: pagina vanaf offset 10 (het venster) hoort de
  // uit het RAM gerolde orders terug te geven, nieuwste eerst
  const historie = await txLedgerVanKlant('orders', 'user-1', 25, 10);
  // statuswissel op een venster-item: de volgende veegronde neemt hem mee (hete kop)
  const kop = db.data.orders[0];
  kop.status = 'terugbetaald';
  await txVeegNu();
  const naMutatie = (await txLedgerVanZaak('orders', 'KIKUNOI', 5, 0)).find(o => o.ref === kop.ref);


  /* ==== RTG PAY: EEN TIJDSTIP IN MILLISECONDEN, EN EEN VENSTER VOORBIJ EEN
     BLADZIJDE (TAKEN.md 4.39) ====

     Twee dingen in EEN ronde, omdat ze dezelfde rijen nodig hebben.

     (1) Een pay-boeking draagt `at` als GETAL (Date.now()), waar de vier andere
         collecties een ISO-tekst dragen. De Postgres-kolom is een timestamptz,
         en beide wegen naar het grootboek slikken een mislukte insert: zonder
         normalisatie blijft `payLedger` gewoon op nul staan terwijl er nergens
         een fout te zien is.

     (2) Er worden er ZEVENHONDERD gemaakt, met opzet meer dan de bladzijde van
         vijfhonderd waar vensterTopUp het ooit bij liet. Gaat de blob verloren
         (de crash binnen het trage-flush-venster), dan hoort de start het hele
         venster terug te halen en niet de eerste bladzijde ervan. */
  const PAY_N = 700;
  for (let i = 0; i < PAY_N; i++) payBoekingenVoegToe({ id: 'PB-IT' + i, van: 'lid:a', naar: 'lid:b',
    centen: 100 + i, soort: 'boeking', oms: 'rit', ref: null, at: BASIS + i * 1000 });
  await txVeegNu();
  const payLedger = await txLedgerTel('payBoekingen');
  /* De kolom zelf: staat er een echt tijdstip in, of struikelde de insert? Een
     timestamptz komt als Date terug; een mislukte insert geeft geen rij. */
  const kolom = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const q = await kolom.query("SELECT at FROM tx_ledger WHERE soort='payboeking' ORDER BY at DESC LIMIT 1");
  const payTijdstip = q.rows.length ? new Date(q.rows[0].at).getTime() : 0;
  await kolom.end();
  // de blob is de crash niet doorgekomen; het grootboek heeft alles nog
  db.data.payBoekingen = [];
  await vensterTopUp();
  const payTopUp = db.data.payBoekingen.length;
  const payNieuwsteEerst = !!(db.data.payBoekingen[0] && db.data.payBoekingen[0].id === 'PB-IT' + (PAY_N - 1));
  /* En een tweede ronde op een venster dat al klopt hoort NIETS te doen: geen
     dubbele regels, geen andere volgorde, en niet eens een nieuwe array. Zo
     blijft een herstart die twee keer bijvult even goed als een die dat een keer
     doet. */
  const voorTweede = db.data.payBoekingen;
  await vensterTopUp();
  const payTweedeRondeRaakteNiets = db.data.payBoekingen === voorTweede &&
    db.data.payBoekingen.length === payTopUp;

  console.log(JSON.stringify({
    ramOrders, ramBoekingen, ledgerOrders, ledgerBoekingen,
    historieN: historie.length, historieEerste: historie[0] && historie[0].ref,
    historieIsOud: historie.every(o => !db.data.orders.some(r => r.ref === o.ref)),
    mutatieStatus: naMutatie && naMutatie.status,
    vensterNogVindbaar: !!orderMetRef(kop.ref),
    payLedger, payTopUp, payNieuwsteEerst, payTweedeRondeRaakteNiets,
    payTijdstipIsBasis: payTijdstip === BASIS + (PAY_N - 1) * 1000
  }));
  await dbmod.flushBijAfsluiten();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
