/* Universele Regie als Living Module boven op bestaande Service- en
   Privékantoorzaken. Zij bezit geen case-engine en schrijft geen bronstatus. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK || !w.RTGCoordinationView || !w.RTGCoordinationEdge) return;
  SDK.add(SDK.define({
    id: 'coordination', name: 'RTG Regie', version: '1.0.0', maturity: 'L3', priority: 55,
    runtime: { minVersion: '0.1.0' }, source: 'native', states: SDK.states,
    capabilities: ['coordination.read', 'coordination.handoff'], services: ['service', 'member'],
    permissions: ['coordination.read'], actions: ['coordination.open-source', 'coordination.ask-human', 'coordination.refresh'],
    assistant: { actions: [{ id: 'coordination.open-source', kind: 'open' },
      { id: 'coordination.refresh', kind: 'search' }, { id: 'coordination.ask-human', kind: 'propose' }] },
    events: { publishes: ['coordination.loaded', 'coordination.selected'], subscribes: [] },
    state: { persistence: 'none', schema: 'coordination.state.v1' },
    performance: { peekBudgetKb: 22, panelBudgetKb: 75 }
  }, function (ctx) {
    var root, state = 'panel', active = false, loading = false, loaded = false;
    var items = [], selectedId = '', error = null;
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    function selected() {
      return items.find(function (x) { return x.source && x.source.id === selectedId; }) || items[0] || null;
    }
    function payload() {
      var item = selected(); return { id: item && item.source && item.source.id || '', kind: item && item.kind || '' };
    }
    var edge = w.RTGCoordinationEdge({ selected: selected, payload: payload,
      run: function (id, data) { return ctx.actions.run(id, data); } });
    function valid(view) {
      return !!(view && view.readOnly === true && view.ownsSourceData === false && view.source && view.source.id && view.phase);
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
      w.RTGCoordinationView(root, { items: items, selectedId: selectedId, state: state, loading: loading, error: error });
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
      loading = true; error = null; draw(); ctx.setStatus('laden', 'busy');
      return Promise.all([serviceViews(), bureauViews()]).then(function (lists) {
        if (!root) return [];
        items = order(lists[0].concat(lists[1])); loaded = true;
        if (!items.some(function (x) { return x.source && x.source.id === selectedId; }) && items.length)
          selectedId = items[0].source.id;
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
          selectedId = id; ctx.events.publish('coordination.selected', payload()); draw(); return true;
        }
        var map = { open: 'coordination.open-source', human: 'coordination.ask-human', refresh: 'coordination.refresh' };
        if (map[action]) ctx.actions.run(map[action], payload()).catch(function (e) { error = e; draw(); });
        return !!map[action];
      },
      destroy: function () { edge.clear(); if (stop) stop.abort(); root = null; items = []; }
    };
  }));
})(window, document);
