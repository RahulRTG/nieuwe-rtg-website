/* Read-only communication projection. The domain owns contacts, permissions
   and sending; the Workspace Runtime owns transport and navigation. */
(function (w, d) {
  'use strict';
  w.RTGDesktopPeople = function (world) {
    var UI = w.RTGDesktopUI, SDK = w.RTGModuleSDK, family = world === 'foundation';
    return SDK.define({ id: 'desktop.people', title: UI.value('people'), pinned: true,
      capabilities: ['messages.read', 'messages.open', 'workspace.layout'], services: ['kern-comm', 'tg-account'],
      actions: ['desktop.layout.read', 'desktop.layout.save'], permissions: [], maturity: 'L3'
    }, function (ctx) {
      var root, state = 'loading', rows = [], pending = false, loaded = false;
      var abort = new AbortController();
      function changed(e) { if (e.detail && e.detail.id === 'comm') load(); }
      d.addEventListener('rtg-widget-changed', changed);
      function link(text, url, title) {
        var a = UI.el('a', 'wd-person', text); a.href = url;
        a.onclick = function (e) { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); ctx.open(url, title || text || UI.value('messages')); }; return a;
      }
      function draw() {
        if (!root) return; root.textContent = ''; root.dataset.state = state;
        if (state !== 'ready') { var message = UI.copy(UI.el('p', 'wd-muted'), state);
          message.setAttribute('role', 'status'); root.appendChild(message); }
        if (state === 'error') root.appendChild(UI.button('retry', load, 'wd-text-button'));
        rows.forEach(function (row) {
          var a = link('', family ? '/apps/foundation/vrienden.html' : '/apps/comm.html?gesprek=' + encodeURIComponent(row.id), row.titel), avatar = UI.el('span', 'wd-avatar');
          avatar.textContent = String(row.titel || '').trim().slice(0, 1).toUpperCase();
          avatar.setAttribute('aria-hidden', 'true'); a.appendChild(avatar);
          var body = UI.el('span'); body.dataset.userContent = ''; body.translate = false;
          body.appendChild(UI.el('strong', '', row.titel || UI.value('messages')));
          if (row.laatste) body.appendChild(UI.el('span', 'wd-muted', String(row.laatste).slice(0, 160)));
          a.appendChild(body); root.appendChild(a);
          // Prefer the canonical conversation deep link, never an arbitrary URL.
          if (typeof row.link === 'string' && /^\/apps\/comm\.html(?:[?#][a-zA-Z0-9._~%=&+-]+)?$/.test(row.link)) {
            a.href = row.link; a.onclick = function (e) { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault(); ctx.open(row.link, row.titel); };
          }
        });
        if (!family) root.appendChild(link(UI.value('messages'), state === 'guest' ? '/apps/app.html' : '/apps/comm.html'));
        root.appendChild(UI.copy(UI.el('h4'), world === 'foundation' ? 'family' : 'friends'));
        root.appendChild(link(UI.value('contacts'),
          world === 'work' ? '/apps/personeel.html' : family ? '/apps/foundation/vrienden.html' : '/apps/mijn-relaties.html'));
        if (world === 'foundation') root.appendChild(UI.copy(UI.el('p', 'wd-muted'), 'free'));
      }
      function load() {
        if (pending || !root) return; pending = true; state = 'loading'; rows = []; draw();
        var request = family ? ctx.services.familyRequest('/api/rtf/social/connections', {}) : ctx.request('/api/comm/inbox', {}, { signal: abort.signal });
        request.then(function (j) {
          var list = family ? j.connections : j.gesprekken;
          if (!Array.isArray(list)) throw new Error('invalid-inbox');
          rows = list.slice(0, 5).map(function (r) { return family ? { titel: r.codename, laatste: r.last } : r; });
          state = rows.length ? 'ready' : family ? 'familyEmpty' : 'empty'; loaded = true;
        }).catch(function (e) {
          if (e.name === 'AbortError') return;
          rows = []; state = e.message === 'signed-out' ? family ? 'familyGuest' : 'guest' : 'error'; loaded = true;
        }).finally(function () { pending = false; draw(); });
      }
      return {
        mount: function (body) { root = UI.el('div', 'wd-people-body'); body.appendChild(root); load(); },
        render: function () { if (loaded) draw(); },
        actions: {
          'desktop.layout.read': { run: function () { return ctx.request('/api/ik/workspace', { scope: world }); } },
          'desktop.layout.save': { run: function (p) { return ctx.request('/api/ik/workspace/zet', { scope: world,
            workspace: { order: p.order, hidden: [], active: null, density: 'comfortable' } }); } }
        },
        destroy: function () { abort.abort(); d.removeEventListener('rtg-widget-changed', changed); root = null; }
      };
    });
  };
})(window, document);
