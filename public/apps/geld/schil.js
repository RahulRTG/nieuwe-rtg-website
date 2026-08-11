/* De schil van RTG Geld: de standenbalk en de routering. Hetzelfde patroon als
   RTG Veilig (apps/veilig/schil.js), en met opzet hetzelfde: twee werelden die
   elk hun eigen schil uitvinden zijn twee producten.

   De tien standen melden zich aan met RTGGeld.standen.push(...). Dat is een
   aanmelding en geen lijst in dit bestand: zo staat de naam van een stand op
   precies een plek -- in de stand zelf -- en kan deze schil er niet naast gaan
   lopen (LAT.md regel 4).

   De volgorde van de balk is de volgorde van de scripts in geld.html: het
   overzicht eerst (dat is waar de wereld voor bestaat), dan de dingen die u
   dagelijks aanraakt (wallet, bank, verrekenen), dan de administraties. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var actief = null;

  /* Een stand wisselen moet de vorige ECHT stoppen. De bank luistert naar een
     eventstream en het overzicht kan een verversing hebben lopen; zonder stop
     blijven die doorlopen op een paneel dat er niet meer staat. Elke stand die
     iets laat lopen, geeft daarom een stop() terug. */
  function stop() {
    if (actief && typeof actief.stop === 'function') {
      try { actief.stop(); } catch (e) { /* een stand die stukgaat mag de app niet meenemen */ }
    }
  }

  function vind(id) {
    for (var i = 0; i < V.standen.length; i++) if (V.standen[i].id === id) return V.standen[i];
    return null;
  }

  function toon(id, uitHash) {
    var gevraagd = id;
    var s = vind(id) || V.standen[0];
    if (!s) return;
    stop();
    actief = s;

    var knoppen = $('#standen').querySelectorAll('button');
    for (var i = 0; i < knoppen.length; i++) {
      knoppen[i].setAttribute('aria-current', String(knoppen[i].dataset.id === s.id));
    }
    $('#standUitleg').innerHTML = s.uitleg || '';
    $('#paneel').innerHTML = s.html || '';

    /* replaceState en niet pushState: met pushState sleept de terugknop u
       eerst door al uw standwissels voordat u de app uit bent. En ook
       schrijven als de hash niet opleverde wat er nu staat -- een adres met
       #onzin toont de eerste stand, en dan hoort het adres dat te zeggen.
       De querystring blijft staan ('#stand' is een relatief adres). Alles
       precies zoals in veilig/schil.js, en met opzet zo. */
    if ((!uitHash || gevraagd !== s.id) && location.hash !== '#' + s.id) {
      try { history.replaceState(null, '', '#' + s.id); } catch (e) { /* file:// */ }
    }
    try { if (typeof s.start === 'function') s.start(); }
    catch (e) { $('#paneel').innerHTML = '<p class="stil">Deze stand kon niet openen.</p>'; }
  }
  V.toon = toon;

  function bouw() {
    var nav = $('#standen');
    nav.innerHTML = V.standen.map(function (s) {
      return '<button type="button" data-id="' + s.id + '" aria-current="false">' + s.naam + '</button>';
    }).join('');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-id]');
      if (b) toon(b.dataset.id);
    });
  }

  function start() {
    bouw();
    toon((location.hash || '').replace(/^#/, ''), true);
    w.addEventListener('hashchange', function () {
      toon((location.hash || '').replace(/^#/, ''), true);
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
