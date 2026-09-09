/* De getekende LivingOS-voordeur bedient de bestaande MediaOS-ruimtes. */
(function () {
  'use strict';
  var body = document.body;
  var nav = document.querySelector('.media-mobile-nav');
  if (!nav) return;

  function actief(naam) {
    nav.querySelectorAll('[data-media-voor]').forEach(function (b) {
      if (b.dataset.mediaVoor === naam) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    body.classList.toggle('media-discover', naam === 'ontdek');
    var titel = document.querySelector('.media-titel h1');
    var oog = document.querySelector('.media-titel>span');
    if (titel) titel.innerHTML = naam === 'ontdek' ? 'Vind iets dat bij<br>dit moment past.' : 'Minder zoeken.<br>Meer beleven.';
    if (oog) oog.textContent = naam === 'ontdek' ? 'Ontdekken · alle vormen' : 'Vandaag · voor u';
  }

  function open(naam) {
    if (naam === 'studio') document.getElementById('nieuwKnop').click();
    else if (naam === 'bieb') document.getElementById('biebKnop').click();
    else {
      var deur = document.querySelector('[data-media-ruimte="' + naam + '"]');
      if (deur) deur.click();
      var standen = document.getElementById('standen');
      if (naam === 'ontdek' && standen) standen.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    actief(naam);
  }

  nav.querySelectorAll('[data-media-voor]').forEach(function (b) {
    b.addEventListener('click', function () { open(b.dataset.mediaVoor); });
  });
  document.querySelectorAll('[data-media-ruimte="wereld"],[data-media-ruimte="ontdek"]').forEach(function (b) {
    b.addEventListener('click', function () { actief(b.dataset.mediaRuimte); });
  });
  var live = document.querySelector('[data-media-ruimte="live"]');
  if (live) live.addEventListener('click', function () { window.location.href = '/apps/podium.html'; });
})();
