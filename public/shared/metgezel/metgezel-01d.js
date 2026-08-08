    /* RAHUL STAAT NERGENS OVERHEEN -- OOK NIET OVER EEN VASTE LAAG.

       Het tussenstuk hierboven (mgz-ruimte) houdt onderaan de PAGINA ruimte
       vrij, en dat werkt voor alles wat gewoon meestroomt: een lange lijst
       eindigt boven de balk in plaats van eronder.

       Maar een app-laag die met position:fixed over het scherm ligt, stroomt
       niet mee. Die trekt zich van het tussenstuk niets aan, en dan ligt de
       balk van Rahul er dwars overheen -- met z-index 9980 wint hij van elke
       app. Drie schermen liepen daar echt op vast, en alle drie op dezelfde
       manier: de knop was zichtbaar, hij was aan te wijzen, en er gebeurde
       niets als je hem indrukte. De browser zei het precies: "<form
       class=mgz-balk> intercepts pointer events".

         apps/clips.html     de knipkaart (.sheet, inset:0) -- "Sluit" onbereikbaar
         apps/meet.html      de vergaderkamer (#kamer, inset:0) -- "Hand" onbereikbaar
         apps/office.html    het rekenblad-paneel -- de functieknoppen onbereikbaar

       Dat is de stilste soort storing die er is. Er komt geen foutmelding, er
       zakt geen toets die naar de knop kijkt, en de gebruiker denkt dat de app
       kapot is. Precies waarom dit hier staat en niet in die drie apps: het is
       de balk die overheen komt, dus is het de balk die opzij hoort te gaan.

       DE REGEL. Ligt er een vaste laag over (bijna) het hele scherm, dan is dat
       waar de gebruiker nu is, en gaat Rahul weg. Komt de laag weg, dan komt hij
       terug in de stand waarin hij stond. Hetzelfde als bij volledig scherm, en
       om dezelfde reden.

       HOE WE HET METEN: met EEN treffertest in het midden van het scherm, en
       niet met een ronde langs alle elementen. Dat laatste kost op een druk
       scherm een merkbare tel, en dit draait bij elke wijziging in de DOM. De
       browser weet zelf al wat er bovenop ligt -- elementFromPoint is precies
       die vraag -- en daarna lopen we een paar ouders omhoog. Rahul zelf zit
       onderaan en komt in het midden nooit als treffer terug.

       WAT WE NIET DOEN: op een afspraak met de apps gaan zitten (een klasse,
       een attribuut). Dan werkt het voor de drie schermen die we nu kennen en
       voor het vierde niet, en dat vierde is degene waar niemand naar kijkt. */
    var wegVoorLaag = false, standVoorLaag = null;

    function laagDektScherm(el) {
      if (!el || el === document.body || el === document.documentElement) return false;
      var st;
      try { st = getComputedStyle(el); } catch (e) { return false; }
      if (st.position !== 'fixed' && st.position !== 'sticky') return false;
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      if (parseFloat(st.opacity || '1') < 0.05) return false;
      var r = el.getBoundingClientRect();
      /* Negentig procent en niet honderd: een blad met een randje, een kop die
         net buiten beeld valt of een safe-area onderaan hoort niet het verschil
         te maken. Kleiner dan dit is geen scherm meer maar een hoekje, en daar
         gaat Rahul niet voor aan de kant. */
      return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9;
    }

    function ligtErIetsOver() {
      /* Volledig scherm telt sowieso: dan is er per definitie iets anders aan
         de beurt. (De chat-laag regelt dit voor zijn eigen paneel al -- zie
         shared/handenvrij-scherm; de balk deed het nog niet.) */
      var vol = document.fullscreenElement || document.webkitFullscreenElement || null;
      if (vol && !blok.contains(vol) && vol !== blok) return true;
      var el = null;
      try { el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2)); } catch (e) { return false; }
      for (var n = 0; el && n < 12; n++) {
        if (el === blok || blok.contains(el)) return false;   // dat zijn wij
        if (laagDektScherm(el)) return true;
        el = el.parentElement;
      }
      return false;
    }

    function kijkOfErIetsOverligt() {
      var over = ligtErIetsOver();
      if (over === wegVoorLaag) return;
      wegVoorLaag = over;
      if (over) {
        standVoorLaag = blok.hidden;
        blok.hidden = true;
      } else {
        blok.hidden = !!standVoorLaag;
      }
      meetRuimte();
    }

    /* Eén keer per beeldopbouw, hoe vaak de DOM ook verandert. Zonder deze rem
       draait de treffertest bij elke aanslag in een invoerveld mee. */
    var gepland = false;
    function plan() {
      if (gepland) return;
      gepland = true;
      (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
        gepland = false;
        kijkOfErIetsOverligt();
      });
    }
    if (window.MutationObserver) {
      try {
        new MutationObserver(plan).observe(document.documentElement, {
          subtree: true, childList: true,
          attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open']
        });
      } catch (e) { /* dan blijft het bij de gebeurtenissen hieronder */ }
    }
    document.addEventListener('fullscreenchange', plan);
    document.addEventListener('webkitfullscreenchange', plan);
    window.addEventListener('resize', plan);
    plan();
