/* DE EERSTE RTG LIVING MODULES.

   Alle definities lopen door Module SDK. De Workspace Runtime tekent de kaart,
   titel, state en aanpasbediening; hier staat alleen domeininhoud. Travel,
   Veiligheid, Contacten en Dashboard beginnen eerlijk via de legacy-adapter en
   kunnen later onder hetzelfde id native worden zonder iemands ruimte te breken. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK, legacy = w.RTGWorkspaceLegacy;
  if (!SDK || !legacy) return;

  function el(tag, cls, tekst) {
    var n = d.createElement(tag); if (cls) n.className = cls;
    if (tekst != null) n.textContent = tekst; return n;
  }
  function button(tekst, cls) { var b = el('button', cls, tekst); b.type = 'button'; return b; }
  function initialen(u) {
    var t = u.full || u.name || u.codename || u.email || '';
    return t.split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase() || 'RTG';
  }
  function tijd(at) {
    if (!at) return '';
    try { return new Date(at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  SDK.add(SDK.define({
    id: 'profile', title: 'Profiel', version: 1, source: 'native', priority: 10,
    states: SDK.states, capabilities: ['identity.read'], services: ['tg-account'], permissions: [], actions: [],
    events: { publishes: ['profile.loaded'], subscribes: [] }
  }, function (ctx) {
    var root, geladen = false, bezig = false, stop = typeof AbortController === 'function' ? new AbortController() : null;
    function laad() {
      if (geladen || bezig) return; bezig = true; ctx.setStatus('laden', 'busy');
      ctx.request('/api/auth/me', {}, { signal: stop && stop.signal }).then(function (j) {
        if (!root || !j.user) return; var u = j.user; root.textContent = '';
        root.appendChild(el('span', 'rtg-ss-avatar', initialen(u)));
        var tekst = el('div', 'rtg-ss-profile-copy');
        tekst.appendChild(el('strong', '', u.full || u.name || u.codename || 'RTG-lid'));
        var sub = [u.codename, u.tier].filter(Boolean).join(' · '); if (sub) tekst.appendChild(el('span', '', sub));
        if (u.emailVerified === true) tekst.appendChild(el('span', 'rtg-ss-ok', 'Profiel geverifieerd'));
        root.appendChild(tekst); geladen = true; ctx.setStatus('live', 'ok');
        ctx.events.publish('profile.loaded', { verified: u.emailVerified === true, tier: u.tier || null });
      }).catch(function (e) {
        if (!root || e.name === 'AbortError') return; root.textContent = '';
        root.appendChild(el('p', 'rtg-ss-quiet', 'Profielstatus niet beschikbaar.')); ctx.setStatus('offline', 'warning');
      }).finally(function () { bezig = false; });
    }
    return {
      mount: function (body) { root = el('div', 'rtg-ss-profile'); root.appendChild(el('p', 'rtg-ss-quiet', 'Profiel wordt zichtbaar wanneer u de werklaag opent.')); body.appendChild(root); },
      render: function (state) { if (state !== 'peek') laad(); },
      destroy: function () { root = null; if (stop) stop.abort(); }
    };
  }));

  SDK.add(SDK.define({
    id: 'context', title: 'Nu relevant', version: 1, source: 'native', priority: 20,
    states: SDK.states, capabilities: ['context.read', 'context.execute'], permissions: [],
    actions: ['context.execute'], events: { publishes: ['context.updated'], subscribes: [] }
  }, function (ctx) {
    var root, laatste = null, af = null, A = w.RTGAdaptief;
    function teken(c) {
      laatste = c || {}; if (!root) return; root.textContent = '';
      if (laatste.titel) root.appendChild(el('strong', '', laatste.titel));
      var items = A && A.voorNu ? A.voorNu() : [];
      (Array.isArray(items) ? items : []).slice(0, 4).forEach(function (x) {
        if (!x || !(x.label || x.naam)) return;
        var b = button(x.label || x.naam, 'rtg-ss-context-action'); b.dataset.ssContextId = x.id; root.appendChild(b);
      });
      if (!root.childNodes.length) root.appendChild(el('p', 'rtg-ss-quiet', 'Geen actuele context.'));
      ctx.setStatus(items.length ? 'actueel' : 'rustig', items.length ? 'ok' : 'quiet');
      ctx.events.publish('context.updated', { title: laatste.titel || null, source: laatste.bron || null,
        actions: (laatste.acties || []).slice(0, 12) });
    }
    function laatsteContext() { return (A && A.context && A.context()) || laatste || {}; }
    return {
      actions: { 'context.execute': { run: function (p) { if (A && A.doe) return A.doe(String(p.id || '')); } } },
      mount: function (body) {
        root = el('div', 'rtg-ss-context'); body.appendChild(root); teken(laatsteContext());
        if (A && A.opContext) af = A.opContext(teken);
      },
      render: function () { teken(laatsteContext()); },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-ss-context-id]'); if (!b || !root.contains(b)) return false;
        ctx.actions.run('context.execute', { id: b.dataset.ssContextId }).catch(function () {}); return true;
      },
      destroy: function () { if (af) af(); root = null; }
    };
  }));

  SDK.add(SDK.define({
    id: 'messages', title: 'Berichten', version: '2.0.0', source: 'native', maturity: 'L4', priority: 30,
    runtime: { minVersion: '0.1.0' }, states: SDK.states, capabilities: ['messages.read', 'messages.open'], permissions: [],
    actions: ['messages.open'], services: ['kern-comm'], state: { persistence: 'session', schema: 'messages.state.v1' },
    performance: { peekBudgetKb: 30, panelBudgetKb: 120 },
    events: { publishes: ['messages.loaded', 'messages.driver-details.detected'], subscribes: ['context.updated'] }
  }, function (ctx) {
    var root, geladen = false, bezig = false, state = 'panel';
    var stop = typeof AbortController === 'function' ? new AbortController() : null, gesprekken = [];
    function teken() {
      if (!root) return; root.textContent = '';
      if (!geladen) { root.appendChild(el('p', 'rtg-ss-quiet', bezig ? 'Berichten laden…' : 'Open de werklaag om berichten te laden.')); return; }
      var max = state === 'panel' ? 3 : 6, lijst = gesprekken.slice(0, max);
      if (!lijst.length) root.appendChild(el('p', 'rtg-ss-quiet', 'Nog geen gesprekken.'));
      lijst.forEach(function (x) {
        var b = button('', 'rtg-ss-message'); b.dataset.ssUrl = x.link || '/apps/comm.html';
        b.appendChild(el('strong', '', x.titel || 'Gesprek'));
        if (x.laatste) b.appendChild(el('span', '', x.laatste));
        var meta = [tijd(x.at), x.ongelezen ? x.ongelezen + ' ongelezen' : ''].filter(Boolean).join(' · ');
        if (meta) b.appendChild(el('small', '', meta)); root.appendChild(b);
      });
      var alles = button(state === 'focus' ? 'Open volledige Messenger' : 'Alle berichten', 'rtg-ss-more');
      alles.dataset.ssUrl = '/apps/comm.html'; root.appendChild(alles);
    }
    function laad() {
      if (geladen || bezig) return; bezig = true; teken(); ctx.setStatus('laden', 'busy');
      ctx.request('/api/comm/inbox', {}, { signal: stop && stop.signal }).then(function (j) {
        gesprekken = Array.isArray(j.gesprekken) ? j.gesprekken : []; geladen = true;
        ctx.setStatus(gesprekken.length ? 'live' : 'leeg', gesprekken.length ? 'ok' : 'quiet');
        ctx.events.publish('messages.loaded', { count: gesprekken.length, unread: Number(j.ongelezen) || 0 });
        var rit = gesprekken.find(function (x) { return /chauffeur|driver|kenteken|ophalen/i.test(String(x.laatste || '')); });
        if (rit) ctx.events.publish('messages.driver-details.detected', {
          conversationId: String(rit.id || rit.ref || rit.link || ''), preview: String(rit.laatste || '').slice(0, 180)
        });
        teken();
      }).catch(function (e) {
        if (e.name === 'AbortError') return; geladen = true; gesprekken = []; ctx.setStatus('offline', 'warning'); teken();
      }).finally(function () { bezig = false; });
    }
    return {
      actions: { 'messages.open': { run: function (p) { return ctx.open(p.url || '/apps/comm.html', p.title || 'Berichten'); } } },
      mount: function (body) { root = el('div', 'rtg-ss-messages'); body.appendChild(root); teken(); },
      render: function (s) { state = s; if (s !== 'peek') laad(); teken(); },
      onEvent: function () { /* Context mag rangschikken, niet zonder keuze een gesprek openen. */ },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-ss-url]'); if (!b || !root.contains(b)) return false;
        ctx.actions.run('messages.open', { url: b.dataset.ssUrl, title: (b.querySelector('strong') || b).textContent.trim() }).catch(function () {}); return true;
      },
      destroy: function () { root = null; if (stop) stop.abort(); }
    };
  }));

  SDK.add(SDK.define({
    id: 'navigation', title: 'Werelden', version: 1, source: 'native', priority: 40,
    states: SDK.states, capabilities: ['navigation.read'], permissions: [], actions: [],
    events: { publishes: [], subscribes: [] }
  }, function (ctx) {
    return { mount: function (body) { var nav = ctx.services.navigation;
      body.appendChild(nav || el('p', 'rtg-ss-quiet', 'Navigatie niet beschikbaar.')); } };
  }));

  [
    [{ id: 'contacts', title: 'Contacten', version: 1, priority: 70, defaultHidden: true, states: SDK.states,
      capabilities: ['contacts.read'], permissions: [], events: { publishes: [], subscribes: [] } },
      { url: '/apps/comm.html', label: 'Open Contacten', description: 'Uw netwerk en gesprekken als onderdeel van dezelfde werkruimte.' }],
    [{ id: 'dashboard', title: 'Dashboard', version: 1, priority: 80, defaultHidden: true, states: SDK.states,
      capabilities: ['dashboard.read'], permissions: [], events: { publishes: [], subscribes: [] } },
      { url: '/apps/pulse.html', label: 'Open Dashboard', description: 'De actuele stand van RTG, op dezelfde plek en in dezelfde interactietaal.' }]
  ].forEach(function (x) { SDK.add(legacy(x[0], x[1])); });
})(window, document);
