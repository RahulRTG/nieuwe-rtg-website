/* Approved warm desktop/mobile composition; domain DOM and actions survive. */
(function (w, d) {
  'use strict';
  var U, world, P;
  var content = {
    living: ['LIVING · VANDAAG', 'Dichtbij begint hier.', 'Ontdek uw omgeving', '/apps/navigatie.html', 'Uit uw Saloon', 'Een nieuw perspectief op dichtbij', '/apps/wereld.html', '/images/editorial/moment-family-support.webp'],
    work: ['WORK · VANDAAG', 'Maak ruimte voor focus.', 'Open uw werkruimte', '/apps/werkruimte.html', 'Uw werkruimte', 'Ruimte voor uw plannen', '/apps/werkruimte.html', '/images/world-homes/work.webp'],
    travel: ['TRAVEL · ONTDEKKEN', 'De ruimte om te ontdekken.', 'Bekijk uw reis', '/apps/reizen.html#reisoverzicht', 'Uw reis in het kort', 'Alles op één plek', '/apps/reisboek.html', '/images/world-homes/living-coast.webp'],
    foundation: ['FOUNDATION · SAMEN', 'Ruimte om verder te komen.', 'Ontdek wat bij u past', '/apps/foundation/meedoen-ontdekken.html', 'In uw buurt', 'Samen aan de slag', '/apps/foundation/meedoen-ontdekken.html', '/images/world-homes/foundation.webp']
  };
  function photo(src, key, label, cls) {
    var box = U.el('div', cls), img = U.el('img'), base = d.querySelector('meta[name="rtg-asset-base"]');
    img.src = new URL(src.slice(1), new URL(((base && base.content) || '/').replace(/\/?$/, '/'), d.baseURI)).href; img.alt = ''; img.width = 1536; img.height = 768;
    box.appendChild(img); if (P) P.register(img, key, label); return box;
  }
  function tabs(root, home, people, favorites) {
    var nav = U.el('nav', 'wp-tabs'); nav.setAttribute('aria-label', 'Onderdelen van deze wereld');
    var names = d.body.dataset.publicPlatform ? ['Verhalen', 'Contact', 'Onderwerpen'] : { living: ['Dichtbij', 'Uw mensen', 'Bewaard'], work: ['Werkruimtes', 'Uw team', 'Vandaag'], travel: ['Overzicht', 'Reisgezelschap', 'Voor vertrek'], foundation: ['Samen leren', 'Uw omgeving', 'Vandaag'] }[world];
    [home, people, favorites].forEach(function (panel, i) {
      panel.id = panel.id || 'wp-panel-' + i; var b = U.el('button', '', names[i]); b.type = 'button'; b.setAttribute('aria-controls', panel.id);
      b.prepend(U.icon(i === 0 ? (world === 'living' ? 'pin' : 'grid') : i === 1 ? 'people' : 'bookmark'));
      b.setAttribute('aria-expanded', String(i === 0)); b.onclick = function () {
        root.dataset.mobilePanel = ['home', 'people', 'favorites'][i];
        nav.querySelectorAll('button').forEach(function (other) { other.setAttribute('aria-expanded', String(other === b)); });
      }; nav.appendChild(b);
    }); root.dataset.mobilePanel = 'home'; root.appendChild(nav);
  }
  function homeScene(home, root) {
    var c = content[world], details = U.el('details', 'wp-domain'), summary = U.el('summary', '', 'Uw volledige overzicht');
    var native = U.el('div', 'wp-domain-content'); while (home.firstChild) native.appendChild(home.firstChild);
    details.append(summary, native); details.id = 'reisoverzicht';
    if (d.body.classList.contains('saloon-leest')) details.open = true;
    var scene = U.el('section', 'wp-scene'), heading = U.el('div', 'wp-heading'), overline = U.el('p', 'wp-overline', c[0]), title = U.el('h2', '', c[1]);
    var link = U.el('a', 'wp-action', c[2] + ' ↗'); link.href = c[3];
    if (world === 'travel') link.onclick = function () { details.open = true; };
    heading.append(overline, title); scene.append(heading, photo('/images/world-homes/' + world + '-warm.jpg', 'hoofd', 'Hoofdfoto', 'wp-photo'), link);
    if (world === 'foundation') scene.appendChild(U.copy(U.el('p', 'wp-free'), 'free'));
    var story = U.el('section', 'wp-story'), label = U.el('p', 'wp-overline', c[4]), a = U.el('a', '', c[5] + ' ↗'); a.href = c[6];
    if (world === 'living') { a.href = '#reisoverzicht'; a.onclick = function () { details.open = true; }; }
    story.append(label, photo(c[7], 'beeld-00000001', 'Verhaalbeeld', 'wd-app-photo'), a);
    home.append(scene); root.append(story, details); home.dataset.warmHome = 'true';
    function revealTarget() {
      var key; try { key = decodeURIComponent(w.location.hash.slice(1)); } catch (_) { return; }
      var target = key && d.getElementById(key);
      if (target && details.contains(target)) details.open = true;
      if (key && Array.from(native.querySelectorAll('[data-blad]')).some(function (el) { return el.dataset.blad === key; })) details.open = true;
      if (native.querySelector('.living-load-error,#stadmelding')) details.open = true;
      // Een gekozen persoonlijke werklijst blijft zichtbaar in de warme schil.
      if (world === 'living' && ['mijn', 'actie'].includes(d.body.dataset.saloonView)) details.open = true;
    }
    revealTarget(); w.addEventListener('hashchange', revealTarget);
    var feedWatch = new MutationObserver(revealTarget); feedWatch.observe(native, { childList: true, subtree: true });
    w.addEventListener('pagehide', function () { feedWatch.disconnect(); });
    // Reuse the actual screen, including listeners and unsaved state. A small
    // viewport must not put a second home in front of the domain's own home.
    return function (wide) {
      var from = wide ? home : native, to = wide ? native : home;
      Array.from(from.childNodes).forEach(function (node) {
        if (node !== scene) w.RTGDesktopSurface.move(to, node);
      });
    };
  }
  function responsive(o, scene) {
    // Public storytelling already is the content surface, not a domain wrapper.
    if (d.body.dataset.publicPlatform) return;
    var viewport = w.matchMedia('(min-width:1000px)');
    function sync() {
      if (viewport.matches) d.body.dataset.rtgDesktop = world;
      else delete d.body.dataset.rtgDesktop;
      d.body.dataset.rtgShell = viewport.matches ? 'desktop' : 'mobile';
      if (scene) scene(viewport.matches);
    }
    sync(); viewport.addEventListener('change', sync);
    w.addEventListener('pagehide', function (event) {
      if (!event.persisted) viewport.removeEventListener('change', sync);
    });
  }
  function start(o) {
    U = w.RTGDesktopUI; world = d.body.dataset.rtgWorld; P = w.RTGPersonalImages;
    if (!content[world]) return;
    var atmosphere = photo('/images/world-homes/' + world + '-sfeer.jpg', 'sfeer', 'Sfeerbeeld', 'wp-atmosphere'); d.body.appendChild(atmosphere);
    tabs(o.root, o.home, o.people, o.favorites);
    var scene = d.body.dataset.worldHome && !d.body.dataset.publicPlatform ? homeScene(o.home, o.root) : null;
    responsive(o, scene);
    function toolbar() {
      var top = d.querySelector('.rtg-edge-top'); if (!P || !top || top.querySelector('.wp-edit-images')) return;
      var b = U.el('button', 'wp-edit-images'); b.append(U.icon('camera'), U.el('span', '', 'Beelden aanpassen')); b.type = 'button'; b.onclick = function () { w.RTGPersonalImageEditor.open(world + '/hoofd'); };
      b.setAttribute('aria-label', 'Beelden aanpassen'); top.appendChild(b);
    }
    toolbar(); var observer = new MutationObserver(toolbar); observer.observe(d.body, { childList: true, subtree: true });
    if (P) P.start(); w.addEventListener('pagehide', function () { observer.disconnect(); });
  }
  w.RTGWorldPresentation = { start: start };
})(window, document);
