/* RTMAIL (deelmodule): is dit linkerdeel nog van niemand?

   EEN TEAM MAG NOOIT EEN BESTAAND POSTVAK KAPEN. Het postvak hangt aan het
   linkerdeel en niet aan het domein (zie kern/rtmail-adres.js, belofte 2), dus
   een team dat "gouden-panter" of "sakura" gaat heten zou de post van een lid
   of een zaak meelezen. Dat is de enige echt gevaarlijke fout die een gedeeld
   adres kan maken, dus staat de toets hier apart -- op één plek, zodat wie er
   later een adressoort bij bouwt hem niet over het hoofd ziet.

   Drie sloten, alle drie exact en zonder netwerk:

   1. DE VORM VAN EEN CODENAAM. Die is altijd een woord uit een vaste lijst plus
      vier hex-tekens ("Gouden Panter 2679" -> "gouden-panter-2679"). Omdat de
      lijst bekend is, is de toets precies: "kantoor-2026" blijft gewoon
      toegestaan, alleen de codenaam-vorm zelf is dicht. We toetsen op de
      vergelijkingssleutel (zonder streepjes en punten), want dat is ook waar
      rtmail-adres.js twee bussen op gelijk legt.
   2. DE ZAAKCODES, rechtstreeks in het register gevraagd.
   3. WAAR AL POST LIGT, WOONT AL IEMAND. Het vangnet voor alles wat de eerste
      twee niet kennen. */
const adresLaag = require('./rtmail-adres');

module.exports = ({ rtmail, findSupplier, CODENAMES }) => {
  const woorden = (Array.isArray(CODENAMES) ? CODENAMES : [])
    .map(w => adresLaag.lokaalVan(w).replace(/-/g, '')).filter(Boolean);
  const codenaamRe = woorden.length ? new RegExp('^(?:' + woorden.join('|') + ')[0-9a-f]{4}$') : null;
  const sleutel = (lokaal) => String(lokaal || '').replace(/[.-]/g, '');

  // Lijkt dit linkerdeel op een gegenereerde codenaam?
  const codenaamVorm = (lokaal) => !!codenaamRe && codenaamRe.test(sleutel(lokaal));

  /* Geeft null als het adres vrij is, anders de reden in gewone taal -- die
     gaat rechtstreeks naar het scherm, dus geen jargon. */
  function bezet(lokaal, adres) {
    if (codenaamVorm(lokaal)) return 'Dit lijkt op een codenaam; die horen bij een persoon.';
    if (findSupplier && findSupplier(lokaal)) return 'Dit is de code van een zaak.';
    if (rtmail && rtmail.postvak(adres, { limit: 1 }).length) return 'Op dit adres ligt al post van iemand anders.';
    return null;
  }

  return { bezet, codenaamVorm };
};
