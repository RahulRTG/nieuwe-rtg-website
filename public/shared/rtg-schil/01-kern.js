/* RTG Spatial Shell: de laag die van de desktop een werkruimte maakt.
   De regels staan in WERKRUIMTE.md; dit is stap 2 en 3 daarvan.

   Wat deze laag doet, doet GEEN enkele app zelf: openen, verplaatsen, docken,
   de drie zoomstanden, welke surface actief is, en de contextbus. Zolang dat
   per app zou worden opgelost, bouwt elke app zijn eigen desktop en zijn we
   terug bij twintig stijlen.

   Wat deze laag met opzet NIET doet: de inhoud van een app kennen. Een surface
   is een naam, een adres en een rechthoek. De shell weet niet wat een boeking
   is, en dat hoort zo -- anders kruipt domeinkennis in de vensterlaag.

   window.RTGSchil = { start, open, sluit, context, opContext, surfaces } */
(function (w, d) {
  'use strict';

  var RANDEN = { links: 'links', rechts: 'rechts', boven: 'boven', onder: 'onder' };
  var MARGE = 64;   // hoe dicht bij de rand voordat er gedockt wordt

  var schil = {
    vak: null, console: null, tabs: null, dok: null, onderbalk: null,
    apps: [], dockApps: [],
    surfaces: [],       // { id, naam, el, zoom }
    actief: null,
    huidigeContext: null,
    luisteraars: []
  };

  function el(tag, klasse, ouder) {
    var e = d.createElement(tag);
    if (klasse) e.className = klasse;
    if (ouder) ouder.appendChild(e);
    return e;
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  /* Een Magnaat-scherm mag bij het openen van een tweede oppervlak nooit
     ongemerkt terugvallen naar de echte omgeving. Alleen lokale app-URL's
     erven de testmarkering; externe adressen worden bewust niet herschreven. */
  function oppervlakUrl(url) {
    if (!url || new URLSearchParams(location.search).get('magnaat') !== '1') return url;
    try {
      var doel = new URL(url, location.href);
      if (doel.origin !== location.origin || doel.pathname.indexOf('/apps/') !== 0) return url;
      doel.searchParams.set('magnaat', '1');
      return doel.pathname + doel.search + doel.hash;
    } catch (e) { return url; }
  }
