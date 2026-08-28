/* Voorbeeldcodes horen uitsluitend in een pagina die de Magnaat-sandbox zelf
   heeft geactiveerd. Een queryparameter, file://, health-antwoord of storing
   mag in een echt scherm nooit testgegevens zichtbaar maken. */
(function () {
  'use strict';
  var velden = Array.prototype.slice.call(document.querySelectorAll('[data-demo-only]'));
  if (!velden.length) return;
  function toon(aan) { velden.forEach(function (el) { el.hidden = !aan; }); }
  toon(false);
  toon(window.RTG_MAGNAAT_PROEF === true);
})();
