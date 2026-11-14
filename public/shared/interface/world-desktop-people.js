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
        var destinationLink = document.createElement('a'); destinationLink.className = 'wd-person'; destinationLink.textContent = text; destinationLink.href = url;
        destinationLink.onclick = function (e) { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); ctx.open(url, title || text || UI.value('messages')); }; return destinationLink;
      }
      function draw() {
        if (!root) return; root.textContent = ''; root.dataset.state = state;
        if (state !== 'ready') { var message = UI.copy(UI.el('p', 'wd-muted'), state);
          message.setAttribute('role', 'status'); root.appendChild(message); }
        if (state === 'error') root.appendChild(UI.button('retry', load, 'wd-text-button'));
        rows.forEach(function (row) {
          var rowUrl = family ? '/apps/foundation/vrienden.html' : '/apps/comm.html?gesprek=' + encodeURIComponent(row.id);
          if (typeof row.link === 'string' && /^\/apps\/comm\.html(?:[?#][a-zA-Z0-9._~%=&+-]+)?$/.test(row.link)) rowUrl = row.link;
          var rowLink = link('', rowUrl, row.titel), avatar = UI.el('span', 'wd-avatar');
          avatar.textContent = String(row.titel || '').trim().slice(0, 1).toUpperCase();
          avatar.setAttribute('aria-hidden', 'true'); rowLink.appendChild(avatar);
          var body = UI.el('span'); body.dataset.userContent = ''; body.translate = false;
          body.appendChild(UI.el('strong', '', row.titel || UI.value('messages')));
          if (row.laatste) body.appendChild(UI.el('span', 'wd-muted', String(row.laatste).slice(0, 160)));
          rowLink.appendChild(body); root.appendChild(rowLink);
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
          'desktop.layout.save': { run: function (p) {
            if (!ctx.session.unchanged()) return Promise.reject(new Error('session-changed'));
            return ctx.request('/api/ik/workspace/zet', { scope: world, idem: p.idem,
              workspace: { order: p.order, hidden: [], active: null, density: 'comfortable' } }).then(function (j) {
              if (!ctx.session.unchanged()) throw new Error('session-changed');
              if (!j || j.ok !== true || !j.workspace || !Array.isArray(j.workspace.order)) throw new Error('invalid-workspace');
              return j;
            });
          } }
        },
        destroy: function () { abort.abort(); d.removeEventListener('rtg-widget-changed', changed); root = null; }
      };
    });
  };
})(window, document);
