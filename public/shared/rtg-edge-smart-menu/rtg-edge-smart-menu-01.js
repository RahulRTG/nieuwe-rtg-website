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
      /* De poort van de gids, als de pagina er een heeft (de ledenapp zet
         RTGAppCatalogusPoort, app-main-29d.js): wat de gids verbergt, toont de
         catalogus ook niet. Zonder poort blijft het zoals het was. */
      var poort = typeof w.RTGAppCatalogusPoort === 'function' ? w.RTGAppCatalogusPoort : null;
      data.apps.forEach(function (app) {
        var appPad = app && intern(app.url);
        if (!app || !Object.prototype.hasOwnProperty.call(namen, app.world) || typeof app.name !== 'string' || !appPad || !/^\/apps\/(?:[\w-]+\/)*[\w-]+\.html(?:[?#][^\s]*)?$/.test(appPad) || gezien.has(appPad)) return;
        if (poort && poort(app.url) === false) return;
        gezien.add(appPad);
        if (!groepen[app.world]) {
          var groep = d.createElement('section'), kop = d.createElement('h3');
          groep.className = 'rtg-edge-group'; kop.textContent = namen[app.world]; groep.appendChild(kop);
          lijst.appendChild(groep); groepen[app.world] = groep;
        }
        var appLink = document.createElement('a');
        var nr = d.createElement('span'), naam = d.createElement('b'), pijl = d.createElement('em');
        appLink.href = '/apps/' + appPad.slice('/apps/'.length); appLink.dataset.search = (namen[app.world] + ' ' + app.name).toLowerCase();
        appLink.dataset.catalogApp = app.id; nr.textContent = String(gezien.size).padStart(2, '0');
        naam.textContent = app.name; pijl.textContent = '→'; appLink.append(nr, naam, pijl); groepen[app.world].appendChild(appLink);
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
