/* Clips (deelmodule): DE LEZERS VOOR DE MEDIA OS.

   Drie vragen die Clips over zijn eigen gegevens beantwoordt, zodat de laag
   erboven (kern/mediaos/) geen tweede administratie hoeft aan te leggen en
   ook niet in db.data van een ander domein hoeft te graven:

   1. wat heeft deze maker gemaakt -- voor het makersprofiel, dat volledig
      hoort te zijn; de dagselectie in de feed is met opzet eindig, maar het
      werk van een maker mag daar niet stil door wegvallen;
   2. welke clips dragen DIT eigen muziekstuk als geluid -- de enige echte
      brug tussen een uitgave in het Klankwerk en een korte video, gelegd door
      clips-studio.js op het moment dat de maker zijn eigen stuk eronder zet;
   3. hoeveel mensen volgen deze maker.

   Alle drie geven ze het gewone clip-beeld terug, dus wat een kijker hier ziet
   is precies wat hij in de feed zou zien -- inclusief wat er NIET in staat. */
'use strict';

module.exports = ({ db, lijsten, beeld }) => {
  const opDatum = (a, b) => String(b.at).localeCompare(String(a.at));

  const clipsVan = (makerKey, kijkerKey) => {
    lijsten();
    return db.data.clips.filter(c => c.key === makerKey).sort(opDatum).map(c => beeld(c, kijkerKey));
  };
  const clipsMetTrack = (trackId, kijkerKey) => {
    lijsten();
    const t = String(trackId || '');
    if (!t) return [];
    return db.data.clips.filter(c => c.muziek && c.muziek.id === t).sort(opDatum).map(c => beeld(c, kijkerKey));
  };
  /* De SLEUTELS van wie deze maker volgt, niet een getal. Het makersbord wil
     tellen en de meldingslaag wil ze een voor een wekken; als dit een getal
     was, kwam er voor dat tweede een tweede functie -- en dan kunnen ze uit
     elkaar gaan lopen (LAT.md regel 4). Tellen doet de beller maar. */
  const clipsVolgersVan = (makerKey) => {
    lijsten();
    return Object.keys(db.data.clipsVolg)
      .filter(k => (db.data.clipsVolg[k] || []).includes(makerKey));
  };

  return { clipsVan, clipsMetTrack, clipsVolgersVan };
};
