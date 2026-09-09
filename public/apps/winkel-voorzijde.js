/* Eén onderste navigatie voor de bestaande Mall, Mijn Mall en Commerce. Op
   Mijn Mall bepaalt de hash welke rustige voordeur openstaat; de gegevens zelf
   blijven door mijnmall*.js uit de bestaande bronnen komen. */
(function (w, d) {
  'use strict';
  function nav(huidig) {
    var el = d.createElement('nav');
    el.className = 'shop-nav'; el.setAttribute('aria-label', 'Winkel');
    el.innerHTML =
      '<a href="/apps/mall.html" data-shop="ontdekken">Ontdekken</a>' +
      '<a href="/apps/mijnmall.html#bewaard" data-shop="bewaard">Bewaard</a>' +
      '<a class="shop-bag" href="/apps/commerce.html#mand-sec" aria-label="Open uw mand"><span>Mand</span></a>' +
      '<a href="/apps/mijnmall.html#bestellingen" data-shop="bestellingen">Bestellingen</a>' +
      '<a href="/apps/mijnmall.html#meer" data-shop="meer">Meer</a>';
    var actief = el.querySelector('[data-shop="' + huidig + '"]');
    if (actief) actief.setAttribute('aria-current', 'page');
    d.body.appendChild(el);
    return el;
  }

  function mijnMall() {
    var kop = d.getElementById('shopKop'), sub = d.getElementById('shopSub');
    var navEl = nav('bestellingen');
    var teksten = {
      bewaard: ['Op tijd onthouden. Zonder opnieuw te zoeken.', 'Bewaar wat u nodig heeft en zie wat er veranderde.'],
      bestellingen: ['Weten waar het is. Van winkel tot voordeur.', 'Bestellingen, tafels, reizen en verblijven in één betrouwbaar overzicht.'],
      meer: ['Meer wanneer u het nodig heeft.', 'Uw lijsten, aanvragen en samengestelde collecties blijven dichtbij.']
    };
    function open() {
      var view = (w.location.hash || '#bestellingen').slice(1);
      if (!teksten[view]) view = 'bestellingen';
      d.querySelectorAll('.shop-panel').forEach(function (p) { p.hidden = p.dataset.shopView !== view; });
      navEl.querySelectorAll('[data-shop]').forEach(function (a) {
        if (a.dataset.shop === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      if (kop) kop.textContent = teksten[view][0];
      if (sub) sub.textContent = teksten[view][1];
    }
    open(); w.addEventListener('hashchange', open);
  }

  d.addEventListener('DOMContentLoaded', function () {
    if (!d.body.classList.contains('rtg-shop-flow')) return;
    if (d.body.classList.contains('rtg-shop-my')) mijnMall(); else nav('ontdekken');
  });
})(window, document);
