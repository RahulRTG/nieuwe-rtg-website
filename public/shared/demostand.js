/* Toon voorbeeldcodes uitsluitend wanneer de server bevestigt dat RTG_DEMO
   actief is. Op file:// is de pagina per definitie een lokale presentatie.
   Een onbereikbare server is nadrukkelijk GEEN reden om demo-informatie te
   tonen: een storing mag nooit een trainingsstand nabootsen. */
(function () {
  'use strict';
  var velden = Array.prototype.slice.call(document.querySelectorAll('[data-demo-only]'));
  if (!velden.length) return;
  function toon(aan) { velden.forEach(function (el) { el.hidden = !aan; }); }
  toon(false);
  var qs = new URLSearchParams(location.search);
  if (location.protocol === 'file:' || qs.get('demo') === '1' || qs.get('magnaat') === '1') { toon(true); return; }
  if (!(location.protocol === 'http:' || location.protocol === 'https:')) return;
  fetch('/api/health').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (h) { toon(!!(h && h.demo)); }).catch(function () { toon(false); });
})();
