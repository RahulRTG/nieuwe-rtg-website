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

