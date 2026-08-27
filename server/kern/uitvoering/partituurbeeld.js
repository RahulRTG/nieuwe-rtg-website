/* UITVOERENDE MEDIA (deelmodule): WAT DE WERELD VAN EEN PARTITUUR ZIET.

   Gesplitst van ./partituur.js toen dat bestand tegen de keuringsgrens liep, en
   de naad loopt waar hij hoort -- dezelfde als bij kern/muziek-uitgave-beeld.js:
   daar staat wat een partituur IS en hoe hij verandert, hier staat welke velden
   naar buiten gaan.

   EN DAT IS EEN EIGEN ONDERWERP, geen opmaak. Wat hier NIET in mag is de
   inhoudsopgave: wie er niet in mag, hoort niet te zien uit welke fragmenten het
   werk bestaat -- dat zou een lijst zijn van werk achter een dichte deur. Wat er
   wel in staat is de duur, het aantal onderdelen en de prijs: dat heeft iemand
   nodig om te kiezen of hij erop tikt. */
'use strict';

const F = require('./fragment');

module.exports = ({ tabel }) => {
  /* WAT ER OPENSTAAT VOOR IEDEREEN. De Media OS leest dit als vijfde vorm, zodat
     een partituur in dezelfde wereld verschijnt als muziek, video, clips en live
     -- geen tweede wereld en geen tweede volgknop (LAT.md regel 4).

     Alleen KLAARGEZETTE partituren, en bewust zonder de onderdelen: wie er niet
     in mag, hoort niet te zien waaruit het werk bestaat. Wat er WEL bij staat is
     de duur en of er een aanspraak voor nodig is -- dat is wat iemand nodig
     heeft om te kiezen of hij erop tikt. */
  function openbaar(codenaamVan) {
    return tabel().filter(p => p.klaar).map(p => ({
      id: p.id, naam: p.naam, key: p.key,
      codenaam: codenaamVan ? codenaamVan(p.key) : null,
      kernS: (p.onderdelen || []).filter(o => o.rol === 'kern').reduce((n, o) => n + F.duurVan(o.fragmentId), 0),
      totaalS: (p.onderdelen || []).reduce((n, o) => n + F.duurVan(o.fragmentId), 0),
      onderdelen: (p.onderdelen || []).length,
      aanspraakNodig: p.aanspraakNodig || null, prijsCenten: p.prijsCenten || 0,
      toestemming: p.toestemming, at: p.at
    }));
  }

  return { openbaar };
};
