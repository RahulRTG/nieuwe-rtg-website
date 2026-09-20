/* Read-only communication projection. The domain owns contacts, permissions
   and sending; the Workspace Runtime owns transport and navigation. */
(function (w, d) {
  'use strict';
  w.RTGDesktopPeople = function (world) {
    var UI = w.RTGDesktopUI, SDK = w.RTGModuleSDK;
    return SDK.define({ id: 'desktop.people', title: UI.value('people'), pinned: true,
      capabilities: ['messages.read', 'messages.open', 'workspace.layout'], services: ['kern-comm', 'tg-account'],
      actions: ['desktop.layout.read', 'desktop.layout.save'], permissions: [], maturity: 'L3'
    }, function (ctx) {
      var root, state = 'loading', rows = [], pending = false, loaded = false;
      var abort = new AbortController();
      function changed(e) { if (e.detail && e.detail.id === 'comm') load(); }
      d.addEventListener('rtg-widget-changed', changed);
      function link(text, url) {
        var a = UI.el('a', 'wd-person', text); a.href = url;
        a.onclick = function (e) { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); ctx.open(url, text); }; return a;
      }
      function draw() {
        if (!root) return; root.textContent = ''; root.dataset.state = state;
        if (state !== 'ready') { var message = UI.copy(UI.el('p', 'wd-muted'), state);
          message.setAttribute('role', 'status'); root.appendChild(message); }
        if (state === 'error') root.appendChild(UI.button('retry', load, 'wd-text-button'));
        rows.forEach(function (row) {
          var a = link('', '/apps/comm.html?gesprek=' + encodeURIComponent(row.id)), avatar = UI.el('span', 'wd-avatar');
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
        root.appendChild(link(UI.value('messages'), state === 'guest' ? '/apps/app.html' : '/apps/comm.html'));
        root.appendChild(UI.copy(UI.el('h4'), world === 'foundation' ? 'family' : 'friends'));
        root.appendChild(link(UI.value(world === 'foundation' ? 'family' : 'friends'),
          world === 'work' ? '/apps/personeel.html' : '/apps/foundation/vrienden.html'));
        if (world === 'foundation') root.appendChild(UI.copy(UI.el('p', 'wd-muted'), 'free'));
      }
      function load() {
        if (pending || !root) return; pending = true; state = 'loading'; rows = []; draw();
        ctx.request('/api/comm/inbox', {}, { signal: abort.signal }).then(function (j) {
          if (!Array.isArray(j.gesprekken)) throw new Error('invalid-inbox');
          rows = j.gesprekken.slice(0, 5); state = rows.length ? 'ready' : 'empty'; loaded = true;
        }).catch(function (e) {
          if (e.name === 'AbortError') return;
          rows = []; state = e.message === 'signed-out' ? 'guest' : 'error'; loaded = true;
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
