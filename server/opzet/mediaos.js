/* DE BEDRADING VAN DE MEDIA OS (kern/mediaos/).

   Eén mediawereld over vier apps heen: Klankwerk (muziek), Theater (video),
   Clips (korte video) en Podium (live). Drie standen op dezelfde catalogus,
   één makersprofiel, één volgrelatie, één bibliotheek.

   WAT HIER STAAT, EN WAAROM HET DUN IS. De Media OS bezit geen van de vier
   domeinen. Elke rij wordt bij het opvragen uit het domein zelf gehaald, en
   een volgknop schrijft in de volgerslijst van het domein zelf. De lezers
   hieronder zijn dus de HELE koppeling -- er komt nergens een tweede
   administratie naast het origineel te staan (LAT.md regel 4).

   Aangeroepen vanuit ./kernlaag7.js, als laatste, want alle vier de domeinen
   moeten er al zijn. */
'use strict';
module.exports = (kern, hulp) => {
  /* `notify` komt uit de hulp-bag van kernlaag7 en niet uit de kern: de
     meldingenlaag hangt daar niet in. Hij gaat mee omdat ./wekken.js de
     volgers van een maker wekt langs precies dezelfde weg als het Theater en
     het Podium dat doen -- inclusief de scope-schakelaar van het lid. */
  /* Dit bestand krijgt de hele hulp-bag van kernlaag7 en niet drie losse
     parameters: de luisterkamer zit op de live-lijn (sseToCustomer) en de
     lijsten hebben crypto nodig voor hun id's. Een bag doorgeven is hier
     goedkoper dan de aanroepregel elke keer verlengen. */
  const { notify, sseToCustomer, crypto } = hulp;
  const { db, save, schoon, keyVanCodenaam } = kern;

  /* DE WERKHERKOMST WORDT HIER GEBOUWD EN NIET IN kern/mediaos/index.js, en dat
     is een maatregel met een reden die het waard is om te onthouden: dat bestand
     stond op 10238 bytes, TWEE onder de grens van keuringsregel 13. Een regel
     erbij en de keuring zakt. Dit is de bedrading, dus hier hoort een motor te
     worden samengesteld; index.js krijgt hem als parameter en forwardt hem naar
     ./wekken.js, waar het vastleggen zelf gebeurt.

     WAT HIJ IS: het register waar vijf domeinen via `nieuwWerk(makerKey, soort,
     titel)` zelf vertellen dat DEZE maker DIT heeft gemaakt -- met een echte
     ledensleutel, op het moment dat het werk er is. kern/connect/ LEEST dat en
     stelt auteurschap nooit zelf vast (besluit van de eigenaar, 15 september
     2026). De uitleg staat in de kop van kern/mediaos/werkherkomst.js. */
  const werkherkomst = require('../kern/mediaos/werkherkomst').maakWerkherkomst({
    opslag: require('../kern/mediaos/opslag')({ db, save }) });

  Object.assign(kern, require('../kern/mediaos').maakMediaOS({
    db, save, schoon, crypto, codenaamVan: kern.codenaamVan, keyVanCodenaam, notify, werkherkomst,
    /* Voor het delen van een lijst en voor de luisterkamer: allebei mogen ze
       alleen tussen mensen die verbonden zijn, en die relatie woont in de
       sociale laag -- er komt hier geen tweede vriendenlijst naast. */
    zijnVrienden: kern.zijnVrienden, sseToCustomer,
    bronnen: {
      // de vier wereldbeelden, elk zoals het domein hem zelf al toont
      tracks: (sess) => kern.muziekZaal(sess, {}),
      videos: (key) => kern.theaterZaal(key),
      clips: (key) => kern.clipsFeed(key, {}),
      // alleen de zones die in de gedeelde index horen; 18+ en besloten niet
      live: (key) => kern.podiumGedeeld(key),
      /* Media for Business: de twee bronnen die AL intern zijn. Ze geven per
         lid alleen wat bij een zaak van dat lid hoort -- de Media OS filtert
         hier niets openbaars "intern". */
      zakenVan: (key) => (kern.werkplekken ? kern.werkplekken.zakenVan(key) : []),
      videosZaak: (key) => kern.theaterZaakVideos(key),
      liveZaak: (key) => kern.podiumZaak(key),
      // de eigen naam en kleur van elke zaak van dit lid
      merkZaak: (key) => kern.theaterZaakMerk(key),
      // gericht: één maker, en de verbinding tussen een uitgave en de clips eronder
      tracksVan: (mKey, kijker) => kern.muziekUitgavenVan(mKey, kijker),
      videosVan: (mKey) => kern.theaterVideosVan(mKey),
      clipsVan: (mKey, kijker) => kern.clipsVan(mKey, kijker),
      clipsMetTrack: (trackId, kijker) => kern.clipsMetTrack(trackId, kijker),
      clipsVolgersVan: (mKey) => kern.clipsVolgersVan(mKey),
      theaterVolgersVan: (mKey) => kern.theaterVolgersVan(mKey),
      liveVan: (mKey, kijker) => kern.podiumKanaalVan(mKey, kijker),
      theaterKanaalVan: (mKey) => kern.theaterKanaalVan(mKey),
      volgtTheater: (key, mKey) => kern.theaterVolgt(key, mKey),
      // schrijven gebeurt IN het domein: de volgerslijst blijft van Clips en Theater
      volgClips: (key, mKey, aan) => kern.clipsVolgMaker(key, mKey, aan),
      volgTheater: (key, kanaalId, aan) => kern.theaterAbonneer(key, kanaalId, aan)
    }
  }));

  /* De twee lezers naar buiten, read-only. Er is met opzet GEEN functie die alle
     werken van iedereen teruggeeft: dat zou een publieke makerslijst zijn. */
  kern.mediaMakerVanWerk = werkherkomst.makerVanWerk;
  kern.mediaWerkenVan = werkherkomst.werkenVan;
};
