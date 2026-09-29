/* Every screen uses the desktop standard. Embedded apps share the outer frame. */
(function (w, d) {
  'use strict';
  var started = false;
  function start() {
    if (started || w.self !== w.top || d.body.dataset.publicPlatform) return;
    /* Een ingebed werkvlak nest het kader nooit, ook niet zonder iframe: ?embed=1
       en een Command-blad tellen als ingebed, net als voor de Edge
       (RTGEdge2Context.isEmbedded) en shared/rtg-world-start.js. */
    if (/(?:^|[?&])embed=1(?:&|$)/.test(w.location.search || '') || d.documentElement.classList.contains('rtg-command-blad') ||
      d.documentElement.getAttribute('data-rtg-oppervlak') === '1') return;
    if (!d.body.dataset.rtgWorld || d.body.dataset.rtgWorld === 'redirect') return;
    started = true;
    // De vaste bovenrand heeft in de warme compositie geen eigen grond, zodat het
    // sfeerbeeld eronder doorloopt. Zodra er inhoud onder hem schuift, zou die tekst
    // door de kop heen te lezen zijn; dan krijgt hij de grond van de wereld (CSS).
    var kop = function () {
      var onder = String((w.scrollY || d.documentElement.scrollTop || 0) > 0);
      if (d.body.dataset.rtgScrolled !== onder) d.body.dataset.rtgScrolled = onder;
    };
    w.addEventListener('scroll', kop, { passive: true }); kop();
    var projection = d.body.hasAttribute('data-rtg-projectie');
    var names = ['module-sdk', 'workspace-world-catalog', 'workspace-registries', 'workspace-session',
      'workspace-policy', 'workspace-context', 'workspace-navigation', 'workspace-state', 'workspace-orchestrator',
      'workspace-blueprints', 'workspace-broker', 'workspace-module-host', 'workspace-runtime',
      'world-desktop-copy', 'world-desktop-people', 'world-desktop-frame', 'world-widget-copy', 'world-widget-data',
      'world-widget-surfaces', 'world-widget-live', 'world-desktop-cards', 'world-desktop-surface', 'world-presentation',
      'personal-images', 'personal-image-editor', 'world-desktop-home'];
    if (projection) names = ['world-desktop-copy','world-desktop-surface','world-presentation','world-desktop-projection'];
    var shared = projection ? ['rtg-edge-icons','rtg-adaptive-edge-core','rtg-adaptive-edge-input','rtg-adaptive-edge-controls','rtg-adaptive-edge'] : ['rtg-edge-icons','bestand-upload'];
    // The surface decides canvas vs. page from the registry; basis.js may add it later than this frame.
    if (!w.RTGHeritageRegistry && !d.querySelector('script[src="/shared/rtg-heritage-registry.js"]')) shared.unshift('rtg-heritage-registry');
    if (projection) ['rtg-edge-system','rtg-adaptive-edge'].forEach(function(name){var l=d.createElement('link');l.rel='stylesheet';l.href='/shared/'+name+'.css';d.head.appendChild(l);});
    /* Een scherm dat een laag al zelf laadt (apps/app.html laadt de hele
       werkruimte, met ?v= of in een /scriptbundel.js), krijgt hem niet een tweede
       keer: een tweede workspace-registries.js zette een LEGE registry neer, en
       de Second Screen van RTG Command vond daarna geen enkele module meer. */
    var loaded = {};
    Array.prototype.forEach.call(d.scripts, function (s) {
      var src = s.getAttribute('src'); if (!src) return;
      try {
        var u = new URL(src, d.baseURI); loaded[u.pathname] = true;
        if (u.pathname === '/scriptbundel.js' && u.searchParams.get('f')) {
          w.atob(u.searchParams.get('f')).split('\n').forEach(function (p) { if (p) loaded[p] = true; });
        }
      } catch (e) {}
    });
    Promise.all(shared.map(function(name){return '/shared/'+name+'.js';}).concat(names.map(function (name) { return '/shared/interface/' + name + '.js'; })).filter(function (url) { return !loaded[url]; }).map(function (url) {
      return new Promise(function (resolve, reject) {
        var s = d.createElement('script'); s.src = url; s.async = false;
        s.onload = resolve; s.onerror = reject; d.head.appendChild(s);
      });
    })).then(function () { if (projection) w.RTGDesktopProjection.start(); else w.RTGDesktopHome.start(); }).catch(function (error) {
      d.body.dataset.rtgDesktopState = 'error';
      console.error('RTG desktop could not start', error);
      started = false;
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
