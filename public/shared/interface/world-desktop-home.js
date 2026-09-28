/* One desktop composition for all four existing world homes. */
(function (w, d) {
  'use strict';
  function start() {
    var home = d.querySelector('main'), world = d.body.dataset.worldHome, U = w.RTGDesktopUI;
    if (!home || d.querySelector('.wd-shell')) return;
    w.fetch('/shared/interface/world-widget-catalog.json', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('catalog-unavailable'); return r.json();
    }).then(function (catalog) {
      var all = catalog.apps, apps = all.filter(function (a) { return a.worlds.includes(world) &&
        (world !== 'foundation' || a.world === 'foundation' || a.url.includes('pas=foundation')); });
      var root = U.el('div', 'wd-shell'), people = U.label(U.el('aside', 'wd-people'), 'people');
      var favorites = U.label(U.el('aside', 'wd-favorites'), 'favorites'), surface = U.el('section', 'wd-focus');
      var library = U.label(U.el('section', 'wd-library'), 'library'), announcement = U.el('p', 'wd-announcement');
      announcement.setAttribute('role', 'status'); announcement.hidden = true; surface.hidden = true;
      home.before(root); home.classList.add('wd-home'); root.appendChild(people); root.appendChild(home);
      root.appendChild(favorites); root.appendChild(surface); root.appendChild(announcement); root.appendChild(library);
      var frame = w.RTGDesktopFrameHost({ root: root, home: home, favorites: favorites, surface: surface,
        paths: new Set((world === 'foundation' ? apps : all).map(function (a) { return a.url.split(/[?#]/)[0]; })),
        announce: function (text) { announcement.textContent = text; announcement.hidden = false; announcement.scrollIntoView({ block: 'nearest' }); } });
      w.RTGDesktopFrame = frame;
      var runtime = w.RTGWorkspaceRuntime({ workspaceId: 'desktop-' + world,
        request: world === 'foundation' ? function () { return Promise.reject(new Error('signed-out')); } : undefined,
        services: { familyRequest: function (path, body) {
          var s = w.Sessie && w.Sessie.huidig();
          if (!s || !s.token || !s.profiel) return Promise.reject(new Error('signed-out'));
          var data = Object.assign({}, body, { code: s.code, token: s.token });
          if (path.indexOf('/api/foundation/') === 0) return w.Sessie.api(path.slice(15), data);
          if (!['/api/rtf/leerling/dag', '/api/rtf/leren/schrijfsels', '/api/rtf/social/connections'].includes(path)) return Promise.reject(new Error('unknown-family-source'));
          return w.fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data) }).then(function (r) { return r.json().then(function (j) {
              if (!r.ok) { var e = new Error(j.error || 'request-failed'); e.status = r.status; throw e; } return j;
            }); });
        } },
        open: function (url, title) { return frame.open(url, title); } });
      runtime.register(w.RTGDesktopPeople(world)); runtime.register(w.RTGWidgetData.definition());
      runtime.mount(people); runtime.setHidden('desktop.widgets', true); runtime.setState('workspace');
      var greeting = U.el('header', 'wd-greeting'), welcome = U.el('h1'), calendar = U.el('time'), name = '';
      greeting.appendChild(welcome); greeting.appendChild(calendar); greeting.appendChild(U.copy(U.el('p'), world === 'foundation' ? 'free' : 'tagline'));
      root.prepend(greeting);
      function greet() {
        welcome.textContent = ''; welcome.appendChild(U.copy(U.el('span'), 'greeting'));
        if (name) { var personal = U.el('span', '', ', ' + name); personal.dataset.userContent = ''; personal.translate = false; welcome.appendChild(personal); }
        welcome.appendChild(d.createTextNode('.'));
        calendar.textContent = new Intl.DateTimeFormat(d.documentElement.lang || 'nl', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        calendar.dateTime = w.RTGWidgetData.date();
      }
      if (world === 'foundation' && w.Sessie) name = w.Sessie.naam();
      greet();
      if (world !== 'foundation' && w.RTGIdentityRuntime().authenticated()) runtime.execute('desktop.widget.read', { id: 'verificatie' }).then(function (j) {
        name = j.user && (j.user.full || j.user.name || j.user.codename) || ''; greet();
      }).catch(function () {});
      var defaults = { living: ['agenda', 'notities'], travel: ['reizen', 'agenda', 'notities'],
        work: ['agenda', 'notities', 'bestanden'], foundation: ['foundation-agenda', 'foundation-leren', 'foundation-schrijven'] };
      var cards = w.RTGDesktopCards({ world: world, apps: apps, favorites: favorites, library: library, runtime: runtime,
        defaults: defaults[world].filter(function (id) { return apps.some(function (a) { return a.id === id; }); }),
        open: function (app, trigger, action) { runtime.navigation.open(app.url, app.name, 'desktop-catalog'); if (action) frame.prepare(action); } });
      d.body.dataset.rtgDesktop = world;
      function edge() {
        if (!w.RTGAdaptiveEdge) return;
        var brand = d.querySelector('.rtg-edge-mark');
        if (brand && !brand.querySelector('.wd-world-label')) {
          var label = U.el('span', 'wd-world-label', { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS' }[world]);
          label.translate = false; brand.appendChild(label);
        }
      }
      edge();
      // Home hangt aan window en niet aan het model van de Edge: dat begint bij elke start leeg.
      w.addEventListener('rtg-edge-home', function (e) {
        e.preventDefault(); if (frame.isOpen()) frame.collapse(); else { home.scrollIntoView({ block: 'start' }); }
      });
      var watch = new MutationObserver(function () { if (d.body.dataset.rtgAdaptiveReady === 'true') { edge(); watch.disconnect(); } });
      if (d.body.dataset.rtgAdaptiveReady !== 'true') watch.observe(d.body, { attributes: true, attributeFilter: ['data-rtg-adaptive-ready'] });
      w.addEventListener('rtglang', function () { cards.refresh(); runtime.setState('workspace'); edge(); greet(); });
      w.addEventListener('pagehide', function () { watch.disconnect(); runtime.destroy(); });
      w.RTGDesktopHome.current = { runtime: runtime, cards: cards, frame: frame };
    }).catch(function () {
      // Catalog failure does not replace or conceal the functioning world home.
      var shell = d.querySelector('.wd-shell'); if (shell) { shell.before(home); home.hidden = false; shell.remove(); }
      delete d.body.dataset.rtgDesktop;
    });
  }
  w.RTGDesktopHome = { start: start };
})(window, document);
