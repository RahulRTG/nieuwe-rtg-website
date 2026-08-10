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
    vak: null, console: null, dok: null,
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

  function schik() {
    var m = meet(), g = m.g;
    var n = schil.surfaces.length;
    var consoleBreed = Math.max(300, Math.min(460, Math.round(m.b * 0.26)));

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

  /* ------------------------------------------------------------- surfaces -- */
  function open(id, opties) {
    opties = opties || {};
    var bestaand = vind(id);
    if (bestaand) { maakActief(bestaand); return bestaand; }

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
    if (opties.url) {
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
      f.src = opties.url;
      vlak.appendChild(f);
    }

    /* Het adres hoort BIJ de surface. Een werkruimte bewaart een meubelplan
       (naam, adres, zoom) en moet dat adres dus kunnen teruglezen; stond het
       alleen in de opties, dan wist de shell na het openen niet meer wat er in
       een surface draaide. */
    var s = { id: id, naam: opties.naam || id, url: opties.url || '', el: e, zoom: e.dataset.zoom, eigen: false };
    schil.surfaces.push(s);

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

  function sluit(id) {
    var s = vind(id); if (!s) return;
    s.el.remove();
    schil.surfaces = schil.surfaces.filter(function (x) { return x !== s; });
    if (schil.actief === s) schil.actief = schil.surfaces[schil.surfaces.length - 1] || null;
    if (schil.actief) maakActief(schil.actief);
    schik(); tekenConsole();
  }

  function maakActief(s) {
    schil.surfaces.forEach(function (x) { x.el.removeAttribute('data-actief'); });
    s.el.setAttribute('data-actief', '');
    schil.actief = s;
    // de actieve surface bovenop, zodat zweven ook echt zweeft
    schil.surfaces.forEach(function (x, i) { x.el.style.zIndex = String(10 + i); });
    s.el.style.zIndex = '40';
    tekenConsole();
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

  /* --------------------------------------------------------- verplaatsen -- */
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
    schil.dok = el('div', 'rtg-dok', schil.vak);
    /* De apps die dit scherm kan openen. De shell KENT ze niet uit zichzelf --
       hij weet niets van domeinen -- maar het palet moet ergens uit kunnen
       putten, dus geeft de pagina zijn lijst mee. */
    schil.apps = (opties.apps || []).slice();
    w.addEventListener('resize', schik);
    // een surface die zelf om context roept (uit een frame, zelfde herkomst)
    w.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.rtg !== 'context') return;
      context(e.data.ref);
    });
    schik(); tekenConsole();
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
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
