/* De Vonk-profielprojecties. De eigenaar, discovery en match lezen dezelfde
   profielwaarheid, maar krijgen elk uitsluitend het benoemde contract. */
'use strict';

const { maakLidstand } = require('../betrouwbaarheid');

module.exports = function maakVonkProjecties({ accounts, codenaamVan, W, H, Projection, mediaVan }) {
  const lidstandVan = maakLidstand({ accounts });
  const niveauVan = key => {
    try {
      const st = lidstandVan(key);
      return st && st.niveau ? { id: st.niveau.id, naam: st.niveau.naam } : null;
    } catch (e) { return null; }
  };

  const publiek = (key, p, zelf, niveau, extra, viewer) => {
    const profileMedia = mediaVan();
    return Projection.project(
      zelf ? Projection.NAMES.VONK_PROFILE_OWNER : Projection.NAMES.VONK_DISCOVERY,
      { codenaam: codenaamVan(key), over: p.over, leeftijd: p.leeftijd,
        stad: p.stad, interesses: p.interesses, betrouwbaarheid: niveauVan(key),
        kenmerken: W.toonKenmerken(p, zelf ? 'match' : (niveau || 'kandidaten')),
        media: profileMedia ? profileMedia.projecteer(viewer || key, key, zelf ? 'owner' : 'discovery') : [],
        ...(extra || {}), ...(zelf ? { geslacht: p.geslacht, zoekt: p.zoekt,
          leeftijdMin: p.leeftijdMin, leeftijdMax: p.leeftijdMax, maxKm: p.maxKm,
          actief: p.actief, afstandActief: !!p.vak,
          wensen: p.wensen || {}, zicht: p.zicht || {}, beschikbaar: p.beschikbaar || [],
          datewens: p.datewens || H.zetDatewens(null, {}) } : {}) }
    );
  };

  return { publiek, niveauVan };
};
