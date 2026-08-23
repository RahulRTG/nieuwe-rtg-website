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
