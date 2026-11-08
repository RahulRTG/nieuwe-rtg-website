/* Every screen uses the desktop standard. Embedded apps share the outer frame. */
(function (w, d) {
  'use strict';
  var started = false;
  function laadScript(path) {
    return new Promise(function (resolve, reject) {
      var worldDesktopScriptNode = document.createElement('script');
      worldDesktopScriptNode.src = path; worldDesktopScriptNode.async = false;
      worldDesktopScriptNode.onload = resolve; worldDesktopScriptNode.onerror = reject;
      document.head.appendChild(worldDesktopScriptNode);
    });
  }
  function start() {
    /* Een data-ds-scherm bezit al zijn centrale presentatie en Edge. De oude
       World Desktop-projectie mag daar geen wd-shell omheen bouwen. Dit sluit
       Workspace Runtime niet uit: DS-modules mogen die expliciet gebruiken,
       maar de globale legacyprojectie is geen geldige Spatial-integratie. */
    if (started || w.self !== w.top || new URLSearchParams(w.location.search).get('embed') === '1' ||
      d.body.dataset.publicPlatform || d.documentElement.hasAttribute('data-ds')) return;
    if (!d.body.dataset.rtgWorld || d.body.dataset.rtgWorld === 'redirect') return;
    started = true;
    var projection = d.body.hasAttribute('data-rtg-projectie');
    /* De projectie is het enige bestaande legacy-scherm dat de Adaptive Edge
       presenteert. Dat document bezit zijn stijlbladen statisch; deze runtime
       laadt uitsluitend gedrag en kan daardoor geen tweede stijllaag maken. */
    var taken = projection ? [
      laadScript('/shared/rtg-edge-icons.js'),
      laadScript('/shared/rtg-adaptive-edge-core.js'),
      laadScript('/shared/rtg-adaptive-edge-input.js'),
      laadScript('/shared/rtg-adaptive-edge-surface.js'),
      laadScript('/shared/rtg-adaptive-edge-controls.js'),
      laadScript('/shared/rtg-adaptive-edge.js'),
      laadScript('/shared/interface/world-desktop-copy.js'),
      laadScript('/shared/interface/world-desktop-surface.js'),
      laadScript('/shared/interface/world-presentation.js'),
      laadScript('/shared/interface/world-desktop-projection.js')
    ] : [
      laadScript('/shared/rtg-heritage-registry.js'),
      laadScript('/shared/rtg-edge-icons.js'),
      laadScript('/shared/bestand-upload.js'),
      laadScript('/shared/experience-intent.js'),
      laadScript('/shared/interface/module-sdk.js'),
      laadScript('/shared/interface/workspace-world-catalog.js'),
      laadScript('/shared/interface/workspace-registries.js'),
      laadScript('/shared/interface/workspace-session.js'),
      laadScript('/shared/interface/workspace-intents.js'),
      laadScript('/shared/interface/workspace-policy.js'),
      laadScript('/shared/interface/workspace-assistant-manifest.js'),
      laadScript('/shared/interface/workspace-context.js'),
      laadScript('/shared/interface/workspace-navigation.js'),
      laadScript('/shared/interface/workspace-state.js'),
      laadScript('/shared/interface/workspace-orchestrator.js'),
      laadScript('/shared/interface/workspace-blueprints.js'),
      laadScript('/shared/interface/workspace-broker.js'),
      laadScript('/shared/interface/workspace-module-host.js'),
      laadScript('/shared/interface/workspace-runtime.js'),
      laadScript('/shared/interface/world-desktop-copy.js'),
      laadScript('/shared/interface/world-desktop-people.js'),
      laadScript('/shared/interface/world-desktop-frame.js'),
      laadScript('/shared/interface/world-widget-copy.js'),
      laadScript('/shared/interface/world-widget-data.js'),
      laadScript('/shared/interface/world-widget-surfaces.js'),
      laadScript('/shared/interface/world-widget-live.js'),
      laadScript('/shared/interface/world-desktop-cards.js'),
      laadScript('/shared/interface/world-desktop-surface.js'),
      laadScript('/shared/interface/world-presentation.js'),
      laadScript('/shared/interface/personal-images.js'),
      laadScript('/shared/interface/personal-image-editor.js'),
      laadScript('/shared/interface/world-desktop-home.js')
    ];
    Promise.all(taken).then(function () { if (projection) w.RTGDesktopProjection.start(); else w.RTGDesktopHome.start(); }).catch(function (error) {
      d.body.dataset.rtgDesktopState = 'error';
      console.error('RTG desktop could not start', error);
      started = false;
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
