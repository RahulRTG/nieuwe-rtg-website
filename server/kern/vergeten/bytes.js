/* Vergeten (deelbestand): de sporen die NIET in db.data staan.

   ../vergeten.js gaat over de takken in de database. Dit bestand gaat over wat
   daar alleen als VERWIJZING staat: de foto's van De Salon, de snaps en
   verhalen, de beelden op een eigen site, en de bestanden in RTG Bestanden.
   Die liggen als losse, met onze eigen sleutel versleutelde bestanden op schijf
   of in de objectopslag.

   Dat onderscheid was precies het gat. "Verwijder mijn gegevens" haalde de
   verwijzing weg en liet het bestand staan: een weesbestand dat wij gewoon
   kunnen openen. Bij De Salon gaat dat over privefoto's, bij RTG Bestanden over
   paspoortscans, contracten en medische brieven.

   De volgorde is hier het hele punt. Eerst de verwijzingen VERZAMELEN, dan pas
   de records weggooien -- andersom weet niemand meer welke bestanden bij dit
   lid hoorden en blijven ze voorgoed staan. Vandaar dat elke functie hier een
   Set meekrijgt en er verwijzingen in achterlaat; ../vergeten.js ruimt ze aan
   het eind in een keer op.

   Afgesplitst uit vergeten.js toen die de 10 KB passeerde. */
module.exports = function maakBytes({ db, media, bestanden }) {
  const isRef = (v) => !!(media && media.isRef && typeof v === 'string' && media.isRef(v));
  const noteer = (bron, uit) => { if (isRef(bron)) uit.add(bron); };

  /* De beelden van de eigen Salon-posts. Aanroepen VOORDAT die posts uit
     db.data.posts worden gefilterd; daarna is de link weg. */
  function noteerPostBeelden(key, uit) {
    for (const p of db.data.posts || []) {
      if (p.authorKey !== key) continue;
      noteer(p.photo, uit);
      noteer(p.visual, uit);
      for (const m of p.media || []) noteer(m && m.src, uit);
    }
  }

  /* SNAPS EN VERHALEN. Een snap is per definitie van een tweetal: gemaakt door
     de een, alleen te openen door de ander. Vertrekt een van de twee, dan houdt
     niemand er nog iets aan over -- de ontvanger kan hem niet meer openen zonder
     afzender, en van de afzender hoort er niets achter te blijven. Dus allebei
     de kanten weg, foto erbij. Een verhaal is eenvoudiger: dat is van de maker
     alleen; uit de verhalen die BLIJVEN gaat dit lid alleen uit de kijkerslijst. */
  function wisSnapsEnVerhalen(key, uit) {
    if (Array.isArray(db.data.snaps)) {
      for (const s of db.data.snaps) if (s.van === key || s.naar === key) noteer(s.foto, uit);
      db.data.snaps = db.data.snaps.filter(s => s.van !== key && s.naar !== key);
    }
    if (Array.isArray(db.data.stories)) {
      for (const s of db.data.stories) if (s.van === key) noteer(s.foto, uit);
      db.data.stories = db.data.stories.filter(s => s.van !== key);
      for (const s of db.data.stories) {
        if (Array.isArray(s.kijkers)) s.kijkers = s.kijkers.filter(k => k !== key);
      }
    }
  }

  /* DE EIGEN SITES (RTG Webmaker). Een gepubliceerde site staat op een
     rtg://-adres met de naam, de foto's en de tekst van dit lid erop. Bleef hij
     staan, dan was "verwijder mijn gegevens" niet alleen onvolledig maar
     zichtbaar onwaar: de site was gewoon nog te bezoeken. De eigen
     fotobibliotheek gaat mee, en de bestanden erachter ook. */
  function wisSites(key, uit) {
    const s = db.data.ledenSites;
    if (!s) return;
    if (Array.isArray(s.lijst)) {
      for (const d of s.lijst) {
        if (d.eigenaar !== key) continue;
        for (const b of d.blokken || []) {
          noteer(b.src, uit);
          for (const beeld of b.beelden || []) noteer(beeld, uit);
        }
      }
      s.lijst = s.lijst.filter(d => d.eigenaar !== key);
    }
    if (s.fotos && Array.isArray(s.fotos[key])) {
      for (const u of s.fotos[key]) noteer(u, uit);
      delete s.fotos[key];
    }
  }

  /* DE KLUIS (RTG Bestanden). Het beleid staat in kern/bestanden-vergeten.js,
     bij de bytes; hier alleen de aanroep. Dit is het zwaarste wat een lid bij
     ons heeft staan, en het stond niet in het vergeetbeleid. */
  function wisKluis(key) {
    const f = bestanden && bestanden.bestandenVergeet;
    if (typeof f !== 'function') return;
    try { f(key); } catch (e) {}
  }

  /* En dan de bytes zelf. Bewust per bestand foutbestendig: een enkel mislukt
     bestand (S3 even onbereikbaar) mag de rest niet tegenhouden. */
  async function wisMedia(uit) {
    if (!media || typeof media.verwijder !== 'function') return;
    for (const ref of uit) { try { await media.verwijder(ref); } catch (e) {} }
  }

  return { noteerPostBeelden, wisSnapsEnVerhalen, wisSites, wisKluis, wisMedia };
};
