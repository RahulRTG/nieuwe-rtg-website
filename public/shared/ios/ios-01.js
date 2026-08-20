/* ======================== De iOS-laag, het gedrag ========================
   Hoort bij shared/ios.css. Eén script dat van elke app-pagina een
   iOS-scherm maakt, zonder dat de pagina er zelf iets voor hoeft te doen.

   WAAROM HIER EN NIET IN 200 BESTANDEN. Elke app-pagina schreef zijn eigen
   kopbalk: een eyebrow met "RTG" erin, een titel, een pijl terug naar het
   bureaublad, soms knoppen. Tweehonderd keer bijna hetzelfde, tweehonderd
   keer net anders. De regel "een balk alleen als er iets te bedienen valt"
   handhaaf je niet door hem tweehonderd keer met de hand toe te passen --
   dan is hij binnen een week weer scheef. Hij staat daarom op één plek, en
   leest de balk die de pagina al heeft.

   WAT HET DOET, per pagina:

   1. HET MERK ERUIT. Een woordmerk hoort op de homescreen, op het icoon --
      niet nog een keer binnen de app die je net geopend hebt. Elk logo,
      elke "RTG"-eyebrow en elke merkchip in de chrome gaat weg.

   2. DE BALK WEGEN. Blijft er na het merk niets over dan een titel, dan is
      de balk geen navigatie maar behang: hij verdwijnt, en de titel komt
      terug als GROTE TITEL boven de inhoud (iOS doet dat zo). Valt er wel
      wat te bedienen of terug te gaan, dan wordt het een navigatiebalk van
      44 punten: terug links, titel in het midden, acties rechts, en een
      tweede rij voor zoeken en filteren.

      De balk wordt TER PLEKKE omgebouwd, niet vervangen: hetzelfde
      <header>-element, dezelfde knoppen, dus dezelfde id's en dezelfde
      luisteraars van de app zelf. Zie de opmerking bij draagtId() -- daar
      zat de val.

   3. DE HOME-INDICATOR. Omhoog vegen brengt je thuis; de app krimpt onder
      je vinger weg. Een losse TIK doet niets -- de pil ligt precies waar je
      duim rust, en een tik gooide de app steeds dicht.

   4. DE RANDVEEG. Van de linkerrand naar rechts is terug, zoals overal in
      iOS. Is er niets om naar terug te gaan, dan gaat hij naar de home.

   5. BLADEN. RTGiOS.blad(inhoud) schuift een blad van onder omhoog. Dat is
      wat er voor de vensters in de plaats komt.

   Uitzetten kan per pagina met <body data-ios-uit>. De homescreen zelf zegt
   <body data-ios-home>: die krijgt geen indicator en geen balk. */
(function (w, d) {
  'use strict';
  if (w.RTGiOS) return;

  var THUIS = '/apps/app.html';
  var body = d.body;
  if (!body || body.hasAttribute('data-ios-uit')) return;

  var isThuis = body.hasAttribute('data-ios-home');
  var rustig = false;
  try { rustig = w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function el(tag, klas, tekst) {
    var e = d.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = tekst;
    return e;
  }

  /* ------------------------------------------------------- 1. het merk */
  /* Twee bezems, en het verschil is belangrijk.

     IN DE KOPBALK mag hij breed vegen: daar is alles chrome. Eyebrow,
     woordmerk, merkchip, icoontje -- in een iOS-balk staat alleen de titel,
     dus het kan er allemaal uit.

     OP DE REST VAN DE PAGINA moet hij smal zijn. Klassenamen liegen: de
     `.logo` van apps/foundation/index.html is geen woordmerk maar de
     display-kop "Alles om vooruit te komen", en die met een brede bezem
     meenemen sloopt de pagina. Buiten de balk gaan daarom alleen de
     ondubbelzinnige merktekens weg. */
  function weghalen(wortel, kiezer) {
    if (!wortel) return;
    var weg = wortel.querySelectorAll(kiezer);
    for (var i = 0; i < weg.length; i++) weg[i].remove();
  }

  /* .ey STOND HIER, EN DAT WAS EEN VERGISSING. De regel is "geen woordmerk in
     de chrome van een app", en .ey/.eyebrow/.kicker zijn geen woordmerk maar
     een typografisch middel: de bovenregel boven een titel. Zevenentachtig
     app-pagina's gebruiken hem, en vijfenvijftig verschillende teksten lang is
     er geen woordmerk bij -- wel dingen als "Alleen voor leden",
     "Belastingdienst · inspecteur" en "Gemeente-medewerker". Precies de zin die
     zegt wat een scherm is en voor wie.

     Die verdwenen dus van elke pagina waar ze in de kopbalk stonden. Geen
     foutmelding, geen kapotte pagina, alleen een zin minder. Drie schermtoetsen
     zakten erop ("zegt niet waar het voor is", "noemt niet voor welke rol dit
     loket is") en dat was de enige plek waar het opviel.

     Dat het een vergissing was, staat er zelf al bij: MERK_PAGINA hieronder --
     dezelfde vraag, buiten de balk -- noemt .ey niet. Buiten de kopbalk was een
     bovenregel altijd al gewoon tekst.

     Hij reist nu mee naar boven de grote titel (zie bovenregelVan in ios-02),
     dus de balk blijft even kaal als hij was. */
  var MERK_CHROME = [
    '.os-merk', '.os-merk-logo', '.brand', '.merk', '.logo', '.logo-img',
    '.os-chip', '.osbar', '.os-kick',
    'img[src*="/icon"]', 'img[src*="logo"]', 'img[alt="RTG"]'
  ].join(',');

  /* Buiten de balk: alleen wat per definitie het merkteken van het OS is. */
  var MERK_PAGINA = [
    '.os-merk', '.os-merk-logo', '.osbar', '.os-kick', 'img[alt="RTG"]'
  ].join(',');

  function merkWegChrome(wortel) { weghalen(wortel, MERK_CHROME); }
  function merkWegPagina() { weghalen(d.body, MERK_PAGINA); }

  /* ------------------------------------------------------- 2. de balk */
  function isTerug(node) {
    if (!node) return false;
    if (node.matches('.terug, #terug, .os-terug, #osTerug')) return true;
    var l = (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('title') || '');
    if (/\bterug\b/i.test(l)) return true;
    /* Een link die met een pijl begint IS de terugknop, hoe hij ook heet.
       De juridische pagina's schrijven "← Juridisch", de meldkamer "←" en
       niets meer; zonder deze regel belanden ze rechts tussen de acties. */
    if (node.tagName === 'A' && /^\s*[←<]/.test(node.textContent || '')) return true;
    var h = node.getAttribute('href') || '';
    return /\/apps\/(index|app|bureau)\.html$/.test(h);
  }

  function zoekTerug(kop) {
    var alle = kop.querySelectorAll('a, button');
    for (var i = 0; i < alle.length; i++) if (isTerug(alle[i])) return alle[i];
    return null;
  }

  /* Waar de terugknop naartoe gaat, in gewone taal. iOS zet daar de naam van
     het scherm waar je vandaan komt, niet het woord "terug".

     Twee dingen worden geweigerd. Een MERKNAAM ("RTG OS" stond als terug-link
     op de schoolpagina) -- dat is precies het woordmerk dat hier weg moet.
     En een BROKSTUK: uit aria-label "Terug naar de app" bleef "app" over, en
     een chevron met "app" ernaast zegt niets. Allebei worden "Home", want dat
     is waar ze naartoe gaan. */
  function bruikbaarLabel(t) {
    if (!t) return null;
    t = t.trim();
    if (!t || t.length > 18) return null;
    if (/\brtg\b/i.test(t)) return null;
    if (/^(de|het|een|app|pagina|scherm|hub|overzicht)$/i.test(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function terugLabel(node) {
    var uitTekst = bruikbaarLabel((node.textContent || '').replace(/^\s*[←<]\s*/, ''));
    if (uitTekst) return uitTekst;
    var h = node.getAttribute('href') || '';
    if (/\/apps\/(index|app|bureau)\.html$/.test(h)) return 'Home';
    var uitLabel = bruikbaarLabel((node.getAttribute('aria-label') || '')
      .replace(/^terug\s*(naar\s*)?(de|het)?\s*/i, ''));
    return uitLabel || 'Home';
  }

  /* Bedienbaar = iets waarmee je wat doet. Een <span> met een teller of een
     <h1> is dat niet, en die houden een balk dus niet in leven.

     VERBORGEN TELT MEE. Dat lijkt vreemd, en het is precies waar dit eerst op
     stukging: de kop van Berichten draagt een zoekveld, een taalkiezer en een
     filterrij die allemaal `hidden` zijn tot je bent ingelogd. Wie die
     overslaat, ziet een kop zonder bediening, gooit hem weg -- en gooit het
     zoekveld mee weg. De app zoekt daarna naar #zoekveld, vindt niets, en
     Berichten heeft geen zoekfunctie meer zonder dat er iets rood wordt. */
  /* MAAR EEN KNOP IN ANDERMANS DICHTE PANEEL IS GEEN BALKACTIE, en dat is iets
     anders dan de regel hierboven.

     Het verschil zit in WIE er verborgen is. Berichten heeft een zoekveld dat
     zelf `hidden` is tot je inlogt: dat veld is een balkactie die nog moet
     verschijnen, en die moet meetellen. Maar de RTFoundation-balk heeft een
     profielmenu -- een dropdown met `hidden` erop -- en daarin staan Gezin
     beheren, Ander profiel en Gezin uitloggen. Die drie zijn geen balkacties;
     ze horen bij de knop die dat menu opent, en die knop staat er al.

     Zonder dit onderscheid tilde bouwBalk() ze uit hun eigen menu de balk in,
     waar ze hun opmaak kwijtraakten (het menu styleert zijn eigen links) en
     als drie blauwe onderstreepte links over de titel heen kwamen te staan. Op
     een telefoon liepen ze gewoon van het scherm af. Dat is precies hoe het
     eruitzag op de foto waarmee dit gemeld werd.

     De regel is dus: het element zelf verborgen -> meetellen. Een VOOROUDER
     onder de kop dicht -> overslaan, want dan zit het in een paneel dat zijn
     eigen opener heeft. Een <dialog> die niet open is en een <details> die
     dicht is zijn hetzelfde geval met een andere spelling. */
  function inGeslotenPaneel(node, kop) {
    for (var p = node.parentElement; p && p !== kop; p = p.parentElement) {
      if (p.hasAttribute && p.hasAttribute('hidden')) return true;
      if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return true;
      if (p.tagName === 'DIALOG' && !p.open) return true;
      if (p.tagName === 'DETAILS' && !p.hasAttribute('open')) return true;
    }
    return false;
  }

  function bedienbaar(kop) {
    var kandidaten = kop.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]');
    var uit = [];
    for (var i = 0; i < kandidaten.length; i++) {
      if (isTerug(kandidaten[i])) continue;
      if (inGeslotenPaneel(kandidaten[i], kop)) continue;
      uit.push(kandidaten[i]);
    }
    return uit;
  }

  /* De titel komt UIT DE KOP, of nergens vandaan. <title> is geen paginakop:
     daar staat "Privacybeleid, Rahul Travel Group" terwijl de pagina zelf al
     een <h1> heeft, en dan zet je er een tweede bovenop. */
  function kopTitel(kop) {
    var h = kop && kop.querySelector('h1, h2');
    var t = h && h.textContent.trim();
    return t ? { tekst: t, element: h } : null;
  }

  /* DE VAL WAAR DIT OP STUKGING. Een kop draagt meer dan knoppen: #tel telt
     ongelezen berichten, #titel krijgt de naam van de dienst, #wie de
     ingelogde eenheid, #filters wordt pas na het inloggen gevuld. Die zijn
     geen bediening, dus ze hielden de balk niet in leven -- en werden met de
     kop weggegooid. Daarna schrijft de app-code er gewoon nooit meer iets in:
     geen foutmelding, geen rode toets, alleen een teller die eeuwig leeg
     blijft. Alles met een id blijft daarom staan, altijd. */
  function draagtId(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!(node.id || node.querySelector('[id]'));
  }
