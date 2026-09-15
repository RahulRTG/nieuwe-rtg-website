(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeLoader) return;
  function add(kind, path, global, done) {
    if (global && w[global]) { done(true); return; }
    var node = d.createElement(kind);
    if (kind === 'link') { node.rel = 'stylesheet'; node.href = path; }
    else { node.src = path; node.async = true; }
    node.addEventListener('load', function () { done(!global || !!w[global]); }, { once: true });
    node.addEventListener('error', function () { done(false); }, { once: true });
    (d.head || d.documentElement).appendChild(node);
  }
  function start(doc, win) {
    if (doc !== d || win !== w) return false;
    add('link', '/shared/rtg-adaptive-edge.css', '', function (vorm) {
      if (!vorm) return;
      add('script', '/shared/rtg-adaptive-edge-core.js', 'RTGAdaptiveEdgeCore', function (kern) {
        if (!kern) return;
        add('script', '/shared/rtg-adaptive-edge-input.js', 'RTGAdaptiveEdgeInput', function (invoer) {
          if (!invoer) return;
          add('script', '/shared/adaptief/balkknop.js', 'RTGAdaptiefBalkKnoppen', function (knoppen) {
          if (!knoppen) return;
          add('script', '/shared/rtg-adaptive-edge-controls.js', 'RTGAdaptiveEdgeControls', function (bediening) {
          if (!bediening) return;
          add('script', '/shared/rtg-adaptive-edge.js', 'RTGAdaptiveEdge', function (klaar) {
            if (!klaar) return;
            w.RTGAdaptiveEdge.start(d, w);
            add('script', '/shared/rtg-adaptive-edge-signals.js', 'RTGAdaptiveEdgeSignals', function (brug) {
              if (brug) w.RTGAdaptiveEdgeSignals.start(d, w);
            });
          });
          });
          });
        });
      });
    });
    return true;
  }
  w.RTGAdaptiveEdgeLoader = Object.freeze({ start: start });
}(window, document));
