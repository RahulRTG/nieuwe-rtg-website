/* Every screen uses the desktop standard. Embedded apps share the outer frame. */
(function (w, d) {
  'use strict';
  var started = false;
  function start() {
    if (started || w.self !== w.top || new URLSearchParams(w.location.search).get('embed') === '1' || d.body.dataset.publicPlatform) return;
    if (!d.body.dataset.rtgWorld || d.body.dataset.rtgWorld === 'redirect') return;
    started = true;
    var projection = d.body.hasAttribute('data-rtg-projectie');
    var names = ['module-sdk', 'workspace-world-catalog', 'workspace-registries', 'workspace-session',
      'workspace-policy', 'workspace-context', 'workspace-navigation', 'workspace-state', 'workspace-orchestrator',
      'workspace-blueprints', 'workspace-broker', 'workspace-module-host', 'workspace-runtime',
      'world-desktop-copy', 'world-desktop-people', 'world-desktop-frame', 'world-widget-copy', 'world-widget-data',
      'world-widget-surfaces', 'world-widget-live', 'world-desktop-cards', 'world-desktop-surface', 'world-presentation',
      'personal-images', 'personal-image-editor', 'world-desktop-home'];
    if (projection) names = ['world-desktop-copy','world-desktop-surface','world-presentation','world-desktop-projection'];
    var shared = projection ? ['rtg-edge-icons','rtg-adaptive-edge-core','rtg-adaptive-edge-input','rtg-adaptive-edge-surface','rtg-adaptive-edge-controls','rtg-adaptive-edge'] : ['rtg-heritage-registry','rtg-edge-icons','bestand-upload'];
    if (projection) ['rtg-edge-system','rtg-adaptive-edge'].forEach(function(name){var l=d.createElement('link');l.rel='stylesheet';l.href='/shared/'+name+'.css';d.head.appendChild(l);});
    Promise.all(shared.map(function(name){return '/shared/'+name+'.js';}).concat(names.map(function (name) { return '/shared/interface/' + name + '.js'; })).map(function (url) {
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
