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

