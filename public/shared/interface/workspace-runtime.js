/* RTG WORKSPACE RUNTIME v0.1. Dynamic Layer, Second Screen en Focus View zijn
   surfaces van dit fundament; modules bezitten nooit de platformlaag. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK, nummer = 0;
  if (!SDK || !w.RTGWorkspaceRegistries || !w.RTGIdentityRuntime || !w.RTGSessionRuntime || !w.RTGWorkspaceContext ||
      !w.RTGWorkspaceNavigation || !w.RTGWorkspaceState || !w.RTGWorkspacePolicy ||
      !w.RTGWorkspaceOrchestrator || !w.RTGWorkspaceBroker || !w.RTGWorkspaceModuleHost || !w.RTGWorkspaceBlueprints) return;
  w.RTGWorkspaceRuntime = function (opties) {
    var o = opties || {}, id = 'rtg-workspace-' + (++nummer), defs = Object.create(null), mounted = Object.create(null);
    var surface = 'peek', actief = null, dood = false, registries = w.RTGWorkspaceRegistries();
    registries.registerWorldCatalog(w.RTGWorkspaceWorldCatalog || []);
    function fout(waar, error) {
      try { d.dispatchEvent(new w.CustomEvent('rtg-workspace-error', { detail: { waar: waar,
        message: String(error && error.message || error || 'Onbekende fout') } })); } catch (e) {}
      if (typeof o.error === 'function') o.error(waar, error);
    }
    var identity = w.RTGIdentityRuntime({ actor: o.actor }), session = w.RTGSessionRuntime({ identity: identity, deviceId: o.deviceId });
    var contextEngine = w.RTGWorkspaceContext({ source: o.context });
    var navigation = w.RTGWorkspaceNavigation({ open: o.open });
    var policy = w.RTGWorkspacePolicy({ actor: identity.actor(), permission: o.permission, tenantPolicy: o.tenantPolicy });
    var state = w.RTGWorkspaceState({ workspaceId: o.workspaceId, global: o.globalState, user: o.userState,
      session: Object.assign(session.snapshot(), o.sessionState || {}),
      workspace: Object.assign({ context: contextEngine.get() }, o.workspaceState || {}),
      persist: o.persistModuleState, onChange: o.onStateChange });
    session.subscribe(function (s) { state.hostSet('session', s, 'connection-change'); });
    contextEngine.subscribe(function (c) { state.hostSet('workspace', { context: c.value }, c.reason); });
    var orchestrator = w.RTGWorkspaceOrchestrator({ error: fout, apply: function (layout, changes, event) {
      toepassen(layout); state.hostSet('workspace', { layout: layout }, 'orchestration');
      if (typeof o.onOrchestrate === 'function') o.onOrchestrate(layout, changes, event);
    } });
    var broker = w.RTGWorkspaceBroker({ definition: function (mid) { return defs[mid]; }, registries: registries,
      policy: policy, workspaceId: o.workspaceId, confirm: o.confirm, audit: function (entry) {
        if (typeof o.audit === 'function') return o.audit(entry);
        aanvraag('/api/ik/workspace/audit/noteer', entry).catch(function () { /* domeinaudit blijft leidend */ });
      }, error: fout,
      observe: function (event) { orchestrator.handle(event); } });
    var blueprints = w.RTGWorkspaceBlueprints({ manifest: function (mid) { return defs[mid] && defs[mid].manifest; },
      permission: policy.allowed, moduleAllowed: o.moduleAllowed, deviceAllows: o.deviceAllows,
      apply: function (plan, reason) { orchestrator.apply(plan, reason); } });
    function zichtbaar(def) { return def.manifest.permissions.every(function (p) { return policy.allowed(p, def.manifest.id); }); }
    function registreer(def) {
      if (dood || !def || !def.manifest) throw new TypeError('Ongeldige moduledefinitie.');
      var mid = def.manifest.id; if (defs[mid]) throw new Error('Dubbele module in workspace: ' + mid);
      registries.registerManifest(def.manifest); defs[mid] = def; orchestrator.register(def.manifest);
      state.registerModule(def.manifest, def.validators && def.validators.state, def.manifest.state.persistence);
      var install = def.lifecycle && def.lifecycle.onInstall;
      if (typeof install === 'function') try { install({ manifest: def.manifest }); } catch (e) { fout('onInstall:' + mid, e); }
      return def;
    }
    function aanvraag(url, body, extra) {
      if (typeof o.request === 'function') return o.request(url, body, extra);
      if (!/^\/api\//.test(String(url || ''))) return Promise.reject(new Error('Een module mag alleen RTG-API-paden opvragen.'));
      if (!identity.authenticated()) return Promise.reject(new Error('signed-out'));
      return w.fetch(url, { method: 'POST', credentials: 'same-origin', signal: extra && extra.signal,
        headers: Object.assign({ 'Content-Type': 'application/json' }, identity.headers()), body: JSON.stringify(body || {}) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'request-failed'); return j; });
      });
    }
    function contextVoor(mid, status) {
      var vak = state.module(mid), ctx = { id: mid, manifest: defs[mid].manifest, services: o.services || {},
        context: contextEngine.get,
        state: { get: vak.get, set: vak.set, snapshot: function () { return state.view(mid); } }, request: aanvraag,
        open: function (url, title) { return navigation.open(url, title, mid); },
        permission: function (p) { return policy.allowed(p, mid); },
        setStatus: function (tekst, toon) { status.textContent = String(tekst || ''); status.dataset.tone = toon || 'quiet'; },
        events: { publish: function (type, data) { return broker.publish(type, data, mid, false); },
          subscribe: function (type, fn) { return broker.subscribe(mid, type, fn, false); } },
        actions: { run: function (actionId, data) { return broker.run(mid, actionId, data); } } };
      return Object.freeze ? Object.freeze(ctx) : ctx;
    }
    function frame(def) {
      var item = w.RTGWorkspaceModuleHost({ runtimeId: id, definition: def, context: function (status) { return contextVoor(def.manifest.id, status); },
        registerAction: broker.registerAction, subscribe: function (owner, type, fn) { return broker.subscribe(owner, type, fn, false); },
        workspaceContext: contextEngine.get, error: fout });
      mounted[def.manifest.id] = item; return item;
    }
    function vormVoor(m, gewenste) {
      if (m.states.indexOf(gewenste) >= 0 && m.surfaces[gewenste]) return gewenste;
      for (var i = SDK.states.indexOf(gewenste); i >= 0; i--) if (m.states.indexOf(SDK.states[i]) >= 0 && m.surfaces[SDK.states[i]]) return SDK.states[i];
      return m.states.filter(function (s) { return m.surfaces[s]; })[0];
    }
    function toepassen(layout) {
      contextEngine.refresh();
      Object.keys(mounted).forEach(function (mid) { var directive = layout[mid] || { surface: 'inherit' };
        var gewenst = SDK.states.indexOf(directive.surface) >= 0 ? directive.surface : surface;
        mounted[mid].render(vormVoor(defs[mid].manifest, gewenst), directive, mid === actief); });
    }
    function mount(container, order) {
      var ids = Array.isArray(order) ? order.slice() : [];
      Object.keys(defs).sort(function (a, b) { return defs[a].manifest.priority - defs[b].manifest.priority; }).forEach(function (mid) { if (ids.indexOf(mid) < 0) ids.push(mid); });
      ids.forEach(function (mid) { var def = defs[mid]; if (!def || !zichtbaar(def)) return; var item = mounted[mid] || frame(def); container.appendChild(item.root); });
      toepassen(orchestrator.layout()); return ids.filter(function (mid) { return mounted[mid]; });
    }
    function setState(next, activeId) {
      if (SDK.states.indexOf(next) < 0) return false; surface = next; if (activeId && mounted[activeId]) actief = activeId;
      state.hostSet('workspace', { surface: surface, active: actief }, 'surface-change'); toepassen(orchestrator.layout());
      broker.publish('workspace.state.changed', { state: surface, active: actief }, 'workspace', true); return true;
    }
    function dispatch(target) {
      var root = target && target.closest && target.closest('[data-rtg-module]'); if (!root) return false;
      var mid = root.dataset.rtgModule, item = mounted[mid]; if (!item) return false;
      /* Handel eerst de intentie af terwijl target nog bij de module hoort.
         render() mag de surface vervangen; deden we dat ervoor, dan verloor
         iedere native module de aangeklikte knop nog voor handle() hem zag. */
      var verwerkt = item.handle(target);
      if (verwerkt) { actief = mid; toepassen(orchestrator.layout()); }
      return verwerkt;
    }
    function destroy() {
      dood = true; Object.keys(mounted).forEach(function (mid) { mounted[mid].destroy(); });
      broker.destroy(); orchestrator.destroy(); navigation.destroy(); contextEngine.destroy(); session.destroy(); state.destroy();
      defs = Object.create(null); mounted = Object.create(null);
    }
    return { version: SDK.version, id: id, register: registreer, mount: mount, setState: setState, dispatch: dispatch,
      setActive: function (mid) { if (mounted[mid]) { actief = mid; setState(surface, mid); } return actief; },
      setHidden: function (mid, hidden) { if (mounted[mid]) { mounted[mid].setHidden(hidden); toepassen(orchestrator.layout()); } },
      ids: function () { return Object.keys(defs).filter(function (mid) { return zichtbaar(defs[mid]); }); },
      manifests: function () { return Object.keys(defs).map(function (mid) { return defs[mid].manifest; }); },
      active: function () { return actief; }, state: function () { return surface; }, stateEngine: state,
      registries: registries, orchestrator: orchestrator, contextEngine: contextEngine, navigation: navigation, blueprints: blueprints,
      applyBlueprint: blueprints.apply,
      publish: function (type, data) { return broker.publish(type, data, 'workspace', true); },
      execute: function (actionId, data) { return broker.run(null, actionId, data); }, destroy: destroy };
  };
})(window, document);
