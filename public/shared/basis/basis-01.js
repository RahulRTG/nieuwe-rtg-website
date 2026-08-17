/* De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt.
   Eén klein script, gedeelde stille taken (RTGId woont in shared/id.js):
   1. offline: registreert de juiste service worker (leden-OS of RTFoundation),
      zodat elke pagina ook zonder bereik opent, en meldt rustig als de
      verbinding wegvalt of terugkomt
   2. rust: respecteert prefers-reduced-motion (alle animaties uit) en geeft
      toetsenbord-gebruikers een zichtbare focusrand
   3. begrenzing: zet een maxlength-vangnet op tekstvelden die er geen hebben
      (de server begrenst altijd al; dit voorkomt stil afgekapte invoer)
   4. leren: de app-gids (wat is dit, wat kun je hier, een leerzame tip) via
      /api/gids/app; te openen vanuit het bedieningspaneel via RTGGids.open()
   5. sfeer: laadt het lopende werk bij (shared/uurwerk.js), de gangreserve
      van het huis die als een stil verhaal over alle pagina's doorloopt
   6. kaart: laadt de kaart-uitwijk bij (shared/kaart.js), die geo:-links op
      desktop/iOS opvangt met een eigen paneeltje - coördinaten tonen en laten
      kopiëren, zonder ook maar iets naar een kaart-provider te sturen
   7. (vervallen) de OS-klok is nu zelf een rustige analoge wijzerplaat in
      shared/klok.js; het uitbundige 3D-skelet (klok3d.js) wordt niet meer
      standaard over elke ring gelegd, maar leeft als concept op /apps/horloge.html
   8. navigatie: verzekert de centrale iOS-laag en het appmenu op iedere app
      die de basis laadt, tenzij het scherm zichzelf expliciet uitsluit
   Geen inloggegevens nodig; werkt hetzelfde in beide werelden. */
(function () {
  'use strict';
  if (window.__rtgBasis) return; window.__rtgBasis = true;
  var rtf = location.pathname.indexOf('/apps/foundation/') === 0;

  /* ---- taal: elk echt appscherm krijgt dezelfde 114-talige laag ---------
     Vijf grote shells namen i18n.js zelf al op; alle andere schermen hadden
     daardoor geen taalkeuze en hielden hun hardcoded tekst. De basis ligt op
     ieder blijvend appscherm en laadt de taalrail precies één keer. */
  if (!window.RTGi18n && !document.querySelector('script[src^="/shared/i18n.js"]')) {
    var taalScript = document.createElement('script');
    taalScript.src = '/shared/i18n.js'; taalScript.async = false;
    (document.head || document.documentElement).appendChild(taalScript);
  }

  /* In een SPLIT-paneel (same-origin iframe uit shared/split.js) staat de app
     in een halve breedte naast een andere app. De vensterbeheerder en het
     desktopframe die deze class ook zetten bestaan niet meer -- het OS is iOS
     en kent geen zwevende vensters -- maar Split View is er nog, en daar is
     een volle kopbalk per paneel te veel. Vol scherm heeft geen iframe en
     houdt zijn eigen kop. */
  if (window.self !== window.top) {
    try { document.documentElement.classList.add('rtg-in-frame'); } catch (e) {}
  }

  /* ---- 8. centrale navigatie, ook voor iedere NIEUWE app -----------------
     Een app hoeft de veilige weg naar huis niet te onthouden. Vrijwel ieder
     scherm laadt basis.js al; daarom vult deze laag ios.js aan wanneer de
     pagina hem niet zelf heeft opgenomen. Bestaande pagina's houden hun
     expliciete volgorde, maatwerkschermen houden hun eigen uiterlijk en krijgen
     alleen de zwevende menuknop/home-veeg. data-ios-uit blijft de bewuste
     ontsnappingsroute voor een scherm dat echt alle OS-chrome zelf verzorgt. */
  if (document.body && !document.body.hasAttribute('data-ios-uit') &&
      !document.body.hasAttribute('data-ios-home') && !window.RTGiOS &&
      !document.querySelector('script[src^="/shared/ios.js"]')) {
    var ios = document.createElement('script');
    ios.src = '/shared/ios.js';
    ios.async = false;
    (document.head || document.documentElement).appendChild(ios);
  }

  /* ---- 0. toegankelijkheid: de instelling van het lid, voor alles ----
     Dit staat bovenaan omdat het over LEZEN gaat: wie grote tekst nodig heeft,
     heeft hem nodig vanaf het eerste beeld en niet na een rondje server. De
     stand staat daarom in localStorage en wordt hier meteen toegepast; de
     server is de eigenaar en synchroniseert hem bij (zie shared/toegankelijk.js,
     dat pas later en zonder haast laadt).

     De stand geldt op elke pagina die dit script laadt, en dat is de hele
     familie -- de leden-apps en de RTFoundation. Een app hoeft er niets voor
     te doen en kan er ook niet omheen: de regels staan op html.* en de
     opmaak-tokens van het huis. */
  try {
    var tg = JSON.parse(localStorage.getItem('rtg_toegankelijk') || 'null') || {};
    var el = document.documentElement;
    if (tg.tekst === 'groot' || tg.tekst === 'groter') el.classList.add('rtg-tekst-' + tg.tekst);
    if (tg.contrast === 'hoog') el.classList.add('rtg-contrast');
    if (tg.beweging === 'stil') el.classList.add('rtg-stil');
    if (tg.links === 'streep') el.classList.add('rtg-linkstreep');
    /* Twee die de gedeelde laag ook echt waarmaakt: rtg-rustig dempt de nadruk
       hieronder, en rtg-eending laat shared/deelmenu.js ook korte apps
       opsplitsen. */
    if (tg.nadruk === 'rustig') el.classList.add('rtg-rustig');
    if (tg.eenDing === 'altijd') el.classList.add('rtg-eending');
  } catch (e) {}

  /* ---- 0. het thema, VOOR al het andere ---------------------------------
     De vier thema's (champagne, onyx, bordeaux, royal) hingen aan een script
     dat maar op één pagina stond. Een themakeuze die niet meereist is geen
     thema maar een instelling van dat ene scherm, dus hij hoort in de laag die
     overal ligt -- net als de bladen die hij aanstuurt (die komen mee via de
     @import bovenaan shared/rtg-ui.css).

     ZO VROEG MOGELIJK. Dit script zet een attribuut op <html> en daar hangt de
     grondkleur aan; gebeurt dat pas na het tekenen, dan zie je de oude grond
     even staan. Vandaar hier, boven de service worker, en niet in de opstart
     onderaan.

     De sleutel is rtg_thema_v2 en die staat los van de oude donker/licht-keuze
     in shared/thema.js. Een pagina die nog niet om is, merkt niets: zonder
     attribuut geldt gewoon wat de UI-kit al zei. */
  if (!document.documentElement.hasAttribute('data-rtg-thema') && !document.getElementById('rtgThemasJs')) {
    var th = document.createElement('script');
    th.id = 'rtgThemasJs';
    th.src = '/shared/rtg-themas.js';
    (document.head || document.documentElement).appendChild(th);
  }
