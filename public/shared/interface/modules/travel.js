/* TravelOS Living Module boven de bestaande Reisbureau-API. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK || !w.RTGTravelContinuity || !w.RTGTravelEdge || !w.RTGTravelActions) return;
  SDK.add(SDK.define({
    id: 'travel', name: 'Travel', version: '3.5.0', maturity: 'L4', runtime: { minVersion: '0.1.0' }, priority: 50,
    states: SDK.states, surfaces: { peek: true, panel: true, workspace: true, focus: true },
    capabilities: ['location.read', 'calendar.read', 'payments.request', 'notifications'],
    permissions: ['travel.read', 'travel.manage'], services: ['member', 'dom-reisbureau', 'mobiliteit', 'bk-reiswijzer'],
    actions: ['travel.open', 'travel.driver.attach', 'travel.request.review', 'travel.request.submit',
      'travel.request.check', 'travel.request.status', 'travel.request.open-flow', 'travel.request.edit', 'travel.request.catalog',
      'travel.request.remember'],
    assistant: { actions: [{ id: 'travel.open', kind: 'open' },
      { id: 'travel.request.catalog', kind: 'search' }, { id: 'travel.request.review', kind: 'propose' },
      { id: 'travel.request.open-flow', kind: 'open' }] },
    events: { publishes: ['travel.driver.attached', 'travel.loaded', 'travel.request.received', 'travel.request.uncertain'],
      subscribes: ['messages.driver-details.detected'] },
    state: { persistence: 'session', schema: 'travel.state.v1' }, performance: { peekBudgetKb: 40, panelBudgetKb: 150 }
  }, function (ctx) {
    var root, state = 'peek', dossier = null, catalogus = null, catalogusFout = '', suggestion = ctx.state.get().suggestion || null;
    var dossierBezig = false, catalogusBezig = false, requestResult = null, gekozen = null;
    var draft = { date: '', participants: 2, note: '' }, requestState = { phase: 'idle', busy: false };
    var active = false, continuity;
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    var controller = w.RTGTravelRequestController && w.RTGTravelRequestController.create({
      api: function (pad, body) { return ctx.request(pad, body, { signal: stop && stop.signal }); },
      sameSession: ctx.session && ctx.session.unchanged || function () { return false; },
      onChange: function (s, reden) {
        requestState = s;
        if (reden === 'submitting') ctx.setStatus('versturen', 'busy');
        else if (reden === 'uncertain') ctx.setStatus('uitkomst onbekend', 'warning');
        else if (reden === 'received') ctx.setStatus('ontvangen', 'ok');
        // Een invoerveld beheert zijn eigen actuele DOM-waarde. Op iedere
        // letter opnieuw tekenen zou focus en cursorpositie verbreken.
        if (reden !== 'edit') teken(); else edgeSync();
      }
    });

    function laadDossier() {
      if (dossierBezig || dossier) return; dossierBezig = true; ctx.setStatus('laden', 'busy');
      ctx.request('/api/member/huis/dossier', {}, { signal: stop && stop.signal }).then(function (j) {
        dossier = j || {}; ctx.setStatus(dossier.reis ? 'live' : 'geen reis', dossier.reis ? 'ok' : 'quiet');
        ctx.events.publish('travel.loaded', { hasTrip: !!dossier.reis, openItems: Array.isArray(dossier.open) ? dossier.open.length : 0 });
      }).catch(function (e) { if (e.name !== 'AbortError') { dossier = {}; ctx.setStatus('offline', 'warning'); } })
        .finally(function () { dossierBezig = false; teken(); });
    }
    function laadCatalogus() {
      if (catalogusBezig || catalogus) return; catalogusBezig = true; catalogusFout = ''; teken();
      ctx.request('/api/reisbureau', {}, { signal: stop && stop.signal }).then(function (j) {
        catalogus = Array.isArray(j && j.reizen) ? j.reizen : [];
      }).catch(function (e) {
        if (e.name !== 'AbortError') { catalogus = []; catalogusFout = e.message || 'Het reisaanbod kon niet worden geladen.'; }
      }).finally(function () { catalogusBezig = false; teken(); });
    }
    function invoer() { return { date: draft.date, participants: draft.participants, note: draft.note }; }
    function vind(id) { return (catalogus || []).find(function (reis) { return reis.id === id; }); }
    function focusLater(selector) { Promise.resolve().then(function () { var n = root && root.querySelector(selector); if (n) n.focus(); }); }
    function actiePayload() { return Object.assign({ tripId: gekozen && gekozen.id || '' }, invoer()); }
    function openFlowPayload() { var saved = continuity.model(); return Object.assign({ tripId: gekozen && gekozen.id || '',
      remember: saved.remember, hasNote: !!draft.note }, continuity.fields()); }
    var edge = w.RTGTravelEdge && w.RTGTravelEdge({ run: ctx.actions.run, actionPayload: actiePayload,
      flowPayload: openFlowPayload, state: function () { return { trip: gekozen, phase: requestState.phase, request: requestResult }; } });
    function edgeSync() { if (edge) edge.sync(active, state); }
    function tekenAanvraag() {
      if (state === 'peek') return;
      if (!w.RTGTravelView) return;
      w.RTGTravelView.renderRequest(root, { controller: !!controller, catalog: catalogus, catalogLoading: catalogusBezig,
        catalogError: catalogusFout, trip: gekozen, draft: invoer(), phase: requestState.phase,
        busy: requestState.busy, result: requestResult, remember: continuity.model().remember,
        rememberBusy: continuity.model().busy }, function (veld, waarde) {
        draft[veld] = waarde; controller.edit(); continuity.touch();
      });
    }
    function teken() {
      if (!root) return; root.textContent = '';
      if (w.RTGTravelView) w.RTGTravelView.renderDossier(root, {
        suggestion: suggestion, dossier: dossier, dossierLoading: dossierBezig, state: state
      });
      tekenAanvraag(); edgeSync();
    }

    function verwerk(uitkomst) {
      requestResult = uitkomst;
      if (uitkomst && uitkomst.type === 'received') ctx.events.publish('travel.request.received', {
        ref: uitkomst.application && uitkomst.application.ref || null, tripId: gekozen && gekozen.id || null
      });
      else if (uitkomst && uitkomst.type === 'uncertain') ctx.events.publish('travel.request.uncertain', { tripId: gekozen && gekozen.id || null });
      if (uitkomst && uitkomst.type === 'received') continuity.complete();
      teken();
    }
    var api = {
      actions: null,
      mount: function (body) {
        root = d.createElement('div'); root.className = 'rtg-module-travel'; body.appendChild(root);
        continuity.mount(); teken();
      },
      render: function (s, meta) { state = s; active = !!(meta && meta.active); if (s !== 'peek') { laadDossier(); laadCatalogus(); } teken(); },
      onEvent: function (event) { suggestion = event.payload || null; ctx.state.set({ suggestion: suggestion }, 'driver-detected'); teken(); },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-rtg-travel-action]'); if (!b || !root.contains(b)) return false;
        var actie = b.dataset.rtgTravelAction, payload = Object.assign({ tripId: gekozen && gekozen.id || '' }, invoer());
        if (actie === 'open') ctx.actions.run('travel.open', {}).catch(function () {});
        else if (actie === 'open-flow') ctx.actions.run('travel.request.open-flow', openFlowPayload()).catch(function () {});
        else if (actie === 'attach-driver' && suggestion) ctx.actions.run('travel.driver.attach', suggestion).catch(function () {});
        else if (actie === 'choose') { gekozen = vind(b.dataset.rtgTravelTrip); requestResult = null; draft = continuity.retain();
          if (gekozen) controller.open(gekozen); teken(); focusLater('[data-rtg-travel-input="date"]'); }
        else if (actie === 'back-catalog') ctx.actions.run('travel.request.catalog', {}).catch(function () {});
        else if (actie === 'minus' || actie === 'plus') { draft.participants = Math.max(1, Math.min(20, draft.participants + (actie === 'plus' ? 1 : -1)));
          controller.edit(); continuity.touch(); teken(); }
        else if (actie === 'remember') ctx.actions.run('travel.request.remember', { enabled: !!b.checked }).catch(function () {});
        else if (actie === 'edit') ctx.actions.run('travel.request.edit', {}).catch(function () {});
        else if (actie === 'review') ctx.actions.run('travel.request.review', payload).catch(function () {});
        else if (actie === 'submit') ctx.actions.run('travel.request.submit', payload).catch(function () {});
        else if (actie === 'check') ctx.actions.run('travel.request.check', { tripId: payload.tripId }).catch(function () {});
        else if (actie === 'status' && requestResult && requestResult.application) {
          ctx.actions.run('travel.request.status', { ref: requestResult.application.ref }).catch(function () {});
        }
        return true;
      },
      destroy: function () {
        if (stop) stop.abort(); continuity.destroy();
        if (edge) edge.clear(); root = null;
      }
    };
    continuity = w.RTGTravelContinuity({ context: ctx, draft: function () { return draft; },
      apply: function (value) { draft.date = value.date; draft.participants = value.participants; }, draw: teken,
      state: function () { return { trip: gekozen, phase: requestState.phase }; } });
    api.actions = w.RTGTravelActions({ context: ctx, controller: controller, continuity: continuity,
      trip: function () { return gekozen; }, find: vind, draw: teken, focus: focusLater,
      result: function (value) { requestResult = value; }, process: verwerk,
      currentResult: function () { return requestResult; },
      catalog: function () { gekozen = null; requestResult = null; continuity.reset(); draft = continuity.retain();
        teken(); focusLater('[data-rtg-travel-action="choose"]'); },
      attach: function (payload) {
        var attached = { conversationId: payload.conversationId, preview: String(payload.preview || '').slice(0, 180) };
        ctx.state.set({ suggestion: null, driverContext: attached }, 'driver-attached'); suggestion = null;
        ctx.events.publish('travel.driver.attached', attached); teken(); return { ok: true, driverContext: attached };
      } });
    return api;
  }));
})(window, document);
