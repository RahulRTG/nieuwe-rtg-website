/* RTG Theater, deelbestand "kantoor": WAT EEN MENS VAN RTG DOET.

   Een kanaal gaat pas open nadat iemand van RTG-kantoor ernaar heeft gekeken --
   de vaste regel van dit huis: het systeem keurt nooit zelf goed. Dat geldt ook
   voor een INTERNE bibliotheek van een organisatie: die is niet openbaar, maar
   hij draait wel op de opslag en de naam van RTG.

   Losgehouden van ./index.js omdat het een ander onderwerp is dan wat een lid of
   een zaak met een kanaal doet -- en omdat dat bestand er anders over de
   omvangregel gaat. */
'use strict';

module.exports = ({ db, lijsten, kanaalMet, codenaamVan, save, notify }) => {
  function officeLijst() {
    lijsten();
    return { wacht: db.data.theaterKanalen.filter(k => k.status === 'wacht').map(k => ({ id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, codenaam: codenaamVan(k.key), at: k.at })),
      meldingen: db.data.theaterMeldingen.slice(-50).reverse() };
  }
  function officeBeslis(kid, besluit) {
    const k = kanaalMet(kid); if (!k) return { status: 404, error: 'Kanaal niet gevonden.' };
    if (!['goedgekeurd', 'geweigerd'].includes(besluit)) return { status: 400, error: 'Besluit is goedgekeurd of geweigerd.' };
    k.status = besluit; save();
    notify(k.key, { title: 'RTG Theater', body: besluit === 'goedgekeurd' ? 'Uw kanaal "' + k.naam + '" is goedgekeurd.' : 'Uw kanaal "' + k.naam + '" is niet goedgekeurd.', scope: 'theater' });
    return { status: 200, ok: true };
  }

  return { officeLijst, officeBeslis };
};
