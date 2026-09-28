/* Only desktop world homes load this presentation; embedded apps never nest it. */
(function (w, d) {
  'use strict';
  var started = false, mq = w.matchMedia('(min-width:1000px)');
  function start() {
    if (started || !mq.matches || w.self !== w.top || !d.body.dataset.worldHome) return;
    started = true;
    var names = ['module-sdk', 'workspace-world-catalog', 'workspace-registries', 'workspace-session',
      'workspace-policy', 'workspace-context', 'workspace-navigation', 'workspace-state', 'workspace-orchestrator',
      'workspace-blueprints', 'workspace-broker', 'workspace-module-host', 'workspace-runtime',
      'world-desktop-copy', 'world-desktop-people', 'world-desktop-frame', 'world-widget-copy', 'world-widget-data',
      'world-widget-surfaces', 'world-widget-live', 'world-desktop-cards', 'world-desktop-home'];
    Promise.all(['/shared/rtg-edge-icons.js'].concat(names.map(function (name) { return '/shared/interface/' + name + '.js'; })).map(function (url) {
      return new Promise(function (resolve, reject) {
        var s = d.createElement('script'); s.src = url; s.async = false;
        s.onload = resolve; s.onerror = reject; d.head.appendChild(s);
      });
    })).then(function () { w.RTGDesktopHome.start(); }).catch(function () {
      // Progressive enhancement: the original, functioning home stays visible.
      started = false;
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
  mq.addEventListener('change', start);
})(window, document);
