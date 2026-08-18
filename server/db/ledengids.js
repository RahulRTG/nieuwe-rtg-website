/* Opslag, deel "ledengids" (member_dir) -- alleen met Postgres.

   De codenaam/pas-gids per lid (sleutel -> { codename, tier }): bij tientallen
   miljoenen leden staan die als geindexeerde rijen in Postgres in plaats van in
   het geheugen, met een kleine cache van de actieve leden. Dit is de enige plek
   waar leden elkaar op codenaam vinden; er gaat nooit een echte naam over.

   Zonder Postgres is dit alles inert en draait de app op db.data.memberDir;
   zie ./gidsen.js, dat dit deel met het grootboek samenvoegt. */
let ledenPool = null;
const ledenCache = new Map();      // key -> { codename, tier } of null (niet gevonden)
// Omgekeerde cache: kleine-letter-codenaam -> { key, codename, tier }. Wordt
// synchroon gevuld door ledenGidsZet, zodat een NET actief lid meteen op
// codenaam vindbaar is, ook al is de rij nog onderweg naar Postgres (de
// upsert is fire-and-forget). Zonder deze cache kan een p2p-betaling naar een
// zojuist geregistreerd lid "codenaam onbekend" krijgen tot de schrijf landt.
const ledenRev = new Map();        // codename_lower -> { key, codename, tier }
let ledenN = 0, ledenNAt = 0;

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
/* Wachtend opzoeken, voor waar "niet gevonden" een BESLUIT draagt (404,
   weigering). De synchrone lezing geeft bij een koude misser null terwijl de
   rij bestaat, en de cache wordt boven de honderdduizend in een keer geleegd
   -- onder last is elke sleutel zomaar even koud. Zo kreeg een NET gevonden
   codenaam bij het verbinden "kennen we niet" (beproeving, 1M leden). Een
   cache-grens is geen feit: deze variant vraagt het bij twijfel echt aan
   Postgres, via dezelfde lader. */
async function ledenGidsHaalWacht(key) {
  if (!ledenPool) return undefined;
  const vlot = ledenCache.get(key);
  if (vlot) return vlot;              // een gevulde cache-regel is betrouwbaar
  await laadLid(key);                 // null of afwezig: nu echt even vragen
  return ledenCache.get(key) || null;
}
function ledenGidsAantal() {
  if (ledenPool && Date.now() - ledenNAt > 10000) { ledenNAt = Date.now(); ververLedenN().catch(() => {}); }
  return ledenN;
}
// Nieuw of gewijzigd lid: cache meteen bijwerken (zodat een lezer direct na een
// schrijf het juiste antwoord krijgt) en de rij in Postgres upserten.
async function ledenGidsZet(key, codename, tier) {
  if (!ledenPool) return;
  /* EERST DE OUDE NAAM WEG, DAN PAS DE NIEUWE ERIN.

     Zonder deze regel bleef een HERNOEMD lid onder zijn oude codenaam
     vindbaar. In Postgres gaat dat goed -- de upsert draait op `key`, dus daar
     is en blijft het een rij -- maar ledenRev is een aparte map op codenaam, en
     die kreeg er bij elke hernoeming stilletjes een sleutel bij die naar
     hetzelfde lid wees.

     Twee gevolgen, en het tweede is het ernstige. Een lid was onder twee namen
     te vinden; en codenamen worden opnieuw uitgegeven, dus die losgeraakte oude
     naam kan later aan een ANDER lid toebehoren terwijl de cache hem nog naar
     de vorige eigenaar wijst -- een p2p-betaling of uitnodiging die bij de
     verkeerde persoon uitkomt. Het viel niet om, het werd alleen nooit
     opgeruimd, en niets klaagde. */
  const vorige = ledenCache.get(key);
  ledenCache.set(key, { codename, tier });
  const nu = String(codename || '').trim().toLowerCase();
  if (vorige && vorige.codename) {
    const oudLower = String(vorige.codename).trim().toLowerCase();
    if (oudLower && oudLower !== nu) ledenRev.delete(oudLower);
  }
  // meteen omgekeerd vindbaar op codenaam (synchroon), nog voor Postgres klaar is
  if (ledenRev.size > 100000) ledenRev.clear();
  ledenRev.set(nu, { key, codename, tier });
  try {
    const r = await ledenPool.query(
      'INSERT INTO member_dir(key, codename, tier, codename_lower) VALUES($1,$2,$3,$4) ' +
      'ON CONFLICT(key) DO UPDATE SET codename=$2, tier=$3, codename_lower=$4 RETURNING (xmax=0) AS nieuw',
      [key, codename, tier, String(codename || '').toLowerCase()]);
    if (r.rows[0] && r.rows[0].nieuw) ledenN++;
  } catch (e) {}
}
/* Een lid uit de gids halen (recht op vergetelheid, AVG art. 17). Zonder deze
   functie blijft de koppeling sleutel <-> codenaam bestaan nadat het account
   is verwijderd, en is het lid nog steeds op codenaam te vinden. Alle drie de
   plekken moeten mee: de rij in Postgres, de vooruitcache en de omgekeerde
   cache op codenaam -- die laatste is makkelijk te vergeten en juist de plek
   waar het zoeken op codenaam op uitkomt. */
async function ledenGidsWeg(key) {
  if (!ledenPool) return;
  const bekend = ledenCache.get(key);
  ledenCache.delete(key);
  if (bekend && bekend.codename) ledenRev.delete(String(bekend.codename).trim().toLowerCase());
  try {
    const r = await ledenPool.query('DELETE FROM member_dir WHERE key = $1 RETURNING codename_lower', [key]);
    if (r.rows.length) { ledenRev.delete(r.rows[0].codename_lower); if (ledenN > 0) ledenN--; }
  } catch (e) {}
}

// Exact opzoeken (codenaam -> { sleutel, codenaam, pas }), op de btree-index
// (codename_lower), NIET op de trigram-scan. Eerst de synchrone omgekeerde
// cache (net actief lid), dan een O(log n)-btree-treffer in Postgres. Dit is
// het HETE pad voor p2p-betalen, uitnodigen en bellen: een exacte opzoeking
// mag nooit een deelzoek-scan over 100M rijen worden.
async function ledenGidsExact(codename) {
  if (!ledenPool) return null;
  const lower = String(codename || '').trim().toLowerCase();
  if (!lower) return null;
  const rev = ledenRev.get(lower);
  if (rev) return { key: rev.key, codename: rev.codename, tier: rev.tier };
  try {
    const r = await ledenPool.query('SELECT key, codename, tier FROM member_dir WHERE codename_lower = $1 LIMIT 1', [lower]);
    if (!r.rows[0]) return null;
    // meteen in de per-sleutel cache warmen voor een volgende lezing
    ledenCache.set(r.rows[0].key, { codename: r.rows[0].codename, tier: r.rows[0].tier });
    return { key: r.rows[0].key, codename: r.rows[0].codename, tier: r.rows[0].tier };
  } catch (e) { return null; }
}
/* Zoeken op (deel van) een codenaam, geindexeerd en begrensd.

   DE LIMIT MAAKTE DE TRIGRAM-INDEX ONBRUIKBAAR. Op 100M leden gemeten:
   LIKE '%...%' LIMIT 20 gaf een Seq Scan over 100M rijen (29.821 ms); dezelfde
   vraag met de index 0,3 ms. De schatting is de dader: Postgres kent voor
   LIKE '%...%' geen selectiviteit, gokt op 10.000 treffers, en met LIMIT 20
   lijkt een seq scan dan al na 0,2% klaar. Het waren er twee.

   OFFSET 0 als hek werkt niet (PG16 vlakt het uit); een CTE met MATERIALIZED
   wel. De ruil: een veelvoorkomende term gaat van 0,3 naar 600 ms. Goede kant
   op -- 600 ms is te doen, 30 seconden is stuk.

   EN DE EXACTE WEG EERST: een VOLLEDIGE codenaam hoort niet in een
   deelzoektocht. Dat is 4 ms op de btree. */
async function ledenGidsZoek(qLower, limit) {
  if (!ledenPool) return [];
  const q = String(qLower || '').trim();
  const max = limit || 20;
  // 1. de exacte weg: O(log n) op de btree, en meteen klaar bij een volle codenaam
  const precies = q ? await ledenGidsExact(q) : null;
  try {
    // 2. de deelzoektocht, met het hek eromheen zodat de LIMIT de planner niet
    //    langs de index stuurt (PG11 en ouder kent MATERIALIZED niet: zie catch)
    const r = await ledenPool.query(
      'WITH treffers AS MATERIALIZED (SELECT key, codename, tier FROM member_dir WHERE codename_lower LIKE $1) '
      + 'SELECT key, codename, tier FROM treffers LIMIT $2', ['%' + q + '%', max]);
    // gevonden leden meteen in de per-sleutel cache warmen: wie iemand net vond
    // en daarna op sleutel opzoekt (verbinden, bellen) mag geen koude cache zien
    if (ledenCache.size > 100000) ledenCache.clear();
    for (const row of r.rows) ledenCache.set(row.key, { codename: row.codename, tier: row.tier });
    const uit = r.rows.map(row => ({ key: row.key, codename: row.codename, tier: row.tier }));
    // Vangnet tegen de schrijf-vertraging: is er een EXACTE codenaam-treffer in
    // de synchrone omgekeerde cache die Postgres nog niet teruggaf (de upsert is
    // net gebeurd), voeg die dan toe. Zo vindt een exacte opzoeking (p2p-betaling,
    // uitnodiging, bellen) een zojuist actief lid meteen, zonder op de index te
    // wachten. Substring-zoeken over miljoenen blijft volledig Postgres-gedekt.
    const rev = ledenRev.get(q);
    if (rev && !uit.some(x => x.key === rev.key)) uit.push({ key: rev.key, codename: rev.codename, tier: rev.tier });
    // de exacte treffer hoort vooraan, en maar een keer
    if (precies && !uit.some(x => x.key === precies.key)) uit.unshift(precies);
    return uit.slice(0, max);
  } catch (e) {
    // Kent deze Postgres MATERIALIZED niet: dezelfde vraag zonder hek. Trager,
    // maar waar -- stilletjes leeg teruggeven is erger dan traag.
    try {
      const r2 = await ledenPool.query('SELECT key, codename, tier FROM member_dir WHERE codename_lower LIKE $1 LIMIT $2', ['%' + q + '%', max]);
      const uit2 = r2.rows.map(row => ({ key: row.key, codename: row.codename, tier: row.tier }));
      if (precies && !uit2.some(x => x.key === precies.key)) uit2.unshift(precies);
      return uit2.slice(0, max);
    } catch (e2) {
      const rev = ledenRev.get(q);
      const uit3 = rev ? [{ key: rev.key, codename: rev.codename, tier: rev.tier }] : [];
      if (precies && !uit3.some(x => x.key === precies.key)) uit3.unshift(precies);
      return uit3;
    }
  }
}

/* Installeer de pool, zet de tabel en de twee indexen klaar. Faalt dit, dan
   blijft ledenPool null en gebruikt de app db.data.memberDir. */
async function init(pool, warn) {
  ledenPool = pool;
  try {
    await ledenPool.query('CREATE TABLE IF NOT EXISTS member_dir(key text PRIMARY KEY, codename text, tier text, codename_lower text)');
    // btree: exact opzoeken (codenaam -> sleutel, de betaal/Tik-weg) is O(log n)
    await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_lower ON member_dir(codename_lower)');
    /* Deelzoeken ("vind een vriend", LIKE '%q%') kan een btree-index niet
       gebruiken door het wildcard-voorvoegsel: dan scant hij alle rijen (bij
       tientallen miljoenen leden seconden per zoekopdracht). De trigram-index
       (pg_trgm) maakt juist die LIKE '%q%' geindexeerd. Best-effort: mag de
       extensie niet (geen rechten) of ontbreekt pg_trgm, dan valt het zoeken
       terug op de scan en werkt de rest gewoon door. */
    try {
      await ledenPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await ledenPool.query('CREATE INDEX IF NOT EXISTS member_dir_codename_trgm ON member_dir USING gin(codename_lower gin_trgm_ops)');
    } catch (e) { warn('[db] trigram-zoekindex niet beschikbaar (deelzoeken valt terug op scan): ' + e.message); }
    await ververLedenN();
  } catch (e) { ledenPool = null; warn('[db] ledengids init mislukt: ' + e.message); }
}

module.exports = {
  init, ledenGidsActief, ledenGidsHaal, ledenGidsHaalWacht, ledenGidsAantal,
  ledenGidsZet, ledenGidsWeg, ledenGidsExact, ledenGidsZoek
};
