/* Travel als L4 Living Module: echte dossierdata, de bestaande TravelOS-
   aanvraagkern en een bevestigde Action Broker-overgang. De module bewaart
   alleen actieve presentatiestatus; catalogus en aanvragen blijven bij de
   bestaande Reisbureau-API. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK) return;
  SDK.add(SDK.define({
    id: 'travel', name: 'Travel', version: '3.3.0', maturity: 'L4', runtime: { minVersion: '0.1.0' }, priority: 50,
    states: SDK.states, surfaces: { peek: true, panel: true, workspace: true, focus: true },
    capabilities: ['location.read', 'calendar.read', 'payments.request', 'notifications'],
    permissions: ['travel.read', 'travel.manage'], services: ['member', 'dom-reisbureau', 'mobiliteit', 'bk-reiswijzer'],
    actions: ['travel.open', 'travel.driver.attach', 'travel.request.review', 'travel.request.submit',
      'travel.request.check', 'travel.request.open-flow'],
    events: { publishes: ['travel.driver.attached', 'travel.loaded', 'travel.request.received', 'travel.request.uncertain'],
      subscribes: ['messages.driver-details.detected'] },
    state: { persistence: 'session', schema: 'travel.state.v1' }, performance: { peekBudgetKb: 40, panelBudgetKb: 150 }
  }, function (ctx) {
    var root, state = 'peek', dossier = null, catalogus = null, catalogusFout = '', suggestion = ctx.state.get().suggestion || null;
    var dossierBezig = false, catalogusBezig = false, requestResult = null, gekozen = null;
    var draft = { date: '', participants: 2, note: '' }, requestState = { phase: 'idle', busy: false };
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    var controller = w.RTGTravelRequestController && w.RTGTravelRequestController.create({
      api: function (pad, body) { return ctx.request(pad, body, { signal: stop && stop.signal }); },
      sameSession: function () { var s = ctx.state.snapshot().session || {}; return s.authenticated === true; },
      onChange: function (s, reden) {
        requestState = s;
        if (reden === 'submitting') ctx.setStatus('versturen', 'busy');
        else if (reden === 'uncertain') ctx.setStatus('uitkomst onbekend', 'warning');
        else if (reden === 'received') ctx.setStatus('ontvangen', 'ok');
        // Een invoerveld beheert zijn eigen actuele DOM-waarde. Op iedere
        // letter opnieuw tekenen zou focus en cursorpositie verbreken.
        if (reden !== 'edit') teken();
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
    function openFlowPayload() { return { tripId: gekozen && gekozen.id || '' }; }
    function tekenAanvraag() {
      if (state === 'peek') return;
      if (!w.RTGTravelView) return;
      w.RTGTravelView.renderRequest(root, { controller: !!controller, catalog: catalogus, catalogLoading: catalogusBezig,
        catalogError: catalogusFout, trip: gekozen, draft: invoer(), phase: requestState.phase,
        busy: requestState.busy, result: requestResult }, function (veld, waarde) {
        draft[veld] = waarde; controller.edit();
      });
    }
    function teken() {
      if (!root) return; root.textContent = '';
      if (w.RTGTravelView) w.RTGTravelView.renderDossier(root, {
        suggestion: suggestion, dossier: dossier, dossierLoading: dossierBezig, state: state
      });
      tekenAanvraag();
    }

    function verwerk(uitkomst) {
      requestResult = uitkomst;
      if (uitkomst && uitkomst.type === 'received') ctx.events.publish('travel.request.received', {
        ref: uitkomst.application && uitkomst.application.ref || null, tripId: gekozen && gekozen.id || null
      });
      else if (uitkomst && uitkomst.type === 'uncertain') ctx.events.publish('travel.request.uncertain', { tripId: gekozen && gekozen.id || null });
      teken();
    }
    return {
      actions: {
        'travel.open': { run: function () { return ctx.open('/apps/reizen.html#reizen', 'Travel'); } },
        'travel.request.open-flow': { permission: 'travel.read', validate: function (p) { return !p.tripId || !!vind(p.tripId); },
          run: function (p) { return ctx.open('/apps/reisbureau.html' + (p.tripId ? '?reis=' + encodeURIComponent(p.tripId) : ''), 'RTG-reisbureau'); } },
        'travel.request.review': { permission: 'travel.manage', inputSchema: 'travel.request.input.v1',
          validate: function (p) { return !!(gekozen && p.tripId === gekozen.id && p.participants >= 1 && p.participants <= 20); },
          run: function (p) { return controller.review({ date: p.date, participants: p.participants, note: p.note }); } },
        'travel.request.submit': { permission: 'travel.manage', confirm: 'Deze reisaanvraag versturen?', audit: true,
          inputSchema: 'travel.request.input.v1', validate: function (p) { return !!(gekozen && p.tripId === gekozen.id && p.participants >= 1 && p.participants <= 20); },
          run: function (p) { return controller.submit({ date: p.date, participants: p.participants, note: p.note }).then(function (x) { verwerk(x); return x; }); } },
        'travel.request.check': { permission: 'travel.manage', inputSchema: 'travel.request.check.v1',
          validate: function (p) { return !!(gekozen && p.tripId === gekozen.id); },
          run: function () { return controller.check().then(function (x) { verwerk(x); return x; }); } },
        'travel.driver.attach': { permission: 'travel.manage', confirm: 'Chauffeurdetails aan deze reis toevoegen?', audit: true,
          inputSchema: 'travel.driver.attach.v1', validate: function (p) { return !!p.conversationId; },
          run: function (p) { var attached = { conversationId: p.conversationId, preview: String(p.preview || '').slice(0, 180) };
            ctx.state.set({ suggestion: null, driverContext: attached }, 'driver-attached'); suggestion = null;
            ctx.events.publish('travel.driver.attached', attached); teken(); return { ok: true, driverContext: attached }; } }
      },
      mount: function (body) { root = d.createElement('div'); root.className = 'rtg-module-travel'; body.appendChild(root); teken(); },
      render: function (s) { state = s; if (s !== 'peek') { laadDossier(); laadCatalogus(); } teken(); },
      onEvent: function (event) { suggestion = event.payload || null; ctx.state.set({ suggestion: suggestion }, 'driver-detected'); teken(); },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-rtg-travel-action]'); if (!b || !root.contains(b)) return false;
        var actie = b.dataset.rtgTravelAction, payload = Object.assign({ tripId: gekozen && gekozen.id || '' }, invoer());
        if (actie === 'open') ctx.actions.run('travel.open', {}).catch(function () {});
        else if (actie === 'open-flow') ctx.actions.run('travel.request.open-flow', openFlowPayload()).catch(function () {});
        else if (actie === 'attach-driver' && suggestion) ctx.actions.run('travel.driver.attach', suggestion).catch(function () {});
        else if (actie === 'choose') { gekozen = vind(b.dataset.rtgTravelTrip); requestResult = null; draft = { date: '', participants: 2, note: '' };
          if (gekozen) controller.open(gekozen); teken(); focusLater('[data-rtg-travel-input="date"]'); }
        else if (actie === 'back-catalog') { gekozen = null; requestResult = null; teken(); focusLater('[data-rtg-travel-action="choose"]'); }
        else if (actie === 'minus' || actie === 'plus') { draft.participants = Math.max(1, Math.min(20, draft.participants + (actie === 'plus' ? 1 : -1))); controller.edit(); teken(); }
        else if (actie === 'edit') { controller.edit(); requestResult = null; teken(); focusLater('[data-rtg-travel-input="date"]'); }
        else if (actie === 'review') ctx.actions.run('travel.request.review', payload).then(function (x) {
          requestResult = x; teken(); if (x && x.ok) focusLater('[data-rtg-travel-action="submit"]');
        }).catch(function () {});
        else if (actie === 'submit') ctx.actions.run('travel.request.submit', payload).catch(function () {});
        else if (actie === 'check') ctx.actions.run('travel.request.check', { tripId: payload.tripId }).catch(function () {});
        return true;
      },
      destroy: function () { if (stop) stop.abort(); root = null; }
    };
  }));
})(window, document);
