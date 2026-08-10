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

    var s = { id: id, naam: opties.naam || id, el: e, zoom: e.dataset.zoom, eigen: false };
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
    var ctx = schil.console.querySelector('[data-context]');
    if (ctx) {
      ctx.innerHTML = schil.huidigeContext
        ? 'Alles op <b>' + esc(schil.huidigeContext.id) + '</b><br>' + esc(schil.huidigeContext.label)
        : 'Geen gedeelde context. Kies iets in een app; de rest volgt.';
    }
  }

  function start(opties) {
    opties = opties || {};
    schil.vak = opties.vak || d.querySelector('.rtg-werkruimte');
    schil.console = opties.console || schil.vak.querySelector('.rtg-console');
    schil.dok = el('div', 'rtg-dok', schil.vak);
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
    get surfaces() { return schil.surfaces.slice(); },
    get actief() { return schil.actief; }
  };
})(window, document);
