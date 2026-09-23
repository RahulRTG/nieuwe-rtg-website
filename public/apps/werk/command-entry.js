(function () {
  'use strict';

  /* Alleen bestaande, benoemde panelen zijn rechtstreeks adresseerbaar. Een
     willekeurige hash mag nooit een selector, module of handeling worden. */
  var routes = Object.freeze({ people: 'people', projecten: 'projecten' });
  var inhoud = document.getElementById('inhoud');
  var route = null;

  function routeUitHash() {
    var hash = '';
    try { hash = decodeURIComponent(String(location.hash || '').slice(1)).trim().toLowerCase(); }
    catch (e) { return null; }
    return Object.prototype.hasOwnProperty.call(routes, hash) ? routes[hash] : null;
  }

  function openAlsBinnen() {
    if (!route || (inhoud && inhoud.hidden)) return;
    var knop = document.querySelector('[data-wk="' + route + '"]');
    if (knop) knop.click();
  }

  /* DE STAND IS VAN DE MENS ZODRA HIJ KOOS (EDGE.md, ronde 2). Bij het LADEN
     schrijft deze route de verklaring op body, gelijk aan de HTML: Edge 2 draait
     dan nog niet, leest haar bij zijn start, en een bewaarde keuze wint daar al.
     Bij een HASHWISSEL draait Edge 2 wel, en daar schreven dezelfde attributen
     een nieuwe start: de keuze Compact werd stil weer 'auto'. Een wissel gaat
     daarom langs de poort van de eigenaar, als automatiek -- die wijkt voor een
     keuze van de mens, en wie niets koos krijgt het overzicht zoals voorheen.
     Zonder Edge 2 blijft het de verklaring; er komt geen tweede stand bij. */
  function zetStand(wissel) {
    var edge2 = window.RTGEdge2;
    if (wissel && edge2 && typeof edge2.setState === 'function') {
      edge2.setState('overview', { source: 'auto' });
      return;
    }
    document.body.setAttribute('data-rtg-edge-2-state', 'overview');
    document.body.setAttribute('data-rtg-edge-2-auto', 'true');
  }

  function volgRoute(wissel) {
    route = routeUitHash();
    var projecten = document.body.getAttribute('data-rtg-vandaag-surface') === 'projecten';
    /* De compacte wereldkop hoort bij het zelfstandige projectenscherm. In
       een iframe beslist de gedeelde luxe-laag zelf dat de bovenliggende
       Edge-schil eigenaar van de chrome blijft. */
    if (route === 'projecten' && projecten) {
      document.body.setAttribute('data-rtg-vandaag-surface-title', 'Projecten en taken');
      document.body.setAttribute('data-rtg-vandaag-luxe', 'surface');
    } else if (projecten) {
      document.body.removeAttribute('data-rtg-vandaag-surface-title');
      document.body.removeAttribute('data-rtg-vandaag-luxe');
    }
    if (projecten) zetStand(wissel === true);
    openAlsBinnen();
  }

  if (inhoud && window.MutationObserver) {
    var waarnemer = new MutationObserver(function () {
      if (!inhoud.hidden) openAlsBinnen();
    });
    waarnemer.observe(inhoud, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('hashchange', function () { volgRoute(true); });
  volgRoute(false);
}());
