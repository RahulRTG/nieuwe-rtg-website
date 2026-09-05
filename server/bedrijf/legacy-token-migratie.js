/* Eenmalige fail-closed overgang van de oude WerkOS-bearers.

   Er wordt geen vervangend geheim gemaakt: productieautoriteit ligt na deze
   migratie uitsluitend bij een accountgebonden actief lidmaatschap. Een oud
   lid zonder rtgKey blijft dus bewust buiten tot een beheerder hem via het
   accountgebonden toetredingspad opnieuw koppelt. */
'use strict';

module.exports = function maakLegacyTokenMigratie({ bewerkCollectie, productie } = {}) {
  const isProductie = productie == null
    ? String(process.env.NODE_ENV || '') === 'production' : productie === true;

  function migreerAlles() {
    if (!isProductie) return { ok: true, overgeslagen: true, werkruimtes: 0, leden: 0 };
    if (typeof bewerkCollectie !== 'function')
      throw new Error('De WerkOS-tokenmigratie mist de autoritatieve collectietransactie.');
    return bewerkCollectie('werkruimtes', werkruimtes => {
      let ruimtes = 0, leden = 0;
      for (const w of Object.values(werkruimtes || {})) {
        if (!w || typeof w !== 'object') continue;
        if (w.beheerToken !== null) { w.beheerToken = null; ruimtes++; }
        for (const l of Object.values(w.leden || {})) {
          if (!l || typeof l !== 'object') continue;
          if (l.token !== null) { l.token = null; leden++; }
        }
      }
      return { ok: true, overgeslagen: false, werkruimtes: ruimtes, leden };
    });
  }

  return { migreerAlles, productie: isProductie };
};
