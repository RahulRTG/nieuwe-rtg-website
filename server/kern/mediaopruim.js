/* Weesbeelden opruimen: als een verwijzing verdwijnt, gaat het bestand mee.

   De mediastore bewaart foto's als losse, versleutelde bestanden; in db.data
   staat alleen een korte verwijzing. Dat is een goed ontwerp, met een valkuil
   die op meerdere plekken tegelijk is ingetrapt: overal waar een LIJST wordt
   afgekapt of een regel wordt verwijderd, verdwijnt de verwijzing en blijft het
   bestand staan.

   Waar dat gebeurde:
   - De Salon kapt het venster op MAX_POSTS (2000). Elke post die eraf valt had
     tot zes foto's van anderhalve megabyte. Een lid dat blijft plaatsen duwt zo
     de foto's van anderen uit de lijst -- en al die bestanden bleven liggen.
   - Een post die de auteur ZELF weghaalt liet zijn foto's ook staan. Dat is
     niet alleen ruimte: wie de /media-url ooit zag, kon hem daarna gewoon
     blijven opvragen, terwijl de post weg was.
   - De eigen fotobibliotheek van een site houdt er 24; de 25e duwde de oudste
     eruit, bestand en al blijvend. En "foto weghalen" haalde alleen de
     verwijzing weg.

   Het gevolg was een mediastore die alleen maar groeit, met daarin beelden
   waarvan de gebruiker denkt dat ze weg zijn. Vandaar EEN plek voor deze
   handeling, zodat de volgende lijst met een grens hem ook gebruikt.

   Bewust NIET afwachten: dit is opruimen, geen onderdeel van het antwoord. Een
   traag of even onbereikbaar S3 mag een post niet ophouden. De fout wordt
   ingeslikt (het ergste geval is dat er een wees blijft liggen, wat precies de
   oude toestand is), maar nooit als losse belofte -- een onafgevangen
   afwijzing zou de server-brede vangnetten laten afgaan. */
module.exports = function maakMediaOpruim(media) {
  const isRef = (v) => !!(media && media.isRef && typeof v === 'string' && media.isRef(v));

  // Alle beeldverwijzingen van een Salon-post (nieuwe karrousel + het oude veld).
  function refsVanPost(p, uit) {
    if (!p) return uit;
    if (isRef(p.photo)) uit.add(p.photo);
    if (isRef(p.visual)) uit.add(p.visual);
    for (const m of p.media || []) if (m && isRef(m.src)) uit.add(m.src);
    return uit;
  }
  function refsVanPosts(posts) {
    const uit = new Set();
    for (const p of posts || []) refsVanPost(p, uit);
    return uit;
  }

  // Opruimen op de achtergrond; nooit een losse belofte laten hangen.
  function wis(refs) {
    if (!media || typeof media.verwijder !== 'function') return;
    for (const ref of refs || []) {
      if (!isRef(ref)) continue;
      try {
        const p = media.verwijder(ref);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* opruimen mag nooit een verzoek breken */ }
    }
  }

  return { isRef, refsVanPost, refsVanPosts, wis };
};
