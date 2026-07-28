/* Opslag, deel "grootboek van zaken" (suppliers_big) -- alleen met Postgres.

   Voor een enorme catalogus (miljoenen restaurants, winkels, hotels) is een
   array in het geheugen geen optie: de zaken staan als geindexeerde rijen in
   Postgres met de code als sleutel, en worden op aanvraag opgezocht met een
   kleine cache. De demo- en actieve zaken blijven gewoon in db.data.suppliers.

   Zonder Postgres is dit alles inert; init(pool) installeert de pool en zet de
   tabel klaar. Zie ./gidsen.js, dat dit deel met de ledengids samenvoegt. */
let grootPool = null;              // blijft null zonder Postgres: dan is alles hier inert
const grootCache = new Map();      // code -> zaak-object of null (niet gevonden)
let grootN = 0, grootNAt = 0;

async function ververGrootN() {
  if (!grootPool) return 0;
  try { const r = await grootPool.query('SELECT count(*)::bigint AS c FROM suppliers_big'); grootN = Number(r.rows[0].c); grootNAt = Date.now(); } catch (e) {}
  return grootN;
}
async function laadGroot(code) {
  try {
    const r = await grootPool.query('SELECT code, name, type, city FROM suppliers_big WHERE code = $1', [code]);
    const row = r.rows[0];
    if (grootCache.size > 5000) grootCache.clear();            // kleine LRU: gewoon legen bij vol
    grootCache.set(code, row ? { code: row.code, name: row.name, type: row.type, city: row.city, menu: [], rate: 0.12 } : null);
  } catch (e) { grootCache.delete(code); }
}
// Synchronoon zoeken in het grootboek: uit de cache, of null terwijl we hem
// asynchroon inladen (de volgende keer zit hij in de cache). Zo blijft
// findSupplier synchroon zoals de hele app verwacht.
function grootSupplierSync(code) {
  if (!grootPool) return null;
  if (grootCache.has(code)) return grootCache.get(code);
  grootCache.set(code, null);        // voorkom een storm van gelijke queries
  laadGroot(code);
  return null;
}
function grootAantal() {
  if (grootPool && Date.now() - grootNAt > 10000) { grootNAt = Date.now(); ververGrootN().catch(() => {}); }
  return grootN;
}

/* Installeer de pool en zet de tabel klaar. Faalt onafhankelijk van de
   ledengids: valt dit om, dan blijft grootPool leeg en draait de app door op
   db.data.suppliers. */
async function init(pool, warn) {
  grootPool = pool;
  try {
    await grootPool.query('CREATE TABLE IF NOT EXISTS suppliers_big(code text PRIMARY KEY, name text, type text, city text)');
    await ververGrootN();
  } catch (e) { warn('[db] grootboek init mislukt: ' + e.message); }
}

module.exports = { init, grootSupplierSync, grootAantal };
