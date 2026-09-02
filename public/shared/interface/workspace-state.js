/* RTG STATE ENGINE.

   Vier expliciete niveaus voorkomen dat een module globale of workspace-state
   rechtstreeks muteert. Alleen de host bestuurt global, user, session en de
   compositie; een module krijgt een begrensd eigen statevak. */
(function (w, d) {
  'use strict';
  var SCOPE = ['global', 'user', 'session', 'workspace', 'module'];
  function clone(x) {
    var tekst = JSON.stringify(x == null ? {} : x);
    if (tekst.length > 65536) throw new Error('Workspace-state is groter dan 64 KB.');
    if (/"(?:token|authorization|password|secret|wachtwoord|sessie)"\s*:/i.test(tekst))
      throw new Error('Workspace-state mag geen geheimen bevatten.');
    return JSON.parse(tekst);
  }
  function samen(a, b) {
    var uit = clone(a); Object.keys(b || {}).forEach(function (k) { out(k); }); return uit;
    function out(k) { uit[k] = clone(b[k]); }
  }
  w.RTGWorkspaceState = function (opties) {
    var o = opties || {}, listeners = [], validators = Object.create(null), persist = Object.create(null);
    var data = {
      global: samen({ theme: d.documentElement.dataset.theme || 'system', language: d.documentElement.lang || 'nl',
        device: w.matchMedia && w.matchMedia('(min-width:1000px)').matches ? 'large' : 'compact' }, o.global),
      user: samen({ permissions: [], preferences: {}, savedWorkspaces: [] }, o.user),
      session: samen({ online: !w.navigator || w.navigator.onLine !== false, authenticated: false, activeDevice: null }, o.session),
      workspace: samen({ id: o.workspaceId || 'default', surface: 'peek', active: null, layout: {}, context: {} }, o.workspace),
      module: Object.create(null)
    };
    function emit(scope, id, value, reason) {
      var change = Object.freeze ? Object.freeze({ scope: scope, id: id || null, value: clone(value), reason: reason || 'update' }) : {};
      listeners.slice().forEach(function (fn) { try { fn(change); } catch (e) {} });
      if (typeof o.onChange === 'function') o.onChange(change);
    }
    function get(scope, id) {
      if (SCOPE.indexOf(scope) < 0) throw new TypeError('Onbekend state-niveau: ' + scope);
      if (scope === 'module') return clone(data.module[id] || {});
      return clone(data[scope]);
    }
    function hostSet(scope, patch, reason) {
      if (scope === 'module' || SCOPE.indexOf(scope) < 0) throw new TypeError('Host-state heeft een ongeldig niveau.');
      data[scope] = samen(data[scope], patch || {}); emit(scope, null, data[scope], reason); return get(scope);
    }
    function register(manifest, validator, persistence) {
      var id = manifest.id; if (!data.module[id]) data.module[id] = {};
      validators[id] = typeof validator === 'function' ? validator : null;
      persist[id] = persistence || manifest.state.persistence;
    }
    function moduleSet(id, patch, reason) {
      if (!Object.prototype.hasOwnProperty.call(data.module, id)) throw new Error('Onbekend module-statevak: ' + id);
      var next = samen(data.module[id], patch || {}), valid = validators[id];
      if (valid && valid(next) !== true) throw new TypeError('Module-state voldoet niet aan haar schema.');
      data.module[id] = next; emit('module', id, next, reason || 'module-update');
      if (persist[id] !== 'none' && typeof o.persist === 'function') o.persist(persist[id], id, clone(next));
      return clone(next);
    }
    function moduleApi(id) {
      return Object.freeze ? Object.freeze({ get: function () { return get('module', id); },
        set: function (patch, reason) { return moduleSet(id, patch, reason); } }) : {};
    }
    function view(id) {
      return Object.freeze ? Object.freeze({ global: get('global'), user: get('user'), session: get('session'),
        workspace: get('workspace'), module: get('module', id) }) : {};
    }
    function subscribe(fn) { listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
    return { scopes: SCOPE.slice(), get: get, hostSet: hostSet, registerModule: register,
      module: moduleApi, view: view, subscribe: subscribe,
      destroy: function () { listeners.length = 0; validators = Object.create(null); } };
  };
})(window, document);
