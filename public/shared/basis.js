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
      standaard over elke ring gelegd. Het losse vitrinescherm daarvoor is weg (19
      augustus 2026, nergens vandaan te bereiken); de mechaniek zelf leeft in
      shared/horlogewerk.js, op het inlogscherm
   8. navigatie: verzekert de centrale iOS-laag en het appmenu op iedere app
      die de basis laadt, tenzij het scherm zichzelf expliciet uitsluit
   9. overdracht: laadt shared/overdracht.js bij zodra er `?overdracht=` in het
      adres staat -- de balk met wat een lid uit zijn mand meenam naar dit
      scherm. Bevestigen doet het domein zelf; deze balk vertelt alleen wat er
      was gekozen (kern/commerce/overdracht.js)
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

  /* De Workspace Runtime begint pas NA identiteit, maar de weg naar binnen is
     ook productervaring. Iedere bestaande en toekomstige app met deze basis
     krijgt daarom dezelfde RTG Access Experience; de laag wordt alleen
     zichtbaar wanneer zij werkelijk een toegangspoort vindt. */
  if (!window.RTGAccessExperience && !document.querySelector('script[src^="/shared/toegang.js"]')) {
    var toegangScript = document.createElement('script');
    toegangScript.src = '/shared/toegang.js'; toegangScript.async = false;
    (document.head || document.documentElement).appendChild(toegangScript);
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
/* Vervolg van basis-01 (op de 10 kB-grens geknipt na de thema-toevoeging van
   de consolidatieronde; de bundelvolgorde is alfabetisch, dus 01, 01b, 02).
   Sectie 1 en verder: offline, verbinding, en de rest. */
  /* ---- 1. offline: de service worker + een rustig verbindingsseintje ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try {
      if (rtf) navigator.serviceWorker.register('/apps/foundation/sw.js', { scope: '/apps/foundation/' }).catch(function () {});
      else navigator.serviceWorker.register('/sw.js').catch(function () {});
    } catch (e) {}
  }

  var css = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}' +
    ':focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
    /* Het toegankelijkheidsprofiel, inline en niet als apart blad: wie grote
       tekst nodig heeft hoort daar niet eerst een netwerkronde op te wachten.
       De tekstmaat werkt omdat de hele familie in rem meet (ruim drieduizend
       plekken, en precies een in px). Hoog contrast tilt de twee gedempte
       tinten van het huis op zonder een nieuwe kleur te verzinnen: zelfde
       #F4F1EC, alleen minder doorzichtig. */
    'html.rtg-tekst-groot{font-size:118%;}' +
    'html.rtg-tekst-groter{font-size:135%;}' +
    'html.rtg-contrast{--rtg-txt:#FFFFFF;--rtg-muted:rgba(244,241,236,0.94);--rtg-soft:rgba(244,241,236,0.88);--rtg-line:rgba(255,255,255,0.32);}' +
    'html.rtg-stil *,html.rtg-stil *::before,html.rtg-stil *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}' +
    /* Rustig: alles even luid. De accentkleuren van het huis worden de gewone
       tekstkleur, en dikke randen worden dunne lijnen -- zodat niets aan de
       aandacht trekt dat dat niet verdient. */
    'html.rtg-rustig{--gold:var(--txt);--goud:var(--txt);--goldlicht:var(--muted,var(--soft));}' +
    'html.rtg-rustig [class*="badge"],html.rtg-rustig [class*="pill"]{filter:saturate(.35);}' +
    'html.rtg-rustig *{border-width:1px!important;box-shadow:none!important;}' +
    'html.rtg-linkstreep a{text-decoration:underline!important;text-underline-offset:.18em;}' +
    '.bss-net{position:fixed;left:50%;transform:translateX(-50%);top:.6rem;z-index:60;background:#0C0C0B;border:1px solid #444;border-radius:0;color:#eee;font:500 .8rem Inter,system-ui,sans-serif;padding:.45rem .8rem;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.bss-sheet{position:fixed;left:1rem;bottom:1rem;z-index:38;width:min(340px,92vw);background:#151312;border:1px solid var(--gold,#A98F1C);border-radius:0;padding:1rem;color:#eee;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;}' +
    '.bss-sheet[hidden]{display:none;}' +
    '.bss-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-weight:600;font-size:.92rem;}' +
    '.bss-x{background:transparent;border:1px solid #444;border-radius:0;color:#eee;padding:.12rem .5rem;cursor:pointer;font:inherit;}' +
    '.bss-wat{font-size:.84rem;color:#ccc;line-height:1.55;}' +
    '.bss-doe{margin:0;padding-left:1.1rem;font-size:.82rem;color:#bbb;line-height:1.6;}' +
    '.bss-tip{font-size:.8rem;color:#d7c690;line-height:1.5;border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;}' +
    /* De hulplaag onder de uitleg. Eigen scheidingslijn, want het is een ander
       soort ding: hierboven staat wat dit scherm IS, hieronder wat je doet als
       het niet werkt. De knoppen halen 2,6rem zodat ze op telefoonformaat boven
       de 24x24 van WCAG 2.5.8 blijven; dat is de maat die de a11y-keuring op
       elk raakvlak natelt. */
    '.bss-hulp{border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;display:flex;flex-direction:column;gap:.45rem;}' +
    '.bss-hulp b{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#d7c690;font-weight:600;}' +
    '.bss-hulp p{font-size:.8rem;color:#bbb;line-height:1.5;margin:0;}' +
    '.bss-rij{display:flex;gap:.4rem;flex-wrap:wrap;}' +
    '.bss-hulp button,.bss-zaak button{background:transparent;border:1px solid #555;border-radius:0;color:#eee;font:inherit;font-size:.8rem;padding:.5rem .7rem;min-height:2.6rem;min-width:2.6rem;cursor:pointer;}' +
    '.bss-hulp button.bss-ja,.bss-zaak button.bss-ja{background:#eee;color:#111;border-color:#eee;font-weight:600;}' +
    '.bss-zaak{font-size:.78rem;color:#bbb;line-height:1.5;border-left:2px solid #444;padding-left:.55rem;display:flex;flex-direction:column;gap:.35rem;}' +
    '.bss-zaak i{font-style:normal;color:#d7c690;}' +
    '.bss-veld{width:100%;background:transparent;color:#eee;border:1px solid #555;border-radius:0;font:inherit;font-size:.82rem;padding:.5rem;}' +
    /* In een split-paneel is de grote titel dubbelop: je hebt de app zelf net
       gekozen in de paneelkiezer. De titel en de terugknop gaan daarom uit het
       zicht maar blijven in de toegankelijkheidsboom (zelfde techniek als
       .vis-verborgen). De ACTIEknoppen in de balk (zoeken, uploaden, nieuw)
       blijven gewoon staan: dat is bediening, geen chrome. */
    'html.rtg-in-frame body>header{position:static!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;}' +
    'html.rtg-in-frame .ios-groot,html.rtg-in-frame body>header h1,' +
    'html.rtg-in-frame body>header .ios-terug,html.rtg-in-frame body>header .terug,' +
    'html.rtg-in-frame body>header>a[href^="/apps/app.html"]' +
    '{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important;}';
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* de gedeelde rustlaag: één ingetogen stijl die overal dezelfde kalmte legt
     (zachte, trage overgangen + een rustige focusrand). Als apart bestand zodat
     het cachet en pagina's het kunnen overschrijven. */
  var rl = document.createElement('link');
  rl.rel = 'stylesheet'; rl.href = '/shared/rust.css';
  (document.head || document.documentElement).appendChild(rl);

  /* de trage helft van de toegankelijkheid: bij de server ophalen wat het lid
     heeft ingesteld, zodat een tweede toestel het ook krijgt. Zonder haast --
     de stand van dit toestel staat hierboven al op het scherm. */
  var tgs = document.createElement('script');
  tgs.src = '/shared/toegankelijk.js'; tgs.async = true;
  (document.head || document.documentElement).appendChild(tgs);

  /* ---- de gebarenlaag: twee laden onder elke regel ----------------------
     Hij ligt op elk appscherm en DOET IN RUST NIETS. Geen element erbij, geen
     stijl erover; hij wordt pas wakker als een scherm zegt welke acties een
     regel draagt (RTGGebaar.zet / RTGGebaar.lijst). Zo staat de bediening op
     EEN plek in plaats van acht keer net anders (LAT.md regel 4), en kost een
     scherm dat hem niet gebruikt precies niets.

     Zonder haast: een veeg is een tweede handeling, nooit de eerste. Het blad
     laadt de laag zelf bij, dus een pagina hoeft er geen <link> voor te kennen. */
  if (!window.RTGGebaar && !document.querySelector('script[src^="/shared/gebaar.js"]')) {
    var gb = document.createElement('script');
    gb.src = '/shared/gebaar.js'; gb.async = true;
    (document.head || document.documentElement).appendChild(gb);
  }

  function toost(t) {
    var m = document.createElement('div'); m.className = 'bss-net'; m.setAttribute('role', 'status'); m.textContent = t;
    document.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3500);
  }
  window.addEventListener('offline', function () { toost(rtf ? 'Even geen internet; de app werkt gewoon door waar dat kan.' : 'Geen verbinding; de app werkt door waar dat kan.'); });
  window.addEventListener('online', function () { toost('De verbinding is terug.'); });


  /* ---- 9. de overdracht: wat een lid uit zijn mand meenam naar dit scherm
     (shared/overdracht.js). Bevestigen gebeurt in het domein dat er al over
     gaat, en die deuren staan verspreid over tientallen schermen -- dus staat
     de balk op EEN plek en niet in elk van hen. Hij wordt alleen bijgeladen als
     er ook werkelijk een briefje in het adres staat; op elk ander scherm kost
     dit niets. De uitleg staat in kern/commerce/overdracht.js.

     Hij hoort hier en niet bij punt 5 en 6 in basis-02.js, waar de andere twee
     bijladers staan: dat deel zat op 9894 bytes en zou met dit blok over de
     10 kB-leesgrens gaan. Een deelbestand is een GROOTTE-grens en geen
     betekenisgrens -- alle delen draaien in dezelfde functie. ---- */
  if (location.search.indexOf('overdracht=') >= 0) {
    var ovdS = document.createElement('script');
    ovdS.src = '/shared/overdracht.js'; ovdS.async = true;
    (document.head || document.documentElement).appendChild(ovdS);
  }

  /* ---- de toestelsleutel: het bezitsbewijs bij zware handelingen ----
     NIET async: dit script haakt op fetch, en laadt het pas na het eerste
     betaalverzoek, dan gaat dat verzoek zonder bewijs de deur uit. De uitleg
     staat in shared/toestelsleutel.js; hier staat het omdat een regel die op
     elk scherm herhaald moet worden, over een half jaar op een scherm
     ontbreekt -- en dat is dan het scherm waar geld beweegt. */
  var tsl = document.createElement('script');
  tsl.src = '/shared/toestelsleutel.js';
  (document.head || document.documentElement).appendChild(tsl);
/* de toegankelijkheidshelpers van de gedeelde laag */
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
  /* ---- 5. het lopende werk: de gangreserve-laag van het huis ---- */
  var uw = document.createElement('script');
  uw.src = '/shared/uurwerk.js'; uw.async = true;
  (document.head || document.documentElement).appendChild(uw);

  /* ---- 6. de kaart-uitwijk: geo:-links op desktop/iOS opvangen met een eigen
     paneeltje (coördinaten tonen + kopiëren), zonder iets naar derden ---- */
  var km = document.createElement('script');
  km.src = '/shared/kaart.js'; km.async = true;
  (document.head || document.documentElement).appendChild(km);

  /* ---- 7. de OS-klok is nu zelf een rustige analoge wijzerplaat (shared/klok.js):
     gevulde uur-/minuut-/secondewijzers met een subtiel gouden bevel en een
     zachte diepte -- strak en netjes. Het uitbundige opengewerkte 3D-skelet
     (shared/klok3d.js) is daarom niet meer standaard over elke ring gelegd; dat
     leeft in shared/horlogewerk.js, op het inlogscherm. ---- */

  /* ---- 8. de 3D-tegellaag (shared/tegel3d.js) is weg. Die liet een KPI-tegel
     met de MUIS meekantelen -- een bureaubladtruc die op een telefoon niets
     doet en die het OS als iOS ook niet hoort te hebben. Een tegel is plat en
     reageert op een vinger, niet op een cursor die er overheen zweeft. ---- */

  /* ---- 3. het maxlength-vangnet, ook voor later gerenderde velden ---- */
  function zetGrens(v) {
    var t = (v.type || 'text').toLowerCase();
    if (v.tagName === 'TEXTAREA') v.setAttribute('maxlength', '6000');
    else if (['text', 'search', 'email', 'tel', 'url', 'password'].indexOf(t) >= 0) v.setAttribute('maxlength', '300');
  }
  function begrens(root) {
    // ook een kaal toegevoegd veld zelf meenemen (querySelectorAll kijkt alleen naar kinderen)
    if (root.matches && root.matches('input:not([maxlength]),textarea:not([maxlength])')) zetGrens(root);
    var velden = (root.querySelectorAll ? root.querySelectorAll('input:not([maxlength]),textarea:not([maxlength])') : []);
    for (var i = 0; i < velden.length; i++) zetGrens(velden[i]);
  }
  /* ---- SPRING NAAR DE INHOUD ----

     Gemeten: 1 van de 258 schermen had een route naar de inhoud, en die ENE
     werkte niet (zie hieronder). Wie met een toetsenbord of schermlezer werkt,
     tabt dus op elk scherm eerst door de hele navigatie voordat de inhoud
     begint -- bij elke paginawissel opnieuw. Gemeten wat dat kost tot in de
     main: 15 tabs op wereld.html, 11 op salon.html, 4 op mall.html.

     Dat is geen fout die een scan vindt: alles IS bereikbaar. Het is een fout
     die pas opvalt als je het zelf een dag doet.

     Hier en niet in 258 bestanden, want dit blad is het vangnet dat elke pagina
     draagt. Let op: basis.js is GEGENEREERD uit deze map (scripts/bundel.js), dus
     een wijziging hoort hier en niet in de bundel -- die wordt door de volgende
     build overschreven. Dat is precies hoe deze functie een keer verloren ging.

     Het doel krijgt tabindex=-1, anders verplaatst de browser de focus niet echt
     naar een element dat zelf niet focusbaar is: de pagina springt dan wel, maar
     de volgende Tab begint weer bovenaan. Dat is het verschil tussen een link
     die lijkt te werken en een link die werkt. */
  function springNaarInhoud() {
    if (document.querySelector('.rtg-spring')) return;          // al gezet
    /* WIJKEN VOOR EEN EIGEN SPRINGLINK, MAAR ALLEEN ALS DIE WERKT.
       app.html en backoffice.html hebben hun eigen <a class="skip" href="#content">,
       en die is daar gemeten als eerste focusbare element -- dus krijgen ze er
       geen tweede bij. Dat een eerste Tab daar op een knop landt komt doordat die
       inlogschermen zelf focus op een veld zetten; de link is dan al voorbij.
       De test hieronder kijkt daarom naar de tabVOLGORDE en niet naar waar de
       focus toevallig staat. Alleen wat de browser echt focust telt: rects
       alleen is niet genoeg (visibility:hidden heeft rects), tabindex<0 valt
       buiten de volgorde. */
    var eigen = document.querySelector('a.skip, a.skiplink, a[href^="#"][class*="skip"]');
    if (eigen) {
      var eersteFocus = null;
      var kand = document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      for (var i = 0; i < kand.length; i++) {
        /* "Zal de browser hier naartoe tabben" is meer dan rects hebben: een
           element op visibility:hidden heeft wel rects en krijgt geen focus, en
           tabindex<0 valt buiten de volgorde. Twee eerdere versies keken alleen
           naar rects en weken daardoor voor de kapotte a.skip op app.html. */
        var e = kand[i];
        if (!e.getClientRects().length) continue;
        var cs = window.getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (e.disabled || e.tabIndex < 0) continue;
        eersteFocus = e; break;
      }
      if (eersteFocus === eigen) return;                        // die van hen doet het werk al
    }
    var doel = document.querySelector('#main, main, [role="main"]') || document.querySelector('h1');
    if (!doel) return;                                          // niets om naartoe te springen
    if (!doel.id) doel.id = 'rtg-inhoud';
    if (!doel.hasAttribute('tabindex')) doel.setAttribute('tabindex', '-1');

    var a = document.createElement('a');
    a.className = 'rtg-spring';
    a.href = '#' + doel.id;
    a.textContent = 'Naar de inhoud';
    a.addEventListener('click', function () {
      try { doel.focus({ preventScroll: false }); } catch (e) { doel.focus(); }
    });

    var st = document.createElement('style');
    st.textContent = '.rtg-spring{position:fixed;left:-9999px;top:0;z-index:99999;' +
      'background:#0C0C0B;color:#fff;padding:.6rem 1rem;font:600 .82rem Inter,system-ui,sans-serif;' +
      'border:1px solid #857007;text-decoration:none}' +
      '.rtg-spring:focus{left:.5rem;top:.5rem}';
    document.head.appendChild(st);
    document.body.insertBefore(a, document.body.firstChild);
  }

  function start() {
    springNaarInhoud();
    /* de twee helpers uit basis-01c.js: meldingen die worden voorgelezen, en een
       venster dat de rest van de pagina afsluit zolang het open staat */
    meldingenHoorbaar();
    focusSpoor();
    modaalAfsluiten();
    begrens(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var n = muts[i].addedNodes[j];
          if (n && n.nodeType === 1) { begrens(n); meldingenIn(n); }
        }
        /* Een venster gaat open door `hidden` of een klasse, niet door een nieuw
           element -- daarom ook op attributen letten, gebundeld in een frame.

           LOSLATEN GAAT WEL METEEN. Zie modaalLos() in basis-01c.js: een frame
           wachten met het opheffen van inert betekent dat een pagina die na het
           sluiten de focus terugzet, hem op een inert element zet. */
        modaalLos();
        if (!modaalGepland) { modaalGepland = true; requestAnimationFrame(function () { modaalGepland = false; modaalAfsluiten(); }); }
      }).observe(document.body, { childList: true, subtree: true,
        attributes: true, attributeFilter: ['hidden', 'class', 'style', 'aria-modal'] });
    } catch (e) {}

    /* ---- 4. de app-gids als rustige leerlaag ----
       Dit was een zwevend vraagteken linksonder, precies onder de themakiezer
       en de taalknop: drie losse knopjes op dezelfde vierkante centimeter. De
       gids zelf blijft ongewijzigd; alleen de ingang verhuisde naar het
       bedieningspaneel (shared/bediening.js), dat RTGGids.open() aanroept.

       HIJ HEET RTGGids EN NIET RTGUitleg. Die naam is van shared/uitleg.js --
       het uitlegknopje bij een besturing, met een heel andere vorm (.knop()).
       Op apps/spelen.html laadden ze allebei, uitleg.js eerst, en dan won deze
       en was .knop() weg. Geen foutmelding: shared/osmenu.js kijkt keurig of
       .knop bestaat, ziet van niet, en laat het knopje gewoon weg. */
    var sheet = null;
    function sluit() { if (sheet) { sheet.remove(); sheet = null; } }
    function openGids() {
      if (sheet) return;
      sheet = document.createElement('section');
      sheet.className = 'bss-sheet'; sheet.setAttribute('aria-label', 'Uitleg over deze app');
      sheet.innerHTML = '<div class="bss-kop"><span></span><button class="bss-x" type="button" aria-label="Sluiten">✕</button></div>' +
        '<div class="bss-wat">Even ophalen…</div>';
      sheet.querySelector('.bss-kop span').textContent = document.title || 'Deze app';
      document.body.appendChild(sheet);
      sheet.querySelector('.bss-x').addEventListener('click', sluit);
      fetch('/api/gids/app', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad: location.pathname }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!sheet || !d || !d.gids) return;
          var g = d.gids, wat = sheet.querySelector('.bss-wat');
          wat.textContent = g.wat;
          var ul = document.createElement('ul'); ul.className = 'bss-doe';
          (g.doe || []).forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
          sheet.appendChild(ul);
          var tip = document.createElement('div'); tip.className = 'bss-tip'; tip.textContent = '' + g.tip;
          sheet.appendChild(tip);
        })
        .catch(function () { if (sheet) sheet.querySelector('.bss-wat').textContent = 'De uitleg is er zo weer; probeer het straks opnieuw.'; });
      hulplaag();
    }

    /* De hulplaag (4b) staat in ./basis-02b.js: dit bestand ging er met 15,6 KB
       mee over de omvangsgrens van keuringsregel 13. De delen worden rauw
       aaneengeplakt op alfabet (scripts/bundel.js), dus de knip loopt gewoon
       midden door start() heen -- net als die tussen basis-01 en -01b. */
/* Vervolg van basis-02: de hulplaag van de app-gids, plus de afsluiting van
   start() en van de omhulling. Geknipt omdat basis-02.js met 15,6 KB over de
   grens van keuringsregel 13 ging; de delen worden rauw aaneengeplakt op
   alfabet, dus dit bestand begint en eindigt midden in een scope. Zelfde vorm
   als de knip tussen basis-01, -01b en -01c.

   WAT HIER STAAT is de ledenkant van RTG Service: wat er klaarstaat om te
   bevestigen, welke zaken er lopen, iets melden, en de knop die er niet was --
   "ik wil een mens". Zie server/kern/service/mens.js voor waarom die knop een
   contract is en geen beleefdheid. */
    /* ---- 4b. HULP, IN DEZELFDE LA ALS DE UITLEG ----

       WAAROM HIER EN NIET IN EEN EIGEN APP. Hulp is Core (WERELDEN.md): hij
       zit in elke doelgroep en reist met de mens mee, dus hij hoort niet in een
       wereld en al helemaal niet in een 84e app. PLATFORM.md par. 0 telt apps,
       en een los /apps/hulp.html zou er een zijn die niets eigen bezit. Deze la
       staat al op elk scherm, en dat is precies wat een servicevoordeur nodig
       heeft.

       EN HIJ WEET WAAR JE STOND. Dat is het punt van RTG Service: wie vanuit een
       betaling om hulp vraagt, hoeft niet te horen "waarmee kunnen wij u
       helpen?" terwijl het systeem al weet welk scherm hij openhad. Het pad
       reist mee als VERWIJZING (soort plus code) en niet als gegevens; de server
       gooit al het andere weg (kern/service/zaak.js).

       DRIE DINGEN DIE DEZE LAAG NIET DOET:
       - hij verschijnt niet zonder lid-token. Zonder account is er geen kanaal
         om iemand terug te bereiken, en een knop die een wachtrij vult waar
         niemand uit komt is erger dan geen knop;
       - hij toont niemand een bevestigingscode die er niet om vroeg: die komt
         uit /api/service/bevestigingen en dus uit de eigen sessie;
       - hij zwijgt bij een storing. Deze la is de UITLEG van een scherm; loopt
         de servicelaag niet, dan hoort die uitleg gewoon te blijven werken. */
    function tok() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }
    function svc(pad, lijf) {
      var t = tok();
      if (!t) return Promise.reject(new Error('geen lid'));
      return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(lijf || {}) }).then(function (r) { return r.json(); });
    }
    function el(soort, klasse, tekst) {
      var n = document.createElement(soort);
      if (klasse) n.className = klasse;
      if (tekst != null) n.textContent = tekst;
      return n;
    }
    function knop(klasse, tekst, doe) {
      var b = el('button', klasse, tekst);
      b.type = 'button';
      b.addEventListener('click', doe);
      return b;
    }
    function hulplaag() {
      if (!tok() || !sheet) return;
      var blok = el('div', 'bss-hulp');
      blok.appendChild(el('b', null, 'Hulp nodig?'));
      sheet.appendChild(blok);
      Promise.all([
        svc('/api/service/bevestigingen').catch(function () { return null; }),
        svc('/api/service/mijn').catch(function () { return null; }),
        svc('/api/service/stand').catch(function () { return null; }),
        svc('/api/service/bel/mijn').catch(function () { return null; })
      ]).then(function (uit) { teken(blok, uit[0], uit[1], uit[2], uit[3]); })
        .catch(function () { blok.remove(); });
    }

    function teken(blok, verzoeken, mijn, stand, bel) {
      if (!sheet || !blok.isConnected) return;

      /* DE PERSOONLIJKE STAND, en alleen als hij iets ZEGT. Raakt er geen
         storing aan uw zaken, dan staat er niets -- geen groen vinkje en geen
         "alles werkt". Dat laatste zou een bewering zijn over beschikbaarheid,
         en die wordt niet per lid gemeten; een geruststelling zonder meting is
         precies wat BESTUUR.md verbiedt. De server zegt hetzelfde in zijn
         `let`, dus dit scherm verzint er niets bij. */
      ((stand && stand.raakt) || []).forEach(function (r) {
        var w = el('div', 'bss-zaak');
        w.appendChild(el('i', null, 'Storing ' + r.incident));
        w.appendChild(el('p', null, r.zin));
        blok.appendChild(w);
      });
      /* HET VERZOEK OM EEN BEVESTIGING GAAT VOOR. Er zit een medewerker aan de
         telefoon te wachten; al het andere kan wachten. */
      ((verzoeken && verzoeken.verzoeken) || []).forEach(function (v) {
        var z = el('div', 'bss-zaak');
        /* WIE VRAAGT DIT. `v.machine` komt van de server en wordt daar afgeleid
           uit een voorvoegsel dat niemand zelf kan zetten. Zonder deze regel
           las een lid hier "ai:onderzoeker vraagt toegang" -- een technische
           sleutel waar een naam hoort te staan, en niets dat zegt dat er geen
           mens meekijkt. */
        z.appendChild(el('i', null, (v.machine ? 'RTG AI' : v.mens) + ' vraagt toegang'));
        if (v.machine) z.appendChild(el('p', null, 'Dit is een machine, geen medewerker.'));
        z.appendChild(el('p', null, v.reden));
        z.appendChild(el('p', null, 'Opent: ' + v.capabilities.join(', ') + '. Zaak ' + v.zaak + '.'));
        var rij = el('div', 'bss-rij');
        rij.appendChild(knop('bss-ja', 'Bevestigen', function () {
          svc('/api/service/bevestig', { id: v.id }).then(function () { z.textContent = 'Bevestigd.'; });
        }));
        rij.appendChild(knop(null, 'Nee', function () {
          svc('/api/service/weiger', { id: v.id }).then(function () { z.textContent = 'Geweigerd.'; });
        }));
        z.appendChild(rij);
        z.appendChild(el('p', null, 'Of lees de code voor: ' + (v.code || '?') +
          ' (' + v.minuten + ' minuten, een keer).'));
        blok.appendChild(z);
      });

      var lopend = ((mijn && mijn.zaken) || []).filter(function (z) {
        return z.stand !== 'opgelost' && z.stand !== 'gesloten';
      });
      lopend.slice(0, 3).forEach(function (z) {
        var r = el('div', 'bss-zaak');
        r.appendChild(el('i', null, z.id + ' / ' + z.standNaam));
        r.appendChild(el('p', null, z.titel));
        blok.appendChild(r);
      });

      var rij = el('div', 'bss-rij');
      rij.appendChild(knop(null, lopend.length ? 'Nog iets melden' : 'Iets melden', function () { meldForm(blok); }));
      /* "IK WIL EEN MENS", en dit is de knop die er niet was. Een lid kon wel
         geholpen worden en niet zelf om een mens vragen; kern/service/mens.js
         legt uit waarom dat twee verschillende dingen waren. */
      if (lopend.length) {
        rij.appendChild(knop(null, 'Ik wil een mens', function () {
          svc('/api/service/mens', { id: lopend[0].id }).then(function (d) {
            rij.replaceWith(el('p', null, (d && d.let) || 'Doorgezet.'));
          });
        }));
      }
      /* DE BELKNOP, en alleen waar hij bestaat. Bellen hoort bij de Lifestyle-
         en Business Pass; voor de rest staat hij er niet, en dat is geen
         weglating maar de ladder. Wat er WEL is -- een mens vragen -- staat er
         hierboven al, want dat is een ondergrens voor elk account en geen
         premium-dienst (kern/service/mens.js). Hij gaat naar een eigen scherm:
         deze la verdwijnt zodra je ergens heen navigeert, en een gesprek dat
         daarmee wegvalt is erger dan geen belknop. */
      if (bel && bel.mag && bel.mag.mag) {
        rij.appendChild(knop(null, 'Bel RTG', function () {
          var z = lopend.length ? ('?zaak=' + encodeURIComponent(lopend[0].id)) : '';
          location.href = '/apps/service-bel.html' + z;
        }));
      }
      blok.appendChild(rij);
    }

    /* Het formulier is met opzet EEN veld. Een melder die eerst een categorie,
       een prioriteit en een subonderwerp moet kiezen, kiest ze verkeerd, en de
       routering leest ze toch liever uit wat hij typt plus waar hij stond
       (kern/service/router.js). */
    function meldForm(blok) {
      var f = el('div', 'bss-zaak');
      var veld = el('textarea', 'bss-veld');
      veld.rows = 3;
      veld.setAttribute('aria-label', 'Wat is er aan de hand?');
      veld.placeholder = 'Wat is er aan de hand?';
      f.appendChild(veld);
      f.appendChild(knop('bss-ja', 'Versturen', function () {
        var t = String(veld.value || '').trim();
        if (t.length < 3) { veld.focus(); return; }
        svc('/api/service/open', { titel: t.slice(0, 110), tekst: t,
          betrokken: { soort: 'scherm', code: location.pathname } })
          .then(function (d) {
            f.textContent = (d && d.zaak)
              ? 'Genoteerd als ' + d.zaak.id + '. U hoort van ons.'
              : ((d && d.error) || 'Er ging iets mis.');
          });
      }));
      /* EN HET ADRES, want een kanaal dat niemand kent bestaat niet. Het komt
         van de server (kern/service/post.js is de enige plek waar het wordt
         uitgerekend) en staat er alleen als de servicelaag hem meegeeft -- geen
         adres in dit bestand overtypen. Het staat ONDER de knop: wie hier al
         zit, meldt sneller met dit veld dan met zijn mailprogramma. */
      svc('/api/service/keuzes').then(function (k) {
        if (!k || !k.hulpAdres || !f.isConnected) return;
        f.appendChild(el('p', null, 'Liever mailen? ' + k.hulpAdres +
          ' -- dat wordt dezelfde melding. Mail vanaf het adres waarmee u bij RTG bekend bent.'));
      }).catch(function () {});
      blok.appendChild(f);
      veld.focus();
    }

    window.RTGGids = { open: openGids, sluit: sluit };
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') sluit(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
