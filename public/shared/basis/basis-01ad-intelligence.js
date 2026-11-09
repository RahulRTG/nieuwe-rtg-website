/* De centrale controllers laden één keer, ook als een route een adapter vóór
   basis nodig heeft. Ze behouden de bestaande nodes en bevoegdheden. De
   letterlijke callsites zijn tevens het controleerbare laadcontract. */
  function laadBasisController(pad, global) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (window[global] || document.querySelector('script[src="' + pad + '"]')) return;
    var basisControllerNode = document.createElement('script');
    basisControllerNode.src = pad; basisControllerNode.async = false;
    document.head.appendChild(basisControllerNode);
  }
  laadBasisController('/shared/rtg-route-memory-core.js', 'RTGRouteMemoryCore');
  laadBasisController('/shared/rtg-route-memory.js', 'RTGRouteMemory');
  laadBasisController('/shared/rtg-heritage-transition.js', 'RTGHeritageTransition');
  laadBasisController('/shared/rtg-action-dock.js', 'RTGActionDock');
  laadBasisController('/shared/rtg-edge-preferences.js', 'RTGEdgePreferences');
  laadBasisController('/shared/rtg-heritage-registry.js', 'RTGHeritageRegistry');
  laadBasisController('/shared/rtg-heritage-components.js', 'RTGHeritageComponents');
  laadBasisController('/shared/rtg-editorial-v4-model.js', 'RTGEditorialV4Model');
  laadBasisController('/shared/rtg-editorial-v4-header.js', 'RTGEditorialV4Header');
  laadBasisController('/shared/rtg-editorial-v4.js', 'RTGEditorialV4');
