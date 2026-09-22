/* Keep live previews separate from the library's search and composition. */
(function (w, d) {
  'use strict';
  w.RTGWidgetLive = function (app, root, o) {
    var U = w.RTGDesktopUI, T = w.RTGWidgetCopy, offset = o.state.offset || 0, revision = 0;
    var ui = w.RTGWidgetSurfaces(app, root, { compact: o.compact, open: o.open, days: function () { return offset; },
      offset: function (delta) { offset = Math.max(0, Math.min(28, offset + delta)); o.state.offset = offset; load(false); }, run: o.run,
      changed: function (id) { d.dispatchEvent(new CustomEvent('rtg-widget-changed', { detail: { id: id } })); } });
    var supported = w.RTGWidgetData.supports(app.id);
    root.dataset.widgetLive = supported ? 'true' : 'false';
    function load(fresh) {
      var version = ++revision; root.textContent = ''; root.dataset.state = 'loading';
      root.appendChild(ui.copy('p', 'wd-widget-empty', 'loading'));
      o.run('desktop.widget.read', { id: app.id, offset: offset, fresh: fresh }).then(function (j) {
        if (version !== revision || !root.isConnected) return;
        ui.render(j); root.dataset.state = 'ready';
        var time = U.el('time', 'wd-widget-updated'), at = new Date(j.widgetReadAt); time.dateTime = at.toISOString();
        time.textContent = T('current') + ' ' + new Intl.DateTimeFormat(d.documentElement.lang || 'nl', { hour: '2-digit', minute: '2-digit' }).format(at);
        root.appendChild(time);
      }).catch(function (e) {
        if (version !== revision || !root.isConnected) return;
        var state = e.message === 'signed-out' || e.status === 401 ? 'guest' : e.status === 403 ? 'locked' : 'error';
        root.dataset.state = state; root.textContent = '';
        root.appendChild(U.icon(app.icon)); root.appendChild(ui.copy('p', 'wd-widget-empty', state));
        if (state === 'error') root.appendChild(ui.button('retry', function () { load(true); }));
        else root.appendChild(ui.open());
      });
    }
    function fallback() {
      root.classList.add('wd-capability-' + app.type);
      // A capability has its own identity. A world-wide stock photo neither
      // describes its records nor belongs to every app of the same type.
      var emblem = U.el('div', 'wd-capability-emblem'); emblem.appendChild(U.icon(app.icon)); root.appendChild(emblem);
      if (app.id === 'navigatie') { root.appendChild(ui.copy('p', 'wd-widget-empty', 'noRoute')); root.appendChild(ui.open('route')); return; }
      app.sections.slice(0, 2).forEach(function (s, i) {
        var title = ui.row(s, '', app.icon).querySelector('strong'); delete title.dataset.userContent;
        title.dataset.i18n = 'desktopApp.' + app.id + '.section' + i; title.dataset.i18nSource = s;
      });
      if (!app.sections.length) root.appendChild(ui.copy('p', 'wd-widget-empty', 'empty'));
      root.appendChild(ui.open('browse'));
    }
    function refresh(e) { if (!root.isConnected) return; if (e.detail && e.detail.id === app.id) load(true); }
    if (supported) { load(false); d.addEventListener('rtg-widget-changed', refresh); } else fallback();
    return { destroy: function () { revision++; d.removeEventListener('rtg-widget-changed', refresh); } };
  };
})(window, document);
