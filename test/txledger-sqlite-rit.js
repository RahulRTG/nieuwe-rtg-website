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
    directBetalingenVoegToe, betaalVerzoekenVoegToe, payBoekingenVoegToe,
    txLedgerTel, txLedgerVanKlant, txLedgerVanZaak, txVeegNu, txLedgerActief } = dbmod;
  const { vensterTopUp } = require('../server/db/tx');
  load();
  startSqliteSync();          // zet de kruisproces-sync EN het grootboek aan
  for (let i = 0; i < 40 && !txLedgerActief() && process.env.TX_LEDGER_SQLITE !== '0'; i++) await slaap(25);

  db.data.orders = []; db.data.boekingen = [];
  db.data.directBetalingen = []; db.data.betaalVerzoeken = []; db.data.payBoekingen = [];
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
  for (let i = 0; i < PAY_N; i++) payBoekingenVoegToe({ id: 'PB-SQ' + i, van: 'lid:a', naar: 'lid:b',
    centen: 100 + i, soort: 'boeking', oms: 'rit', ref: null, at: BASIS + i * 1000 });
  await txVeegNu();
  const payLedger = await txLedgerTel('payBoekingen');

  // de blob is de crash niet doorgekomen; het grootboek heeft alles nog
  db.data.payBoekingen = [];
  await vensterTopUp();
  const payTopUp = db.data.payBoekingen.length;
  const payNieuwsteEerst = !!(db.data.payBoekingen[0] && db.data.payBoekingen[0].id === 'PB-SQ' + (PAY_N - 1));
  /* En een tweede ronde op een venster dat al klopt hoort NIETS te doen: geen
     dubbele regels, geen andere volgorde, en niet eens een nieuwe array. Zo
     blijft een herstart die twee keer bijvult even goed als een die dat een keer
     doet. */
  const voorTweede = db.data.payBoekingen;
  const tweede = await vensterTopUp();
  const payTweedeRondeRaakteNiets = db.data.payBoekingen === voorTweede &&
    db.data.payBoekingen.length === payTopUp;
  /* DE PRIJS VAN DIE TWEEDE RONDE. Hij hoort EEN bladzijde te lezen en dan te
     stoppen, want die bladzijde gaf al niets nieuws. Zonder die stopregel
     pagineert hij door tot het grootboek op is -- hier 700 rijen in plaats van
     500, en bij een volle collectie tot ramMax. Dat is geen gedragsverschil
     maar wel de helft van de reparatie, dus staat het getal er. */
  const payTweedeRondeLas = (tweede.payBoekingen && tweede.payBoekingen.gelezen) || 0;

  /* ==== DE VOLGORDE BIJ EEN GAT AAN DE ACHTERKANT ====

     Hierboven was de blob helemaal leeg, en dan staat alles wat terugkomt toch
     al op volgorde. Deze ronde zet de blob op de 200 NIEUWSTE en laat de rest
     ontbreken. Wat er dan bijkomt is OUDER dan wat er staat, dus vooraan
     plakken (missend.concat(arr)) geeft een venster dat met de oudste begint.
     Alleen het sorteren erna zet dat recht.

     Zo'n stand ontstaat niet vanzelf -- de kv-blob wordt in zijn geheel
     weggeschreven, dus een gat zit altijd aan de VOORkant -- maar de sortering
     staat er wel, en wat er staat hoort gemeten te zijn. */
  const nieuwste200 = db.data.payBoekingen.slice(0, 200);
  db.data.payBoekingen = nieuwste200.map(x => x);
  await vensterTopUp();
  const payGatAchteraanN = db.data.payBoekingen.length;
  const payGatAchteraanOpVolgorde = db.data.payBoekingen.every((b, i, a) =>
    i === 0 || String(a[i - 1].at) >= String(b.at));
  const payGatAchteraanEerste = db.data.payBoekingen[0] && db.data.payBoekingen[0].id;

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
    sleutelLeesbaar: /RTG-O-SQ/.test(ruwGrootboek + walTekst(grootboekPad)),
    payLedger, payTopUp, payNieuwsteEerst, payTweedeRondeRaakteNiets, payTweedeRondeLas,
    payGatAchteraanN, payGatAchteraanOpVolgorde, payGatAchteraanEerste
  }));
  await dbmod.flushBijAfsluiten();
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
