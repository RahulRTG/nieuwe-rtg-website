(function (w, d) {
  'use strict';

  var pad = w.location.pathname;
  var modules = {
    '/apps/vluchten.html': { id: 'vluchten', naam: 'VLUCHTEN', actief: 'reizen' },
    '/apps/hotels.html': { id: 'hotels', naam: 'VERBLIJVEN', actief: 'reizen' },
    '/apps/reisbureau.html': { id: 'reisbureau', naam: 'REISBUREAU', actief: 'reizen' },
    '/apps/ov.html': { id: 'mobiliteit', naam: 'MOBILITEIT', actief: 'reizen' },
    '/apps/navigatie.html': { id: 'navigatie', naam: 'NAVIGATIE', actief: 'reizen', kaart: true },
    '/apps/rit.html': { id: 'rit', naam: 'RITSTATUS', actief: 'taxi' },
    '/apps/reisboek.html': { id: 'reisboek', naam: 'REISBOEK', actief: 'reizen' },
    '/apps/hangar.html': { id: 'hangar', naam: 'PRIVATE MOBILITY', actief: 'reizen' }
  };
  var module = modules[pad] || { naam: 'REIZEN', actief: 'reizen' };
  var body = d.body;
  if (!body || body.querySelector('.tos-topbar')) return;
  body.classList.add('travel-os');
  if (module.kaart) body.classList.add('travel-os-map');
  /* De oude brede Travel-balken worden alleen als terugval gebouwd. De nieuwe
     Edge System-schil houdt exact dezelfde functies op dezelfde plaats als de
     drie andere werelden. In een werktafel-iframe komt er geen tweede schil. */
  if (new URLSearchParams(w.location.search).get('embed') === '1') {
    body.classList.add('rtg-edge-embed');
    return;
  }
  if (w.RTGEdge) {
    w.RTGEdge.start({
      world: 'travel',
      context: { scope: 'REIZEN', title: module.naam, tool: module.id || 'vandaag', actie: 'Verder in ' + module.naam },
      onAction: function () {
        var knop = body.querySelector('main .knop:not([disabled]),main button.hoofd:not([disabled]),main [data-primary]');
        if (knop) knop.click();
      }
    });
    return;
  }

  function maak(tag, klasse, tekst) {
    var el = d.createElement(tag);
    if (klasse) el.className = klasse;
    if (tekst != null) el.textContent = tekst;
    return el;
  }
  function svg(paden) {
    var s = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    paden.forEach(function (gegevens) {
      var p = d.createElementNS('http://www.w3.org/2000/svg', gegevens[0]);
      Object.keys(gegevens[1]).forEach(function (sleutel) { p.setAttribute(sleutel, gegevens[1][sleutel]); });
      s.appendChild(p);
    });
    return s;
  }

  var kop = maak('div', 'tos-topbar');
  kop.setAttribute('role', 'banner');
  var merk = maak('a', 'tos-mark', 'RTG');
  merk.href = '/apps/app.html';
  merk.setAttribute('aria-label', 'Naar RTG Vandaag');
  var identiteit = maak('div', 'tos-identity');
  identiteit.appendChild(maak('strong', '', 'TRAVEL OS'));
  identiteit.appendChild(maak('small', '', module.naam));
  var veilig = maak('button', 'tos-secure');
  veilig.type = 'button';
  veilig.setAttribute('aria-label', 'Bekijk beveiliging');
  veilig.appendChild(svg([['path', { d: 'M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z' }]]));
  veilig.appendChild(maak('i'));
  veilig.appendChild(maak('span', '', 'BEVEILIGD'));
  kop.appendChild(merk);
  kop.appendChild(identiteit);
  kop.appendChild(veilig);
  /* De gedeelde basis zet de springlink als eerste tabstop. Dit script draait
     erna en mag de vaste merkbalk daar niet meer voor schuiven: dan moet een
     toetsenbordgebruiker de hele schil door voordat de inhoud bereikbaar is. */
  var spring = body.querySelector('a.rtg-spring, a.skip, a.skiplink, a[href^="#"][class*="skip"]');
  if (spring && spring.parentNode === body) body.insertBefore(kop, spring.nextSibling);
  else body.insertBefore(kop, body.firstChild);

  var items = [
    { id: 'vandaag', label: 'Vandaag', href: '/apps/reizen.html#vandaag', icoon: [['rect', { x: '4', y: '5', width: '16', height: '15', rx: '1' }], ['path', { d: 'M8 3v4m8-4v4M4 10h16M8 14h.01m4 0h.01m4 0h.01M8 17h.01m4 0h.01' }]] },
    { id: 'reizen', label: 'Reizen', href: '/apps/reizen.html#reizen', icoon: [['path', { d: 'M4 7h16v12H4zM8 7V4h8v3M4 12h16' }]] },
    { id: 'taxi', label: 'Taxi', href: '/apps/reizen.html#taxi', icoon: [['path', { d: 'm5 16-1-2 2-6h12l2 6-1 2M6 16h12v3H6zM8 19v2m8-2v2M7 12h.01M17 12h.01' }]] },
    { id: 'rahul', label: 'Rahul', href: '/apps/reizen.html#rahul', icoon: [['circle', { cx: '12', cy: '8', r: '4' }], ['path', { d: 'M4 21a8 8 0 0 1 16 0' }]] }
  ];
  var nav = maak('nav', 'tos-nav');
  nav.setAttribute('aria-label', 'RTG Travel OS');
  items.forEach(function (item) {
    var a = maak('a');
    a.href = item.href;
    a.appendChild(svg(item.icoon));
    a.appendChild(maak('span', '', item.label));
    if (item.id === module.actief) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  });
  body.appendChild(nav);

  var dialoog = maak('dialog', 'tos-security');
  dialoog.setAttribute('aria-labelledby', 'tosSecurityTitle');
  var binnen = maak('div', 'tos-security-inner');
  var dkop = maak('div', 'tos-security-head');
  var dtitel = maak('div');
  dtitel.appendChild(maak('small', '', 'RTG VEILIGE VERBINDING'));
  var h2 = maak('h2', '', 'Uw reis blijft van u.');
  h2.id = 'tosSecurityTitle';
  dtitel.appendChild(h2);
  var sluit = maak('button', 'tos-security-close', '×');
  sluit.type = 'button';
  sluit.setAttribute('aria-label', 'Sluiten');
  dkop.appendChild(dtitel);
  dkop.appendChild(sluit);
  binnen.appendChild(dkop);
  var lijst = maak('ul');
  ['Account en sessie beveiligd', 'Alleen noodzakelijke reisdata gedeeld', 'Prijs en actie altijd zichtbaar voor bevestiging'].forEach(function (tekst) {
    var li = maak('li');
    li.appendChild(maak('b', '', '✓'));
    li.appendChild(maak('span', '', tekst));
    lijst.appendChild(li);
  });
  binnen.appendChild(lijst);
  binnen.appendChild(maak('p', '', 'RTG voert geen boeking of betaling uit zonder een duidelijke bevestiging van u.'));
  dialoog.appendChild(binnen);
  body.appendChild(dialoog);

  veilig.addEventListener('click', function () {
    if (typeof dialoog.showModal === 'function') dialoog.showModal(); else dialoog.setAttribute('open', '');
  });
  sluit.addEventListener('click', function () {
    if (typeof dialoog.close === 'function') dialoog.close(); else dialoog.removeAttribute('open');
  });
  dialoog.addEventListener('click', function (e) {
    if (e.target === dialoog) sluit.click();
  });

  Array.prototype.forEach.call(body.querySelectorAll('a[href="/apps/app.html"]'), function (a) {
    if (a === merk || a.closest('.tos-topbar')) return;
    a.href = '/apps/reizen.html#reizen';
    if ((a.textContent || '').trim().length <= 8) a.textContent = '← Reizen';
    a.setAttribute('aria-label', 'Terug naar RTG Reizen');
  });
})(window, document);
