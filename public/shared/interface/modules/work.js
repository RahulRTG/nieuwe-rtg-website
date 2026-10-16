/* WorkOS als Living Module boven op de bestaande bedrijfslaag. De gebruiker
   activeert de koppeling expliciet. Verse lid-sessies blijven uitsluitend in
   deze module-instantie en komen nooit in Workspace State, DOM of opslag. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK || !w.RTGWorkView || !w.RTGWorkEdge) return;
  SDK.add(SDK.define({
    id: 'work', name: 'WorkOS', version: '1.0.0', maturity: 'L3', priority: 52,
    runtime: { minVersion: '0.1.0' }, source: 'native', states: SDK.states,
    capabilities: ['work.read'], services: ['bedrijf'], permissions: ['work.read'],
    actions: ['work.connect', 'work.select', 'work.refresh', 'work.open'],
    assistant: { actions: [{ id: 'work.open', kind: 'open' }, { id: 'work.refresh', kind: 'search' }] },
    events: { publishes: ['work.loaded', 'work.coordination.bound', 'work.coordination.unavailable'],
      subscribes: ['coordination.selected'] },
    state: { persistence: 'none', schema: 'work.state.v1' },
    performance: { peekBudgetKb: 20, panelBudgetKb: 55 }
  }, function (ctx) {
    var root, surface = 'peek', active = false, phase = 'idle', spaces = [], selected = -1;
    var dashboard = null, message = '', busy = false;
    var selectedCase = null, bindingRequest = 0;
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    function current() { return selected >= 0 && spaces[selected] || null; }
    function publicSpaces() { return spaces.map(function (row) { return { code: row.werkruimte,
      name: row.naam, roles: row.rollen, function: row.functie }; }); }
    function model() { var row = current(); return { phase: phase, spaces: publicSpaces(), dashboard: dashboard,
      message: message, state: surface, code: row && row.werkruimte, name: row && row.naam }; }
    var edge = w.RTGWorkEdge({ run: function (id, data) { return ctx.actions.run(id, data); } });
    function wipe(next) {
      bindingRequest++; spaces = []; selected = -1; dashboard = null; message = ''; phase = next || 'idle';
      if (phase === 'idle' || phase === 'stale') selectedCase = null;
    }
    function same() { return !!(ctx.session && ctx.session.unchanged && ctx.session.unchanged()); }
    function draw() {
      if (!same() && phase !== 'idle' && phase !== 'stale') wipe('stale');
      if (root) w.RTGWorkView(root, model()); edge.sync(active, surface, model());
    }
    function request(path, body) {
      if (!same()) { wipe('stale'); draw(); return Promise.reject(new Error('session-changed')); }
      return ctx.request(path, body || {}, { signal: stop && stop.signal }).then(function (value) {
        if (!same()) { wipe('stale'); draw(); throw new Error('session-changed'); } return value;
      });
    }
    function caseSelection(value) {
      var p = value || {}, domain = String(p.domain || ''), id = String(p.id || '').trim();
      if ((domain !== 'bureau' && domain !== 'service') || !id || id.length > 160) return null;
      return { domain: domain, id: id };
    }
    function unavailable(p, reason) {
      ctx.events.publish('work.coordination.unavailable', { schemaVersion: 1,
        case: { domain: p.domain, id: p.id }, reason: reason || 'context-unavailable' });
      return false;
    }
    function safeBinding(value, p, row) {
      var view = value && value.regiebeeld, context = view && view.context, refs = context && context.context;
      var workspace = refs && refs.workspace, tenant = refs && refs.tenant, entity = refs && refs.legalEntity;
      if (!value || value.ok !== true || !view || view.readOnly !== true || !view.source ||
          view.source.domain !== p.domain || view.source.id !== p.id || !context ||
          context.status !== 'bekend' || context.readOnly !== true || context.grantsAuthority !== false ||
          !workspace || workspace.id !== row.werkruimte || !tenant || !tenant.id) return null;
      return { schemaVersion: 1, case: { domain: p.domain, id: p.id },
        workspace: { id: String(workspace.id) }, tenant: { id: String(tenant.id) },
        legalEntity: entity && entity.id ? { id: String(entity.id) } : null,
        readOnly: true, grantsAuthority: false };
    }
    function bindCase(value) {
      var p = caseSelection(value); if (!p) return Promise.resolve(false);
      selectedCase = p;
      var row = current();
      if (!same()) { wipe('stale'); draw(); return Promise.resolve(unavailable(p, 'session-changed')); }
      if (phase !== 'ready' || !row) return Promise.resolve(unavailable(p, 'workspace-not-selected'));
      var sequence = ++bindingRequest, body = { werkruimte: row.werkruimte, domain: p.domain, id: p.id };
      /* Alleen de WorkOS-module bezit de tijdelijke ontwikkelsessie. Productie
         gebruikt dezelfde route zonder dit veld via productie-identiteit. */
      if (row.lidToken) body.lidToken = row.lidToken;
      return request('/api/bedrijf/zaakregie', body).then(function (value) {
        if (sequence !== bindingRequest || row !== current()) return false;
        var binding = safeBinding(value, p, row);
        if (!binding) return unavailable(p, 'projection-mismatch');
        ctx.events.publish('work.coordination.bound', binding); return true;
      }).catch(function (error) {
        if (error && error.name === 'AbortError') return false;
        return unavailable(p, error && error.message === 'session-changed' ? 'session-changed' : 'context-unavailable');
      });
    }
    function load(index) {
      if (busy || !spaces[index]) return Promise.resolve(false);
      busy = true; selected = index; phase = 'loading'; draw();
      var row = spaces[index], body = { werkruimte: row.werkruimte };
      if (row.lidToken) body.lidToken = row.lidToken;
      return request('/api/bedrijf/start', body).then(function (value) {
        dashboard = value; phase = 'ready'; ctx.setStatus('actueel', 'ok');
        ctx.events.publish('work.loaded', { workspace: value && value.werkruimte && value.werkruimte.code || '',
          warnings: value && value.blokken && Array.isArray(value.blokken.waarschuwingen) ? value.blokken.waarschuwingen.length : 0 });
        return selectedCase ? bindCase(selectedCase).then(function () { return true; }) : true;
      }).catch(function (error) {
        if (error && (error.name === 'AbortError' || error.message === 'session-changed')) return false;
        dashboard = null; phase = 'error'; message = error.message || 'WerkOS is nu niet beschikbaar.';
        ctx.setStatus('niet beschikbaar', 'warning'); return false;
      }).finally(function () { busy = false; draw(); });
    }
    function connect() {
      if (busy) return Promise.resolve(false); busy = true; wipe('loading'); draw();
      return request('/api/bedrijf/mijn', {}).then(function (value) {
        spaces = Array.isArray(value && value.werkruimtes) ? value.werkruimtes.slice(0, 24) : [];
        if (!spaces.length) { phase = 'empty'; ctx.setStatus('niet gekoppeld', 'quiet'); return false; }
        if (spaces.length === 1) { busy = false; return load(0); }
        phase = 'choose'; ctx.setStatus(spaces.length + ' werkruimtes', 'ok'); return true;
      }).catch(function (error) {
        if (error && (error.name === 'AbortError' || error.message === 'session-changed')) return false;
        phase = 'error'; message = error.message || 'WorkOS is nu niet beschikbaar.';
        ctx.setStatus('niet beschikbaar', 'warning'); return false;
      }).finally(function () { busy = false; draw(); });
    }
    function storage(event) { if (!event || event.key == null || event.key === 'rtg_member_token') { wipe('stale'); draw(); } }
    return {
      actions: {
        'work.connect': { permission: 'work.read', run: connect },
        'work.select': { permission: 'work.read', validate: function (p) { return Number.isInteger(p.index) && p.index >= 0; },
          run: function (p) { return load(p.index); } },
        'work.refresh': { permission: 'work.read', run: function () { return current() ? load(selected) : connect(); } },
        'work.open': { run: function () { var row = current();
          return ctx.open('/apps/werk.html' + (row ? '?werkruimte=' + encodeURIComponent(row.werkruimte) : ''), 'RTG Werk OS'); } }
      },
      mount: function (body) { root = d.createElement('div'); root.className = 'rtg-module-work'; body.appendChild(root);
        w.addEventListener('storage', storage); draw(); },
      render: function (next, meta) { surface = next; active = !!(meta && meta.active); draw(); },
      handle: function (target) {
        var button = target && target.closest && target.closest('[data-rtg-work-action]');
        if (!button || !root.contains(button)) return false;
        var id = button.dataset.rtgWorkAction, map = { connect: 'work.connect', select: 'work.select',
          refresh: 'work.refresh', open: 'work.open' };
        if (!map[id]) return false;
        var payload = id === 'select' ? { index: Number(button.dataset.rtgWorkIndex) } : {};
        ctx.actions.run(map[id], payload).catch(function () {}); return true;
      },
      onEvent: function (event) {
        if (!event || event.event !== 'coordination.selected') return Promise.resolve(false);
        return bindCase(event.payload);
      },
      destroy: function () { edge.clear(); if (stop) stop.abort(); w.removeEventListener('storage', storage);
        wipe('idle'); root = null; }
    };
  }));
})(window, document);
