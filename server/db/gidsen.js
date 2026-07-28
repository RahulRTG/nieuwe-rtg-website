/* Opslag, deel "gidsen": de twee geindexeerde-buiten-het-geheugen registers voor
   de echt grote schaal (alleen met Postgres actief).

   - ./grootboek.js -- de zakencatalogus (suppliers_big): miljoenen restaurants,
     winkels en hotels als geindexeerde rijen, op code opgezocht.
   - ./ledengids.js -- de ledengids (member_dir): de codenaam/pas-gids per lid,
     de enige plek waar leden elkaar op codenaam vinden.

   Ze staan apart omdat het twee onafhankelijke registers zijn met elk hun eigen
   tabel, cache en indexen; hier worden ze samengevoegd tot de ene API die de
   rest van de opslaglaag al gebruikte, zodat geen aanroeper iets merkt.

   Zonder Postgres is dit alles inert; init(pool) reikt de pool aan beide delen
   aan. De twee inits falen los van elkaar: valt de ledengids om, dan blijft het
   grootboek werken en andersom. */
const grootboek = require('./grootboek');
const ledengids = require('./ledengids');

async function init(pool, log) {
  const warn = m => { if (log && log.warn) log.warn(m); };
  await grootboek.init(pool, warn);
  await ledengids.init(pool, warn);
}

module.exports = {
  init,
  grootSupplierSync: grootboek.grootSupplierSync,
  grootAantal: grootboek.grootAantal,
  ledenGidsActief: ledengids.ledenGidsActief,
  ledenGidsHaal: ledengids.ledenGidsHaal,
  ledenGidsAantal: ledengids.ledenGidsAantal,
  ledenGidsZet: ledengids.ledenGidsZet,
  ledenGidsWeg: ledengids.ledenGidsWeg,
  ledenGidsExact: ledengids.ledenGidsExact,
  ledenGidsZoek: ledengids.ledenGidsZoek
};
