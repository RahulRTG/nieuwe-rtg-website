
  /* DEEL 3: het menu in leven houden. Deel 2 bouwt een menu uit wat er NU
     staat; hieronder staat het tweede onderwerp: opnieuw indelen als de app
     zijn scherm hertekent, en de wacht die dat opmerkt. Dat scheelt niet
     alleen bytes (deel 2 raakte de 10 KB), het zijn ook twee verhalen. */

  /* De stand zonder menu: herscan blijft met de hand beschikbaar, de rest heeft
     niets te openen. Op een plek, zodat er nooit twee "geen menu"-standen naast
     elkaar rondgaan. open() geeft hier null terug en niet stilzwijgend niets:
     wie een deel opvraagt hoort te merken dat er geen menu staat. */
  var geenMenu = { herscan: herscan, open: function () { return null; },
    delen: function () { return []; } };

  /* Opnieuw indelen. Veel apps bouwen hun scherm pas na een fetch, en
     sommige hertekenen main bij elke verversing (een bank die een
     saldo-melding krijgt). Een menu dat maar EEN keer scant, ziet daar
     niets -- of wordt weggevaagd. Daarom: eerst schoonvegen wat we vorige
     keer achterlieten, dan opnieuw indelen. */
  function herscan() {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!main) return false;
    /* Vanaf hier is de vorige ronde dood: zijn indeling wijst zo meteen naar
       losgekoppelde kaarten. Eerst loslaten, dan pas opruimen -- anders bleef
       window.RTGDeel na een MISLUKTE hertekening antwoorden alsof er een menu
       stond, en verborg open() kaarten die zonder balk niemand terughaalt. */
    menu = null;
    deelUit(geenMenu);
    /* ALLE balken weg, niet alleen de eerste (dezelfde vorm als de regel
       hieronder voor .rtgdeel-weg). De balk kan in een diepere gastheer staan,
       en een app die zijn scherm uit een momentopname terugzet plakt er zelf
       een kopie bij. Ruimde herscan() er maar EEN op, dan bleef de andere
       staan en zette bouw() er weer een bij: twee balken, waarvan de voorste
       nooit de onze is, dus herbouwde de wacht elke 120 ms opnieuw. */
    var oud = main.querySelectorAll('.rtgdeel-balk');
    for (var b = 0; b < oud.length; b++) oud[b].remove();
    var weg = main.querySelectorAll('.rtgdeel-weg');
    for (var i = 0; i < weg.length; i++) weg[i].classList.remove('rtgdeel-weg');
    return start();
  }

  /* De wacht. Zolang er nog geen menu staat, kijkt hij of de app zijn
     schermen alsnog neerzet; staat het menu er en veegt de app het weg met
     een eigen hertekening, dan bouwt hij het opnieuw. Hij kijkt naar heel de
     boom onder main (zie de observe onderaan deze functie), en negeert wat
     hijzelf verandert (de verbergklasse is een attribuut-wijziging, geen
     childList). */
  function wacht() {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!main || !window.MutationObserver) return;
    var bezig = false, vergeefs = 0;
    var obs = new MutationObserver(function () {
      if (bezig) return;
      bezig = true;
      // na de eerstvolgende rust opnieuw kijken, niet bij elke losse rij
      setTimeout(function () {
        bezig = false;
        /* Staat de balk er nog, en is het ONZE balk van deze ronde? Een app
           die zijn scherm uit een momentopname terugzet, zet ook een kopie van
           onze balk terug: die staat er wel, maar zijn knoppen doen niets. De
           vorige toets hierop (window.RTGDeel) kon dat nooit zien: de regel
           onderaan deze functie zet hem zelf en hij is daarna altijd waar. */
        if (menu && main.querySelector('.rtgdeel-balk') === menu.balk) { vergeefs = 0; return; }
        if (herscan()) { vergeefs = 0; return; }
        /* Een pagina die blijft muteren maar nooit drie delen krijgt (een
           chat die berichten aanvult) hoort geen menu te krijgen EN geen
           eeuwige wacht te betalen. Na veertig vergeefse pogingen is het
           antwoord duidelijk; RTGDeel.herscan() blijft met de hand
           beschikbaar voor wie het later alsnog nodig heeft. (Hier stond
           "twintig": het commit-bericht dat deze wacht invoerde legt veertig
           vast, dus het woord was verouderd en niet het getal.) */
        if (++vergeefs >= 40) obs.disconnect();
      }, 120);
    });
    /* subtree, en niet alleen de directe kinderen: de meeste apps renderen
       niet in main zelf maar in een scherm daarbinnen (main > wrap > vPay).
       Op alleen childList van main werd deze wacht daar nooit wakker. */
    obs.observe(main, { childList: true, subtree: true });

    /* "Een ding tegelijk" verlaagt de drempel van drie naar twee delen. De
       snelle toegankelijkheidslaag kan die klasse NA onze eerste scan zetten:
       defer-scripts draaien wel in volgorde, maar readyState is dan al
       interactive. Een inhoudsobserver ziet een class op <html> niet. Volg
       daarom precies deze ene betekenisvolle omslag en deel opnieuw in; ook
       terug naar normaal ruimt zo een tweedelig menu meteen op. */
    var eenDing = document.documentElement.classList.contains('rtg-eending');
    var profiel = new MutationObserver(function () {
      var nu = document.documentElement.classList.contains('rtg-eending');
      if (nu === eenDing) return;
      eenDing = nu;
      herscan();
    });
    profiel.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (!window.RTGDeel) deelUit(geenMenu);
  }

  /* De hash-luisteraar hoort bij de MODULE, niet bij een ronde. Hij stond in
     bouw() en herscan() kon hem niet opruimen: elke hertekening liet er een
     achter die met de indeling van ZIJN ronde de hash bleef overschrijven, en
     dan kwam een deep-link op het verkeerde deel uit. Nu een luisteraar voor
     de module, die telkens het menu van nu vraagt. */
  function volgHash() {
    var m = /^#deel-(.+)$/.exec(location.hash);
    if (m && menu) menu.api.open(m[1]);
  }

  function begin() { window.addEventListener('hashchange', volgHash); start(); wacht(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
