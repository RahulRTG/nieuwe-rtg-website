/* ============================================================================
   DE BAKJES -- de kant van het LID, en met opzet NIET de brug.

   Afgesplitst van ./brug.js toen die over de 10 KB-keuringsgrens ging, en langs
   de naad die daar al met zoveel woorden stond: dit loopt niet over de brug.

   WAAROM DAT VERSCHIL BESTAAT. Een app mag een bericht KLAARZETTEN in het bakje
   van een lid (machtiging `bericht.klaarzetten`, ./brug.js). Wat hij daarna niet
   mag, is zien of dat bericht is gelezen -- dat zou van een bericht een baken
   maken waarmee een derde kan meten wanneer een lid zijn scherm opent. Daarom
   staan de LEES-kant en de SCHRIJF-kant niet achter dezelfde deur: de app schrijft
   via de brug, het lid leest via zijn eigen sessie, en er is geen weg terug.

   Een bestand ertussen maakt die grens zichtbaar in plaats van dat hij als
   alinea in een groter bestand staat.
   ========================================================================== */
'use strict';

module.exports = function maakBakjes({ S, save, eigen, bak, GRENS }) {
  /* Het bakje van EEN app, gelezen door het lid zelf. Dit loopt met opzet niet
     over de brug: het is de kant van het lid, en een app hoort niet te kunnen
     zien of zijn bericht is gelezen. */
  function bakje(key, sleutel) { return bak('bakjes', key, sleutel).slice(0, GRENS.bakGrootte); }
  function bakjeGelezen(key, sleutel) {
    const b = bak('bakjes', key, sleutel);
    let n = 0;
    for (const x of b) if (!x.gelezen) { x.gelezen = true; n++; }
    if (n) save();
    return { ok: true, gelezen: n };
  }
  function bakjes(key) {
    const r = eigen(S().bakjes, String(key)) || {};
    const uit = {};
    for (const s of Object.keys(r)) {
      const ongelezen = (r[s] || []).filter(x => !x.gelezen).length;
      if (ongelezen) uit[s] = ongelezen;
    }
    return uit;
  }

  return { bakje, bakjeGelezen, bakjes };
};
