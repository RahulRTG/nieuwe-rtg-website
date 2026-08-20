/* DE LEDENGIDS, ZOEKKANT: exact opzoeken en deelzoeken.

   Afgesplitst van ./ledengids.js omdat dat bestand over de 10 kB van
   keuringsregel 13 liep. De snede loopt langs een echte grens: hierboven staat
   het BIJHOUDEN van de gids (zetten, weghalen, tellen, de cache warm houden),
   hier het OPZOEKEN. Dat zijn twee verschillende soorten werk met twee
   verschillende prestatie-eisen -- de uitleg bij ledenGidsExact hieronder legt
   uit waarom een exacte opzoeking nooit een scan mag worden.

   DE GEDEELDE TOESTAND GAAT MEE ALS FUNCTIE, NIET ALS WAARDE. `ledenPool` wordt
   pas bij init() gezet en daarna nog vervangen; wie hem hier als waarde zou
   binnenkrijgen, houdt voor eeuwig de null van het opstartmoment vast. Vandaar
   `pool()`. De omgekeerde cache is wel een vaste Map en gaat gewoon mee: het is
   dezelfde Map, geen kopie -- twee cachekopieen zouden uiteenlopen en dan vindt
   de ene een net geregistreerd lid dat de andere niet kent. Dat geldt ook voor
   `ledenCache`: het zoeken warmt hem op met wat het uit Postgres haalt, en dat
   moet dezelfde Map zijn die het opzoeken leest.

   DIE TWEEDE STOND ER EERST NIET IN, en geen enkele toets zag dat: zonder
   Postgres-pool komt deze code niet eens aan de cache toe. Keuringsregel 39
   (kruis-slice) wees hem aan -- een zusterbestand mag geen top-level van zijn
   buurman gebruiken, juist omdat dat pas in productie omvalt. */
'use strict';

module.exports = ({ pool, ledenRev, ledenCache }) => {

// Exact opzoeken (codenaam -> { sleutel, codenaam, pas }), op de btree-index
// (codename_lower), NIET op de trigram-scan. Eerst de synchrone omgekeerde
// cache (net actief lid), dan een O(log n)-btree-treffer in Postgres. Dit is
// het HETE pad voor p2p-betalen, uitnodigen en bellen: een exacte opzoeking
// mag nooit een deelzoek-scan over 100M rijen worden.
async function ledenGidsExact(codename) {
  if (!pool()) return null;
  const lower = String(codename || '').trim().toLowerCase();
  if (!lower) return null;
  const rev = ledenRev.get(lower);
  if (rev) return { key: rev.key, codename: rev.codename, tier: rev.tier };
  try {
    const r = await pool().query('SELECT key, codename, tier FROM member_dir WHERE codename_lower = $1 LIMIT 1', [lower]);
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
  if (!pool()) return [];
  const q = String(qLower || '').trim();
  const max = limit || 20;
  // 1. de exacte weg: O(log n) op de btree, en meteen klaar bij een volle codenaam
  const precies = q ? await ledenGidsExact(q) : null;
  try {
    // 2. de deelzoektocht, met het hek eromheen zodat de LIMIT de planner niet
    //    langs de index stuurt (PG11 en ouder kent MATERIALIZED niet: zie catch)
    const r = await pool().query(
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
      const r2 = await pool().query('SELECT key, codename, tier FROM member_dir WHERE codename_lower LIKE $1 LIMIT $2', ['%' + q + '%', max]);
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

  return { ledenGidsExact, ledenGidsZoek };
};
