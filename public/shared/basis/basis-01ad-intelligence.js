/* De centrale controllers laden één keer, ook als een route een adapter vóór
   basis nodig heeft. Ze behouden de bestaande nodes en bevoegdheden. */
  [['rtg-route-memory-core', 'RTGRouteMemoryCore'], ['rtg-route-memory', 'RTGRouteMemory'], ['rtg-heritage-transition', 'RTGHeritageTransition'], ['rtg-action-dock', 'RTGActionDock'], ['rtg-edge-preferences', 'RTGEdgePreferences'],
    ['rtg-heritage-registry', 'RTGHeritageRegistry'],
    ['rtg-heritage-components', 'RTGHeritageComponents']].forEach(function (bron) {
    if (window[bron[1]] || document.querySelector('script[src="/shared/' + bron[0] + '.js"]')) return;
    var script = document.createElement('script');
    script.src = '/shared/' + bron[0] + '.js'; script.async = false;
    (document.head || document.documentElement).appendChild(script);
  });
