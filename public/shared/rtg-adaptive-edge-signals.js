(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeSignals) return;
  var actief = false;
  function primary() {
    var api = w.RTGAdaptiveEdge, knop = d.querySelector('[data-rtg-edge-primary]:not([hidden])');
    if (!api || !knop) return;
    var label = (knop.getAttribute('aria-label') || knop.textContent || 'Volgende stap').replace(/\s+/g, ' ').trim();
    api.registerAction({ id: 'primary', label: label.slice(0, 80), allowed: !knop.disabled });
    var staat = knop.getAttribute('data-rtg-action-state');
    if (staat === 'pending') api.setPresence({ label: label + ' wordt uitgevoerd', action: 'primary' });
    else if (staat === 'success') api.setPresence({ label: label + ' is gereed', action: 'primary' });
  }
  function start(doc, win) {
    if (actief || doc !== d || win !== w || !w.RTGAdaptiveEdge) return false;
    actief = true;
    primary();
    return true;
  }
  w.RTGAdaptiveEdgeSignals = Object.freeze({ start: start });
}(window, document));
