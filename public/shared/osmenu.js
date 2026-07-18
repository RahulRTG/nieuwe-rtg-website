/* Het RTG-OS uitschuifmenu. Zet een hamburger in de balk (.osbar op de apps,
   .bar op het bureaublad) en bouwt een rustig navigatiepaneel: een profielkaart
   met het actieve account, een 2-koloms app-raster met labels, "Meer weergeven"
   voor de website-tegels, en inklapbare secties voor instellingen en hulp.

   De accountwereld komt uit body[data-oswereld] (standaard 'lid'); het account
   zelf uit de accountkluis (shared/accounts-os.js). Geen inline handlers
   (nonce-CSP). Insluiten met defer, NA shared/accounts-os.js. */
(function (w, d) {
  'use strict';

  var APPS = [
    ['🎫', 'RTG-app', '/apps/app.html'],
    ['🏛️', 'Leverancier', '/apps/leverancier.html'],
    ['🧭', 'Personeel', '/apps/personeel.html'],
    ['📊', 'Backoffice', '/apps/backoffice.html'],
    ['🗂️', 'Kantoren', '/apps/kantoren.html'],
    ['💳', 'RTG Pay', '/apps/pay.html'],
    ['♟️', 'Spelen', '/apps/spelen.html'],
    ['🤝', 'RTFoundation', '/apps/foundation/index.html']
  ];
  var SITE = [
    ['◆', 'RTG Pass', '/site/rtg-pass.html'],
    ['❖', 'Lifestyle Pass', '/site/lifestyle-pass.html'],
    ['◈', 'Business Pass', '/site/business-pass.html'],
    ['✦', 'RTFoundation', '/site/rtfoundation.html'],
    ['🧭', 'Boeken', '/site/boeken.html'],
    ['⛓️', 'Systemen', '/site/systemen.html'],
    ['➕', 'Partner worden', '/site/partner-worden.html'],
    ['∩', 'Downloads', '/site/download.html'],
    ['⌂', 'Startpagina', '/']
  ];
  var INSTELLINGEN = [
    ['🔒', 'Privacy', '/site/privacy.html'],
    ['📜', 'Voorwaarden', '/site/voorwaarden.html']
  ];
  var HULP = [
    ['⚙️', 'Hoe alles werkt', '/site/systemen.html'],
    ['⌂', 'Naar de website', '/']
  ];
  var BUREAU = '/apps/bureau.html';

  function el(tag, cls, txt) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function tegel(rij) {
    var a = el('a', 'osmenu-tegel'); a.href = rij[2];
    a.appendChild(el('span', 'ic', rij[0]));
    a.appendChild(el('span', 'lb', rij[1]));
    return a;
  }
  function menurij(rij) {
    var a = el('a', 'osmenu-rij'); a.href = rij[2];
    a.appendChild(el('span', 'ic', rij[0]));
    a.appendChild(el('span', null, rij[1]));
    return a;
  }
  function sectie(icoon, titel, rijen) {
    var det = el('details', 'osmenu-sectie');
    var sum = el('summary');
    sum.appendChild(el('span', 'ic', icoon));
    sum.appendChild(el('span', null, titel));
    sum.appendChild(el('span', 'pijl', '▾'));
    det.appendChild(sum);
    var binnen = el('div', 'binnen');
    rijen.forEach(function (r) { binnen.appendChild(menurij(r)); });
    det.appendChild(binnen);
    return det;
  }

  function bouw() {
    var body = d.body; if (!body) return;
    var bar = d.querySelector('.osbar') || d.querySelector('.bar');
    if (!bar) return;

    // hamburger in de balk
    var ham = el('button', 'os-ham');
    ham.type = 'button';
    ham.setAttribute('aria-label', 'Menu openen');
    ham.setAttribute('aria-expanded', 'false');
    ham.appendChild(el('span')); ham.appendChild(el('span')); ham.appendChild(el('span'));
    bar.insertBefore(ham, bar.firstChild);

    // scrim + paneel
    var scrim = el('div', 'osmenu-scrim');
    var paneel = el('aside', 'osmenu');
    paneel.setAttribute('role', 'dialog');
    paneel.setAttribute('aria-label', 'RTG-OS menu');
    paneel.setAttribute('aria-hidden', 'true');

    var kop = el('div', 'osmenu-kop');
    var titel = el('div', 'titel'); titel.innerHTML = 'RTG <b>OS</b>';
    var dicht = el('button', 'osmenu-dicht', '✕');
    dicht.type = 'button'; dicht.setAttribute('aria-label', 'Menu sluiten');
    kop.appendChild(titel); kop.appendChild(dicht);
    paneel.appendChild(kop);

    var lijf = el('div', 'osmenu-body');

    // profielkaart
    var wereld = (body.getAttribute('data-oswereld') || 'lid').trim() || 'lid';
    var acc = null, wnaam = '';
    try {
      if (w.RTGAccounts && w.RTGAccounts.maak) {
        var kluis = w.RTGAccounts.maak();
        acc = kluis.huidig(wereld);
        var wdef = w.RTGAccounts.WERELDEN && w.RTGAccounts.WERELDEN[wereld];
        wnaam = (wdef && wdef.naam) || '';
      }
    } catch (e) {}
    var naam = (acc && acc.label) ? acc.label : 'Aanmelden';
    var prof = el('a', 'osmenu-prof'); prof.href = BUREAU;
    var ava = el('span', 'ava', naam.charAt(0).toUpperCase());
    ava.setAttribute('aria-hidden', 'true');
    var wie = el('span', 'wie');
    wie.appendChild(el('b', null, naam));
    wie.appendChild(el('small', null, acc ? (wnaam || 'Actief account') : 'Kies of voeg een account toe'));
    prof.appendChild(ava); prof.appendChild(wie); prof.appendChild(el('span', 'chev', '›'));
    lijf.appendChild(prof);

    // app-raster
    lijf.appendChild(el('h3', 'osmenu-sectiekop', 'Apps'));
    var grid = el('div', 'osmenu-grid');
    APPS.forEach(function (r) { grid.appendChild(tegel(r)); });
    lijf.appendChild(grid);

    // meer weergeven -> website-tegels
    var meer = el('button', 'osmenu-meer', 'Meer weergeven'); meer.type = 'button';
    var siteKop = el('h3', 'osmenu-sectiekop', 'De website'); siteKop.hidden = true;
    var siteGrid = el('div', 'osmenu-grid'); siteGrid.hidden = true;
    SITE.forEach(function (r) { siteGrid.appendChild(tegel(r)); });
    meer.addEventListener('click', function () {
      var open = !siteGrid.hidden;
      siteGrid.hidden = open; siteKop.hidden = open;
      meer.textContent = open ? 'Meer weergeven' : 'Minder weergeven';
    });
    lijf.appendChild(meer);
    lijf.appendChild(siteKop);
    lijf.appendChild(siteGrid);

    // inklapbare secties
    lijf.appendChild(sectie('⚙️', 'Instellingen & privacy', INSTELLINGEN));
    lijf.appendChild(sectie('❓', 'Hulp & ondersteuning', HULP));

    paneel.appendChild(lijf);
    body.appendChild(scrim);
    body.appendChild(paneel);

    // openen/sluiten
    function open() {
      scrim.classList.add('open'); paneel.classList.add('open');
      paneel.setAttribute('aria-hidden', 'false'); ham.setAttribute('aria-expanded', 'true');
      dicht.focus();
    }
    function sluit() {
      scrim.classList.remove('open'); paneel.classList.remove('open');
      paneel.setAttribute('aria-hidden', 'true'); ham.setAttribute('aria-expanded', 'false');
    }
    ham.addEventListener('click', function () {
      if (paneel.classList.contains('open')) sluit(); else open();
    });
    dicht.addEventListener('click', sluit);
    scrim.addEventListener('click', sluit);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && paneel.classList.contains('open')) sluit(); });

    w.RTGosmenu = { open: open, sluit: sluit };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bouw);
  else bouw();
})(window, document);
