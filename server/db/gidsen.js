/* Opslag, deel "gidsen": de twee geindexeerde-buiten-het-geheugen registers voor
   de echt grote schaal (alleen met Postgres actief).

   - Grootboek van zaken (suppliers_big): voor een enorme catalogus (miljoenen
     restaurants) is een array in het geheugen geen optie; de zaken staan als
     geindexeerde rijen in Postgres (code = sleutel) en worden op aanvraag
     opgezocht, met een kleine cache. De demo-/actieve zaken blijven in
     db.data.suppliers.
   - Ledengids (member_dir): de codenaam/pas-gids per lid (sleutel ->
     {codename, tier}) staat bij tientallen miljoenen leden als geindexeerde
     rijen in Postgres (key = sleutel, codename_lower voor zoeken), met een kleine
     cache van de actieve leden.

   Zonder Postgres is dit alles inert; init(pool) installeert de pools en zet de
   tabellen/indexen klaar. */
let grootPool = null;
const grootCache = new Map();      // code -> zaak-object of null (niet gevonden)
let grootN = 0, grootNAt = 0;
let ledenPool = null;
const ledenCache = new Map();      // key -> { codename, tier } of null (niet gevonden)
let ledenN = 0, ledenNAt = 0;

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

async function ververLedenN() {
  if (!ledenPool) return 0;
  try { const r = await ledenPool.query('SELECT count(*)::bigint AS c FROM member_dir'); ledenN = Number(r.rows[0].c); ledenNAt = Date.now(); } catch (e) {}
  return ledenN;
}
async function laadLid(key) {
  try {
    const r = await ledenPool.query('SELECT codename, tier FROM member_dir WHERE key = $1', [key]);
    const row = r.rows[0];
    if (ledenCache.size > 100000) ledenCache.clear();          // begrensde cache van actieve leden
    ledenCache.set(key, row ? { codename: row.codename, tier: row.tier } : null);
  } catch (e) { ledenCache.delete(key); }
}
function ledenGidsActief() { return !!ledenPool; }
// Synchroon opzoeken: uit de cache, of null terwijl we hem asynchroon inladen
// (de volgende keer zit hij in de cache). Zo blijven de bestaande synchrone
// lezers werken zoals de app verwacht.
function ledenGidsHaal(key) {
  if (!ledenPool) return undefined;
  if (ledenCache.has(key)) return ledenCache.get(key);
  ledenCache.set(key, null);          // voorkom een storm van gelijke queries
  laadLid(key);
  return null;
}
function ledenGidsAantal() {
  if (ledenPool && Date.now() - ledenNAt > 10000) { ledenNAt = Date.now(); ververLedenN().catch(() => {}); }
  return ledenN;
}
// Nieuw of gewijzigd lid: cache meteen bijwerken (zodat een lezer direct na een
// schrijf het juiste antwoord krijgt) en de rij in Postgres upserten.
async function ledenGidsZet(key, codename, tier) {
  if (!ledenPool) return;
  ledenCache.set(key, { codename, tier });
  try {
    const r = await ledenPool.query(
      'INSERT INTO member_dir(key, codename, tier, codename_lower) VALUES($1,$2,$3,$4) ' +
      'ON CONFLICT(key) DO UPDATE SET codename=$2, tier=$3, codename_lower=$4 RETURNING (xmax=0) AS nieuw',
      [key, codename, tier, String(codename || '').toLowerCase()]);
    if (r.rows[0] && r.rows[0].nieuw) ledenN++;
  } catch (e) {}
}
// Omgekeerd opzoeken (codenaam -> sleutel), geindexeerd i.p.v. een scan.
async function ledenGidsKeyVanCodenaam(codename) {
  if (!ledenPool) return null;
  try { const r = await ledenPool.query('SELECT key FROM member_dir WHERE codename_lower = $1 LIMIT 1', [String(codename || '').trim().toLowerCase()]); return r.rows[0] ? r.rows[0].key : null; } catch (e) { return null; }
}
// Zoeken op (deel van) een codenaam, geindexeerd en begrensd.
async function ledenGidsZoek(qLower, limit) {
  if (!ledenPool) return [];
  try {
    const r = await ledenPool.query('SELECT key, codename, tier FROM member_dir WHERE codename_lower LIKE $1 LIMIT $2', ['%' + String(qLower || '') + '%', limit || 20]);
    // De gevonden leden meteen in de per-sleutel cache warmen: wie iemand net via
    // de zoekindex vond en daarna op de sleutel opzoekt (codeExists bij verbinden
    // of bellen) moet die synchroon terugvinden, niet op een koude cache stuiten.
    if (ledenCache.size > 100000) ledenCache.clear();
    for (const row of r.rows) ledenCache.set(row.key, { codename: row.codename, tier: row.tier });
    return r.rows.map(row => ({ key: row.key, codename: row.codename, tier: row.tier }));
  } catch (e) { return []; }
}

/* Installeer de pools en zet de tabellen/indexen klaar (aangeroepen door de
   Postgres-start). De grootboek- en ledengids-init falen onafhankelijk: valt de
   ledengids-init om, dan blijft ledenPool null en gebruikt de app db.data. */
async function init(pool, log) {
  const warn = m => { if (log && log.warn) log.warn(m); };
  grootPool = pool;
  try { await grootPool.query('CREATE TABLE IF NOT EXISTS suppliers_big(code text PRIMARY KEY, name text, type text, city text)'); await ververGrootN(); } catch (e) { warn('[db] grootboek init mislukt: ' + e.message); }
  ledenPool = pool;
  try {
    await ledenPool.query('CREATE TABLE IF NOT EXISTS member_dir(key text PRIMARY KEY, codename text, tier text, codename_lower text)');
    // btree: exact opzoeken (codenaam -> sleutel, de betaal/Tik-weg) is O(log n)
    await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_lower ON member_dir(codename_lower)');
    // Deelzoeken ("vind een vriend", LIKE '%q%') kan een btree-index niet
    // gebruiken door het wildcard-voorvoegsel: dan scant hij alle rijen (bij
    // tientallen miljoenen leden seconden per zoekopdracht). De trigram-index
    // (pg_trgm) maakt juist die LIKE '%q%' geindexeerd. Best-effort: mag de
    // extensie niet (geen rechten) of ontbreekt pg_trgm, dan valt het zoeken
    // terug op de scan en werkt de rest gewoon door.
    try {
      await ledenPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)');
    } catch (e) { warn('[db] trigram-zoekindex niet beschikbaar (deelzoeken valt terug op scan): ' + e.message); }
    await ververLedenN();
  } catch (e) { ledenPool = null; warn('[db] ledengids init mislukt: ' + e.message); }
}

module.exports = {
  init, grootSupplierSync, grootAantal,
  ledenGidsActief, ledenGidsHaal, ledenGidsAantal, ledenGidsZet, ledenGidsKeyVanCodenaam, ledenGidsZoek
};
