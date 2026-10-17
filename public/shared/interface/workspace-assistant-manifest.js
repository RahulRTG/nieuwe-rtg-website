/* Read-only projectie van expliciet assistant-safe Workspace-acties. Zij leest
   bestaande manifesten, registries, policy, sessie en Edge-context. Zij voert
   niets uit, bewaart niets en verleent geen bevoegdheid. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RTGWorkspaceAssistantManifest = api.create;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var STATES = ['panel', 'workspace', 'focus'], MAX_AGE = 10 * 60 * 1000, MAX_FUTURE = 2 * 60 * 1000;
  var KINDS = ['read', 'search', 'open', 'propose'];
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9-]+)*$/;
  function freeze(value) { return Object.freeze ? Object.freeze(value) : value; }
  function result(status, reason, moduleId, actions) {
    return freeze({ version: 1, status: status, reason: reason, module: moduleId || null,
      actions: freeze(actions || []) });
  }
  function create(options) {
    var o = options || {}, registries = o.registries, identity = o.identity, policy = o.policy;
    function allowed(permission, moduleId) {
      try { return !!(policy && typeof policy.allowed === 'function' && policy.allowed(permission, moduleId) === true); }
      catch (e) { return false; }
    }
    function read() {
      if (!identity || typeof identity.authenticated !== 'function' || !identity.authenticated() ||
          typeof identity.sameSession !== 'function' || !identity.sameSession())
        return result('blocked', 'session', null, []);
      var active = typeof o.active === 'function' ? String(o.active() || '') : '';
      var surface = typeof o.surface === 'function' ? String(o.surface() || '') : '';
      if (!ID.test(active) || STATES.indexOf(surface) < 0) return result('blocked', 'inactive', null, []);
      if (!registries || typeof registries.get !== 'function') return result('blocked', 'registry', null, []);
      var manifest = registries.get('module', active), declared = manifest && manifest.assistant && manifest.assistant.actions;
      if (!manifest || !Array.isArray(declared) || !declared.length) return result('blocked', 'not-opted-in', null, []);
      if (!Array.isArray(manifest.permissions) || !manifest.permissions.length ||
          !manifest.permissions.every(function (p) { return allowed(p, active); }))
        return result('blocked', 'permission', null, []);
      var edge;
      try { edge = typeof o.edge === 'function' ? o.edge() : null; } catch (e) { edge = null; }
      var now = typeof o.now === 'function' ? Number(o.now()) : Date.now(), at = Number(edge && edge.op);
      if (!Number.isFinite(at) || now - at > MAX_AGE || at - now > MAX_FUTURE)
        return result('blocked', 'stale-context', null, []);
      var context = edge && edge.velden && edge.velden.context;
      var source = context && context.waarde && String(context.waarde.bron || '');
      if (source !== 'workspace.' + active) return result('blocked', 'context-mismatch', null, []);
      var current = Object.create(null);
      (Array.isArray(edge.acties) ? edge.acties : []).forEach(function (a) {
        if (a && ID.test(String(a.id || '')) && a.staat === 'BESCHIKBAAR') current[a.id] = true;
      });
      var actions = [];
      declared.forEach(function (safe) {
        if (!safe || !ID.test(String(safe.id || '')) || KINDS.indexOf(safe.kind) < 0) return;
        var row = safe && registries.get('action', safe.id);
        if (!safe || !current[safe.id] || !row || row.owner !== active || row.registered !== true) return;
        if (row.permission && !allowed(row.permission, active)) return;
        actions.push(freeze({ id: safe.id, kind: safe.kind }));
      });
      return result('ready', 'explicit-opt-in', active, actions);
    }
    return freeze({ read: read });
  }
  return freeze({ create: create, maxAgeMs: MAX_AGE, maxFutureMs: MAX_FUTURE });
}));
