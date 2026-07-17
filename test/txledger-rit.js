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
  const { Pool } = require('pg');
  const schoonmaak = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  await schoonmaak.query('DROP TABLE IF EXISTS tx_ledger');
  await schoonmaak.query('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT NOT NULL, ver BIGINT NOT NULL DEFAULT 0, bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now())');
  await schoonmaak.query('DELETE FROM kv');
  await schoonmaak.end();

  const dbmod = require('../server/db');
  const { db, load, startPostgres, ordersVoegToe, orderMetRef, boekingenVoegToe,
    txLedgerTel, txLedgerVanKlant, txLedgerVanZaak, txVeegNu } = dbmod;
  load();
  await startPostgres();
  db.data.orders = []; db.data.boekingen = [];

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

  console.log(JSON.stringify({
    ramOrders, ramBoekingen, ledgerOrders, ledgerBoekingen,
    historieN: historie.length, historieEerste: historie[0] && historie[0].ref,
    historieIsOud: historie.every(o => !db.data.orders.some(r => r.ref === o.ref)),
    mutatieStatus: naMutatie && naMutatie.status,
    vensterNogVindbaar: !!orderMetRef(kop.ref)
  }));
  await dbmod.flushBijAfsluiten();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
