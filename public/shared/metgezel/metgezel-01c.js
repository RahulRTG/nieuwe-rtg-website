    /* HET BLOK VAN RAHUL: het antwoord boven, de balk eronder, en de ruimte
       die de pagina ervoor vrijhoudt. Apart deel omdat metgezel-01b.js anders
       over de 10 KB-lat komt (scripts/check.js regel 13) en omdat dit een eigen
       onderwerp is: waar Rahul STAAT, los van wat hij doet. */
    /* Een blok: het antwoord boven, de balk eronder. Ze horen bij elkaar en
       staan dus ook bij elkaar, op dezelfde breedte. */
    var blok = document.createElement('div');
    blok.className = 'mgz-blok';
    blok.appendChild(sheet);
    blok.appendChild(balk);
    document.body.appendChild(blok);

    /* De pagina reserveert de hoogte van het blok, zodat Rahul nergens overheen
       staat -- ook niet onderaan een lange lijst. Dat doen we met een leeg
       tussenstuk onderaan de body en NIET door body.paddingBottom te zetten:
       veel pagina's hebben daar hun eigen marge staan (de wallet 57,6 px) en
       die zouden we dan overschrijven. Een tussenstuk telt op bij wat er al
       is in plaats van het te vervangen.
       We meten het blok in plaats van een vaste hoogte te kiezen: hij groeit
       met een antwoord mee en krimpt als je hem klein klapt. */
    /* MAAR NIET OP EEN BODY DIE ZELF EEN INDELING IS. Op de leverancier-app is
       de body een flexrij met de app-schil erin. Een extra kind van 100% breed
       is daar geen tussenstuk maar een tweede KOLOM: de schil kreeg nul breedte
       en het hele scherm bleef leeg. Geen foutmelding, geen kapotte regel --
       alleen een lege app, en dat is precies het soort stilte waar dit huis
       niet tegen kan.

       Zo'n pagina scrollt zijn body ook helemaal niet (de inhoud scrollt binnen
       de schil), dus het tussenstuk had daar sowieso niets te reserveren. De
       maat komt wel gewoon in --rtg-rahul-h te staan; wie ruimte wil maken,
       gebruikt die. */
    var indeling = getComputedStyle(document.body).display;
    var eigenIndeling = indeling === 'flex' || indeling === 'inline-flex' ||
      indeling === 'grid' || indeling === 'inline-grid';
    var ruimte = document.createElement('div');
    ruimte.className = 'mgz-ruimte';
    ruimte.setAttribute('aria-hidden', 'true');
    if (!eigenIndeling) document.body.appendChild(ruimte);
    function meetRuimte() {
      var h = blok.hidden ? 0 : blok.getBoundingClientRect().height;
      var px = h ? Math.round(h + 18) : 0;   // 18px lucht tussen inhoud en blok
      document.documentElement.style.setProperty('--rtg-rahul-h', px + 'px');
      ruimte.style.height = 'calc(' + px + 'px + env(safe-area-inset-bottom, 0px))';
    }
    // de bewaarde stand pas zetten nu het blok bestaat: zetMaat() raakt hem aan
    zetMaat(klein, false);
    if (window.ResizeObserver) { try { new ResizeObserver(meetRuimte).observe(blok); } catch (e) {} }
    window.addEventListener('resize', meetRuimte);
    meetRuimte();
    // de waarnemer meldt de allereerste opmaak niet altijd; daarom nog twee keer
    setTimeout(meetRuimte, 200); setTimeout(meetRuimte, 900);

    /* RAHUL WIJKT VOOR EEN GEOPEND VENSTER.

       Het blok staat op z-index 9980 en zweeft daarmee boven vrijwel elk
       venster in dit huis (de bladen van Clips staan bijvoorbeeld op 10). Dat
       is te zien EN te merken: een venster dat onderaan opent -- en dat zijn ze
       hier allemaal, het is een telefoon-vorm -- krijgt zijn onderste knoppen
       onder de balk. In Clips is dat letterlijk de knop "Sluit"; die was met
       een vinger niet te raken en in een schermtoets niet aan te klikken
       ("intercepts pointer events").

       De oorzaak zit niet in die vensters maar hier: een laag die overal
       bovenop ligt, hoort opzij te gaan zodra iemand ergens middenin zit. Dus
       niet elk venster een hogere z-index geven (dat zijn drieentwintig
       plekken die uiteen gaan lopen), maar op DEZE plek even wijken en daarna
       gewoon terugkomen.

       Wat telt als geopend venster: role="dialog", aria-modal="true" of een
       <dialog open>. Zichtbaarheid wordt GEMETEN, want die bladen staan altijd
       in de HTML en gaan open met een klasse.

       En dat meten moet met getClientRects() en niet met offsetParent, hoe
       gebruikelijk dat laatste ook is: bij een element met position:fixed --
       en dat zijn deze bladen allemaal -- is offsetParent ALTIJD null. Die
       controle wees dus precies het geval af waar hij voor bedoeld was, en
       zag er ondertussen keurig uit. */
    function zichtbaarVenster() {
      var lijst = document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]');
      for (var i = 0; i < lijst.length; i++) {
        var v = lijst[i];
        if (v === blok || blok.contains(v)) continue;            // zijn eigen blad telt niet
        if (v.hidden) continue;
        if (v.getClientRects().length) return true;   // leeg bij display:none
      }
      return false;
    }
    var wijkt = null;
    function wijkOfNiet() {
      var moet = zichtbaarVenster();
      if (moet === wijkt) return;
      wijkt = moet;
      blok.style.display = moet ? 'none' : '';
      /* De losse pillen (de Samen-knop uit metgezel-03) staan op dezelfde
         hoogte en zweven dus even hard; de lippen zelf zitten IN het blok en
         gaan vanzelf mee. */
      var pillen = document.querySelectorAll('.mgz-knop');
      for (var p = 0; p < pillen.length; p++) pillen[p].style.display = moet ? 'none' : '';
      meetRuimte();
    }
    /* Op de tel gehouden en niet op elke mutatie: deze waarnemer draait op elk
       scherm, en de vraag zelf is een querySelectorAll. Een venster gaat open
       op een tik, dus 150 ms is ruim binnen wat iemand merkt. */
    var wijkKlok = null;
    function laterKijken() {
      if (wijkKlok) return;
      wijkKlok = setTimeout(function () { wijkKlok = null; wijkOfNiet(); }, 150);
    }
    if (window.MutationObserver) {
      try {
        new MutationObserver(laterKijken).observe(document.body, {
          subtree: true, childList: true,
          attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open', 'role', 'aria-modal']
        });
      } catch (e) { /* zonder waarnemer blijft alles zoals het was */ }
    }
    wijkOfNiet();
