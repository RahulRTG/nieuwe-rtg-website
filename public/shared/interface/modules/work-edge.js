/* WorkOS verklaart alleen acties die de bestaande WorkOS-deuren uitvoeren.
   De Adaptieve Edge bezit geen werkruimtesessie en geen bedrijfsrecht. */
(function (w) {
  'use strict';
  w.RTGWorkEdge = function (options) {
    var declared = false;
    function run(id) { options.run(id, {}).catch(function () {}); }
    function declare() {
      var edge = w.RTGAdaptief; if (!edge || declared) return;
      [['work.open', 'Open WorkOS'], ['work.refresh', 'Ververs WorkOS']].forEach(function (row) {
        edge.declareer({ id: row[0], naam: row[1], label: row[1], groep: 'WorkOS',
          primair: row[0] === 'work.open', telefoon: ['balk', 'lade'], tablet: ['balk', 'lade'],
          bureau: ['werkbalk'], gewicht: 'licht', effect: 'lokaal', herstel: 'exact',
          doe: function () { run(row[0]); } });
      }); declared = true;
    }
    function clear() { if (w.RTGAdaptief) w.RTGAdaptief.wisContext('workspace.work'); }
    function sync(active, surface, model) {
      var edge = w.RTGAdaptief;
      if (!edge || !active || surface === 'peek' || !model || model.phase !== 'ready') { clear(); return; }
      declare(); edge.context({ bron: 'workspace.work', titel: 'WorkOS · ' + (model.name || 'Werkruimte'),
        acties: ['work.open', 'work.refresh'], selectie: false,
        object: { soort: 'workos-workspace', id: model.code || '', label: model.name || 'Werkruimte' },
        activiteit: 'work.overview' });
    }
    return { sync: sync, clear: clear };
  };
})(window);
