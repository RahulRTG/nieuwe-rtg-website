  var MELDPLEKKEN = '#toast,.toast,#melding,.melding,[data-toast],.status';
  /* ---- de toegankelijkheidshelpers van de gedeelde laag ----

     Twee dingen die op ELK scherm moeten gelden en die geen enkele pagina zelf
     hoeft te doen: een melding die wordt voorgelezen, en een venster waar je
     niet ongemerkt uit tabt. Ze staan in een eigen deel omdat basis-02.js met
     hen erbij op 14,6 KB kwam en de grens 10 is (check.js regel 13) -- en omdat
     ze samen een onderwerp zijn: wat de schil doet voor wie het scherm niet
     ziet of niet met een muis bedient.

     Ze worden aangeroepen vanuit start() in basis-02.js. Dat mag: alle delen
     van deze bundel zitten in EEN IIFE, dus een functie die hier staat is daar
     gewoon bekend. */

  /* MELDINGEN DIE NIEMAND HOORT.

     Bijna elk scherm hier heeft een toast of een statusregel: "bewaard",
     "netwerk weg", "dat mag niet". Ze verschijnen in beeld, en voor wie ze niet
     ZIET gebeurt er niets. Een schermlezer leest alleen voor wat in een live
     region staat, en dat is precies wat deze elementen niet waren -- gemeten
     over 259 schermen: 46 stille meldplekken op 42 schermen (25x #melding, 11x
     #toast, 9x .status).

     Waarom hier en niet per pagina: het zijn 42 schermen met dezelfde vorm, en
     42 losse reparaties lopen uiteen. `role="status"` is bovendien de zachte
     variant (aria-live=polite): hij onderbreekt niets en wacht tot de lezer
     uitgesproken is. Voor een echte fout is `alert` de juiste rol, maar die
     kiest een pagina zelf -- wie al een rol heeft, houdt hem.

     Een statische regel die nooit verandert wordt hier ook een status, en dat
     is onschadelijk: een live region meldt alleen WIJZIGINGEN. */
  function meldingenHoorbaar() {
    var kandidaten = document.querySelectorAll(MELDPLEKKEN);
    for (var i = 0; i < kandidaten.length; i++) {
      var el = kandidaten[i];
      if (el.getAttribute('role') || el.getAttribute('aria-live')) continue;   // eigen keuze wint
      el.setAttribute('role', 'status');
    }
  }

  /* EEN MODAAL WAAR JE UIT TABT, IS GEEN MODAAL.

     `aria-modal="true"` vertelt een schermlezer: negeer de rest van de pagina.
     Het doet NIETS aan de tabvolgorde. Staat de achtergrond dan nog open, dan
     tabt iemand met een toetsenbord de melding uit en landt op knoppen die zijn
     schermlezer niet meer voorleest -- hij hoort stilte en weet niet waar hij
     is. Dat is erger dan geen modaal.

     Gemeten over 259 schermen: twee eigen vensters, en het ene (de onboarding
     van app.html) liet dertien focusbare elementen buiten zich staan terwijl het
     aria-modal droeg.

     `inert` is de enige manier om dat in een keer waar te maken: het haalt een
     tak uit de tabvolgorde EN uit de toegankelijkheidsboom. Een browser zonder
     inert-ondersteuning valt terug op de oude situatie en niet op iets ergers.

     Dit doet BEWUST geen Escape-afhandeling: of een venster gesloten mag worden
     hangt af van wat het vraagt (een onboardingpoort is niet hetzelfde als een
     tip), en dat weet de pagina en niet deze laag. */
  var inertGezet = [], modaalGepland = false, kwamVan = null;

  /* WAAR DE FOCUS VANDAAN KWAM, bijgehouden terwijl het gebeurt.

     Eerste poging onthield hem op het moment dat deze laag de focus in het
     venster zette, en die kwam altijd te laat: een pagina die zijn venster
     opent, zet de focus er zelf al in (shared/uitvoer.js doet `laag.hidden =
     false; knop.focus()` in EEN tik). De waarnemer draait pas daarna, en ziet
     dan alleen nog een focus die al binnen staat. Wie wil weten waar iemand
     vandaan kwam, moet meekijken en niet achteraf vragen. */
  var kwamVanBuiten = null;
  function focusSpoor() {
    document.addEventListener('focusin', function (e) {
      var m = openModaal();
      if (!m || !m.contains(e.target)) kwamVanBuiten = e.target;
    }, true);
  }

  /* Welk venster staat er OPEN -- apart, want twee plekken hebben het nodig en
     de tweede mag niet wachten (zie modaalLos hieronder).

     DE LAATSTE WINT, EN DAT KOSTTE EEN TOETS. Eerst nam deze de EERSTE in de
     boom, en op app.html staat dat vast: de onboardingpoort staat in de markup,
     en een venster dat later opengaat wordt aan het eind van <body> gehangen.
     Toen pin-herstel zijn eigen scherm opende, sloot deze laag dus alles buiten
     de ONBOARDING af -- inclusief dat nieuwe scherm. Het stond bovenop, in
     beeld, en was onaanklikbaar; de tik viel door naar het veld eronder.
     test/pinherstel.e2e.js zakte erop.

     Later in de boom is bovenop, dus telt de laatste. */
  function openModaal() {
    var kandidaten = document.querySelectorAll('[aria-modal="true"]');
    for (var i = kandidaten.length - 1; i >= 0; i--) {
      var k = kandidaten[i];
      if (k.hidden || !k.getClientRects().length) continue;
      var cs = window.getComputedStyle(k);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      return k;
    }
    return null;
  }

  /* LOSLATEN MAG NOOIT EEN FRAME WACHTEN, en die regel komt uit een fout die ik
     zelf heb gemaakt. Het afsluiten hangt in een requestAnimationFrame om een
     regen van mutaties te bundelen, en het loslaten hing daar aan vast. Gevolg:
     na het sluiten van een venster stond de rest van de pagina nog een frame
     lang op inert. Een mens merkt dat zelden, maar wat er in dat frame gebeurt
     is niet niets -- een pagina die na het sluiten de focus terugzet op de knop
     waar de tik vandaan kwam, zet hem op een INERT element, en dan valt de focus
     terug op body. Twee schermtoetsen in test/premium.e2e.js zakten er precies
     op ("in een veld komt de letter gewoon in het veld", "de focus gaat terug
     naar de knop waar de tik vandaan kwam").

     Dus: sluiten mag wachten, loslaten niet.

     EN DE FOCUS TERUG, WANT WIJ HEBBEN HEM WEGGEHAALD. Zelfs zonder dat frame
     vertraging kan een pagina hem niet zelf terugzetten: zij sluit het venster
     en zet de focus op de knop waar de tik vandaan kwam, allebei in dezelfde
     tik -- en op dat moment staat die knop nog op inert, dus de focus valt op
     body. De waarnemer draait pas daarna. Dat is geen fout van de pagina: hij
     deed het goed voordat deze laag bestond.

     Dus onthoudt deze laag waar de focus vandaan kwam en zet hem terug als hij
     bij het loslaten NERGENS staat. Heeft de pagina hem intussen zelf ergens
     neergezet, dan blijft die keuze staan -- de pagina weet beter waar hij
     hoort dan wij. */
  function modaalLos() {
    if (!inertGezet.length || openModaal()) return false;
    for (var i = 0; i < inertGezet.length; i++) inertGezet[i].inert = false;
    inertGezet = [];
    /* "Nergens" is meer dan body. In het echte geval (shared/uitvoer.js) doet de
       pagina `laag.hidden = true; knop.focus();` in EEN tik: die focus valt weg
       omdat de knop nog inert is, en de focus BLIJFT dan staan op de knop in het
       zojuist verborgen venster -- een element zonder afmetingen, waar niemand
       iets aan heeft. Pas een tel later laat de browser hem los naar body. Wie
       alleen op body test, komt te laat. */
    var actief = document.activeElement;
    var nergens = !actief || actief === document.body ||
      !actief.getClientRects || !actief.getClientRects().length;
    var terug = kwamVan || kwamVanBuiten;
    if (terug && nergens && document.contains(terug)) {
      try { terug.focus({ preventScroll: true }); } catch (e) { try { terug.focus(); } catch (e2) {} }
    }
    kwamVan = null;
    return true;
  }

  function modaalAfsluiten() {
    var open = openModaal();
    // eerst terugdraaien wat we eerder hebben afgesloten
    for (var j = 0; j < inertGezet.length; j++) inertGezet[j].inert = false;
    inertGezet = [];
    if (!open || open.tagName === 'DIALOG') return;   // <dialog> doet dit zelf
    /* OP ELK NIVEAU, en niet alleen bovenaan. Eerste versie zocht de bovenste
       voorouder van het venster en sloot diens BUREN af -- gemeten op app.html:
       van de dertien focusbare elementen buiten het venster kwamen er zo maar
       twee achter inert te staan, want het venster hangt middenin dezelfde tak
       als de rest van de app. Wie de wereld buiten een venster wil afsluiten,
       loopt omhoog en sluit op iedere verdieping de buren af. */
    for (var k = open; k && k !== document.body; k = k.parentElement) {
      var ouder = k.parentElement; if (!ouder) break;
      for (var n = ouder.firstElementChild; n; n = n.nextElementSibling) {
        if (n === k || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.contains(open)) continue;
        try { n.inert = true; inertGezet.push(n); } catch (e) { /* oude browser: laat staan */ }
      }
    }
    /* En de focus hoort erin te staan. Zonder dit blijft de focus achter op de
       knop die het venster opende -- in een inerte tak, dus nergens. */
    if (!open.contains(document.activeElement)) {
      // waar hij vandaan kwam, zodat modaalLos() hem straks kan teruggeven
      if (document.activeElement && document.activeElement !== document.body) kwamVan = document.activeElement;
      var eerste = open.querySelector('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
      var doel = eerste || open;
      if (!eerste && !open.hasAttribute('tabindex')) open.setAttribute('tabindex', '-1');
      try { doel.focus({ preventScroll: true }); } catch (e) { try { doel.focus(); } catch (e2) {} }
    }
  }

  /* Dezelfde behandeling voor een tak die er LATER bij komt: een scherm dat een
     kaart met een statusregel erin aanmaakt, gaf anders niets terug. Wordt
     aangeroepen vanuit de waarnemer in basis-02.js. */
  function meldingenIn(n) {
    if (!n || !n.querySelectorAll) return;
    var kandidaten = n.matches && n.matches(MELDPLEKKEN) ? [n] : [];
    kandidaten = kandidaten.concat([].slice.call(n.querySelectorAll(MELDPLEKKEN)));
    for (var i = 0; i < kandidaten.length; i++) {
      var m = kandidaten[i];
      if (!m.getAttribute('role') && !m.getAttribute('aria-live')) m.setAttribute('role', 'status');
    }
  }
