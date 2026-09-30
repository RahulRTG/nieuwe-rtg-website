/* One desktop composition for every world screen. */
(function (w, d) {
  'use strict';
  function start() {
    if (d.querySelector('.wd-shell')) return;
    var home = w.RTGDesktopSurface.prepare(), world = d.body.dataset.rtgWorld, U = w.RTGDesktopUI;
    if (!home) throw new Error('desktop-content-missing');
    d.body.dataset.rtgDesktop = world;
    d.body.dataset.rtgDesktopState = 'loading';
      var root = U.el('div', 'wd-shell'), people = U.label(U.el('aside', 'wd-people'), 'people');
      var favorites = U.label(U.el('aside', 'wd-favorites'), 'favorites'), surface = U.el('section', 'wd-focus');
      var library = U.label(U.el('section', 'wd-library'), 'library'), announcement = U.el('p', 'wd-announcement');
      announcement.setAttribute('role', 'status'); announcement.hidden = true; surface.hidden = true;
      home.before(root); home.classList.add('wd-home'); root.appendChild(people); w.RTGDesktopSurface.move(root, home);
      root.appendChild(favorites); root.appendChild(surface); root.appendChild(announcement); root.appendChild(library);
      w.RTGDesktopSurface.guard(root, home);
      w.RTGWorldPresentation.start({root:root,home:home,people:people,favorites:favorites});
    var loadingHeader = U.el('header','wd-greeting'), loadingTitle=U.el('h1','',d.title);
    loadingHeader.appendChild(loadingTitle);root.prepend(loadingHeader);
    library.setAttribute('aria-busy','true');
    w.fetch('/shared/interface/world-widget-catalog.json', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('catalog-unavailable'); return r.json();
    }).then(function (catalog) {
      var all = catalog.apps, apps = all.filter(function (a) { return a.worlds.includes(world) &&
        (world !== 'foundation' || a.world === 'foundation' || a.url.includes('pas=foundation')); });
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
      loadingHeader.replaceWith(greeting);
      library.removeAttribute('aria-busy');
      function greet() {
        welcome.textContent = ''; welcome.appendChild(U.copy(U.el('span'), 'greeting'));
        if (name) { var personal = U.el('span', '', ', ' + name); personal.dataset.userContent = ''; personal.translate = false; welcome.appendChild(personal); }
        welcome.appendChild(d.createTextNode('.'));
        if (!d.body.dataset.worldHome) welcome.textContent = d.title.replace(/^(RTG|LivingOS|TravelOS|WorkOS|FoundationOS)\s*[·\u2014:|-]?\s*/, '') || 'RTG';
        calendar.textContent = new Intl.DateTimeFormat(d.documentElement.lang || 'nl', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        calendar.dateTime = w.RTGWidgetData.date();
      }
      if (world === 'foundation' && w.Sessie) name = w.Sessie.naam();
      greet();
      if (world !== 'foundation' && w.RTGIdentityRuntime().authenticated()) runtime.execute('desktop.widget.read', { id: 'verificatie' }).then(function (j) {
        name = j.user && (j.user.full || j.user.name || j.user.codename) || ''; greet();
      }).catch(function () {});
      var defaults = { living: ['agenda', 'notities'], travel: ['reizen', 'agenda', 'notities'],
        work: ['agenda', 'notities'], foundation: ['foundation-agenda', 'foundation-leren'] };
      var cards = w.RTGDesktopCards({ world: world, apps: apps, favorites: favorites, library: library, runtime: runtime,
        defaults: defaults[world].filter(function (id) { return apps.some(function (a) { return a.id === id; }); }),
        open: function (app, trigger, action) { runtime.navigation.open(app.url, app.name, 'desktop-catalog'); if (action) frame.prepare(action); } });
      d.body.dataset.rtgDesktopState = 'ready';
      function edge() {
        if (!w.RTGAdaptiveEdge) return;
        var brand = d.querySelector('.rtg-edge-mark');
        if (brand && !brand.querySelector('.wd-world-label')) {
          var label = U.el('span', 'wd-world-label', { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS' }[world]);
          label.translate = false; brand.appendChild(label);
        }
        var activeLabel = brand && brand.querySelector('.wd-world-label');
        var activeTitle = {living:'LivingOS',work:'WorkOS',travel:'TravelOS',foundation:'FoundationOS'}[d.body.dataset.rtgPalette] || {living:'LivingOS',work:'WorkOS',travel:'TravelOS',foundation:'FoundationOS'}[world];
        if (activeLabel && activeLabel.textContent !== activeTitle) activeLabel.textContent = activeTitle;
      }
      edge();
      // Home hangt aan window en niet aan het model van de Edge: dat begint bij elke start leeg.
      w.addEventListener('rtg-edge-home', function (e) {
        root.dataset.mobilePanel = 'home';
        root.querySelectorAll('.wp-tabs button').forEach(function (b, i) { b.setAttribute('aria-expanded', String(i === 0)); });
        if (frame.isOpen()) { e.preventDefault(); frame.collapse(); }
        else if (d.body.dataset.worldHome) { e.preventDefault(); home.scrollIntoView({ block: 'start' }); }
      });
      var watch = new MutationObserver(edge);
      watch.observe(d.body, { attributes: true, attributeFilter: ['data-rtg-adaptive-ready','data-rtg-palette'] });
      w.addEventListener('rtglang', function () { cards.refresh(); runtime.setState('workspace'); edge(); greet(); });
      w.addEventListener('pagehide', function () { watch.disconnect(); runtime.destroy(); });
      w.RTGDesktopHome.current = { runtime: runtime, cards: cards, frame: frame };
    }).catch(function (error) {
      d.body.dataset.rtgDesktopState = 'error';
      library.removeAttribute('aria-busy');
      announcement.textContent = (d.documentElement.lang === 'en' ? 'The app library could not be loaded.' : 'De appbibliotheek kon niet worden geladen.');
      announcement.hidden = false;
      console.error('RTG desktop: ' + error.message);
    });
  }
  w.RTGDesktopHome = { start: start };
})(window, document);
