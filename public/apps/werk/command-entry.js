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

  function volgRoute() {
    route = routeUitHash();
    /* De compacte wereldkop hoort bij het zelfstandige projectenscherm. In
       een iframe beslist de gedeelde luxe-laag zelf dat de bovenliggende
       Edge-schil eigenaar van de chrome blijft. */
    if (route === 'projecten' &&
        document.body.getAttribute('data-rtg-vandaag-surface') === 'projecten') {
      document.body.setAttribute('data-rtg-vandaag-surface-title', 'Projecten en taken');
      document.body.setAttribute('data-rtg-vandaag-luxe', 'surface');
      document.body.setAttribute('data-rtg-edge-2-state', 'compact');
      document.body.setAttribute('data-rtg-edge-2-auto', 'false');
    } else if (document.body.getAttribute('data-rtg-vandaag-surface') === 'projecten') {
      document.body.removeAttribute('data-rtg-vandaag-surface-title');
      document.body.removeAttribute('data-rtg-vandaag-luxe');
      document.body.setAttribute('data-rtg-edge-2-state', 'overview');
      document.body.setAttribute('data-rtg-edge-2-auto', 'true');
    }
    openAlsBinnen();
  }

  if (inhoud && window.MutationObserver) {
    var waarnemer = new MutationObserver(function () {
      if (!inhoud.hidden) openAlsBinnen();
    });
    waarnemer.observe(inhoud, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('hashchange', volgRoute);
  volgRoute();
}());
