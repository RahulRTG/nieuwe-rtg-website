/* Transactie-grootboek (tx_ledger), alleen met Postgres actief. Orders en
   boekingen staan als GEINDEXEERDE RIJEN in Postgres (soort+ref als sleutel,
   klant/zaak/at geindexeerd), buiten het procesgeheugen. Het werkgeheugen houdt
   alleen een VENSTER van de recentste items (TX_RAM_*); alles daarbuiten leeft in
   het grootboek en is via de gepagineerde lezers bereikbaar. Zo blijft de kv-blob
   klein (goedkope flush) en verdwijnt de laatste O(alles)-serialisatie.

   Verlies-vrij per constructie: de veegronde schrijft de staart EERST (upsert,
   idempotent) naar het grootboek en haalt hem pas daarna uit het RAM. Nieuwe
   items gaan bij aanmaak direct (best-effort) mee; statuswissels van recente
   items neemt de veegronde mee via de hete kop. Zonder Postgres is dit inert.
   Afgesplitst uit tx/index.js; het RAM-venster (txStaartNa/txVerwijder) en save()
   komen via wire() binnen. */
const kluis = require('../../kluis');
const state = require('../state');
const db = state.db;

const txKlantVan = t => t.customerKey || t.customerTier;

// het RAM-venster + de snapshot-trigger komen uit tx/index (injectie voorkomt
// een circulaire require: index gebruikt onze zet(), wij gebruiken hun venster)
let venster = { txStaartNa: () => [], txVerwijder: () => {}, save: () => {} };
function wire(v) { venster = Object.assign(venster, v); }

let txPool = null;
const TX_RAM_MAX = { orders: Number(process.env.TX_RAM_ORDERS || 30000), boekingen: Number(process.env.TX_RAM_BOEKINGEN || 50000) };
const TX_SOORT = { orders: 'order', boekingen: 'boeking' };
const TX_VEEG_MS = Number(process.env.TX_VEEG_MS || 30000);
const TX_KAP = Number(process.env.TX_KAP || 20000);      // max staart-items per veegronde (tegen event-loop-stalls)
const TX_KOP = Number(process.env.TX_KOP || 500);        // hete kop die elke ronde opnieuw meegaat (statuswissels)
const txBekend = { orders: new Set(), boekingen: new Set() }; // refs waarvan we weten dat ze in het grootboek staan
let txVeegTimer = null, txVeegBezig = false;
function txLedgerActief() { return !!txPool; }
const txDedup = items => { const gezien = new Set(); const uit = []; for (const t of items) { if (!t || t.ref == null || gezien.has(t.ref)) continue; gezien.add(t.ref); uit.push(t); } return uit; };
async function txLedgerZet(naam, t) {
  if (!txPool || !t || t.ref == null) return;
  try {
    await txPool.query(
      `INSERT INTO tx_ledger(soort, ref, klant, zaak, paid, status, totaal, at, data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(soort, ref) DO UPDATE SET klant=$3, zaak=$4, paid=$5, status=$6, totaal=$7, at=$8, data=$9`,
      [TX_SOORT[naam], String(t.ref), txKlantVan(t) || null, t.supplierCode || null, !!t.paid, t.status || null,
        Number(t.total != null ? t.total : t.price) || 0, t.at || new Date().toISOString(), kluis.versleutel(JSON.stringify(t))]);
    txBekend[naam].add(t.ref);
  } catch (e) { /* eventueel-consistent: de veegronde (backfill/kop) probeert het opnieuw */ }
}
async function txLedgerBulk(naam, items) {
  if (!txPool) return false;
  const schoonItems = txDedup(items);
  const soort = TX_SOORT[naam];
  for (let i = 0; i < schoonItems.length; i += 1000) {
    const brok = schoonItems.slice(i, i + 1000);
    const vals = [], params = [];
    brok.forEach((t, j) => {
      const b = j * 9;
      vals.push('($' + (b + 1) + ',$' + (b + 2) + ',$' + (b + 3) + ',$' + (b + 4) + ',$' + (b + 5) + ',$' + (b + 6) + ',$' + (b + 7) + ',$' + (b + 8) + ',$' + (b + 9) + ')');
      params.push(soort, String(t.ref), txKlantVan(t) || null, t.supplierCode || null, !!t.paid, t.status || null,
        Number(t.total != null ? t.total : t.price) || 0, t.at || new Date().toISOString(), kluis.versleutel(JSON.stringify(t)));
    });
    await txPool.query(
      'INSERT INTO tx_ledger(soort,ref,klant,zaak,paid,status,totaal,at,data) VALUES ' + vals.join(',') +
      ' ON CONFLICT(soort,ref) DO UPDATE SET klant=EXCLUDED.klant, zaak=EXCLUDED.zaak, paid=EXCLUDED.paid, status=EXCLUDED.status, totaal=EXCLUDED.totaal, at=EXCLUDED.at, data=EXCLUDED.data',
      params);
    for (const t of brok) txBekend[naam].add(t.ref);
  }
  return true;
}
// Gepagineerde lezers: geindexeerd op (soort, klant/zaak, at), nooit een scan.
async function txLedgerVanKlant(naam, klant, limit, offset) {
  if (!txPool) return [];
  try {
    const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 AND klant=$2 ORDER BY at DESC LIMIT $3 OFFSET $4',
      [TX_SOORT[naam], String(klant || ''), Math.min(200, limit || 25), Math.max(0, offset || 0)]);
    return r.rows.map(x => JSON.parse(kluis.ontsleutel(x.data)));
  } catch (e) { return []; }
}
async function txLedgerVanZaak(naam, zaak, limit, offset) {
  if (!txPool) return [];
  try {
    const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 AND zaak=$2 ORDER BY at DESC LIMIT $3 OFFSET $4',
      [TX_SOORT[naam], String(zaak || ''), Math.min(200, limit || 25), Math.max(0, offset || 0)]);
    return r.rows.map(x => JSON.parse(kluis.ontsleutel(x.data)));
  } catch (e) { return []; }
}
async function txLedgerTel(naam, klant) {
  if (!txPool) return 0;
  try {
    const r = klant != null
      ? await txPool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1 AND klant=$2', [TX_SOORT[naam], String(klant)])
      : await txPool.query('SELECT count(*)::bigint AS c FROM tx_ledger WHERE soort=$1', [TX_SOORT[naam]]);
    return Number(r.rows[0].c);
  } catch (e) { return 0; }
}
// Synchrone, gecachete totalen (zelfde patroon als ledenGidsAantal): de
// KPI-lezers blijven synchroon en krijgen een teller die hooguit ~10 s achterloopt.
const txN = { orders: 0, boekingen: 0 };
let txNAt = 0;
function txLedgerAantal(naam) {
  if (txPool && Date.now() - txNAt > 10000) {
    txNAt = Date.now();
    (async () => { try { txN.orders = await txLedgerTel('orders'); txN.boekingen = await txLedgerTel('boekingen'); } catch (e) {} })();
  }
  return txN[naam] || 0;
}
/* De veegronde: (1) backfill wat het grootboek nog niet kent (na een boot met
   een bestaande kv), (2) de hete kop opnieuw (statuswissels), (3) de staart
   voorbij het venster veilig wegschrijven en dan pas uit het RAM halen.
   Gepaced (TX_KAP per ronde) zodat een grote achterstand nooit de event-loop
   blokkeert maar in rustige stappen wegloopt. */
async function txVeegNu() {
  if (!txPool || txVeegBezig || !db.writable) return;
  txVeegBezig = true;
  try {
    for (const naam of ['orders', 'boekingen']) {
      const arr = db.data[naam] || [];
      const onbekend = arr.filter(t => t && t.ref != null && !txBekend[naam].has(t.ref)).slice(0, TX_KAP);
      if (onbekend.length) await txLedgerBulk(naam, onbekend);
      if (arr.length) await txLedgerBulk(naam, arr.slice(0, TX_KOP));
      if (arr.length > TX_RAM_MAX[naam]) {
        const staart = venster.txStaartNa(naam, TX_RAM_MAX[naam]).slice(-TX_KAP).filter(t => t && t.ref != null);
        if (staart.length) {
          await txLedgerBulk(naam, staart);   // eerst duurzaam in het grootboek...
          venster.txVerwijder(naam, staart);  // ...dan pas uit het venster
          venster.save();
          console.log('[tx] ' + staart.length + ' ' + naam + ' voorbij het venster naar het grootboek verhuisd; ' + (db.data[naam] || []).length + ' in het RAM.');
        }
      }
    }
  } catch (e) { console.warn('[tx] veegronde mislukt:', e.message); }
  finally { txVeegBezig = false; }
}

/* Installeer het grootboek: tabellen/indexen klaarzetten, de pool bewaren en de
   veegronde starten (aangeroepen door de Postgres-start). */
async function initLedger(pool, log) {
  const warn = m => { if (log && log.warn) log.warn(m); };
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS tx_ledger(
      soort text NOT NULL, ref text NOT NULL, klant text, zaak text,
      paid boolean, status text, totaal numeric, at timestamptz, data text NOT NULL,
      PRIMARY KEY(soort, ref))`);
    await pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_klant ON tx_ledger(soort, klant, at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS tx_ledger_zaak ON tx_ledger(soort, zaak, at DESC)');
    txPool = pool;
    txVeegTimer = setInterval(() => { txVeegNu().catch(() => {}); }, TX_VEEG_MS);
    if (txVeegTimer.unref) txVeegTimer.unref();
    const eersteVeeg = setTimeout(() => { txVeegNu().catch(() => {}); }, 3000);
    if (eersteVeeg.unref) eersteVeeg.unref();
  } catch (e) { txPool = null; warn('[db] tx-grootboek init mislukt: ' + e.message); }
}
// Venster-top-up uit het grootboek: items die al als rij in het grootboek staan
// maar nog niet in de blob, komen hier terug in het venster.
async function vensterTopUp(log) {
  const warn = m => { if (log && log.warn) log.warn(m); };
  if (!txPool || !db.data) return;
  for (const naam of ['orders', 'boekingen']) {
    try {
      const r = await txPool.query('SELECT data FROM tx_ledger WHERE soort=$1 ORDER BY at DESC LIMIT 500', [TX_SOORT[naam]]);
      const arr = Array.isArray(db.data[naam]) ? db.data[naam] : (db.data[naam] = []);
      const bekend = new Set(arr.map(t => t && t.ref).filter(x => x != null));
      const missend = [];
      for (const row of r.rows) { const t = JSON.parse(kluis.ontsleutel(row.data)); if (!bekend.has(t.ref)) missend.push(t); }
      if (missend.length) {
        missend.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))); // nieuwste eerst, zoals unshift
        db.data[naam] = missend.concat(arr);
        console.log('[tx] ' + missend.length + ' ' + naam + ' uit het grootboek teruggezet in het venster (kv liep achter).');
      }
    } catch (e) { warn('[db] venster-top-up ' + naam + ' mislukt: ' + e.message); }
  }
}

module.exports = {
  wire, actief: txLedgerActief, zet: txLedgerZet,
  txLedgerActief, txLedgerVanKlant, txLedgerVanZaak, txLedgerTel, txLedgerAantal, txVeegNu,
  initLedger, vensterTopUp
};
