/* Twee gezichten, één hamburger: lokale context en heel RTG blijven in het
   bestaande Edge-menu. De laag verwijst naar echte knoppen en routes; zij
   maakt geen tweede navigatiesysteem. */
(function (w, d) {
  'use strict';

  var actief = null, teller = 0, OPSLAG = 'rtg.edge.recent.v1';

  function tekst(el) {
    var label = el.getAttribute('aria-label') || el.textContent || '';
    return label.replace(/\s+/g, ' ').trim();
  }

  function icoon(naam) {
    var p = w.RTGEdgeIcons && w.RTGEdgeIcons[naam];
    return p ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>' : '';
  }

  function wereldHome() {
    var cfg = w.RTGEdge && w.RTGEdge.active && w.RTGEdge.active.cfg;
    if (!cfg) return false;
    var hier = location.pathname;
    return [cfg.huis, cfg.home].some(function (pad) {
      try { return new URL(pad, location.href).pathname === hier; } catch (fout) { return false; }
    });
  }

  function recent() {
    var nu = location.pathname + location.search + location.hash, vorige = '';
    try { vorige = sessionStorage.getItem(OPSLAG) || ''; sessionStorage.setItem(OPSLAG, nu); } catch (fout) {}
    if (!vorige || vorige === nu || vorige.charAt(0) !== '/') {
      var cfg = w.RTGEdge && w.RTGEdge.active && w.RTGEdge.active.cfg;
      vorige = cfg ? cfg.huis || cfg.home : '/apps/app.html';
    }
    return vorige;
  }

  function bronknoppen(root) {
    var lokaal = Array.from(root.querySelectorAll('.rtg-edge-appslot .rtg-edge-owned-bar a[href],.rtg-edge-appslot .rtg-edge-owned-bar button'));
    if (lokaal.length) return lokaal.slice(0, 3);
    var groepen = Array.from(root.querySelectorAll('.rtg-edge-global-original .rtg-edge-group'));
    var groep = groepen.find(function (g) { return g.querySelector('[aria-current="page"]'); }) || groepen[0];
    return groep ? Array.from(groep.querySelectorAll('a[href]')).slice(0, 3) : [];
  }

  function maakHier(rt) {
    var nav = rt.hier.querySelector('.rtg-edge-here-list');
    nav.textContent = '';
    var command = d.getElementById('rtgCommand');
    if (command && command.__rtgSecondScreen) {
      var ruimte = d.createElement('button'); ruimte.type = 'button'; ruimte.className = 'rtg-edge-here-action';
      ruimte.innerHTML = icoon('people') + '<span>Uw ruimte</span><em aria-hidden="true">›</em>';
      ruimte.addEventListener('click', function () {
        sluit(rt); var deur = rt.root.querySelector('.rtg-edge-menu'); if (deur) deur.focus();
        command.__rtgSecondScreen.setState('panel');
        setTimeout(function () { var x = command.querySelector('.rtg-ss-close'); if (x) x.focus(); }, 0);
      });
      nav.appendChild(ruimte);
    }
    bronknoppen(rt.root).forEach(function (bron, i) {
      var knop = d.createElement('button');
      knop.type = 'button'; knop.className = 'rtg-edge-here-action';
      knop.innerHTML = (bron.querySelector('svg') ? bron.querySelector('svg').outerHTML : icoon(['calendar','home','play'][i] || 'spark')) +
        '<span></span><em aria-hidden="true">›</em>';
      knop.querySelector('span').textContent = tekst(bron) || 'Open';
      if (bron.matches('[aria-current],.is-actief,.actief')) knop.setAttribute('aria-current', 'page');
      knop.addEventListener('click', function () { sluit(rt); bron.click(); });
      nav.appendChild(knop);
    });
    var bank = d.querySelector('#rtgCommand .cmd-lade');
    if (bank) {
      var werk = d.createElement('button'); werk.type = 'button';
      werk.className = 'rtg-edge-here-action'; werk.setAttribute('data-edge-command-bank', '');
      werk.textContent = 'Werelden en werkbladen';
      werk.addEventListener('click', function () { openWerkbladen(rt); });
      nav.appendChild(werk);
    }
    var terug = d.createElement('a');
    terug.className = 'rtg-edge-here-action'; terug.href = recent();
    terug.innerHTML = icoon('replay') + '<span>Recent bezocht</span><em aria-hidden="true">›</em>';
    nav.appendChild(terug);
  }

  function gezicht(rt, naam, focus) {
    naam = naam === 'all' ? 'all' : 'here';
    rt.index.setAttribute('data-edge-face', naam);
    rt.tabs.forEach(function (tab) {
      var aan = tab.getAttribute('data-edge-face') === naam;
      tab.setAttribute('aria-selected', String(aan)); tab.tabIndex = aan ? 0 : -1;
    });
    rt.hier.hidden = naam !== 'here'; rt.alles.hidden = naam !== 'all';
    rt.body.setAttribute('data-rtg-edge-menu-face', naam);
    if (naam === 'here') maakHier(rt);
    if (focus) rt.tabs.find(function (x) { return x.getAttribute('data-edge-face') === naam; }).focus();
  }

  function sluit(rt) {
    var menu = rt.root.querySelector('.rtg-edge-menu');
    if (menu && menu.getAttribute('aria-expanded') === 'true') menu.click();
  }

  function openWerkbladen(rt) {
    sluit(rt);
    rt.root.querySelector('.rtg-edge-menu').focus();
    d.querySelector('#rtgCommand .cmd-lade').click();
    w.requestAnimationFrame(function () {
      var bank = d.querySelector('#rtgCommand.bank-open .cmd-bank');
      if (bank) { bank.tabIndex = -1; bank.focus({ preventScroll: true }); }
    });
  }

  function deur(href, naam, icon, attribuut) {
    return '<a class="rtg-edge-smart-door" href="' + href + '"' + (attribuut || '') + '>' +
      icoon(icon) + '<span>' + naam + '</span><em aria-hidden="true">›</em></a>';
  }
  /* De menupanelen, focus en koppeling aan de bestaande Edge-schil. */
  function bouw(rt) {
    var index = rt.index, oorspronkelijk = index.querySelector('.rtg-edge-index-inner');
    if (!oorspronkelijk || index.querySelector('.rtg-edge-faces')) return false;
    var id = 'rtg-edge-smart-' + (++teller), schaal = d.createElement('div');
    schaal.className = 'rtg-edge-faces';
    schaal.innerHTML = '<div class="rtg-edge-sheet-grip" aria-hidden="true"></div>' +
      '<div class="rtg-edge-face-tabs" role="tablist" aria-label="Menuweergave">' +
      '<button type="button" role="tab" data-edge-face="here">Hier</button>' +
      '<button type="button" role="tab" data-edge-face="all">Heel RTG</button></div>' +
      '<section class="rtg-edge-face rtg-edge-face-here" role="tabpanel" id="' + id + '-here"><h2>Dit scherm</h2>' +
      '<p>Relevant op deze plek</p><nav class="rtg-edge-here-list" aria-label="Functies op deze plek"></nav></section>' +
      '<section class="rtg-edge-face rtg-edge-face-all" role="tabpanel" id="' + id + '-all" hidden><h2>Uw vier werelden</h2>' +
      '<p>Alles van Rahul Travel Group</p><div class="rtg-edge-smart-worlds"></div><nav class="rtg-edge-smart-doors" aria-label="Heel RTG">' +
      deur('/apps/app.html', 'Alle apps', 'grid') +
      '<button type="button" class="rtg-edge-smart-door" data-edge-smart-search>' + icoon('search') + '<span>Zoeken</span><em aria-hidden="true">›</em></button>' +
      deur('/apps/mijn-gegevens.html', 'Profiel &amp; veiligheid', 'people') + '</nav><div class="rtg-edge-global-original"></div></section>';
    index.textContent = ''; index.appendChild(schaal);
    rt.hier = schaal.querySelector('.rtg-edge-face-here');
    rt.alles = schaal.querySelector('.rtg-edge-face-all');
    var werelden = oorspronkelijk.querySelector('.rtg-edge-worlds');
    Array.from(werelden.querySelectorAll('a')).forEach(function (a, i) { a.setAttribute('data-nr', '0' + (i + 1)); });
    rt.alles.querySelector('.rtg-edge-smart-worlds').appendChild(werelden);
    rt.alles.querySelector('.rtg-edge-global-original').appendChild(oorspronkelijk);
    rt.tabs = Array.from(schaal.querySelectorAll('[role="tab"]'));
    rt.tabs[0].id = id + '-tab-here'; rt.tabs[1].id = id + '-tab-all';
    rt.tabs[0].setAttribute('aria-controls', id + '-here'); rt.tabs[1].setAttribute('aria-controls', id + '-all');
    rt.hier.setAttribute('aria-labelledby', rt.tabs[0].id); rt.alles.setAttribute('aria-labelledby', rt.tabs[1].id);
    rt.tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { gezicht(rt, tab.getAttribute('data-edge-face'), false); });
      tab.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        ev.preventDefault(); gezicht(rt, rt.tabs[i ? 0 : 1].getAttribute('data-edge-face'), true);
      });
    });
    if (d.querySelector('#rtgCommand .cmd-lade')) {
      var werk = d.createElement('button'); werk.type = 'button'; werk.className = 'rtg-edge-smart-door';
      werk.setAttribute('data-edge-command-bank', ''); werk.textContent = 'Werelden en werkbladen';
      werk.addEventListener('click', function () { openWerkbladen(rt); });
      rt.alles.querySelector('.rtg-edge-smart-doors').appendChild(werk);
    }
    schaal.querySelector('[data-edge-smart-search]').addEventListener('click', function () {
      rt.alles.setAttribute('data-catalogus-open', 'true');
      var invoer = rt.alles.querySelector('.rtg-edge-find input'); if (invoer) invoer.focus();
    });
    schaal.querySelector('.rtg-edge-smart-doors a').addEventListener('click', function (ev) {
      var groepen = rt.alles.querySelector('.rtg-edge-global-original');
      if (!groepen) return; ev.preventDefault(); rt.alles.setAttribute('data-catalogus-open', 'true'); groepen.scrollIntoView({ block: 'start' });
    });
    index.addEventListener('focusin', function (ev) {
      if (ev.target.matches('.rtg-edge-find input')) { gezicht(rt, 'all', false); rt.alles.setAttribute('data-catalogus-open', 'true'); }
    });
    gezicht(rt, wereldHome() ? 'all' : 'here', false);
    return true;
  }

  function start(doc) {
    doc = doc || d;
    var root = doc.querySelector('.rtg-edge-chrome'), index = root && root.querySelector('.rtg-edge-index');
    if (!root || !index) return null;
    if (actief && actief.root === root) { bouw(actief); return actief; }
    var rt = actief = { root: root, index: index, body: doc.body, tabs: [] };
    index.id = index.id || 'rtg-edge-smart-menu'; index.setAttribute('aria-label', 'Slim menu');
    var menu = root.querySelector('.rtg-edge-menu');
    menu.setAttribute('aria-controls', index.id); menu.setAttribute('aria-haspopup', 'true'); menu.setAttribute('aria-label', 'Menu openen');
    bouw(rt);
    menu.addEventListener('click', function () {
      queueMicrotask(function () {
        var open = menu.getAttribute('aria-expanded') === 'true';
        menu.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
      });
    });
    rt.observer = new MutationObserver(function (regels) {
      if (!doc.documentElement.contains(root)) { rt.observer.disconnect(); actief = null; return; }
      bouw(rt);
      regels.forEach(function (regel) {
        if (regel.type !== 'attributes' || regel.target !== index) return;
        var open = index.getAttribute('aria-hidden') === 'false';
        menu.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
        if (open) gezicht(rt, wereldHome() ? 'all' : 'here', true);
      });
    });
    rt.observer.observe(index, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
    return rt;
  }

  w.RTGEdgeSmartMenu = {
    start: start,
    openSearch: function () {
      if (!actief || actief.index.getAttribute('aria-hidden') !== 'false') return;
      gezicht(actief, 'all', false);
      actief.alles.setAttribute('data-catalogus-open', 'true');
    },
    setAttention: function (aan) {
      var menu = d.querySelector('.rtg-edge-menu');
      if (menu) menu.setAttribute('data-attention', aan ? 'true' : 'false');
    }
  };
}(window, document));
