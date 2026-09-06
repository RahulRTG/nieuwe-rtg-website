(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    g.RTGVandaagLuxe = api;
    api.start(g.document);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* De wereldhome IS het dashboard. Deze laag maakt geen kop, navigatie,
     kaartkopie of bediening aan: ze commit uitsluitend de bestaande, reeds
     gebonden home-DOM aan één gedeelde materiaal- en rastertaal. */
  var CONTRACT = Object.freeze({
    versie: 3,
    activatie: 'data-rtg-vandaag-luxe',
    wereld: 'data-rtg-world',
    dashboard: 'data-rtg-world-dashboard',
    gereed: 'data-rtg-world-dashboard-ready',
    render: 'data-rtg-vandaag-render',
    beelden: Object.freeze({
      living: '/images/worlds/heritage/living-heritage-v2.jpg',
      travel: '/images/worlds/heritage/travel-heritage-v2.jpg',
      work: '/images/worlds/heritage/work-heritage-v2.jpg',
      foundation: '/images/worlds/heritage/foundation-heritage-v2.jpg'
    }),
    netwerk: false,
    opslag: false
  });
  var WERELDEN = Object.freeze({
    living: Object.freeze({ pad: '/apps/rtg.html', hoofd: '#inhoud' }),
    work: Object.freeze({ pad: '/apps/kantoor.html', hoofd: '#inhoud' }),
    travel: Object.freeze({ pad: '/apps/reizen.html', hoofd: '#inhoud' }),
    foundation: Object.freeze({ pad: '/apps/foundation/os-publiek.html', hoofd: '#main' })
  });
  var KLAS = 'rtg-world-dashboard';

  function wereldVan(waarde) {
    var wereld = String(waarde || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(WERELDEN, wereld) ? wereld : null;
  }

  function heeftKlas(element, naam) {
    return !!(element && element.classList && element.classList.contains(naam));
  }

  function isIngebed(document) {
    if (!document) return false;
    var html = document.documentElement;
    var body = document.body;
    var venster = document.defaultView;
    if (heeftKlas(html, 'rtg-command-blad') || heeftKlas(body, 'rtg-command-blad') ||
        heeftKlas(body, 'rtg-edge-embed') ||
        html && html.getAttribute && html.getAttribute('data-rtg-oppervlak') === '1') return true;
    if (!venster) return false;
    try { if (venster.self !== venster.top) return true; } catch (fout) { return true; }
    try { return new URLSearchParams(venster.location.search).get('embed') === '1'; }
    catch (fout) { return false; }
  }

  function routeKlopt(document, wereld) {
    var venster = document && document.defaultView;
    if (!venster || !venster.location) return true;
    var pad = String(venster.location.pathname || '').replace(/\/$/, '');
    return !pad || pad === WERELDEN[wereld].pad;
  }

  function geschikt(document) {
    if (!document || !document.body || isIngebed(document)) return null;
    var body = document.body;
    if (!body.hasAttribute(CONTRACT.activatie) ||
        String(body.getAttribute(CONTRACT.activatie) || '').toLowerCase() === 'surface') return null;
    var wereld = wereldVan(body.getAttribute(CONTRACT.wereld));
    if (!wereld || body.getAttribute(CONTRACT.dashboard) !== wereld || !routeKlopt(document, wereld)) return null;
    return wereld;
  }

  function deactiveer(document) {
    if (!document || !document.body) return null;
    var oud = document.querySelector && document.querySelector('.' + KLAS + '[data-rtg-dashboard-world]');
    if (oud && oud.classList) {
      oud.classList.remove(KLAS);
      oud.removeAttribute('data-rtg-dashboard-world');
    }
    document.body.removeAttribute(CONTRACT.gereed);
    document.body.removeAttribute(CONTRACT.render);
    return null;
  }

  function activeer(document) {
    var wereld = geschikt(document);
    if (!wereld) return deactiveer(document);
    var hoofd = document.querySelector(WERELDEN[wereld].hoofd);
    if (!hoofd) return deactiveer(document);
    hoofd.classList.add(KLAS);
    hoofd.setAttribute('data-rtg-dashboard-world', wereld);
    document.body.setAttribute(CONTRACT.render, 'dashboard');
    document.body.setAttribute(CONTRACT.gereed, 'true');
    return hoofd;
  }

  function start(document) {
    if (!document) return;
    function klaar() {
      activeer(document);
      var Mutatie = document.defaultView && document.defaultView.MutationObserver;
      if (!Mutatie || document.body.rtgDashboardWaarnemer) return;
      var waarnemer = new Mutatie(function () { activeer(document); });
      waarnemer.observe(document.body, {
        attributes: true,
        attributeFilter: [CONTRACT.activatie, CONTRACT.wereld, CONTRACT.dashboard, 'class']
      });
      if (document.documentElement) waarnemer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-rtg-oppervlak']
      });
      document.body.rtgDashboardWaarnemer = waarnemer;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', klaar, { once: true });
    else klaar();
  }

  return Object.freeze({
    CONTRACT: CONTRACT,
    WERELDEN: WERELDEN,
    normaliseerWereld: wereldVan,
    isIngebed: isIngebed,
    routeKlopt: routeKlopt,
    geschikt: geschikt,
    activeer: activeer,
    deactiveer: deactiveer,
    start: start
  });
}));
