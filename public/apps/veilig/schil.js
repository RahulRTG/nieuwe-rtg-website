/* De schil van RTG Veilig: de standenbalk, de routering en de twee dingen die
   boven de standen uit gaan (de kring en de grens).

   De vier standen melden zich hier aan met RTGVeilig.stand(...). Dat is met
   opzet een aanmelding en geen lijst in dit bestand: zo staat de naam van een
   stand op precies een plek -- in de stand zelf -- en kan deze schil er niet
   naast gaan lopen (LAT.md regel 4).

   De volgorde van de balk is de volgorde waarin de scripts staan in
   veilig.html, en die is niet willekeurig: Thuiswacht eerst omdat dat de stand
   is die mensen kennen en zoeken, Thuisrust laatst omdat hij het minst met
   alarm te maken heeft. */
(function (w, d) {
  'use strict';
  var V = w.RTGVeilig = w.RTGVeilig || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var actief = null;

  /* Een stand wisselen moet de vorige ECHT stoppen. Thuiswacht en Vitaal laten
     allebei een seconde-teller lopen; zonder deze stop tikken er na drie keer
     wisselen drie tellers door op een paneel dat er niet meer staat, en die
     roepen bij nul ook nog eens laad() aan. Elke stand die iets laat lopen,
     geeft daarom een stop() terug. */
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
    $('#standRegel').textContent = s.regel || '';
    $('#standUitleg').innerHTML = s.uitleg || '';
    $('#kringKop').textContent = s.kringKop || 'Uw kring';
    $('#paneel').innerHTML = s.html || '';

    /* Het adres draagt de stand, zodat een link naar een bepaalde stand kan
       wijzen; de vier oude paden leiden hierheen met precies deze hash.

       replaceState en niet pushState, en dat is een keuze: met pushState zou de
       terugknop u eerst door al uw standwissels heen slepen voordat u de app
       uit bent. Wie vier keer heeft rondgekeken, moet dan vier keer terug om
       thuis te komen. Nu brengt terug u waar u vandaan kwam.

       Ook schrijven als de hash NIET opleverde wat er nu staat: een adres met
       een stand die niet bestaat (#onzin, of een oude naam) toont de eerste
       stand, en dan hoort het adres dat ook te zeggen. Anders staat er een hash
       in de balk die iets anders belooft dan het scherm laat zien, en die
       kopieert iemand door.

       De querystring blijft staan: '#stand' is een relatief adres, dus pad en
       query van de huidige pagina blijven eraan hangen. */
    if ((!uitHash || gevraagd !== s.id) && location.hash !== '#' + s.id) {
      try { history.replaceState(null, '', '#' + s.id); } catch (e) { /* file:// */ }
    }
    try { if (typeof s.start === 'function') s.start(); }
    catch (e) { $('#paneel').innerHTML = RTGLeeg.html(RTGLeeg.vanFout(e, {
      ey: 'RTG Veilig', titel: 'Deze stand kon niet openen.' })); }
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
    /* De grens en de kring horen bij de app en niet bij een stand: ze worden
       hier een keer neergezet en overleven het wisselen. In de vier losse apps
       gebeurde dit vier keer, dus ook vier keer een verzoek naar de server voor
       dezelfde kring. */
    $('#grens').innerHTML = w.Veilig.grens();
    w.Veilig.kringKaart($('#kring'));

    toon((location.hash || '').replace(/^#/, ''), true);
    w.addEventListener('hashchange', function () {
      toon((location.hash || '').replace(/^#/, ''), true);
    });
  }

  if (w.Veilig) start();
  else w.addEventListener('load', start);
})(window, document);
