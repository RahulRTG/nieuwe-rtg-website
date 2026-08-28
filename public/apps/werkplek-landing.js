/* De buitendeur van de enterprise-campus. Afzonderlijk van de campus zelf: dit
   scherm kent alleen de huizen waarvoor de sessie een sleutel heeft. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var glyf = function (naam) {
    return window.RTGGlyf && RTGGlyf.svgHTML ? RTGGlyf.svgHTML(naam, {}) : '';
  };
  function toon(lijst, open) {
    document.querySelector('#huis').hidden = true;
    document.querySelector('#kiezer').hidden = false;
    document.querySelector('#kiezer').innerHTML = '<section class="campus-landing"><div class="campus-door">' +
      '<div class="campus-wordmark"><span class="campus-seal">RTG</span><div><p>Secure enterprise workspace</p><b>Rahul Group Campus</b></div></div>' +
      '<header><div><span class="campus-kicker">Personeelsingang</span><h1>Waar werkt u vandaag?</h1></div>' +
      '<p>RTG en de RTFoundation delen het platform, maar nooit hun bezetting, cijfers, taken of documenten. Uw persoonlijke sleutel bepaalt welk huis hier verschijnt.</p></header>' +
      '<div class="campus-huizen">' + lijst.map(function (b, i) {
        return '<button class="campus-huis" type="button" data-huis="' + esc(b.code) + '">' +
          '<span class="nummer">0' + (i + 1) + ' · beveiligde campus</span>' +
          '<span class="huisglyf">' + glyf(b.icoon) + '</span><h2>' + esc(b.naam) + '</h2>' +
          '<p class="aard">' + esc(b.aard) + '</p><span class="voet"><span><b>' + esc(b.mensen) + '</b> personeel</span>' +
          '<span><b>' + esc(b.takenOpen) + '</b> open werk</span><span><b>16</b> kantoren</span></span></button>';
      }).join('') + '</div></div></section>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-huis]'), function (b) {
      b.addEventListener('click', function () { open(b.dataset.huis); });
    });
  }
  window.RTGWerkplekLanding = { toon: toon };
})();
