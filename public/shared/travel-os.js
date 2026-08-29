(function (w, d) {
  'use strict';

  var pad = w.location.pathname;
  var config = w.RTGTravelOSConfig || { routes: {}, profiles: {} };
  var profiel = d.body && d.body.getAttribute('data-travelos-profile');
  var module = (profiel && config.profiles[profiel]) || config.routes[pad] ||
    { naam: 'REIZEN', actief: 'reizen', scene: 'desk' };
  var body = d.body;
  /* EEN INGEBOUWDE TRAVEL-MODULE HEEFT AL EEN NAVIGATIE-EIGENAAR. `embed=1`
     is dezelfde expliciete afspraak die RTG Edge gebruikt; Reizen & Veilig zet
     hem op zijn child-iframes. De marker haalt ook de ruimte van de niet
     gebouwde rail/balk weg in travel-os.css. */
  var ingebed = new URLSearchParams(w.location.search).get('embed') === '1';
  var terugAdres = ingebed ? '/apps/reizen.html?embed=1#reizen' : '/apps/reizen.html#reizen';
  if (ingebed) {
    d.documentElement.classList.add('tos-ingebed');
    var bestaandeNav = body && body.querySelector('.tos-nav');
    if (bestaandeNav) bestaandeNav.remove();
  }
  /* De embed-afspraak moet ook gelden als deze module door een andere laag al
     is opgebouwd; daarom staat zij vóór deze idempotentie-uitgang. */
  if (!body || body.querySelector('.tos-topbar')) return;

  function slug(tekst) {
    return String(tekst || '').toLocaleLowerCase('nl-NL').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  body.classList.add('travel-os');
  if (module.kaart) body.classList.add('travel-os-map');
  if (module.operations) body.classList.add('travel-os-ops');
  if (module.guest) body.classList.add('travel-os-guest');
  if (module.immersive) body.classList.add('travel-os-immersive');
  body.setAttribute('data-travelos-module', slug(module.naam));
  body.setAttribute('data-travelos-scene', module.scene || 'desk');

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
  merk.href = ingebed ? terugAdres : (module.guest ? '/apps/reizen.html' : '/apps/app.html');
  merk.setAttribute('aria-label', 'Naar RTG Vandaag');
  var identiteit = maak('div', 'tos-identity');
  identiteit.appendChild(maak('strong', '', module.operations ? 'TRAVEL OS · OPERATIONS' : 'TRAVEL OS'));
  identiteit.appendChild(maak('small', '', module.naam));
  var veilig = maak('button', 'tos-secure');
  veilig.type = 'button';
  veilig.setAttribute('aria-label', 'Bekijk beveiliging');
  veilig.appendChild(svg([['path', { d: 'M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z' }]]));
  veilig.appendChild(maak('i'));
  veilig.appendChild(maak('span', '', module.guest ? 'PRIVÉ LINK' : 'BEVEILIGD'));
  kop.appendChild(merk);
  kop.appendChild(identiteit);
  kop.appendChild(veilig);
  var spring = body.querySelector('a.rtg-spring, a.skip, a.skiplink, a[href^="#"][class*="skip"]');
  if (spring && spring.parentNode === body) body.insertBefore(kop, spring.nextSibling);
  else body.insertBefore(kop, body.firstChild);

  var sfeer = null;
  if (!module.kaart) {
    sfeer = maak('div', 'tos-atmosphere');
    sfeer.setAttribute('aria-hidden', 'true');
    body.insertBefore(sfeer, kop.nextSibling);
  }

  if (module.operations) {
    var ops = maak('nav', 'tos-opsnav');
    ops.setAttribute('aria-label', 'Travel OS operations');
    [
      ['Reiziger', '/apps/ov.html'], ['Chauffeur', '/apps/chauffeur.html'],
      ['Luchthaven', '/apps/luchthaven.html'], ['Regie', '/apps/ovcontrol.html']
    ].forEach(function (item) {
      var a = maak('a', '', item[0]); a.href = item[1];
      if (item[1] === pad) a.setAttribute('aria-current', 'page');
      ops.appendChild(a);
    });
    body.insertBefore(ops, sfeer ? sfeer.nextSibling : kop.nextSibling);
  }

  if (!module.kaart && !module.eigenHero && !module.immersive && module.titel) {
    var hero = maak('section', 'tos-module-hero' + (module.operations ? ' tos-module-hero--compact' : '') + (module.guest ? ' tos-module-hero--guest' : ''));
    hero.setAttribute('data-scene', module.scene || 'desk');
    hero.setAttribute('aria-labelledby', 'tosModuleTitle');
    var heroBinnen = maak('div', 'tos-module-copy');
    heroBinnen.appendChild(maak('p', 'tos-module-eyebrow', '03 / TRAVEL OS · ' + module.naam));
    var heroTitel = maak('h2', '', module.titel); heroTitel.id = 'tosModuleTitle';
    heroBinnen.appendChild(heroTitel);
    heroBinnen.appendChild(maak('p', 'tos-module-intro', module.intro));
    hero.appendChild(heroBinnen);
    var heroMerk = maak('div', 'tos-module-mark');
    heroMerk.appendChild(maak('small', '', 'RTG'));
    heroMerk.appendChild(maak('span', '', module.naam));
    hero.appendChild(heroMerk);
    var hoofdinhoud = body.querySelector('main');
    if (hoofdinhoud && hoofdinhoud.parentNode === body) body.insertBefore(hero, hoofdinhoud);

    if (module.stappen && module.stappen.length) {
      var strip = maak('section', 'tos-service-strip');
      strip.setAttribute('aria-label', 'Reisverloop');
      module.stappen.forEach(function (stap, i) {
        var blok = maak('div', 'tos-service-step');
        blok.appendChild(maak('span', '', String(i + 1).padStart(2, '0')));
        var tekst = maak('div'); tekst.appendChild(maak('b', '', stap[0])); tekst.appendChild(maak('small', '', stap[1]));
        blok.appendChild(tekst); strip.appendChild(blok);
      });
      hero.parentNode.insertBefore(strip, hero.nextSibling);
    }
  }

  if (!module.geenNav && !module.operations && !ingebed) {
    var items = [
      { id: 'vandaag', label: 'Vandaag', href: '/apps/reizen.html#vandaag', icoon: [['rect', { x: '4', y: '5', width: '16', height: '15', rx: '1' }], ['path', { d: 'M8 3v4m8-4v4M4 10h16M8 14h.01m4 0h.01m4 0h.01M8 17h.01m4 0h.01' }]] },
      { id: 'reizen', label: 'Reizen', href: '/apps/reizen.html#reizen', icoon: [['path', { d: 'M4 7h16v12H4zM8 7V4h8v3M4 12h16' }]] },
      { id: 'taxi', label: 'Taxi', href: '/apps/reizen.html#taxi', icoon: [['path', { d: 'm5 16-1-2 2-6h12l2 6-1 2M6 16h12v3H6zM8 19v2m8-2v2M7 12h.01M17 12h.01' }]] },
      { id: 'rahul', label: 'Rahul', href: '/apps/reizen.html#rahul', icoon: [['circle', { cx: '12', cy: '8', r: '4' }], ['path', { d: 'M4 21a8 8 0 0 1 16 0' }]] }
    ];
    var nav = maak('nav', 'tos-nav');
    nav.setAttribute('aria-label', 'RTG Travel OS');
    items.forEach(function (item) {
      var a = maak('a'); a.href = item.href; a.appendChild(svg(item.icoon)); a.appendChild(maak('span', '', item.label));
      if (item.id === module.actief) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    body.appendChild(nav);
  }

  var dialoog = maak('dialog', 'tos-security');
  dialoog.setAttribute('aria-labelledby', 'tosSecurityTitle');
  var binnen = maak('div', 'tos-security-inner');
  var dkop = maak('div', 'tos-security-head');
  var dtitel = maak('div');
  dtitel.appendChild(maak('small', '', module.guest ? 'RTG PRIVÉ-UITNODIGING' : 'RTG VEILIGE VERBINDING'));
  var h2 = maak('h2', '', module.guest ? 'Alleen voor de genodigde.' : 'Uw reis blijft van u.');
  h2.id = 'tosSecurityTitle'; dtitel.appendChild(h2);
  var sluit = maak('button', 'tos-security-close', '×'); sluit.type = 'button'; sluit.setAttribute('aria-label', 'Sluiten');
  dkop.appendChild(dtitel); dkop.appendChild(sluit); binnen.appendChild(dkop);
  var lijst = maak('ul');
  (module.guest ? [
    'De link toont alleen de noodzakelijke samenvatting',
    'Reisdetails verschijnen pas na overname',
    'Een doorgestuurde link geeft geen toegang tot uw account'
  ] : [
    'Account en sessie beveiligd',
    'Alleen noodzakelijke reisdata gedeeld',
    'Prijs en actie altijd zichtbaar voor bevestiging'
  ]).forEach(function (tekst) {
    var li = maak('li'); li.appendChild(maak('b', '', '✓')); li.appendChild(maak('span', '', tekst)); lijst.appendChild(li);
  });
  binnen.appendChild(lijst);
  binnen.appendChild(maak('p', '', module.operations ? 'Handelingen blijven gebonden aan de persoonlijke personeelssessie.' : 'RTG voert geen boeking of betaling uit zonder een duidelijke bevestiging van u.'));
  dialoog.appendChild(binnen); body.appendChild(dialoog);

  veilig.addEventListener('click', function () {
    if (typeof dialoog.showModal === 'function') dialoog.showModal(); else dialoog.setAttribute('open', '');
  });
  sluit.addEventListener('click', function () {
    if (typeof dialoog.close === 'function') dialoog.close(); else dialoog.removeAttribute('open');
  });
  dialoog.addEventListener('click', function (e) { if (e.target === dialoog) sluit.click(); });

  Array.prototype.forEach.call(body.querySelectorAll('a[href="/apps/app.html"]'), function (a) {
    if (a === merk || a.closest('.tos-topbar')) return;
    a.href = terugAdres;
    if ((a.textContent || '').trim().length <= 8) a.textContent = '← Reizen';
    a.setAttribute('aria-label', 'Terug naar RTG Reizen');
  });
})(window, document);
