/* Driver voor test/txledger-sqlite.test.js (GEEN .test.js: draait als kindproces).
   Bestuurt de db-laag rechtstreeks op de SQLITE-opslag en print een JSON-resultaat
   op de laatste regel. Een apart proces omdat het grootboek en de sqlite-
   verbindingen in modulescope leven; dit proces sluit hard af. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-txledger-sqlite-'));
process.env.RTG_DATA_DIR = TMP;
process.env.RTG_STORE = 'sqlite';
process.env.DATABASE_URL = '';
process.env.PG_URL = '';
process.env.RTG_ENC_KEY = 'toets-sleutel-voor-de-grootboek-rit';
process.env.TX_RAM_ORDERS = '10';
process.env.TX_RAM_BOEKINGEN = '8';
process.env.TX_RAM_DIRECTBETALINGEN = '5';
process.env.TX_RAM_BETAALVERZOEKEN = '4';
process.env.TX_KOP = '3';
process.env.TX_KAP = '1000';

const slaap = ms => new Promise(r => setTimeout(r, ms));
// De WAL hoort erbij: een verse rij kan daar nog in staan in plaats van in het
// hoofdbestand, en dan zou "staat het leesbaar op schijf" onterecht nee zeggen.
const walTekst = p => fs.existsSync(p + '-wal') ? fs.readFileSync(p + '-wal', 'latin1') : '';

(async () => {
  const dbmod = require('../server/db');
  const { db, load, save, startSqliteSync, ordersVoegToe, orderMetRef, boekingenVoegToe,
    directBetalingenVoegToe, betaalVerzoekenVoegToe,
    txLedgerTel, txLedgerVanKlant, txLedgerVanZaak, txVeegNu, txLedgerActief } = dbmod;
  load();
  startSqliteSync();          // zet de kruisproces-sync EN het grootboek aan
  for (let i = 0; i < 40 && !txLedgerActief() && process.env.TX_LEDGER_SQLITE !== '0'; i++) await slaap(25);

  db.data.orders = []; db.data.boekingen = [];
  db.data.directBetalingen = []; db.data.betaalVerzoeken = [];
  const BASIS = Date.parse('2026-01-01T00:00:00Z');
  const maakOrder = i => ({ ref: 'RTG-O-SQ' + i, supplierCode: 'KIKUNOI', customerKey: 'user-1', customerTier: 'rtg',
    total: 10 + i, paid: true, status: 'geserveerd', at: new Date(BASIS + i * 1000).toISOString() });
  for (let i = 0; i < 30; i++) ordersVoegToe(maakOrder(i));
  for (let i = 0; i < 15; i++) boekingenVoegToe({ ref: 'RTG-B-SQ' + i, kind: 'ticket', supplierCode: 'PONTO',
    customerKey: 'user-2', price: 40, paid: true, status: 'bevestigd', at: new Date(BASIS + i * 1000).toISOString() });
  /* De twee geldcollecties. Ze hebben ANDERE veldnamen dan een order (key in
     plaats van customerKey, bedrag in plaats van total), en juist daar zou een
     grootboek stilletjes nullen en lege klanten opleveren. Daarom worden ze
     hieronder ook echt teruggezocht op klant en op codenaam. */
  for (let i = 0; i < 12; i++) directBetalingenVoegToe({ ref: 'DP-SQ' + i, key: 'user-9', codename: 'ALK',
    supplierCode: 'PONTO', supplierName: 'Ponto', bedrag: 500 + i, betaalwijze: 'kaart',
    at: new Date(BASIS + i * 1000).toISOString() });
  for (let i = 0; i < 6; i++) betaalVerzoekenVoegToe({ ref: 'BV-SQ' + i, supplierCode: 'PONTO',
    supplierName: 'Ponto', naarCodename: 'Alk', bedrag: 700 + i, status: 'open',
    at: new Date(BASIS + i * 1000).toISOString() });
  save();

  // hoe groot is de kv-rij `orders` VOORDAT het venster gekapt is?
  const { DatabaseSync } = require('node:sqlite');
  const kvRij = (naam) => {
    const d = new DatabaseSync(path.join(TMP, 'store.db'));
    try { const r = d.prepare('SELECT val FROM kv WHERE key = ?').get(naam); return r ? r.val : ''; }
    finally { d.close(); }
  };
  const blobBytesVoor = kvRij('orders').length;

  await txVeegNu();   // staart eerst naar het grootboek, dan pas uit het RAM

  const ramOrders = db.data.orders.length;
  const ramBoekingen = db.data.boekingen.length;
  const ledgerOrders = await txLedgerTel('orders');
  const ledgerBoekingen = await txLedgerTel('boekingen');
  const historie = await txLedgerVanKlant('orders', 'user-1', 25, 10);
  const ramBetalingen = db.data.directBetalingen.length;
  const ramVerzoeken = db.data.betaalVerzoeken.length;
  const ledgerBetalingen = await txLedgerTel('directBetalingen');
  const ledgerVerzoeken = await txLedgerTel('betaalVerzoeken');
  // op de EIGEN sleutels teruglezen: een betaling op key, een verzoek op codenaam
  const betalingenVanLid = await txLedgerVanKlant('directBetalingen', 'user-9', 50, 0);
  const verzoekenVanCodenaam = await txLedgerVanKlant('betaalVerzoeken', 'alk', 50, 0);

  // statuswissel op een venster-item: de volgende veegronde neemt hem mee (hete kop)
  const kop = db.data.orders[0];
  kop.status = 'terugbetaald';
  await txVeegNu();
  const naMutatie = (await txLedgerVanZaak('orders', 'KIKUNOI', 5, 0)).find(o => o.ref === kop.ref);

  save();
  const ruweBlob = kvRij('orders');
  const kluis = require('../server/kluis');
  const blobOrders = JSON.parse(kluis.ontsleutel(ruweBlob)).length;
  const grootboekPad = path.join(TMP, 'grootboek.db');
  const ruwGrootboek = fs.existsSync(grootboekPad) ? fs.readFileSync(grootboekPad, 'latin1') : '';

  console.log(JSON.stringify({
    actief: txLedgerActief(),
    ramOrders, ramBoekingen, ledgerOrders, ledgerBoekingen,
    historieN: historie.length,
    historieIsOud: historie.every(o => !db.data.orders.some(r => r.ref === o.ref)),
    mutatieStatus: naMutatie && naMutatie.status,
    ramBetalingen, ramVerzoeken, ledgerBetalingen, ledgerVerzoeken,
    betalingenVanLid: betalingenVanLid.length,
    verzoekenVanCodenaam: verzoekenVanCodenaam.length,
    // klopt het BEDRAG in de rij, of staat er een 0 omdat de veldnaam niet paste?
    betalingBedragOk: betalingenVanLid.every(b => b.bedrag >= 500),
    vensterNogVindbaar: !!orderMetRef(kop.ref),
    opRefUitVenster: !!orderMetRef(db.data.orders[1] && db.data.orders[1].ref),
    blobOrders, blobBytesVoor, blobBytesNa: ruweBlob.length,
    grootboekBestand: fs.existsSync(grootboekPad),
    // Versleuteling-at-rest: de INHOUD (data-kolom) hoort onleesbaar te zijn. De
    // sleutelkolommen (ref, klant, zaak) staan bewust wel leesbaar op schijf --
    // je kunt niet indexeren op wat je niet kunt lezen, en precies zo doet de
    // Postgres-kant het ook. Privacy zit erin doordat `klant` een codenaam-sleutel
    // is; echte namen staan in de gescheiden kluis, niet hier.
    // `customerTier` bestaat alleen BINNEN de data-kolom, dus dit meet echt de
    // inhoud. `status` en `ref` zijn eigen kolommen en dus geen goede maatstaf.
    inhoudLeesbaar: /customerTier/.test(ruwGrootboek + walTekst(grootboekPad)),
    sleutelLeesbaar: /RTG-O-SQ/.test(ruwGrootboek + walTekst(grootboekPad))
  }));
  await dbmod.flushBijAfsluiten();
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
