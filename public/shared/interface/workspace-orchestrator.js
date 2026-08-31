/* RTG WORKSPACE ORCHESTRATOR.

   Modules nemen nooit zelf de interface over. Deze laag vertaalt events en
   systeembeleid naar een layoutbesluit met prioriteit en reden. */
(function (w) {
  'use strict';
  var MODES = ['inherit', 'hidden', 'peek', 'panel', 'workspace', 'focus', 'suspended'];
  w.RTGWorkspaceOrchestrator = function (opties) {
    var o = opties || {}, layout = Object.create(null), regels = [], seq = 0;
    function register(manifest) {
      layout[manifest.id] = { module: manifest.id, surface: manifest.defaultHidden ? 'hidden' : 'inherit',
        priority: manifest.priority, reason: 'default', interrupted: false };
    }
    function rule(spec) {
      var s = spec || {}; if (!s.event || typeof s.apply !== 'function') throw new TypeError('Orchestratieregel mist event of apply.');
      regels.push({ id: s.id || 'rule-' + (++seq), event: s.event, priority: Number(s.priority) || 0,
        when: s.when, apply: s.apply }); regels.sort(function (a, b) { return b.priority - a.priority; });
    }
    function valid(mid, surface) { return !!layout[mid] && MODES.indexOf(surface) >= 0; }
    function apply(plan, reden, event) {
      var wijzigingen = [];
      Object.keys(plan || {}).forEach(function (mid) {
        var surface = plan[mid]; if (!valid(mid, surface)) return;
        var oud = layout[mid].surface; if (oud === surface) return;
        layout[mid].surface = surface; layout[mid].reason = reden; layout[mid].interrupted = surface === 'suspended';
        wijzigingen.push({ module: mid, from: oud, to: surface });
      });
      if (wijzigingen.length && typeof o.apply === 'function') o.apply(snapshot(), wijzigingen, event || null);
      return wijzigingen;
    }
    function handle(event) {
      var gekozen = regels.filter(function (r) {
        if (r.event !== event.event) return false;
        try { return typeof r.when !== 'function' || r.when(event) === true; } catch (e) { return false; }
      });
      var gebruikt = false;
      gekozen.forEach(function (r) {
        var plan; try { plan = r.apply(event, snapshot()); } catch (e) { if (o.error) o.error('orchestrator:' + r.id, e); return; }
        if (plan) { apply(plan, r.id, event); gebruikt = true; }
      });
      return gebruikt;
    }
    function snapshot() { return JSON.parse(JSON.stringify(layout)); }
    rule({ id: 'critical-safety-takeover', event: 'safety.incident.started', priority: 100,
      when: function (e) { return e.payload && e.payload.severity === 'critical'; },
      apply: function () { return { safety: 'focus', messages: 'suspended', travel: 'panel' }; } });
    rule({ id: 'driver-context', event: 'messages.driver-details.detected', priority: 40,
      apply: function () { return { travel: 'peek' }; } });
    rule({ id: 'trip-monitoring-context', event: 'travel.driver.attached', priority: 50,
      apply: function () { return { travel: 'panel', safety: 'peek' }; } });
    return { modes: MODES.slice(), register: register, addRule: rule, handle: handle, apply: apply,
      layout: snapshot, destroy: function () { regels.length = 0; layout = Object.create(null); } };
  };
})(window);
