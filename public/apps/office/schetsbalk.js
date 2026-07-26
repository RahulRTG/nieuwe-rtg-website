/* RTG Office, de werkbalk van de schets: de vormknoppen, dupliceren, de
   volgorde (voor- en achtergrond) en weghalen. De hand zelf (slepen,
   grepen, ongedaan maken) woont in schets.js en geeft deze balk een smalle
   brug: kijken, en langs de gewone weg wijzigen.

   Levert window.RTGOfficeSchetsBalk. */
(function () {
  'use strict';
  var V = window.RTGOfficeSchetsVorm;

  function bouw(z) {
    var b = document.createElement('div');
    b.className = 'sbalk';
    b.innerHTML = V.GEREEDSCHAP.map(function (g) {
      return '<button class="tb' + (z.keuze() === g[0] ? ' aan' : '') + '" data-vorm="' + g[0] + '" type="button">' + g[1] + '</button>';
    }).join('') +
      '<button class="tb" id="sDup" type="button" title="Gekozen vorm dupliceren">Dupliceer</button>' +
      '<button class="tb" id="sAchter" type="button" title="Gekozen vorm naar de achtergrond">Achter</button>' +
      '<button class="tb" id="sVoor" type="button" title="Gekozen vorm naar de voorgrond">Voor</button>' +
      '<button class="tb weg" id="sWeg" type="button" title="Gekozen vorm weghalen">Weg</button>' +
      '<span class="fstil">Sleep om te tekenen · grepen veranderen de maat · dubbelklik voor tekst · Ctrl+Z draait terug</span>';
    Array.prototype.forEach.call(b.querySelectorAll('[data-vorm]'), function (k) {
      k.addEventListener('click', function () { z.zetKeuze(k.dataset.vorm); });
    });
    b.querySelector('#sWeg').addEventListener('click', function () { z.wegSel(); });
    b.querySelector('#sDup').addEventListener('click', function () {
      var sel = z.sel(), vormen = z.vormen();
      if (sel < 0) return z.meld('Klik eerst een vorm aan.');
      if (vormen.length >= 300) return z.meld('Maximaal 300 vormen.');
      z.duw();
      var kopie = JSON.parse(JSON.stringify(vormen[sel]));
      kopie.x += 20; kopie.y += 20;
      if (kopie.soort === 'pijl') { kopie.x2 += 20; kopie.y2 += 20; }
      vormen.push(kopie); z.zetSel(vormen.length - 1);
      z.onWijzig(); z.teken();
    });
    var orde = function (naarVoor) {
      return function () {
        var sel = z.sel(), vormen = z.vormen();
        if (sel < 0) return z.meld('Klik eerst een vorm aan.');
        z.duw();
        var v = vormen.splice(sel, 1)[0];
        if (naarVoor) { vormen.push(v); z.zetSel(vormen.length - 1); }
        else { vormen.unshift(v); z.zetSel(0); }
        z.onWijzig(); z.teken();
      };
    };
    b.querySelector('#sVoor').addEventListener('click', orde(true));
    b.querySelector('#sAchter').addEventListener('click', orde(false));
    return b;
  }

  window.RTGOfficeSchetsBalk = { bouw: bouw };
})();
