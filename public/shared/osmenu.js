/* Het RTG-OS uitschuifmenu. Zet een hamburger in de balk (.osbar op de apps,
   .bar op het bureaublad) en bouwt een rustig navigatiepaneel:
     - een profielkaart die de ACCOUNTWISSELAAR openklapt (wisselen, in een
       nieuw venster openen, nog een account toevoegen);
     - een 2-koloms app-raster met labels (alleen de apps die AAN staan);
     - "Meer weergeven" voor de website-tegels;
     - een BEDIENINGSPANEEL waarin elke app aan/uit kan (uit = weg uit de
       launcher), plus inklapbare secties voor instellingen (incl. afmelden)
       en hulp.

   De accountwereld komt uit body[data-oswereld] (standaard 'lid'); accounts uit
   de accountkluis (shared/accounts-os.js). Voorkeuren staan lokaal per toestel.
   Geen inline handlers (nonce-CSP). Insluiten met defer, NA accounts-os.js. */
(function (w, d) {
  'use strict';

  var APPS = [
    ['pas', 'RTG-app', '/apps/app.html'],
    ['maison', 'Leverancier', '/apps/leverancier.html'],
    ['werk', 'Personeel', '/apps/personeel.html'],
    ['office', 'Backoffice', '/apps/backoffice.html'],
    ['gebouw', 'Kantoren', '/apps/kantoren.html'],
    ['betalen', 'RTG Pay', '/apps/pay.html'],
    ['spelen', 'Spelen', '/apps/spelen.html'],
    ['paneel', 'Boardroom', '/apps/boardroom.html'],
    ['rtf', 'RTFoundation', '/apps/foundation/index.html']
  ];
  var HULP = [
    ['juridisch', 'Juridisch', '/apps/juridisch.html']
  ];
  var BUREAU = '/apps/bureau.html';
  var UIT_SLEUTEL = 'rtg_os_apps_uit';   // localStorage: apps die AAN uit staan

  function el(tag, cls, txt) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function leeg(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* De menu-iconen komen uit de gedeelde huisstijl-glyfen (shared/glyf.js),
     geen emoji. Die set laden we er zelf bij; iconen die vóór het laden zijn
     gebouwd, vullen we aan zodra hij binnen is. */
  var glyfWacht = [];
  function icoNode(naam) {
    var s = el('span', 'ic');
    var g = w.RTGGlyf && w.RTGGlyf.svg(naam);
    if (g) s.appendChild(g); else glyfWacht.push([s, naam]);
    return s;
  }
  (function laadGlyf() {
    if (w.RTGGlyf) return;
    var s = d.createElement('script'); s.src = '/shared/glyf.js'; s.async = true;
    s.onload = function () {
      for (var i = 0; i < glyfWacht.length; i++) {
        var g = w.RTGGlyf.svg(glyfWacht[i][1]); if (g) glyfWacht[i][0].appendChild(g);
      }
      glyfWacht = [];
    };
    d.head.appendChild(s);
  })();

  // ---- voorkeuren: welke apps staan uit ----
  function leesUit() {
    try { var a = JSON.parse(localStorage.getItem(UIT_SLEUTEL) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function schrijfUit(a) { try { localStorage.setItem(UIT_SLEUTEL, JSON.stringify(a)); } catch (e) {} }
  function isUit(naam) { return leesUit().indexOf(naam) !== -1; }
  function zetUit(naam, uit) {
    var a = leesUit(); var i = a.indexOf(naam);
    if (uit && i === -1) a.push(naam);
    if (!uit && i !== -1) a.splice(i, 1);
    schrijfUit(a);
  }

  function tegel(rij) {
    var a = el('a', 'osmenu-tegel'); a.href = rij[2];
    a.appendChild(icoNode(rij[0]));
    a.appendChild(el('span', 'lb', rij[1]));
    return a;
  }
  function menurij(rij) {
    var a = el('a', 'osmenu-rij'); a.href = rij[2];
    a.appendChild(icoNode(rij[0]));
    a.appendChild(el('span', null, rij[1]));
    return a;
  }
  function knoprij(icoon, tekst, opKlik) {
    var b = el('button', 'osmenu-rij', null); b.type = 'button';
    b.style.width = '100%'; b.style.background = 'none'; b.style.border = '0'; b.style.cursor = 'pointer';
    b.appendChild(icoNode(icoon));
    b.appendChild(el('span', null, tekst));
    b.addEventListener('click', opKlik);
    return b;
  }
  function schakelaar(aan, opWissel) {
    var lab = el('label', 'osmenu-sw');
    var inp = d.createElement('input'); inp.type = 'checkbox'; inp.checked = !!aan;
    inp.addEventListener('change', function () { opWissel(inp.checked); });
    lab.appendChild(inp); lab.appendChild(el('span', 'baan')); lab.appendChild(el('span', 'knop'));
    return lab;
  }
  function toggleRij(icoon, titel, sub, aan, opWissel) {
    var rij = el('div', 'osmenu-toggle');
    rij.appendChild(icoNode(icoon));
    var tl = el('div', 'tl'); tl.appendChild(el('b', null, titel));
    if (sub) tl.appendChild(el('small', null, sub));
    rij.appendChild(tl);
    rij.appendChild(schakelaar(aan, opWissel));
    return rij;
  }
  function sectie(icoon, titel, kinderen, open) {
    var det = el('details', 'osmenu-sectie'); if (open) det.open = true;
    var sum = el('summary');
    sum.appendChild(icoNode(icoon));
    sum.appendChild(el('span', null, titel));
    sum.appendChild(el('span', 'pijl', '▾'));
    det.appendChild(sum);
    var binnen = el('div', 'binnen');
    kinderen.forEach(function (k) { binnen.appendChild(k); });
    det.appendChild(binnen);
    return det;
  }

  function bouw() {
    var body = d.body; if (!body) return;
    var bar = d.querySelector('.osbar') || d.querySelector('.bar');
    if (!bar) return;

    var wereld = (body.getAttribute('data-oswereld') || 'lid').trim() || 'lid';
    var kluis = (w.RTGAccounts && w.RTGAccounts.maak) ? w.RTGAccounts.maak() : null;
    var werelden = (w.RTGAccounts && w.RTGAccounts.WERELDEN) || {};
    var winfo = werelden[wereld] || null;
    function ingang() { return winfo ? '/' + winfo.ingang : BUREAU; }

    // hamburger in de balk
    var ham = el('button', 'os-ham');
    ham.type = 'button';
    ham.setAttribute('aria-label', 'Menu openen');
    ham.setAttribute('aria-expanded', 'false');
    ham.appendChild(el('span')); ham.appendChild(el('span')); ham.appendChild(el('span'));
    bar.insertBefore(ham, bar.firstChild);

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

    // ---- profielkaart + accountwisselaar ----
    var acc = null, wnaam = '';
    try { if (kluis) { acc = kluis.huidig(wereld); wnaam = (winfo && winfo.naam) || ''; } } catch (e) {}
    var naam = (acc && acc.label) ? acc.label : 'Aanmelden';

    var prof = el('button', 'osmenu-prof'); prof.type = 'button';
    prof.setAttribute('aria-expanded', 'false');
    var ava = el('span', 'ava', naam.charAt(0).toUpperCase()); ava.setAttribute('aria-hidden', 'true');
    var wie = el('span', 'wie');
    wie.appendChild(el('b', null, naam));
    wie.appendChild(el('small', null, acc ? (wnaam || 'Actief account') : 'Kies of voeg een account toe'));
    prof.appendChild(ava); prof.appendChild(wie); prof.appendChild(el('span', 'chev', '›'));
    lijf.appendChild(prof);

    var accVak = el('div', 'osmenu-accounts'); accVak.hidden = true;
    var lijst = kluis ? kluis.lijst(wereld) : [];
    lijst.forEach(function (a) {
      var rij = el('button', 'osmenu-acc' + (acc && a.id === acc.id ? ' actief' : '')); rij.type = 'button';
      rij.appendChild(el('span', 'anaam', a.label));
      var v = el('button', 'venster', '↗ venster'); v.type = 'button';
      v.title = 'Open dit account in een nieuw venster, naast je huidige';
      v.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var u = kluis.vensterURL(wereld, a.id); if (u) w.open('/' + u, '_blank', 'noopener');
      });
      rij.appendChild(v);
      rij.addEventListener('click', function () { kluis.wissel(wereld, a.id); kluis.pasToe(wereld); w.location.href = ingang(); });
      accVak.appendChild(rij);
    });
    var toevoeg = el('a', 'osmenu-acc toevoeg'); toevoeg.href = ingang();
    toevoeg.appendChild(el('span', 'anaam', '+  Nog een account toevoegen'));
    accVak.appendChild(toevoeg);
    prof.addEventListener('click', function () {
      var open = !accVak.hidden; accVak.hidden = open;
      prof.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    lijf.appendChild(accVak);

    // ---- app-raster (respecteert aan/uit) ----
    lijf.appendChild(el('h3', 'osmenu-sectiekop', 'Apps'));
    var grid = el('div', 'osmenu-grid');
    function vulGrid() {
      leeg(grid);
      var zichtbaar = APPS.filter(function (r) { return !isUit(r[1]); });
      if (!zichtbaar.length) {
        var p = el('p', null, 'Alle apps staan uit. Zet ze aan in het bedieningspaneel hieronder.');
        p.style.color = 'var(--osm-grijs-zacht)'; p.style.fontSize = '0.85rem'; p.style.padding = '0.4rem 0.2rem';
        grid.appendChild(p);
      } else {
        zichtbaar.forEach(function (r) { grid.appendChild(tegel(r)); });
      }
    }
    vulGrid();
    lijf.appendChild(grid);

    // ---- bedieningspaneel: apps aan/uit ----
    var appToggles = APPS.map(function (r) {
      return toggleRij(r[0], r[1], null, !isUit(r[1]), function (aan) {
        zetUit(r[1], !aan); vulGrid();
      });
    });
    var uitleg = el('p', null, 'Zet uit wat je niet gebruikt; het verdwijnt dan uit je app-raster. Dit geldt alleen op dit toestel.');
    uitleg.style.color = 'var(--osm-grijs-zacht)'; uitleg.style.fontSize = '0.78rem'; uitleg.style.margin = '0.2rem 0.2rem 0.6rem';
    lijf.appendChild(sectie('paneel', 'Bedieningspaneel', [uitleg].concat(appToggles), false));

    // ---- verbinding: GPS werkt echt; wifi/Bluetooth kan een website niet
    //      schakelen (alleen het toestel zelf), dus die staan vast met uitleg ----
    function gpsAan() { try { return localStorage.getItem('rtg_os_gps') === '1'; } catch (e) { return false; } }
    var gpsRij = el('div', 'osmenu-toggle');
    gpsRij.appendChild(icoNode('gps'));
    var gtl = el('div', 'tl'); gtl.appendChild(el('b', null, 'Locatie (GPS)'));
    gtl.appendChild(el('small', null, 'Voor kaarten, ritten en veiligheid'));
    gpsRij.appendChild(gtl);
    var gLab = el('label', 'osmenu-sw');
    var gInp = d.createElement('input'); gInp.type = 'checkbox'; gInp.checked = gpsAan();
    gInp.addEventListener('change', function () {
      if (gInp.checked) {
        try { localStorage.setItem('rtg_os_gps', '1'); } catch (e) {}
        if (w.navigator && w.navigator.geolocation) {
          w.navigator.geolocation.getCurrentPosition(function () {}, function () {
            try { localStorage.setItem('rtg_os_gps', '0'); } catch (e) {}
            gInp.checked = false;   // toestemming geweigerd -> weer uit
          });
        }
      } else { try { localStorage.setItem('rtg_os_gps', '0'); } catch (e) {} }
    });
    gLab.appendChild(gInp); gLab.appendChild(el('span', 'baan')); gLab.appendChild(el('span', 'knop'));
    gpsRij.appendChild(gLab);

    function vastRij(icoon, titel, uitlegTekst) {
      var rij = el('div', 'osmenu-toggle');
      rij.appendChild(icoNode(icoon));
      var tl = el('div', 'tl');
      var b = el('b'); b.appendChild(d.createTextNode(titel + ' '));
      if (w.RTGUitleg && w.RTGUitleg.knop) b.appendChild(w.RTGUitleg.knop(uitlegTekst, 'Waarom kan dit niet?'));
      tl.appendChild(b);
      tl.appendChild(el('small', null, 'Je toestel schakelt dit zelf'));
      rij.appendChild(tl);
      var lab = el('label', 'osmenu-sw uit');
      var inp = d.createElement('input'); inp.type = 'checkbox'; inp.disabled = true;
      lab.appendChild(inp); lab.appendChild(el('span', 'baan')); lab.appendChild(el('span', 'knop'));
      rij.appendChild(lab);
      return rij;
    }
    var wifiRij = vastRij('wifi', 'Wifi',
      'Een website mag de wifi van je toestel niet aan- of uitzetten; dat kan alleen je telefoon zelf, via de instellingen. RTG-OS toont de schakelaar, maar bedient de radio niet.');
    var btRij = vastRij('bluetooth', 'Bluetooth',
      'Een website mag Bluetooth van je toestel niet aan- of uitzetten; dat kan alleen je telefoon zelf, via de instellingen. RTG-OS toont de schakelaar, maar bedient de radio niet.');
    // Zaakdoos: het lokale kastje van de zaak. Staat er een adres, dan probeert
    // elke app dat eerst en valt terug op de cloud als de doos niet reageert.
    function doosRij() {
      var rij = el('div', 'osmenu-conn');
      rij.appendChild(icoNode('netwerk'));
      var tl = el('div', 'tl');
      tl.appendChild(el('b', null, 'Zaakdoos'));
      var opdoos = w.RTGdoos && w.RTGdoos.opDeDoos && w.RTGdoos.opDeDoos();
      tl.appendChild(el('small', null, opdoos ? 'Nu verbonden met de Zaakdoos' : 'Adres van het kastje in de zaak'));
      rij.appendChild(tl);
      var inp = d.createElement('input');
      inp.type = 'url'; inp.placeholder = 'http://…'; inp.setAttribute('aria-label', 'Zaakdoos-adres');
      inp.value = (w.RTGdoos && w.RTGdoos.adres && w.RTGdoos.adres()) || '';
      inp.style.cssText = 'flex:none;width:9rem;max-width:42vw;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:8px;color:inherit;font:inherit;font-size:.8rem;padding:.35rem .5rem;';
      var bwr = el('button', 'osmenu-mini'); bwr.type = 'button'; bwr.textContent = 'Bewaar';
      bwr.addEventListener('click', function () {
        if (w.RTGdoos) { w.RTGdoos.instellen(inp.value); w.RTGdoos.uit(false); }
        if (inp.value.trim() && w.RTGdoos && w.RTGdoos.naarDoos) w.RTGdoos.naarDoos();
      });
      rij.appendChild(inp); rij.appendChild(bwr);
      return rij;
    }
    lijf.appendChild(sectie('antenne', 'Verbinding', [gpsRij, wifiRij, btRij, doosRij()], false));

    // ---- instellingen (incl. afmelden) ----
    var instKinderen = [
      menurij(['slot', 'Privacy', '/apps/juridisch/privacy.html']),
      menurij(['juridisch', 'Voorwaarden', '/apps/juridisch/voorwaarden.html'])
    ];
    if (winfo && acc) {
      instKinderen.push(knoprij('uitloggen', 'Afmelden', function () {
        try { localStorage.removeItem(winfo.sleutel); } catch (e) {}
        try { if (kluis) kluis.wisVensterAccount(); } catch (e) {}
        w.location.reload();
      }));
    }
    lijf.appendChild(sectie('gear', 'Instellingen & privacy', instKinderen, false));

    // ---- hulp ----
    lijf.appendChild(sectie('help', 'Hulp & ondersteuning', HULP.map(menurij), false));

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
    ham.addEventListener('click', function () { if (paneel.classList.contains('open')) sluit(); else open(); });
    dicht.addEventListener('click', sluit);
    scrim.addEventListener('click', sluit);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && paneel.classList.contains('open')) sluit(); });

    w.RTGosmenu = { open: open, sluit: sluit };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', bouw);
  else bouw();
})(window, document);
