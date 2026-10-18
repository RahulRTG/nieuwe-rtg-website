/* Universele Regie als Living Module boven op bestaande Service- en
   Privékantoorzaken. Zij bezit geen case-engine en schrijft geen bronstatus. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK || !w.RTGCoordinationView || !w.RTGCoordinationEdge) return;
  SDK.add(SDK.define({
    id: 'coordination', name: 'RTG Regie', version: '1.1.0', maturity: 'L3', priority: 55,
    runtime: { minVersion: '0.1.0' }, source: 'native', states: SDK.states,
    capabilities: ['coordination.read', 'coordination.handoff'], services: ['service', 'member'],
    permissions: ['coordination.read'], actions: ['coordination.open-source', 'coordination.ask-human', 'coordination.refresh'],
    assistant: { actions: [{ id: 'coordination.open-source', kind: 'open' },
      { id: 'coordination.refresh', kind: 'search' }, { id: 'coordination.ask-human', kind: 'propose' }] },
    events: { publishes: ['coordination.loaded', 'coordination.selected'],
      subscribes: ['work.coordination.bound', 'work.coordination.unavailable'] },
    state: { persistence: 'none', schema: 'coordination.state.v1' },
    performance: { peekBudgetKb: 22, panelBudgetKb: 75 }
  }, function (ctx) {
    var root, state = 'panel', active = false, loading = false, loaded = false;
    var items = [], selectedId = '', error = null;
    var binding = { phase: 'idle' };
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    function selected() {
      return items.find(function (x) { return x.id === selectedId; }) || items[0] || null;
    }
    function payload() {
      var item = selected(); return { id: item && item.source && item.source.id || '', kind: item && item.kind || '' };
    }
    function selectionPayload() {
      var item = selected(), source = item && item.source || {};
      return { schemaVersion: 1, case: { domain: source.domain || '', type: source.type || '',
        id: source.id || '', observedVersion: source.version || '' } };
    }
    var edge = w.RTGCoordinationEdge({ selected: selected, payload: payload,
      run: function (id, data) { return ctx.actions.run(id, data); } });
    function valid(view) {
      var source = view && view.source || {}, pair = source.domain + '/' + source.type;
      return !!(view && view.schemaVersion === 1 && view.readOnly === true && view.ownsSourceData === false &&
        view.id === source.domain + ':' + source.type + ':' + source.id && source.id && source.version &&
        (pair === 'bureau/concierge-case' || pair === 'service/service-case') && view.phase);
    }
    function order(list) {
      return list.filter(valid).sort(function (a, b) {
        var aa = a.attention || {}, bb = b.attention || {};
        return Number(!!bb.decisionRequired) - Number(!!aa.decisionRequired) ||
          Number(!!bb.recovery) - Number(!!aa.recovery) || Number(!!a.phase.terminal) - Number(!!b.phase.terminal);
      }).slice(0, 12);
    }
    function draw() {
      if (!root) return;
      w.RTGCoordinationView(root, { items: items, selectedId: selectedId, state: state,
        loading: loading, error: error, binding: binding });
      edge.sync(active, state);
    }
    function serviceViews() {
      return ctx.request('/api/service/mijn', {}, { signal: stop && stop.signal }).then(function (j) {
        var open = (j.zaken || []).filter(function (x) { return x.stand !== 'opgelost' && x.stand !== 'gesloten'; }).slice(0, 6);
        return Promise.all(open.map(function (x) {
          return ctx.request('/api/service/zaak', { id: x.id }, { signal: stop && stop.signal })
            .then(function (dossier) { return dossier && dossier.zaak && dossier.zaak.regiebeeld || null; })
            .catch(function () { return null; });
        }));
      }).catch(function () { return []; });
    }
    function bureauViews() {
      return ctx.request('/api/member/bureau/zaken', {}, { signal: stop && stop.signal })
        .then(function (j) { return Array.isArray(j.regiebeelden) ? j.regiebeelden : []; })
        .catch(function () { return []; });
    }
    function load(force) {
      if (loading || (loaded && !force)) return Promise.resolve(items);
      loading = true; error = null; binding = { phase: 'idle' }; draw(); ctx.setStatus('laden', 'busy');
      return Promise.all([serviceViews(), bureauViews()]).then(function (lists) {
        if (!root) return [];
        items = order(lists[0].concat(lists[1])); loaded = true;
        if (!items.some(function (x) { return x.id === selectedId; }) && items.length)
          selectedId = items[0].id;
        ctx.setStatus(items.length ? items.length + ' actief' : 'Alles rustig', items.length ? 'ok' : 'quiet');
        ctx.events.publish('coordination.loaded', { count: items.length,
          attention: items.filter(function (x) { return x.attention && (x.attention.decisionRequired || x.attention.recovery); }).length });
        return items;
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return [];
        error = e || new Error('coordination-unavailable'); ctx.setStatus('offline', 'warning'); return [];
      }).finally(function () { loading = false; draw(); });
    }
    function openSource(p) {
      var item = items.find(function (x) { return x.source && x.source.id === p.id; }) || selected();
      if (!item) return false;
      if (item.kind === 'bureau' || item.kind === 'concierge') return ctx.open('/apps/lifestyle.html#zaken', 'Uw zaken');
      if (w.RTGGids && typeof w.RTGGids.open === 'function') { w.RTGGids.open(); return true; }
      return ctx.open('/apps/app.html', 'RTG');
    }
    return {
      actions: {
        'coordination.open-source': { validate: function (p) { return !!p.id; }, run: openSource },
        'coordination.ask-human': { offline: false, audit: true, idempotent: true,
          confirm: 'Wilt u deze servicezaak aan een mens doorgeven?',
          validate: function (p) { return !!p.id && p.kind === 'service'; },
          run: function (p) { return ctx.request('/api/service/mens', { id: p.id }).then(function (result) { return load(true).then(function () { return result; }); }); } },
        'coordination.refresh': { run: function () { return load(true); } }
      },
      mount: function (body) { root = d.createElement('div'); root.className = 'rtg-module-coordination'; body.appendChild(root); draw(); },
      render: function (next, meta) { state = next; active = !!(meta && meta.active); if (next !== 'peek') load(false); draw(); },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-rtg-coordination-action]');
        if (!b || !root.contains(b)) return false;
        var action = b.dataset.rtgCoordinationAction, id = b.dataset.rtgCoordinationId;
        if (action === 'select') {
          selectedId = id; binding = { phase: 'checking', case: selectionPayload() };
          ctx.events.publish('coordination.selected', selectionPayload()); draw(); return true;
        }
        var map = { open: 'coordination.open-source', human: 'coordination.ask-human', refresh: 'coordination.refresh' };
        if (map[action]) ctx.actions.run(map[action], payload()).catch(function (e) { error = e; draw(); });
        return !!map[action];
      },
      onEvent: function (event) {
        var p = event && event.payload || {}, c = p.case || {}, chosen = selectionPayload();
        var ref = chosen.case || {};
        if (p.schemaVersion !== 1 || !ref.id || c.id !== ref.id || c.domain !== ref.domain ||
            c.type !== ref.type || c.observedVersion !== ref.observedVersion) return false;
        if (event.event === 'work.coordination.bound' && p.readOnly === true && p.grantsAuthority === false &&
            p.workspace && p.workspace.id && p.tenant && p.tenant.id) {
          binding = { phase: 'bound', workspace: { id: String(p.workspace.id) },
            tenant: { id: String(p.tenant.id) }, legalEntity: p.legalEntity && p.legalEntity.id
              ? { id: String(p.legalEntity.id) } : null, readOnly: true, grantsAuthority: false };
        } else if (event.event === 'work.coordination.unavailable') {
          binding = { phase: 'unavailable', reason: String(p.reason || 'context-unavailable') };
        } else return false;
        draw(); return true;
      },
      destroy: function () { edge.clear(); if (stop) stop.abort(); root = null; items = []; }
    };
  }));
})(window, document);
