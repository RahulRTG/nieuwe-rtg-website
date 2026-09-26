/* Context Engine: een LEZER van het Edge Blikveld (shared/edge/blikveld.js),
   zonder eigen staat. Hier stond een eigen `current` met een eigen ontdubbeling,
   gevoed uit RTGAdaptief.context(): een derde contextmodel dat bij elke vraag
   kon achterlopen op het tweede. Nu vraagt get() het blikveld OP HET MOMENT VAN
   VRAGEN en geeft vier velden door zoals ze daar staan -- herkomst, gezag en
   sinds ongewijzigd, want de werkruimte weet niet beter waar iets vandaan komt
   dan het blikveld (EDGE.md par. 2). Er is geen setter en geen luisteraar: wie
   wil weten wat er nu speelt, vraagt het nu.

   Geen blikveld, een blikveld dat gooit, of een afdruk die clean() weigert:
   dan `velden: null` MET de reden, en nooit een oude kopie -- een context die
   stil blijft staan zegt iets wat niet meer waar is. */
(function (w) {
  'use strict';
  var VELDEN = ['wereld', 'context', 'object', 'activiteit'];
  function clean(value) {
    var text = JSON.stringify(value == null ? {} : value);
    if (text.length > 16384) throw new Error('Workspace-context is groter dan 16 KB.');
    if (/"(?:token|authorization|password|secret|wachtwoord|sessie)"\s*:/i.test(text))
      throw new Error('Workspace-context mag geen geheimen bevatten.');
    return JSON.parse(text);
  }
  w.RTGWorkspaceContext = function () {
    function get() {
      var B = w.RTGEdgeBlikveld;
      if (!B || typeof B.lees !== 'function') return { velden: null, reden: 'het Edge Blikveld (edge/blikveld.js) is niet geladen' };
      try {
        var b = B.lees(), velden = {};
        VELDEN.forEach(function (k) { velden[k] = b.velden[k]; });
        return clean({ op: b.op, velden: velden });
      } catch (e) { return { velden: null, reden: 'het blikveld gaf geen bruikbare context: ' + (e && e.message || e) }; }
    }
    return { get: get };
  };
})(window);
