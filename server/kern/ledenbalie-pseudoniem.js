/* DE BALIE WERKT OP PSEUDONIEMEN -- en dit bestand maakt ze.

   Los van ./ledenbalie.js om dezelfde reden als ./ledenbalie-zetels.js (daar
   woont de TOEGANG) en ./ledenbalie-zaken.js (daar woont de ADMINISTRATIE):
   hier woont de VERTALING van een sleutel naar iets dat een mens aan de balie
   kan noemen zonder zijn naam te zeggen. Ze delen geen state, en de knip loopt
   langs een echte naad.

   DE STEUNCODE: waarmee een lid zich aan de balie meldt zonder zijn naam te
   noemen. Afgeleid uit de key plus een zout dat per installatie eenmalig wordt
   aangemaakt -- niet per lid opgeslagen, want dan was er een tweede lijst om te
   bewaren en te wissen. Het zout is er omdat een code die rechtstreeks uit het
   account-id volgt door iedereen na te rekenen is.

   Let op wat dit NIET is: een bewijs. De steuncode vindt iemand, hij bevestigt
   niemand. Alles wat erna komt (herstel, voorstel) loopt langs het lid zelf of
   langs een mens. */
'use strict';

module.exports = ({ db, save, crypto, onboarding }) => {
  function zout() {
    if (!db.data.balieSteunZout) { db.data.balieSteunZout = crypto.randomBytes(16).toString('hex'); save(); }
    return db.data.balieSteunZout;
  }
  function steuncodeVan(key) {
    return 'RTG-' + crypto.createHash('sha256').update(zout() + '|' + String(key))
      .digest('hex').slice(0, 6).toUpperCase();
  }

  // de stad komt uit het onboardingprofiel, net als in kern/ledenregister.js
  function stadVan(key) {
    const p = ((onboarding && onboarding.store && onboarding.store().profielen) || {})[key];
    const w = p && p.velden && p.velden.woonplaats;
    return w ? String(w).trim() : null;
  }

  return { steuncodeVan, stadVan };
};
