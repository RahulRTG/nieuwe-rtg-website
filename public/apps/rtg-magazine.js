/* Het bladeren van het RTG-magazine: één pagina met bladen naast elkaar in een
   horizontale scroll-snap-baan. Swipen naar links bladert verder; de pijlen,
   de stippen en de pijltjestoetsen doen hetzelfde. Puur navigatie; de bladen en
   de stijl staan in de HTML en shared/magazine.css. */
(function () {
  'use strict';
  var flip = document.getElementById('flip');
  if (!flip) return;
  var bladen = Array.prototype.slice.call(flip.querySelectorAll('.mag-blad'));
  var n = bladen.length;
  if (!n) return;

  var pager = document.getElementById('pager');
  var vorige = document.getElementById('vorige');
  var volgende = document.getElementById('volgende');
  var teller = document.getElementById('teller');
  var stippenBox = document.getElementById('stippen');
  var RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // stippen opbouwen, één per blad
  var stippen = [];
  if (stippenBox) {
    for (var i = 0; i < n; i++) {
      var s = document.createElement('button');
      s.type = 'button'; s.className = 'stip';
      s.setAttribute('aria-label', 'Blad ' + (i + 1));
      (function (idx) { s.addEventListener('click', function () { ganaar(idx); }); })(i);
      stippenBox.appendChild(s); stippen.push(s);
    }
  }

  var nu = 0;
  function ganaar(idx) {
    idx = Math.max(0, Math.min(n - 1, idx));
    flip.scrollTo({ left: idx * flip.clientWidth, behavior: RUSTIG ? 'auto' : 'smooth' });
  }
  function toon(idx) {
    nu = idx;
    if (teller) teller.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    for (var i = 0; i < stippen.length; i++) stippen[i].classList.toggle('nu', i === idx);
    if (vorige) vorige.disabled = idx === 0;
    if (volgende) volgende.disabled = idx === n - 1;
  }

  var wacht = null;
  flip.addEventListener('scroll', function () {
    if (wacht) return;
    wacht = requestAnimationFrame(function () {
      wacht = null;
      var idx = Math.round(flip.scrollLeft / flip.clientWidth);
      if (idx !== nu) toon(idx);
    });
  }, { passive: true });

  if (vorige) vorige.addEventListener('click', function () { ganaar(nu - 1); });
  if (volgende) volgende.addEventListener('click', function () { ganaar(nu + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { ganaar(nu - 1); }
    else if (e.key === 'ArrowRight') { ganaar(nu + 1); }
  });

  // bij het draaien van het scherm het huidige blad weer netjes uitlijnen
  window.addEventListener('resize', function () { flip.scrollLeft = nu * flip.clientWidth; });

  toon(0);
})();
