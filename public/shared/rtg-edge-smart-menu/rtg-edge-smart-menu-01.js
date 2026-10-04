  /* Dezelfde appcatalogus als de widgets: mobiel mag geen apps verliezen. */
  function volledigeCatalogus(rt) {
    var host = rt.alles;
    if (rt.catalogus && rt.catalogus.host === host) return rt.catalogus.promise;
    var oud = host.querySelector('[data-edge-catalog-status]'); if (oud) oud.remove();
    var lijst = host.querySelector('.rtg-edge-groups'), melding = d.createElement('p');
    melding.setAttribute('data-edge-catalog-status', '');
    melding.setAttribute('role', 'status'); melding.textContent = 'Apps worden geladen.'; lijst.before(melding);
    var aanvraag = rt.catalogus = { host: host, promise: null };
    function actueel() { return rt.catalogus === aanvraag && rt.alles === host && host.isConnected; }
    aanvraag.promise = fetch('/shared/interface/world-widget-catalog.json').then(function (r) {
      if (!r.ok) throw new Error('Catalogus niet beschikbaar'); return r.json();
    }).then(function (data) {
      if (!actueel()) return;
      if (!Array.isArray(data.apps)) throw new Error('Catalogus ontbreekt');
      var gezien = new Set(Array.from(lijst.querySelectorAll('a[href]')).map(function (a) { return a.getAttribute('href'); }));
      var groepen = {}, namen = { living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS' };
      data.apps.forEach(function (app) {
        if (!app || !Object.prototype.hasOwnProperty.call(namen, app.world) || typeof app.name !== 'string' || typeof app.url !== 'string' || !/^\/apps\/(?:[\w-]+\/)*[\w-]+\.html(?:[?#][^\s]*)?$/.test(app.url) || gezien.has(app.url)) return;
        gezien.add(app.url);
        if (!groepen[app.world]) {
          var groep = d.createElement('section'), kop = d.createElement('h3');
          groep.className = 'rtg-edge-group'; kop.textContent = namen[app.world]; groep.appendChild(kop);
          lijst.appendChild(groep); groepen[app.world] = groep;
        }
        var a = d.createElement('a'), nr = d.createElement('span'), naam = d.createElement('b'), pijl = d.createElement('em');
        a.href = app.url; a.dataset.search = (namen[app.world] + ' ' + app.name).toLowerCase();
        a.dataset.catalogApp = app.id; nr.textContent = String(gezien.size).padStart(2, '0');
        naam.textContent = app.name; pijl.textContent = '→'; a.append(nr, naam, pijl); groepen[app.world].appendChild(a);
      });
      melding.remove();
      var input = host.querySelector('.rtg-edge-find input');
      input.placeholder = 'Zoek in ' + gezien.size + ' functies'; input.dispatchEvent(new Event('input', { bubbles: true }));
      host.dataset.catalogusReady = 'true';
    }).catch(function () {
      if (!actueel()) return;
      rt.catalogus = null; melding.textContent = 'De applijst kon niet worden geladen. ';
      var opnieuw = d.createElement('button'); opnieuw.type = 'button'; opnieuw.textContent = 'Probeer opnieuw';
      opnieuw.onclick = function () { melding.remove(); volledigeCatalogus(rt); }; melding.appendChild(opnieuw);
    });
    return aanvraag.promise;
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
      '<button type="button" class="rtg-edge-smart-door" data-edge-smart-language>' + icoon('grid') + '<span>Taal kiezen</span><em aria-hidden="true">›</em></button>' +
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
      werk.setAttribute('data-edge-command-bank', ''); werk.innerHTML = icoon('grid') + '<span>Werelden en werkbladen</span><em aria-hidden="true">›</em>';
      werk.addEventListener('click', function () { openWerkbladen(rt); });
      rt.alles.querySelector('.rtg-edge-smart-doors').appendChild(werk);
    }
    schaal.querySelector('[data-edge-smart-search]').addEventListener('click', function () {
      volledigeCatalogus(rt);
      rt.alles.setAttribute('data-catalogus-open', 'true');
      var invoer = rt.alles.querySelector('.rtg-edge-find input'); if (invoer) invoer.focus();
    });
    schaal.querySelector('[data-edge-smart-language]').addEventListener('click', function () {
      if (!w.RTGi18n) return;
      var menu = rt.root.querySelector('.rtg-edge-menu');
      if (menu.getAttribute('aria-expanded') === 'true') menu.click();
      w.RTGi18n.openModal();
    });
    schaal.querySelector('.rtg-edge-smart-doors a').addEventListener('click', function (ev) {
      volledigeCatalogus(rt);
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
      volledigeCatalogus(actief);
      gezicht(actief, 'all', false);
      actief.alles.setAttribute('data-catalogus-open', 'true');
    },
    setAttention: function (aan) {
      var menu = d.querySelector('.rtg-edge-menu');
      if (menu) menu.setAttribute('data-attention', aan ? 'true' : 'false');
    }
  };
}(window, document));
