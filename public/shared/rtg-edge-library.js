/* De doorzoekbare functiebibliotheek en de live status van het RTG Edge System. */
(function (w) {
  'use strict';
  /* De volgorde staat op één plek en is die van WERELDEN.md: LivingOS, WorkOS,
     TravelOS, FoundationOS. De topbalk (rtg-edge-system.js) leest dezelfde
     rij, zodat de nummers 01..04 daar niet apart worden bijgehouden. */
  var ORDE = ['living', 'work', 'travel', 'foundation'];
  function werelden(e, C) {
    return '<nav class="rtg-edge-worlds" aria-label="Vier RTG werelden">' + ORDE.map(function (sleutel) {
      var wereld = C[sleutel];
      /* Het HUIS en niet de werkplek: een tik op een wereld brengt je naar het
         wereldscherm uit MAPPEN. Zie de opmerking in rtg-edge-worlds.js. */
      return '<a href="' + (wereld.huis || wereld.home) + '" ' +
        (e.key === sleutel ? 'aria-current="page"' : '') + '>' + wereld.kaart + '</a>';
    }).join('') + '</nav>';
  }
  function html(e, C, esc, icoon, actief) {
    var groepen = e.cfg.groups || [['Functies', e.cfg.tools]], nr = 0;
    var inhoud = groepen.map(function (groep) {
      var links = groep[1].map(function (x) {
        nr++;
        var gekozen = e.ctx.tool === x[0] || (!e.ctx.tool && actief(x));
        return '<a href="' + x[3] + '" data-tool="' + x[0] + '" data-search="' + esc((groep[0] + ' ' + x[1]).toLowerCase()) + '" ' + (gekozen ? 'aria-current="page"' : '') + '><span>' + String(nr).padStart(2, '0') + '</span><b>' + esc(x[1]) + '</b><em>→</em></a>';
      }).join('');
      return '<section class="rtg-edge-group"><h3>' + esc(groep[0]) + '</h3>' + links + '</section>';
    }).join('');
    return '<div class="rtg-edge-index-inner"><div class="rtg-edge-index-k">' + esc(e.cfg.naam) + ' · ALLE FUNCTIES</div><h2>' + esc(e.ctx.title) + '</h2><label class="rtg-edge-find">' + icoon('search') + '<input type="search" autocomplete="off" spellcheck="false" aria-label="Functies zoeken" placeholder="Zoek in ' + nr + ' functies"><kbd>⌘K</kbd></label><div class="rtg-edge-groups">' + inhoud + '</div><p class="rtg-edge-none" hidden>Geen functie gevonden.</p>' + werelden(e, C) + '</div>';
  }
  function status() {
    var lokaal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname), veilig = w.isSecureContext || lokaal, online = navigator.onLine;
    return '<div class="rtg-edge-status-inner"><div class="rtg-edge-index-k">LIVE SYSTEEMSTATUS</div><h2 data-edge-status-title>Status ophalen…</h2><dl><div><dt>Context</dt><dd><i class="' + (veilig ? 'ok' : 'warn') + '"></i>' + (lokaal ? 'Lokale controle' : veilig ? 'Beveiligd' : 'Niet beveiligd') + '</dd></div><div><dt>Netwerk</dt><dd><i class="' + (online ? 'ok' : 'warn') + '"></i>' + (online ? 'Online' : 'Offline') + '</dd></div><div><dt>Server</dt><dd data-edge-ready><i class="warn"></i>Controleren…</dd></div><div><dt>Datalaag</dt><dd data-edge-store><i class="warn"></i>Controleren…</dd></div><div><dt>Rahul AI</dt><dd data-edge-ai><i class="warn"></i>Controleren…</dd></div></dl><p data-edge-mode>Boeken, betalen en goedkeuren blijven menselijke handelingen.</p></div>';
  }
  function statusRij(el, goed, tekst) { if (!el) return; el.innerHTML = '<i class="' + (goed ? 'ok' : 'warn') + '"></i>'; el.appendChild(document.createTextNode(tekst)); }
  async function refresh(e) {
    if (!e || !e.root) return;
    var title = e.root.querySelector('[data-edge-status-title]'), state = e.root.querySelector('.rtg-edge-state span');
    try {
      var rs = await Promise.all([fetch('/api/ready', { cache: 'no-store' }), fetch('/api/health', { cache: 'no-store' })]);
      var ready = await rs[0].json(), health = await rs[1].json(), ok = rs[0].ok && ready.ready === true && health.ok === true;
      var magnaat = health.omgeving === 'magnaat-test' && health.testomgeving === true;
      title.textContent = magnaat ? 'Magnaat Test gereed' : ok ? 'Systemen gereed' : 'Controle nodig'; state.textContent = magnaat ? 'TEST' : ok ? 'Beveiligd' : 'Beperkt';
      statusRij(e.root.querySelector('[data-edge-ready]'), rs[0].ok && ready.ready === true, ready.ready ? 'Gereed' : 'Niet gereed');
      statusRij(e.root.querySelector('[data-edge-store]'), ready.data === true && ready.writable === true, (ready.store || 'opslag') + (ready.writable ? ' · schrijfbaar' : ' · alleen-lezen'));
      statusRij(e.root.querySelector('[data-edge-ai]'), health.ai !== 'uit', health.ai || 'niet beschikbaar');
      e.root.querySelector('[data-edge-mode]').textContent = (magnaat ? 'Afgeschermde Magnaat-testomgeving. Geen klantdata of productieacties. ' : '') + 'Boeken, betalen en goedkeuren blijven menselijke handelingen.';
    } catch (fout) { title.textContent = 'Server niet bereikbaar'; state.textContent = 'Offline'; statusRij(e.root.querySelector('[data-edge-ready]'), false, 'Geen antwoord'); }
  }
  function bind(e, sluiten) {
    var input = e.root.querySelector('.rtg-edge-find input');
    input.oninput = function () { filter(e, input.value); };
    input.onkeydown = function (ev) {
      var zichtbaar = Array.from(e.root.querySelectorAll('.rtg-edge-group a:not([hidden])'));
      if (ev.key === 'Enter' && zichtbaar[0]) { ev.preventDefault(); zichtbaar[0].click(); }
      if (ev.key === 'Escape') { ev.preventDefault(); sluiten(); }
    };
  }
  function crumbs(e, open, actie) {
    var r = e.root;
    r.querySelector('[data-crumb="home"]').onclick = function () { location.href = e.cfg.home; };
    r.querySelector('[data-crumb="scope"]').onclick = function () { open(true); };
    r.querySelector('[data-crumb="current"]').onclick = actie;
  }
  function filter(e, waarde) {
    var q = String(waarde || '').trim().toLowerCase(), aantal = 0;
    e.root.querySelectorAll('.rtg-edge-group').forEach(function (groep) {
      var raak = 0;
      groep.querySelectorAll('a[data-search]').forEach(function (a) {
        var toon = !q || a.dataset.search.indexOf(q) >= 0;
        a.hidden = !toon; if (toon) { raak++; aantal++; }
      });
      groep.hidden = !raak;
    });
    e.root.querySelector('.rtg-edge-none').hidden = !!aantal;
  }
  function release(e) {
    var actief = document.activeElement, index = e.root.querySelector('.rtg-edge-index');
    if (actief && index.contains(actief)) actief.blur();
  }
  w.RTGEdgeLibrary = { html: html, status: status, refresh: refresh, bind: bind, crumbs: crumbs, release: release, orde: ORDE };
})(window);
