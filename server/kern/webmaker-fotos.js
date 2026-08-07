/* RTG Webmaker (deelbestand): de eigen fotobibliotheek van een lid.

   Alleen veilige /media-verwijzingen; het scannen en opslaan gebeurt in de
   route, hier bewaren we de url en houden we de bibliotheek op maat.

   EN HIER STOND HET LEK. De bibliotheek houdt er FOTO_MAX; de 25e duwde de
   oudste eruit, en "foto weghalen" haalde alleen de verwijzing weg. Het
   BESTAND bleef in beide gevallen staan -- niet alleen ruimte die nooit
   terugkomt, maar ook een /media-url die opvraagbaar bleef terwijl de
   gebruiker denkt dat het beeld weg is.

   Met een strik erop die makkelijk te missen was: de bibliotheek is de
   keuzelijst, niet de eigendomsadministratie. Een beeld-blok op een site
   verwijst naar dezelfde /media-url. Zou "uit de bibliotheek" ook meteen "van
   schijf" betekenen, dan haalde je met een opruimactie het beeld van je eigen
   gepubliceerde pagina weg. Vandaar nogInGebruik().

   Afgesplitst uit webmaker.js toen die de 10 KB passeerde. */
module.exports = function maakWebmakerFotos({ store, save, media }) {
  // deze module heeft zijn EIGEN nogInGebruik (hieronder) en kijkt in store(),
  // niet in db. Hij geeft dus geen db mee: mediaopruim wist dan niets in plaats
  // van te veel, en de controle die hier telt staat een paar regels verderop.
  const opruim = require('./mediaopruim')(media);
  const FOTO_MAX = 24;        // hoeveel eigen foto's een lid in zijn bibliotheek houdt

  // Staat deze url nog op een site van dit lid? Dan blijft het bestand.
  function nogInGebruik(key, url) {
    for (const d of store().lijst) {
      if (d.eigenaar !== key) continue;
      for (const b of d.blokken || []) {
        if (b.src === url) return true;
        if (Array.isArray(b.beelden) && b.beelden.includes(url)) return true;
      }
    }
    return false;
  }
  const wisOngebruikt = (key, urls) => opruim.wis(urls.filter(u => !nogInGebruik(key, u)));

  function fotos(key) { const s = store(); return Array.isArray(s.fotos[key]) ? s.fotos[key].slice() : []; }

  function fotoBewaar(key, url) {
    if (!/^\/media\/[A-Za-z0-9._-]+$/.test(String(url || ''))) return { error: 'Ongeldige foto.', status: 400 };
    const s = store(); const lijst = Array.isArray(s.fotos[key]) ? s.fotos[key] : (s.fotos[key] = []);
    if (!lijst.includes(url)) lijst.unshift(url);
    if (lijst.length > FOTO_MAX) {
      const eraf = lijst.slice(FOTO_MAX);   // de oudste vallen eraf...
      lijst.length = FOTO_MAX;
      wisOngebruikt(key, eraf);             // ...en hun bestanden vallen mee af
    }
    save();
    return { ok: true, url, fotos: lijst.slice() };
  }

  function fotoWeg(key, url) {
    const s = store();
    /* Alleen wissen als hij ECHT in de bibliotheek van dit lid stond. Anders is
       dit een knop waarmee je met een geraden /media-url het beeld van iemand
       anders weggooit. */
    const stond = Array.isArray(s.fotos[key]) && s.fotos[key].includes(url);
    if (Array.isArray(s.fotos[key])) s.fotos[key] = s.fotos[key].filter(u => u !== url);
    save();
    if (stond) wisOngebruikt(key, [url]);
    return { ok: true, fotos: fotos(key) };
  }

  return { fotos, fotoBewaar, fotoWeg, nogInGebruik, FOTO_MAX };
};
