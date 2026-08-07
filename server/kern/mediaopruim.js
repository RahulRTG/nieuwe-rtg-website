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
/* db komt erbij zodat wis() kan zien of een verwijzing ergens ANDERS nog hangt.
   Zonder die kennis wiste hij het beeld van een zaak zodra haar Salon-post uit
   het venster viel. Wie hem zonder db bouwt, krijgt het oude gedrag terug -- dus
   dat mag niet stil: dan wist hij niets in plaats van te veel. */
module.exports = function maakMediaOpruim(media, db) {
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
  /* NIET WISSEN WAT ERGENS ANDERS NOG GEBRUIKT WORDT.

     wis() gooide elke verwijzing weg die uit een verdwijnende post kwam. Maar
     dezelfde afbeelding kan elders nog hangen: een zaak die zijn Salon-foto ook
     als paginafoto gebruikt, een profiel, een clip. Viel de post uit het venster
     (kap() houdt er hooguit MAX_POSTS), dan verdween daarmee de foto van de
     zaak -- zonder dat iemand iets had verwijderd en zonder enig spoor.

     Daarom eerst kijken of de verwijzing nog ergens staat. Dat doen we op de
     hele opslag in EEN keer: de refs zijn lange, unieke tekenreeksen, dus een
     tekstzoektocht is hier betrouwbaar en het scheelt een lijst van "alle
     plekken waar een beeld kan hangen" die gegarandeerd achterloopt op de code.

     Deze functie draait zelden (alleen als een post verdwijnt), dus de prijs van
     een keer serialiseren is de juiste ruil tegen stil beeldverlies. Lukt het
     serialiseren niet, dan wissen we NIETS: bij twijfel bewaren. */
  function nogInGebruik(refs) {
    const over = new Set();
    if (!db || !db.data) { for (const r of refs) over.add(r); return over; }   // geen zicht = niets wissen
    let tekst = '';
    try { tekst = JSON.stringify(db.data); } catch (e) { for (const r of refs) over.add(r); return over; }
    for (const r of refs) if (tekst.includes(r)) over.add(r);
    return over;
  }

  function wis(refs) {
    if (!media || typeof media.verwijder !== 'function') return;
    const lijst = [...(refs || [])].filter(isRef);
    if (!lijst.length) return;
    const bewaren = nogInGebruik(lijst);
    for (const ref of lijst) {
      if (bewaren.has(ref)) continue;   // hangt nog ergens: van iemand anders
      try {
        const p = media.verwijder(ref);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* opruimen mag nooit een verzoek breken */ }
    }
  }

  return { isRef, refsVanPost, refsVanPosts, wis };
};
