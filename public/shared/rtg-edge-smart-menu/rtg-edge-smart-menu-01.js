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
      deur('/apps/ik.html#persoonlijk', 'Profiel aanvullen', 'people') + '</nav><div class="rtg-edge-global-original"></div></section>';
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
