/* RTFoundation (deelmodule): DE ACCOUNTPLICHT VAN HET GEZIN.

   Besluit van de eigenaar, 5 oktober 2026: een minderjarige komt alleen binnen
   via het account van een ouder. Deze regel hangt in gezinshulp.js profielVan(),
   de ene plek waar elk gezinstoken langskomt, en niet in de vijftig routes
   erachter.

   In productie opent een token alleen nog iets in een gezin met een EIGENAAR
   (een RTG-account, ./gezinseigenaar.js). Een beschermd profiel (kind, of 15
   jaar en jonger) opent alleen als RTG het paspoort van die eigenaar heeft
   gezien: volwassen() uit kern/volwassen.js, laat gebonden als
   ctx.volwassenSleutel. Is die binding er niet, dan is het antwoord nee. Een
   ontbrekende poort mag nooit als een open poort lezen.

   Buiten productie staat de plicht uit, want de toetsen en lokale fixtures
   kennen anonieme gezinnen. RTF_GEZIN_ACCOUNTPLICHT=1 zet hem aan, zodat hij
   tegen een echte server te beproeven is (test/gezinseigenaar.test.js).

   Dit vervangt de vrijgavepoort NIET: zonder extern dossier blijven de
   beschermde routes in productie 503 (middleware/foundation-productiepoort.js).

   Daarnaast weigerKind() voor de oude beheerdersroute /gezin/profiel/maak:
   onder de plicht voegt die geen kind toe, anders was hij de omweg om de
   paspoorttrede heen. */
'use strict';

function maak({ ctx, isBeschermd }) {
  function accountplicht() {
    return process.env.NODE_ENV === 'production' || process.env.RTF_GEZIN_ACCOUNTPLICHT === '1';
  }
  function volwassenAccount(userId) {
    if (userId == null || typeof ctx.volwassenSleutel !== 'function') return false;
    try { return ctx.volwassenSleutel('user-' + userId) === true; } catch (e) { return false; }
  }
  function magDoor(g, p) {
    if (!accountplicht()) return true;
    if (!g || !g.eigenaar || g.eigenaar.userId == null) return false;
    return isBeschermd(p) ? volwassenAccount(g.eigenaar.userId) : true;
  }
  /* Voor gezin.js /gezin/profiel/maak, NA het bepalen van de rol (die van
     elke onbekende rol een kind maakt): weigert onder de plicht met 409. */
  function weigerKind(res, rol) {
    if (!accountplicht() || rol !== 'kind') return false;
    res.status(409).json({ error: 'Voeg je kind toe via Mijn gezin in je RTG-account.' });
    return true;
  }
  return { accountplicht, volwassenAccount, magDoor, weigerKind };
}

module.exports = { maak };
