/* Travel als L4 Living Module: echte dossierdata, contextuele chauffeursuggestie
   en een bevestigde Action Broker-overgang. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK) return;
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function button(tekst, actie) { var b = el('button', 'rtg-module-primary', tekst); b.type = 'button'; b.dataset.rtgTravelAction = actie; return b; }
  SDK.add(SDK.define({
    id: 'travel', name: 'Travel', version: '3.2.0', maturity: 'L4', runtime: { minVersion: '0.1.0' }, priority: 50,
    states: SDK.states, surfaces: { peek: true, panel: true, workspace: true, focus: true },
    capabilities: ['location.read', 'calendar.read', 'payments.request', 'notifications'],
    permissions: ['travel.read', 'travel.manage'], services: ['member', 'dom-reisbureau', 'mobiliteit', 'bk-reiswijzer'],
    actions: ['travel.open', 'travel.driver.attach'],
    events: { publishes: ['travel.driver.attached', 'travel.loaded'], subscribes: ['messages.driver-details.detected'] },
    state: { persistence: 'session', schema: 'travel.state.v1' }, performance: { peekBudgetKb: 40, panelBudgetKb: 150 }
  }, function (ctx) {
    var root, state = 'peek', dossier = null, suggestion = ctx.state.get().suggestion || null, bezig = false;
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    function laad() {
      if (bezig || dossier) return; bezig = true; ctx.setStatus('laden', 'busy');
      ctx.request('/api/member/huis/dossier', {}, { signal: stop && stop.signal }).then(function (j) {
        dossier = j || {}; ctx.setStatus(dossier.reis ? 'live' : 'geen reis', dossier.reis ? 'ok' : 'quiet');
        ctx.events.publish('travel.loaded', { hasTrip: !!dossier.reis, openItems: Array.isArray(dossier.open) ? dossier.open.length : 0 }); teken();
      }).catch(function (e) { if (e.name !== 'AbortError') { dossier = {}; ctx.setStatus('offline', 'warning'); teken(); } }).finally(function () { bezig = false; });
    }
    function teken() {
      if (!root) return; root.textContent = '';
      if (suggestion) {
        var card = el('div', 'rtg-module-suggestion'); card.appendChild(el('strong', '', 'Chauffeurdetails ontvangen'));
        card.appendChild(el('p', 'rtg-ss-quiet', suggestion.preview || 'Details uit Berichten zijn klaar om aan deze reis toe te voegen.'));
        card.appendChild(button('Toevoegen aan rit', 'attach-driver')); root.appendChild(card);
      }
      if (!dossier) root.appendChild(el('p', 'rtg-ss-quiet', bezig ? 'Reisdossier laden…' : 'Open de werklaag om uw reisdossier te laden.'));
      else if (!dossier.reis) root.appendChild(el('p', 'rtg-ss-quiet', 'Er staat nog geen reis in uw dossier.'));
      else {
        var r = dossier.reis, kaart = el('div', 'rtg-module-summary'); kaart.appendChild(el('strong', '', r.bestemming || 'Komende reis'));
        if (r.datums) kaart.appendChild(el('span', '', r.datums));
        if (state !== 'peek') kaart.appendChild(el('small', '', (Number(dossier.bevestigd) || 0) + ' bevestigd · ' +
          (Array.isArray(dossier.open) ? dossier.open.length : 0) + ' vraagt aandacht'));
        root.appendChild(kaart);
      }
      var open = button(state === 'focus' ? 'Open volledige Travel Workspace' : 'Open Travel', 'open');
      open.dataset.ssUrl = '/apps/reizen.html#reizen'; root.appendChild(open);
    }
    return {
      actions: {
        'travel.open': { run: function () { return ctx.open('/apps/reizen.html#reizen', 'Travel'); } },
        'travel.driver.attach': { permission: 'travel.manage', confirm: 'Chauffeurdetails aan deze reis toevoegen?', audit: true,
          inputSchema: 'travel.driver.attach.v1', validate: function (p) { return !!p.conversationId; },
          run: function (p) { var attached = { conversationId: p.conversationId, preview: String(p.preview || '').slice(0, 180) };
            ctx.state.set({ suggestion: null, driverContext: attached }, 'driver-attached'); suggestion = null;
            ctx.events.publish('travel.driver.attached', attached); teken(); return { ok: true, driverContext: attached }; } }
      },
      mount: function (body) { root = el('div', 'rtg-module-travel'); body.appendChild(root); teken(); },
      render: function (s) { state = s; if (s !== 'peek') laad(); teken(); },
      onEvent: function (event) { suggestion = event.payload || null; ctx.state.set({ suggestion: suggestion }, 'driver-detected'); teken(); },
      handle: function (target) { var b = target && target.closest && target.closest('[data-rtg-travel-action]');
        if (!b || !root.contains(b)) return false;
        if (b.dataset.rtgTravelAction === 'open') ctx.actions.run('travel.open', {}).catch(function () {});
        else if (suggestion) ctx.actions.run('travel.driver.attach', suggestion).catch(function () {}); return true; },
      destroy: function () { if (stop) stop.abort(); root = null; }
    };
  }));
})(window, document);
