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
      b.setAttribute('aria-expanded', String(i === 0)); b.onclick = function () {
        root.dataset.mobilePanel = ['home', 'people', 'favorites'][i];
        nav.querySelectorAll('button').forEach(function (other) { other.setAttribute('aria-expanded', String(other === b)); });
      }; nav.appendChild(b);
    }); root.dataset.mobilePanel = 'home'; root.appendChild(nav);
  }
  function homeScene(home, root) {
    var c = content[world], details = U.el('details', 'wp-domain'), summary = U.el('summary', '', 'Uw volledige overzicht');
    var native = U.el('div', 'wp-domain-content');
    details.append(summary, native); details.id = 'reisoverzicht';
    /* Eerst in het document, dan verhuizen: zo kan moveBefore() de eigen inhoud
       atomisch meenemen (een frame of een lopende invoer herlaadt niet). */
    root.append(details);
    while (home.firstChild) w.RTGDesktopSurface.move(native, home.firstChild);
    var scene = U.el('section', 'wp-scene'), heading = U.el('div', 'wp-heading'), overline = U.el('p', 'wp-overline', c[0]), title = U.el('h2', '', c[1]);
    var link = U.el('a', 'wp-action', c[2] + ' ↗'); link.href = c[3];
    if (world === 'travel') link.onclick = function () { details.open = true; };
    heading.append(overline, title); scene.append(heading, photo('/images/world-homes/' + world + '-warm.jpg', 'hoofd', 'Hoofdfoto', 'wp-photo'), link);
    if (world === 'foundation') scene.appendChild(U.copy(U.el('p', 'wp-free'), 'free'));
    var story = U.el('section', 'wp-story'), label = U.el('p', 'wp-overline', c[4]), a = U.el('a', '', c[5] + ' ↗'); a.href = c[6];
    story.append(label, photo(c[7], 'beeld-00000001', 'Verhaalbeeld', 'wd-app-photo'), a);
    home.append(scene); details.before(story); home.dataset.warmHome = 'true';
    /* Een diepe link (reizen.html#rahul, #samen, een anker) wijst naar een blad
       IN de eigen inhoud, of naar een leesstand die de app zelf herstelt (zoals
       #saloon-artikel, zonder element met die id). Die inhoud staat nu onder het
       overzicht; bleef dat dicht, dan landde de link op de hoofdfoto met het
       gevraagde blad onzichtbaar. Alleen een anker BUITEN de eigen inhoud laat
       het overzicht dicht. */
    function reveal() {
      var h = ''; try { h = decodeURIComponent(w.location.hash.slice(1)); } catch (e) { return; }
      if (!h) return;
      var sel = w.CSS && w.CSS.escape ? w.CSS.escape(h) : h.replace(/[^\w-]/g, '');
      var target = native.querySelector('#' + sel + ',[data-blad="' + sel + '"],[data-tab="' + sel + '"],[data-view="' + sel + '"]');
      var doel = d.getElementById(h);
      if (target || !doel || details.contains(doel)) details.open = true;
    }
    reveal(); w.addEventListener('hashchange', reveal);
    /* Ook een eigen bediening van het huis (een tab uit de verborgen app-balk die
       de Edge doorgeeft, zoals "Wereld" op wereld.html) wisselt een weergave IN
       het overzicht. Een tik door een mens op zo'n bediening opent dat overzicht,
       anders gebeurt er zichtbaar niets. De eigen lagen van het kader (scene,
       verhaal, tabbladen, bibliotheek) en de Edge zelf tellen niet mee, en een
       klik uit een script zonder gebruikersgebaar ook niet: bij het laden blijft
       het overzicht dicht. */
    d.addEventListener('click', function (e) {
      if (details.open || !(e.isTrusted || (w.navigator.userActivation && w.navigator.userActivation.isActive))) return;
      var t = e.target && e.target.closest ? e.target : null;
      if (!t || t.closest('.rtg-edge-chrome,[class*="rtg-adaptive-"],.wp-domain>summary,dialog,[role="dialog"]')) return;
      if (root.contains(t) && !native.contains(t)) return;
      details.open = true;
    }, true);
  }
  function start(o) {
    U = w.RTGDesktopUI; world = d.body.dataset.rtgWorld; P = w.RTGPersonalImages;
    if (!content[world]) return;
    var atmosphere = photo('/images/world-homes/' + world + '-sfeer.jpg', 'sfeer', 'Sfeerbeeld', 'wp-atmosphere'); d.body.appendChild(atmosphere);
    tabs(o.root, o.home, o.people, o.favorites);
    if (d.body.dataset.worldHome && !d.body.dataset.publicPlatform) homeScene(o.home, o.root);
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
