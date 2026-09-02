/* Safety als L4 Living Module. De surface leest het echte veiligheidsbeeld;
   een server-side ritwacht start alleen na een afzonderlijk policybesluit. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK) return;
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function button(tekst, actie) { var b = el('button', 'rtg-module-primary', tekst); b.type = 'button'; b.dataset.rtgSafetyAction = actie; return b; }
  SDK.add(SDK.define({
    id: 'safety', name: 'RTG Veilig', version: '2.0.0', maturity: 'L4', runtime: { minVersion: '0.1.0' }, priority: 60,
    states: SDK.states, surfaces: { peek: true, panel: true, workspace: true, focus: true },
    capabilities: ['safety.read', 'safety.respond', 'notifications'], services: ['dom-veiligheid'],
    permissions: ['safety.read', 'safety.respond'],
    actions: ['safety.open', 'safety.monitoring.start'],
    events: { publishes: ['safety.trip-monitoring.started', 'safety.loaded', 'safety.incident.started'],
      subscribes: ['travel.driver.attached'] },
    state: { persistence: 'session', schema: 'safety.state.v1' }, performance: { peekBudgetKb: 35, panelBudgetKb: 140 }
  }, function (ctx) {
    var root, state = 'peek', beeld = null, suggestion = null, bezig = false;
    var stop = typeof AbortController === 'function' ? new AbortController() : null;
    function laad() {
      if (bezig || beeld) return; bezig = true; ctx.setStatus('laden', 'busy');
      ctx.request('/api/veiligheid', {}, { signal: stop && stop.signal }).then(function (j) {
        beeld = j || {}; var actief = beeld.wachten && Array.isArray(beeld.wachten.lopend) ? beeld.wachten.lopend.length : 0;
        ctx.setStatus(actief ? 'waakt' : 'alles rustig', actief ? 'ok' : 'quiet');
        ctx.events.publish('safety.loaded', { activeWatches: actief, incidents: Array.isArray(beeld.voorMij) ? beeld.voorMij.length : 0 }); teken();
      }).catch(function (e) { if (e.name !== 'AbortError') { beeld = {}; ctx.setStatus('offline', 'warning'); teken(); } }).finally(function () { bezig = false; });
    }
    function teken() {
      if (!root) return; root.textContent = '';
      var actief = beeld && beeld.wachten && Array.isArray(beeld.wachten.lopend) ? beeld.wachten.lopend : [];
      var kaart = el('div', 'rtg-module-summary'); kaart.appendChild(el('strong', '', actief.length ? 'Ritmonitoring actief' : 'Alles rustig'));
      if (state !== 'peek') kaart.appendChild(el('span', '', actief.length ? actief.length + ' actieve wacht' : 'Geen actieve wacht of melding.'));
      root.appendChild(kaart);
      if (suggestion) { var s = el('div', 'rtg-module-suggestion'); s.appendChild(el('strong', '', 'Reisbeveiliging klaarzetten'));
        s.appendChild(el('p', 'rtg-ss-quiet', 'Start een server-side wacht voor deze rit. Uw kring wordt alleen gewaarschuwd als u niet incheckt.'));
        s.appendChild(button('Start ritmonitoring', 'monitor')); root.appendChild(s); }
      root.appendChild(button(state === 'focus' ? 'Open volledig veiligheidscentrum' : 'Open Veiligheid', 'open'));
    }
    return {
      actions: {
        'safety.open': { run: function () { return ctx.open('/apps/veilig.html', 'RTG Veilig'); } },
        'safety.monitoring.start': { permission: 'safety.respond', confirm: 'Ritmonitoring voor twee uur starten?', offline: false, audit: true,
          inputSchema: 'safety.monitoring.start.v1', validate: function (p) { return !p.minutes || Number(p.minutes) > 0; },
          run: function (p) { return ctx.request('/api/veiligheid/wacht/start', { soort: 'thuis', minuten: Number(p.minutes) || 120,
            marge: 10, label: 'Ritmonitoring', deelLocatie: true }).then(function (j) { beeld = null; suggestion = null;
              ctx.state.set({ monitoringId: j.wacht && j.wacht.id || null }, 'monitoring-started');
              ctx.events.publish('safety.trip-monitoring.started', { watchId: j.wacht && j.wacht.id || null }); laad(); return j; }); } }
      },
      mount: function (body) { root = el('div', 'rtg-module-safety'); body.appendChild(root); teken(); },
      render: function (s) { state = s; if (s !== 'peek') laad(); teken(); },
      onEvent: function (event) { suggestion = event.payload || {}; teken(); },
      handle: function (target) { var b = target && target.closest && target.closest('[data-rtg-safety-action]');
        if (!b || !root.contains(b)) return false;
        if (b.dataset.rtgSafetyAction === 'monitor') ctx.actions.run('safety.monitoring.start', { minutes: 120 }).catch(function () {});
        else ctx.actions.run('safety.open', {}).catch(function () {}); return true; },
      destroy: function () { if (stop) stop.abort(); root = null; }
    };
  }));
})(window, document);
