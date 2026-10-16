/* Universele Regie gebruikt de bestaande Adaptieve Edge. De module verklaart
   alleen toegestane acties; de Edge krijgt geen eigen zaak- of bevoegdheidsstaat. */
(function (w) {
  'use strict';
  w.RTGCoordinationEdge = function (options) {
    var declared = false;
    function run(id) { options.run(id, options.payload()).catch(function () {}); }
    function declare() {
      var edge = w.RTGAdaptief; if (!edge || declared) return;
      function capability(id, name, weight, effect) {
        edge.declareer({ id: id, naam: name, label: name, groep: 'RTG Regie',
          primair: id === 'coordination.open-source', telefoon: ['balk', 'lade'],
          tablet: ['balk', 'lade'], bureau: ['werkbalk'], gewicht: weight || 'licht',
          effect: effect || 'lokaal', herstel: 'exact', doe: function () { run(id); } });
      }
      capability('coordination.open-source', 'Open zaak');
      capability('coordination.ask-human', 'Vraag een mens', 'bewust', 'server');
      capability('coordination.refresh', 'Ververs zaken'); declared = true;
    }
    function clear() { if (w.RTGAdaptief) w.RTGAdaptief.wisContext('workspace.coordination'); }
    function sync(active, surface) {
      var edge = w.RTGAdaptief, item = options.selected();
      if (!edge || !active || surface === 'peek' || !item) { clear(); return; }
      declare();
      var actions = ['coordination.open-source', 'coordination.refresh'];
      if (item.kind === 'service' && item.phase && !item.phase.terminal) actions.splice(1, 0, 'coordination.ask-human');
      edge.context({ bron: 'workspace.coordination', titel: 'RTG Regie · ' + (item.title || 'Zaak'),
        acties: actions, selectie: false,
        object: { soort: item.kind || 'case', id: item.source && item.source.id || '', label: item.title || 'Zaak' },
        activiteit: item.phase && item.phase.id || 'case' });
    }
    return { sync: sync, clear: clear };
  };
})(window);
