/* RTG Spatial Shell: de laag die van de desktop een werkruimte maakt.
   De regels staan in WERKRUIMTE.md; dit is stap 2 en 3 daarvan.

   Wat deze laag doet, doet GEEN enkele app zelf: openen, verplaatsen, docken,
   de drie zoomstanden, welke surface actief is, en de contextbus. Zolang dat
   per app zou worden opgelost, bouwt elke app zijn eigen desktop en zijn we
   terug bij twintig stijlen.

   Wat deze laag met opzet NIET doet: de inhoud van een app kennen. Een surface
   is een naam, een adres en een rechthoek. De shell weet niet wat een boeking
   is, en dat hoort zo -- anders kruipt domeinkennis in de vensterlaag.

   window.RTGSchil = { start, open, sluit, context, opContext, surfaces } */
(function (w, d) {
  'use strict';

  var RANDEN = { links: 'links', rechts: 'rechts', boven: 'boven', onder: 'onder' };
  var MARGE = 64;   // hoe dicht bij de rand voordat er gedockt wordt

  var schil = {
    vak: null, console: null, tabs: null, dok: null,
    surfaces: [],       // { id, naam, el, zoom }
    actief: null,
    huidigeContext: null,
    luisteraars: []
  };

  function el(tag, klasse, ouder) {
    var e = d.createElement(tag);
    if (klasse) e.className = klasse;
    if (ouder) ouder.appendChild(e);
    return e;
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };

  /* Een Magnaat-scherm mag bij het openen van een tweede oppervlak nooit
     ongemerkt terugvallen naar de echte omgeving. Alleen lokale app-URL's
     erven de testmarkering; externe adressen worden bewust niet herschreven. */
  function oppervlakUrl(url) {
    if (!url || new URLSearchParams(location.search).get('magnaat') !== '1') return url;
    try {
      var doel = new URL(url, location.href);
      if (doel.origin !== location.origin || doel.pathname.indexOf('/apps/') !== 0) return url;
      doel.searchParams.set('magnaat', '1');
      return doel.pathname + doel.search + doel.hash;
    } catch (e) { return url; }
  }
/* ---------------------------------------------------------- de indeling --
     De console is het ANKER en schuift naar waar hij het minst stoort
     (WERKRUIMTE.md par. 2): bij een lege ruimte staat hij midden, zodra er
     surfaces zijn gaat hij naar links en verdelen de surfaces de rest. Dit is
     bewust een eenvoudige verdeling en geen vrij zwevend geheel: een indeling
     die je niet kunt voorspellen, kun je ook niet onthouden. */
  function meet() {
    var r = schil.vak.getBoundingClientRect();
    return { b: r.width, h: r.height, g: parseInt(getComputedStyle(schil.vak).getPropertyValue('--gutter'), 10) || 14 };
  }

  function standaard() {
    return d.body && d.body.getAttribute('data-rtg-schil') === 'standaard';
  }

  function schik() {
    var m = meet(), g = m.g;
    var n = schil.surfaces.length;
    if (standaard()) {
      /* De Edge System-randen zijn de enige navigator. In het vlak liggen
         maximaal vier echte apps: 1, 2 of 2 x 2. Op een telefoon is het altijd
         precies de actieve app. */
      zet(schil.console, 0, 0, 0, 0);
      if (schil.tabs) zet(schil.tabs, 0, 0, 0, 0);
      if (!n) return;
      var limiet = m.b < 720 ? 1 : parseInt(d.body.dataset.rtgLayout || '2', 10);
      if ([1, 2, 4].indexOf(limiet) < 0) limiet = 1;
      var zichtbaar = schil.surfaces.slice(0, limiet);
      if (schil.actief && zichtbaar.indexOf(schil.actief) < 0) zichtbaar[zichtbaar.length - 1] = schil.actief;
      schil.surfaces.forEach(function (s) { s.el.toggleAttribute('data-edge-visible', zichtbaar.indexOf(s) >= 0); });
      var k = zichtbaar.length;
      var sk = k === 4 ? 2 : (k === 2 && m.b >= 760 ? 2 : 1);
      var sr = Math.ceil(k / sk), sw = Math.floor(m.b / sk), sh = Math.floor(m.h / sr);
      zichtbaar.forEach(function (s, i) {
        var c = i % sk, r = Math.floor(i / sk);
        zet(s.el, c * sw, r * sh,
          c === sk - 1 ? m.b - c * sw : sw,
          r === sr - 1 ? m.h - r * sh : sh);
      });
      return;
    }
    var consoleBreed = Math.max(300, Math.min(460, Math.round(m.b * 0.26)));

    /* De standaard Work OS-schil is een vaste linkerbank met een tabbalk.
       Alle surfaces delen daar hetzelfde werkvlak; de actieve tab bepaalt
       welke zichtbaar en bedienbaar is. De vrije Spatial Shell hieronder
       behoudt zijn raster, docken en eigen meubelplan. */
    if (schil.standaard) {
      var bankBreed = Math.max(164, Math.min(210, Math.round(m.b * 0.12)));
      var tabHoog = 48;
      zet(schil.console, 0, 0, bankBreed, m.h);
      if (schil.tabbar) zet(schil.tabbar, bankBreed, 0, m.b - bankBreed, tabHoog);
      schil.surfaces.forEach(function (s) {
        zet(s.el, bankBreed, tabHoog, m.b - bankBreed, m.h - tabHoog);
      });
      return;
    }

    if (!n) {
      // niets open: de console staat midden, als commandotafel zonder werk
      zet(schil.console, Math.round((m.b - consoleBreed) / 2), g, consoleBreed, m.h - g * 2);
      return;
    }
    zet(schil.console, g, g, consoleBreed, m.h - g * 2);

    var x0 = g + consoleBreed + g;
    var breed = m.b - x0 - g;
    var hoog = m.h - g * 2;

    /* Wie zelf gedockt of gesleept is, houdt zijn plek. Alleen de rest wordt
       automatisch verdeeld -- anders gooit de shell het werk van de gebruiker
       elke keer overhoop. */
    var vrij = schil.surfaces.filter(function (s) { return !s.eigen; });
    var k = vrij.length;
    if (!k) return;

    // tot twee naast elkaar, daarboven een raster van twee kolommen
    var kol = k === 1 ? 1 : 2;
    var rij = Math.ceil(k / kol);
    var sb = Math.floor((breed - g * (kol - 1)) / kol);
    var sh = Math.floor((hoog - g * (rij - 1)) / rij);
    vrij.forEach(function (s, i) {
      var c = i % kol, r = Math.floor(i / kol);
      zet(s.el, x0 + c * (sb + g), g + r * (sh + g), sb, sh);
    });
  }

  function zet(e, x, y, b, h) {
    e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.width = b + 'px'; e.style.height = h + 'px';
  }
/* surfaces: een venster openen, sluiten en naar voren halen */
  function open(id, opties) {
    opties = opties || {};
    var bestaand = vind(id);
    if (bestaand) { maakActief(bestaand); return bestaand; }
    /* Vier is een systeemgrens, geen aanbeveling. Een vijfde app vervangt de
       oudste niet-actieve app zodat de werktafel nooit buiten 2 x 2 groeit. */
    if (standaard() && schil.surfaces.length >= 4) {
      var oud = schil.surfaces.filter(function (x) { return x !== schil.actief; })[0] || schil.surfaces[0];
      if (oud) sluit(oud.id);
    }

    var e = el('article', 'rtg-surface', schil.vak);
    e.dataset.id = id;
    e.dataset.zoom = opties.zoom || 'work';
    e.setAttribute('aria-label', opties.naam || id);

    var h = el('header', 'rtg-handle', e);
    h.innerHTML = '<span class="naam">' + esc(opties.naam || id) + '</span>' +
      '<span class="rek"></span>' +
      '<button type="button" data-doe="zoom" title="Kleiner of groter">&#9633;</button>' +
      '<button type="button" data-doe="sluit" title="Sluiten">&times;</button>';

    el('div', 'kort', e).innerHTML = opties.kort || '';
    var vlak = el('div', 'vlak', e);
    var veiligeUrl = oppervlakUrl(opties.url || '');
    if (veiligeUrl) {
      var f = d.createElement('iframe');
      f.setAttribute('title', opties.naam || id);
      /* Het recht op camera en microfoon doorgeven VOOR de src wordt gezet.
         Zonder dit vallen ze in een surface stil weg: de app vraagt netjes, de
         browser weigert zonder melding, en de gebruiker ziet alleen dat het
         niet werkt. De mediapoort is er precies om dat te voorkomen. */
      if (w.RTGMedia && w.RTGMedia.kader) w.RTGMedia.kader(f);
      /* De app draait als eigen pagina in de surface. Dat is met opzet: een app
         houdt zijn eigen diepte en zijn eigen sessie, en de shell hoeft niets
         van zijn binnenkant te weten (PLATFORM.md). */
      f.src = veiligeUrl;
      vlak.appendChild(f);
    }

    /* Het adres hoort BIJ de surface. Een werkruimte bewaart een meubelplan
       (naam, adres, zoom) en moet dat adres dus kunnen teruglezen; stond het
       alleen in de opties, dan wist de shell na het openen niet meer wat er in
       een surface draaide. */
    var s = { id: id, naam: opties.naam || id, url: veiligeUrl, el: e, zoom: e.dataset.zoom, eigen: false };
    schil.surfaces.push(s);
    /* Een pointer in een iframe borrelt niet door naar het bovenliggende
       article. De apps zijn same-origin, dus koppelen we hun eerste aanraking
       expliciet terug: werken in een vak maakt precies dat vak actief en laat
       breadcrumb, functies, hoofdactie en Rahul-context meteen meeschakelen. */
    var kader = e.querySelector('iframe');
    if (kader) kader.addEventListener('load', function () {
      try { kader.contentDocument.addEventListener('pointerdown', function () { maakActief(s); }, true); }
      catch (fout) { /* een niet-lokaal kader blijft via de eigen kop selecteerbaar */ }
    });

    h.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button')) return;
      sleep(s, ev);
    });
    h.addEventListener('dblclick', function () { zoom(s, 'deep'); });
    h.querySelector('[data-doe="sluit"]').addEventListener('click', function () { sluit(id); });
    h.querySelector('[data-doe="zoom"]').addEventListener('click', function () {
      zoom(s, s.zoom === 'glance' ? 'work' : 'glance');
    });
    e.addEventListener('pointerdown', function () { maakActief(s); });

    maakActief(s);
    schik();
    tekenConsole();
    return s;
  }

  function vind(id) {
    for (var i = 0; i < schil.surfaces.length; i++) if (schil.surfaces[i].id === id) return schil.surfaces[i];
    return null;
  }

  function tekenTabbar() {
    if (!schil.tabbar) return;
    schil.tabbar.innerHTML = '';
    schil.surfaces.forEach(function (s) {
      var tab = el('div', 'rtg-tab', schil.tabbar);
      if (schil.actief === s) tab.setAttribute('data-actief', '');
      var kies = el('button', 'rtg-tab-kies', tab);
      kies.type = 'button'; kies.textContent = s.naam;
      kies.setAttribute('aria-label', 'Open ' + s.naam);
      kies.addEventListener('click', function () { maakActief(s); });
      var dicht = el('button', 'rtg-tab-sluit', tab);
      dicht.type = 'button'; dicht.innerHTML = '&times;';
      dicht.setAttribute('aria-label', 'Sluit ' + esc(s.naam));
      dicht.addEventListener('click', function () { sluit(s.id); });
    });
  }

  function sluit(id) {
    var s = vind(id); if (!s) return;
    s.el.remove();
    schil.surfaces = schil.surfaces.filter(function (x) { return x !== s; });
    if (schil.actief === s) schil.actief = schil.surfaces[schil.surfaces.length - 1] || null;
    if (schil.actief) maakActief(schil.actief);
    schik(); tekenConsole(); tekenTabs();
  }

  function maakActief(s) {
    schil.surfaces.forEach(function (x) { x.el.removeAttribute('data-actief'); });
    s.el.setAttribute('data-actief', '');
    schil.actief = s;
    // de actieve surface bovenop, zodat zweven ook echt zweeft
    schil.surfaces.forEach(function (x, i) { x.el.style.zIndex = String(10 + i); });
    s.el.style.zIndex = '40';
    if (w.RTGEdge) w.RTGEdge.setContext({
      title: s.naam, tool: s.id, actie: (schil.actionPrefix || 'Open') + ' ' + s.naam
    });
    schik();
    tekenConsole(); tekenTabs();
  }

  /* Deep maakt er een dominante van en zet de rest op Glance: zo blijft de
     werkruimte vloeiend in plaats van een stapel gelijke vensters
     (WERKRUIMTE.md par. 4). */
  function zoom(s, stand) {
    s.zoom = stand; s.el.dataset.zoom = stand;
    if (stand === 'deep') {
      schil.surfaces.forEach(function (x) {
        if (x !== s) { x.zoom = 'glance'; x.el.dataset.zoom = 'glance'; }
      });
      maakActief(s);
    }
    schik();
  }
/* verplaatsen: een surface aan zijn gouden greep verslepen */
  function sleep(s, ev) {
    var m = meet();
    var start = s.el.getBoundingClientRect();
    var vakR = schil.vak.getBoundingClientRect();
    var dx = ev.clientX - start.left, dy = ev.clientY - start.top;
    var rand = null;
    s.el.setAttribute('data-sleept', '');
    maakActief(s);

    function beweeg(e) {
      var x = e.clientX - vakR.left - dx, y = e.clientY - vakR.top - dy;
      s.el.style.left = x + 'px'; s.el.style.top = y + 'px';
      rand = randBij(e.clientX - vakR.left, e.clientY - vakR.top, m);
      toonDok(rand, m);
    }
    function los() {
      d.removeEventListener('pointermove', beweeg);
      d.removeEventListener('pointerup', los);
      s.el.removeAttribute('data-sleept');
      schil.dok.removeAttribute('data-aan');
      if (rand) { dok(s, rand, m); }
      else { s.eigen = true; }   // vrij neergezet: hij houdt zijn plek
    }
    d.addEventListener('pointermove', beweeg);
    d.addEventListener('pointerup', los);
  }

  function randBij(x, y, m) {
    if (x < MARGE) return RANDEN.links;
    if (x > m.b - MARGE) return RANDEN.rechts;
    if (y < MARGE) return RANDEN.boven;
    if (y > m.h - MARGE) return RANDEN.onder;
    return null;
  }

  function dokVak(rand, m) {
    var g = m.g, halfB = Math.floor((m.b - g * 3) / 2), halfH = Math.floor((m.h - g * 3) / 2);
    if (rand === RANDEN.links)  return [g, g, halfB, m.h - g * 2];
    if (rand === RANDEN.rechts) return [g * 2 + halfB, g, halfB, m.h - g * 2];
    if (rand === RANDEN.boven)  return [g, g, m.b - g * 2, halfH];
    return [g, g * 2 + halfH, m.b - g * 2, halfH];
  }

  function toonDok(rand, m) {
    if (!rand) { schil.dok.removeAttribute('data-aan'); return; }
    var v = dokVak(rand, m);
    zet(schil.dok, v[0], v[1], v[2], v[3]);
    schil.dok.setAttribute('data-aan', '');
  }

  function dok(s, rand, m) {
    var v = dokVak(rand, m);
    zet(s.el, v[0], v[1], v[2], v[3]);
    s.eigen = true;
  }

  /* ------------------------------------------------------- context linking --
     De shell stuurt alleen een VERWIJZING rond: soort, id, label. Nooit de
     gegevens zelf. Elke surface lost hem op met zijn eigen sessie en zijn eigen
     rechten, zodat de werkruimte geen sluiproute wordt naar iets waar je niet
     bij mag (WERKRUIMTE.md par. 5). */
  function context(ref) {
    if (!ref || !ref.id) { schil.huidigeContext = null; tekenConsole(); return; }
    schil.huidigeContext = { soort: String(ref.soort || ''), id: String(ref.id), label: String(ref.label || '') };
    schil.luisteraars.forEach(function (fn) {
      try { fn(schil.huidigeContext); } catch (e) { /* een luisteraar die stukgaat neemt de rest niet mee */ }
    });
    // de surfaces die als eigen pagina draaien, krijgen hem over de framegrens
    schil.surfaces.forEach(function (s) {
      var f = s.el.querySelector('iframe');
      if (f && f.contentWindow) {
        try { f.contentWindow.postMessage({ rtg: 'context', ref: schil.huidigeContext }, location.origin); }
        catch (e) { /* een frame dat nog laadt hoort de volgende wel */ }
      }
    });
    tekenConsole();
  }
  function opContext(fn) { if (typeof fn === 'function') schil.luisteraars.push(fn); }

  /* --------------------------------------------------------- de console -- */
  function tekenConsole() {
    schil.console.querySelectorAll('[data-open]').forEach(function (b) {
      var geopend = vind(b.dataset.open);
      b.toggleAttribute('data-huidig', !!(geopend && schil.actief === geopend));
    });
    var c = schil.console.querySelector('[data-actieflijst]');
    if (c) {
      c.innerHTML = schil.surfaces.length
        ? schil.surfaces.map(function (s) {
            return '<button type="button" data-ga="' + esc(s.id) + '"' +
              (schil.actief === s ? ' data-open' : '') + '>' + esc(s.naam) + '</button>';
          }).join('')
        : '<span class="stil" style="font-size:.78rem;">nog niets open</span>';
      c.querySelectorAll('[data-ga]').forEach(function (b) {
        b.addEventListener('click', function () { var s = vind(b.dataset.ga); if (s) { zoom(s, 'work'); maakActief(s); } });
      });
    }
    /* De bewaarde werkruimtes. Ze staan in de console en niet in een menu:
       de console IS de navigator (WERKRUIMTE.md par. 10), en een kamer
       terughalen is navigeren. */
    var wr = schil.console.querySelector('[data-ruimtes]');
    if (wr) {
      var namen = Object.keys(alleRuimtes());
      wr.innerHTML = namen.length
        ? namen.map(function (n) {
            return '<button type="button" data-ruimte="' + esc(n) + '">' + esc(n) + '</button>';
          }).join('')
        : '<span class="stil" style="font-size:.78rem;">nog niets bewaard</span>';
      wr.querySelectorAll('[data-ruimte]').forEach(function (b) {
        b.addEventListener('click', function () { haalRuimte(b.dataset.ruimte); });
      });
    }
    var ctx = schil.console.querySelector('[data-context]');
    if (ctx) {
      ctx.innerHTML = schil.huidigeContext
        ? 'Alles op <b>' + esc(schil.huidigeContext.id) + '</b><br>' + esc(schil.huidigeContext.label)
        : 'Geen gedeelde context. Kies iets in een app; de rest volgt.';
    }
  }

  /* Een tab is één echt open oppervlak: kiezen activeert het scherm en het
     kruis sluit precies dat scherm. */
  function tekenTabs() {
    if (!schil.tabs) return;
    schil.tabs.innerHTML = schil.surfaces.map(function (s) {
      return '<div class="rtg-tab" data-id="' + esc(s.id) + '"' +
        (schil.actief === s ? ' data-actief' : '') + '>' +
        '<button type="button" class="rtg-tab-kies">' + esc(s.naam) + '</button>' +
        '<button type="button" class="rtg-tab-sluit" aria-label="Sluit ' + esc(s.naam) + '">&times;</button>' +
        '</div>';
    }).join('');
    schil.tabs.querySelectorAll('.rtg-tab').forEach(function (tab) {
      tab.querySelector('.rtg-tab-kies').addEventListener('click', function () {
        var s = vind(tab.dataset.id); if (s) maakActief(s);
      });
      tab.querySelector('.rtg-tab-kies').addEventListener('dblclick', function () {
        var s = vind(tab.dataset.id); if (s) zoom(s, 'deep');
      });
      tab.querySelector('.rtg-tab-sluit').addEventListener('click', function () { sluit(tab.dataset.id); });
    });
  }
  /* ------------------------------------------------------- werkruimtes --
     Stap 5 uit WERKRUIMTE.md. Een gerangschikte set surfaces is opslaanbaar en
     met één klik terug te halen: "Mijn Directie", "Reisbureau",
     "Restaurantavond". Eén klik en de hele kamer staat er.

     WAT ER BEWAARD WORDT is met opzet weinig: per surface een naam, een adres,
     de zoomstand, en -- alleen als de gebruiker hem zelf heeft neergezet -- de
     rechthoek. Geen inhoud, geen gegevens, geen sessie. Een werkruimte is een
     MEUBELPLAN en geen kopie van het werk; wie hem terughaalt, opent dezelfde
     apps opnieuw met zijn eigen rechten. Zou hier inhoud in staan, dan was de
     werkruimte een tweede administratie en een sluiproute langs de rechten --
     precies wat par. 5 over Context Linking al verbiedt.

     Per toestel, in localStorage. Een meubelplan hoort bij een scherm: wat op
     een breed bureau klopt, klopt niet op een laptop. */
  var WKEY = 'rtg_werkruimtes_v1';

  function alleRuimtes() {
    try { return JSON.parse(localStorage.getItem(WKEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function bewaarAlle(o) {
    try { localStorage.setItem(WKEY, JSON.stringify(o)); } catch (e) { /* vol of geweigerd */ }
  }

  function bewaarRuimte(naam) {
    var n = String(naam || '').trim();
    if (!n) return null;
    var o = alleRuimtes();
    o[n] = schil.surfaces.map(function (s) {
      var r = { id: s.id, naam: s.naam, url: s.url || '', zoom: s.zoom };
      /* Alleen de rechthoek van wie ZELF is neergezet. De rest wordt door
         schik() verdeeld, en die verdeling hangt af van de schermmaat -- die
         vastleggen zou hem juist verkeerd terugzetten. */
      if (s.eigen) r.vak = { x: s.el.offsetLeft, y: s.el.offsetTop, b: s.el.offsetWidth, h: s.el.offsetHeight };
      return r;
    });
    bewaarAlle(o);
    tekenConsole();
    return n;
  }

  function haalRuimte(naam) {
    var lijst = alleRuimtes()[String(naam || '')];
    if (!lijst) return false;
    // eerst leeg, anders staat de vorige kamer er nog doorheen
    schil.surfaces.slice().forEach(function (s) { sluit(s.id); });
    lijst.forEach(function (r) {
      var s = open(r.id, { naam: r.naam, url: r.url, kort: r.naam, zoom: r.zoom });
      if (r.vak && s) {
        s.eigen = true;
        zet(s.el, r.vak.x, r.vak.y, r.vak.b, r.vak.h);
      }
    });
    schik(); tekenConsole();
    return true;
  }

  function wisRuimte(naam) {
    var o = alleRuimtes();
    if (!(naam in o)) return false;
    delete o[naam]; bewaarAlle(o); tekenConsole();
    return true;
  }

  /* ------------------------------------------------------------ het palet --
     Stap 6 uit WERKRUIMTE.md: de console IS de navigator, en ⌘K is zijn mond.
     Hier stond een zoekregel die alleen op naam kon openen; die beloofde al
     niets meer dan hij deed, maar hij kon ook niet veel.

     Wat er nu in zit: apps openen, een bewaarde werkruimte terughalen, de
     huidige ruimte bewaren, en een surface sluiten. Geen fuzzy zoeken en geen
     scores -- een palet dat je niet kunt voorspellen, kun je ook niet uit je
     hoofd leren, en dat is precies waar zo'n palet voor bestaat. */
  function paletBronnen() {
    var uit = [];
    (schil.apps || []).forEach(function (a) {
      uit.push({ soort: 'app', label: a.naam, hint: 'openen',
        doe: function () { open(a.id, { naam: a.naam, url: a.url, kort: a.naam }); } });
    });
    Object.keys(alleRuimtes()).forEach(function (n) {
      uit.push({ soort: 'ruimte', label: n, hint: 'werkruimte terughalen',
        doe: function () { haalRuimte(n); } });
    });
    schil.surfaces.forEach(function (s) {
      uit.push({ soort: 'sluit', label: 'Sluit ' + s.naam, hint: 'surface sluiten',
        doe: function () { sluit(s.id); } });
    });
    return uit;
  }

  function paletTreffers(t) {
    var q = String(t || '').trim().toLowerCase();
    var bron = paletBronnen();
    if (!q) return bron.slice(0, 8);
    /* Beginnend met wat je typt gaat voor; daarna wat het bevat. Zo staat wat
       je bedoelde bovenaan zodra je genoeg getypt hebt, en verschuift de
       eerste regel niet meer onder je vingers vandaan. */
    var begin = bron.filter(function (x) { return x.label.toLowerCase().indexOf(q) === 0; });
    var bevat = bron.filter(function (x) {
      return x.label.toLowerCase().indexOf(q) > 0 && begin.indexOf(x) === -1;
    });
    return begin.concat(bevat).slice(0, 8);
  }
  /* ----------------------------------------------- objecten tussen apps --
     Stap 7 uit WERKRUIMTE.md. Niet alleen surfaces bewegen; de OBJECTEN
     bewegen door RTG heen: een reis naar de Agenda, een persoon naar een
     uitnodiging, een factuur naar een boeking.

     TWEE REGELS, en die maken het verschil met "een desktop met vensters".

     1. EEN SLEEP IS EEN VOORSTEL, GEEN HANDELING. Loslaten toont wat er gaat
        gebeuren en wie het uitvoert; bevestigen doet een mens. Dezelfde drempel
        als bij geld en bij Rahul (CLAUDE.md). Zonder die stap is een uitschieter
        met de muis een afspraak in iemands agenda.

     2. DE SCHIL DRAAGT EEN VERWIJZING, NOOIT EEN DOSSIER. Hetzelfde als bij
        Context Linking (par. 5): de ontvanger doet de handeling met ZIJN eigen
        sessie en ZIJN eigen rechten. De schil weet niet wat een reis is en mag
        dat ook niet weten -- anders kruipt domeinkennis in de vensterlaag.

     Wat een verwijzing WEL mag dragen: soort, id, label, en een klein aantal
     `velden` die de verzender al op het scherm had staan. Dat is geen
     sluiproute: het is dezelfde gebruiker, in dezelfde browser, die dat net zelf
     zag staan. Wat er NOOIT in mag: iets wat de verzender zelf niet toonde.

     HET GESPREK, in vier berichten (alle vier same-origin postMessage):
       app  -> schil   sleep-start   {object:{soort,id,label,velden}}
       schil-> app     sleep-kan     {object}          "kun jij hier iets mee?"
       app  -> schil   sleep-kan-ja  {wat:'...'}       "ja: ik zet er een afspraak van"
       schil-> app     sleep-doe     {object}          pas NA bevestiging door een mens
     Een app die niet antwoordt, is geen doelwit. Zwijgen is nee. */

  var sleepObject = null;      // wat er nu gesleept wordt
  var sleepDoel = null;        // de surface waar de muis boven hangt
  var sleepAanbod = {};        // surface-id -> wat die surface ermee zou doen

  function surfaceVanVenster(bron) {
    for (var i = 0; i < schil.surfaces.length; i++) {
      var f = schil.surfaces[i].el.querySelector('iframe');
      if (f && f.contentWindow === bron) return schil.surfaces[i];
    }
    return null;
  }

  function naarSurface(s, bericht) {
    var f = s.el.querySelector('iframe');
    if (!f || !f.contentWindow) return;
    try { f.contentWindow.postMessage(bericht, location.origin); } catch (e) { /* laadt nog */ }
  }

  /* Bij het oppakken vragen we ALLE andere surfaces of ze er iets mee kunnen.
     Vooraf en niet bij het loslaten: zo kan de schil tijdens het slepen laten
     zien welke surfaces oplichten, en weet de gebruiker waar hij heen kan
     voordat hij loslaat. */
  /* EEN VANGVLAK OVER DE HELE RUIMTE, zolang er gesleept wordt.
     Een surface draait als eigen pagina in een iframe, en zodra de cursor daar
     boven hangt gaan de pointer-events NAAR DAT FRAME. De schil zag de muis dan
     niet meer bewegen en wist bij loslaten niet waar hij was: je sleepte iets
     naar de agenda en er gebeurde niets. Dit doorzichtige vlak vangt de
     beweging op zolang het slepen duurt, en verdwijnt daarna meteen -- want een
     vlak dat blijft liggen maakt elke app onklikbaar. */
  function vangvlak(aan) {
    var v = schil.vak.querySelector('.rtg-sleepvangst');
    if (aan) {
      if (!v) v = el('div', 'rtg-sleepvangst', schil.vak);
      v.setAttribute('data-aan', '');
    } else if (v) { v.removeAttribute('data-aan'); }
  }

  function sleepStart(vanSurface, object) {
    sleepObject = object;
    sleepAanbod = {};
    schil.vak.setAttribute('data-sleept-object', '');
    vangvlak(true);
    schil.surfaces.forEach(function (s) {
      if (s === vanSurface) return;
      naarSurface(s, { rtg: 'sleep-kan', object: object });
    });
    d.addEventListener('pointermove', sleepBeweeg);
    d.addEventListener('pointerup', sleepLos);
  }

  function sleepKanJa(s, wat) {
    if (!sleepObject || !wat) return;
    sleepAanbod[s.id] = String(wat).slice(0, 120);
    s.el.setAttribute('data-kan-vangen', '');
    var tab = tabVanSurface(s);
    if (tab) tab.setAttribute('data-kan-vangen', '');
  }

  function tabVanSurface(s) {
    if (!schil.tabs) return null;
    var tabs = schil.tabs.querySelectorAll('.rtg-tab[data-id]');
    for (var i = 0; i < tabs.length; i++) if (tabs[i].dataset.id === s.id) return tabs[i];
    return null;
  }

  function surfaceOp(x, y) {
    /* In de standaard Werk OS-weergave staat maar een appvlak tegelijk open.
       De overige apps zijn bereikbaar via hun zichtbare tab. Een tab die door
       de ontvangende app als doel is aanvaard, is daarom een volwaardig
       sleepdoel: zo hoeft de gebruiker een app niet eerst te openen en het
       object daarna opnieuw op te pakken. */
    if (schil.tabs) {
      var tabs = schil.tabs.querySelectorAll('.rtg-tab[data-id][data-kan-vangen]');
      for (var t = tabs.length - 1; t >= 0; t--) {
        var tr = tabs[t].getBoundingClientRect();
        if (x >= tr.left && x <= tr.right && y >= tr.top && y <= tr.bottom) return vind(tabs[t].dataset.id);
      }
    }
    for (var i = schil.surfaces.length - 1; i >= 0; i--) {
      var stijl = w.getComputedStyle(schil.surfaces[i].el);
      if (stijl.visibility === 'hidden' || stijl.display === 'none' || stijl.pointerEvents === 'none') continue;
      var r = schil.surfaces[i].el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return schil.surfaces[i];
    }
    return null;
  }

  function sleepBeweeg(e) {
    var s = surfaceOp(e.clientX, e.clientY);
    var nieuw = (s && sleepAanbod[s.id]) ? s : null;
    if (nieuw === sleepDoel) return;
    if (sleepDoel) {
      sleepDoel.el.removeAttribute('data-vangt');
      var oudTab = tabVanSurface(sleepDoel);
      if (oudTab) oudTab.removeAttribute('data-vangt');
    }
    sleepDoel = nieuw;
    if (sleepDoel) {
      sleepDoel.el.setAttribute('data-vangt', '');
      var nieuwTab = tabVanSurface(sleepDoel);
      if (nieuwTab) nieuwTab.setAttribute('data-vangt', '');
    }
  }

  function sleepLos() {
    d.removeEventListener('pointermove', sleepBeweeg);
    d.removeEventListener('pointerup', sleepLos);
    schil.vak.removeAttribute('data-sleept-object');
    vangvlak(false);
    schil.surfaces.forEach(function (s) {
      s.el.removeAttribute('data-kan-vangen'); s.el.removeAttribute('data-vangt');
    });
    if (schil.tabs) schil.tabs.querySelectorAll('[data-kan-vangen],[data-vangt]').forEach(function (tab) {
      tab.removeAttribute('data-kan-vangen'); tab.removeAttribute('data-vangt');
    });
    var doel = sleepDoel, object = sleepObject;
    sleepDoel = null;
    if (!doel || !object) { sleepObject = null; return; }
    toonVoorstel(doel, object, sleepAanbod[doel.id]);
  }

  /* HET VOORSTEL. Hier staat wat er gaat gebeuren, met WELK object en door
     WELKE app -- en niets gebeurt tot een mens op bevestigen drukt. */
  function toonVoorstel(doel, object, wat) {
    var vak = schil.vak.querySelector('.rtg-voorstel') || el('div', 'rtg-voorstel', schil.vak);
    vak.innerHTML =
      '<div class="doos" role="dialog" aria-modal="true" aria-label="Voorstel">' +
        '<p class="wat"></p>' +
        '<p class="wie"></p>' +
        '<div class="knoppen">' +
          '<button type="button" data-doe="nee">Annuleren</button>' +
          '<button type="button" data-doe="ja" class="vol">Bevestigen</button>' +
        '</div>' +
      '</div>';
    vak.querySelector('.wat').textContent = (object.label || object.soort) + ': ' + wat;
    vak.querySelector('.wie').textContent = 'Uitgevoerd door ' + doel.naam + ', met uw rechten daar.';
    vak.setAttribute('data-aan', '');
    var weg = function () { vak.removeAttribute('data-aan'); vak.innerHTML = ''; sleepObject = null; };
    vak.querySelector('[data-doe="nee"]').addEventListener('click', weg);
    vak.querySelector('[data-doe="ja"]').addEventListener('click', function () {
      naarSurface(doel, { rtg: 'sleep-doe', object: object });
      maakActief(doel);
      weg();
    });
    vak.querySelector('[data-doe="ja"]').focus();
  }

  /* Wat een app mag sturen, en wat er van gelezen wordt. Alles wordt gekapt:
     een verwijzing hoort klein te zijn, en een app die er een dossier in propt
     krijgt hem afgekapt in plaats van dat de schil hem doorgeeft. */
  function schoneVerwijzing(o) {
    if (!o || !o.id) return null;
    var velden = {};
    var bron = o.velden && typeof o.velden === 'object' ? o.velden : {};
    var namen = Object.keys(bron).slice(0, 8);
    namen.forEach(function (n) { velden[String(n).slice(0, 24)] = String(bron[n] == null ? '' : bron[n]).slice(0, 120); });
    return {
      soort: String(o.soort || '').slice(0, 32),
      id: String(o.id).slice(0, 64),
      label: String(o.label || '').slice(0, 120),
      velden: velden
    };
  }
  /* ------------------------------------------------------------ opstarten --
     Dit deel sluit de omhulsel-functie af en hangt RTGSchil op. Het MOET het
     laatste deel van de reeks zijn: alles wat er hierna nog geschreven wordt,
     staat buiten de IIFE en doet niets. De delen worden op bestandsnaam
     aaneengeplakt (scripts/bundel.js), dus "laatste" betekent hier letterlijk
     "hoogste nummer". Toets 43 in scripts/check.js vangt het als iemand dat
     alsnog vergeet. */
  function start(opties) {
    opties = opties || {};
    schil.vak = opties.vak || d.querySelector('.rtg-werkruimte');
    schil.console = opties.console || schil.vak.querySelector('.rtg-console');
    schil.tabs = el('nav', 'rtg-tabbar', schil.vak);
    schil.tabs.setAttribute('aria-label', 'Open software');
    schil.dok = el('div', 'rtg-dok', schil.vak);
    /* De apps die dit scherm kan openen. De shell KENT ze niet uit zichzelf --
       hij weet niets van domeinen -- maar het palet moet ergens uit kunnen
       putten, dus geeft de pagina zijn lijst mee. */
    schil.apps = (opties.apps || []).slice();
    schil.actionPrefix = opties.actionPrefix || 'Open';
    w.addEventListener('resize', schik);
    w.addEventListener('rtg-edge-layout', schik);
    /* Berichten uit de surfaces. Alleen van dezelfde herkomst -- een surface
       is een eigen pagina, maar altijd onze eigen. */
    w.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.rtg === 'context') { context(e.data.ref); return; }
      var s = surfaceVanVenster(e.source);
      if (!s) return;                       // een venster dat geen surface is, telt niet mee
      if (e.data.rtg === 'sleep-start') {
        var v = schoneVerwijzing(e.data.object);
        if (v) sleepStart(s, v);
      } else if (e.data.rtg === 'sleep-kan-ja') {
        sleepKanJa(s, e.data.wat);
      }
    });
    schik(); tekenConsole(); tekenTabs();
    return w.RTGSchil;
  }

  w.RTGSchil = {
    start: start, open: open, sluit: sluit, zoom: zoom,
    context: context, opContext: opContext,
    // stap 5: werkruimtes
    bewaarRuimte: bewaarRuimte, haalRuimte: haalRuimte, wisRuimte: wisRuimte,
    get ruimtes() { return Object.keys(alleRuimtes()); },
    // stap 6: het palet
    palet: paletTreffers,
    /* stap 7: objecten tussen apps. Een app in een surface roept dit NIET aan --
       die praat via postMessage, want hij draait in een eigen venster. Dit staat
       er voor de werkruimte-pagina zelf en voor de toetsen. */
    sleepStart: sleepStart, schoneVerwijzing: schoneVerwijzing,
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
