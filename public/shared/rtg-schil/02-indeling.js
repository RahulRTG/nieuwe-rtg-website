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
    if (schil.tabbar) {
      var bank = Math.max(228, Math.min(286, Math.round(m.b * .18)));
      var tabHoog = 40;
      zet(schil.console, 0, 0, bank, m.h);
      zet(schil.tabbar, bank, 0, m.b - bank, tabHoog);
      var vrijStandaard = schil.surfaces.filter(function (s) { return !s.eigen; });
      if (!vrijStandaard.length) return;
      var kolStandaard = vrijStandaard.length === 1 ? 1 : 2;
      var rijStandaard = Math.ceil(vrijStandaard.length / kolStandaard);
      var breedStandaard = Math.floor((m.b - bank) / kolStandaard);
      var hoogStandaard = Math.floor((m.h - tabHoog) / rijStandaard);
      vrijStandaard.forEach(function (s, i) {
        var c = i % kolStandaard, r = Math.floor(i / kolStandaard);
        zet(s.el, bank + c * breedStandaard, tabHoog + r * hoogStandaard,
          c === kolStandaard - 1 ? m.b - bank - c * breedStandaard : breedStandaard,
          r === rijStandaard - 1 ? m.h - tabHoog - r * hoogStandaard : hoogStandaard);
      });
      return;
    }
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
