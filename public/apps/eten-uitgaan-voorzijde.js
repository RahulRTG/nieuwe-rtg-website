/* Gedeelde navigatie voor Ontdekken en Mijn avond. Aan tafel is bewust een
   accountloze QR-deur en gebruikt daarom zijn eigen lokale tabbladen. */
(function (w, d) {
  'use strict';
  function nav(huidig) {
    var el = d.createElement('nav');
    el.className = 'night-nav'; el.setAttribute('aria-label', 'Eten en uitgaan');
    el.innerHTML =
      '<a href="/apps/foodcourt.html" data-night="ontdekken">Ontdekken</a>' +
      '<a href="/apps/uitgaan.html#mijn" data-night="avond">Mijn avond</a>' +
      '<a class="night-plus" href="/apps/bestellen.html" aria-label="Eten bestellen"><span>Bestellen</span></a>' +
      '<a href="/apps/app.html#scan" data-night="tafel">Aan tafel</a>' +
      '<a href="/apps/uitgaan.html#ontdekken" data-night="meer">Meer</a>';
    var actief = el.querySelector('[data-night="' + huidig + '"]');
    if (actief) actief.setAttribute('aria-current', 'page');
    d.body.appendChild(el);
  }
  function avondStand() {
    function zet() {
      var mijn = w.location.hash === '#mijn';
      d.body.classList.toggle('night-focus-evening', mijn);
    }
    zet(); w.addEventListener('hashchange', zet); nav('avond');
  }
  d.addEventListener('DOMContentLoaded', function () {
    if (d.body.classList.contains('rtg-night-discover')) nav('ontdekken');
    if (d.body.classList.contains('rtg-night-evening')) avondStand();
  });
})(window, document);
