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

  /* Zoekvelden en filterrijen horen niet op de balk zelf maar eronder -- dat
     is waar Mail en Berichten ze zetten. */
  function naarTweedeRij(node) {
    if (node.matches('input[type=search], input[type=text], input:not([type])')) return true;
    var p = node.parentElement;
    return !!(p && p.matches('.filters, .tabs, [role="group"], [role="tablist"], nav'));
  }

  /* HOUD DE WIKKEL BIJ EEN GROEP. Knoppen worden los verplaatst, en dat gaat
     goed tot een pagina ze via hun OUDER selecteert. Precies dat gebeurde op
     apps/payroll.html: de tabs stonden in een <nav> en het scherm zocht ze met
     `nav [data-tab]`. Na het omvormen stonden de knoppen in .ios-nav-acties, de
     <nav> was weg, en de tabwissel deed niets meer -- zonder foutmelding, want
     querySelectorAll levert gewoon een lege lijst.

     Mijn eerdere controle keek naar id's en zag dit dus niet: deze knoppen
     hebben er geen, ze worden via hun container gevonden. Vandaar deze regel:
     hoort een knop bij een GROEP (nav, tablist, filterrij), dan verhuist de
     groep als geheel en blijft de kiezer van de pagina werken. */
  function groepVan(node) {
    var p = node.parentElement;
    return (p && p.matches('.filters, .tabs, [role="group"], [role="tablist"], nav')) ? p : null;
  }

  /* DE BALK HEEFT EEN BOVENGRENS, en die stond nergens opgeschreven.

     bouwBalk() hieronder verplaatst ELKE bedienbare knop naar .ios-nav-acties.
     Dat gaat goed bij twee of drie acties en het gaat stuk bij zeven: op
     foundation/vrienden.html stonden Samen, Rahul, de avatar, de naam, Gezin
     beheren, Ander profiel en Gezin uitloggen naast elkaar, samen 666px in een
     scherm van 390. De balk werd niet te vol -- de PAGINA werd te breed, en
     alles schoof zijwaarts. De tweede rij bestond al (naarTweedeRij), maar die
     kiest op SOORT (een zoekveld, een tabrij) en nooit op RUIMTE. Dat is het
     gat: er was geen regel die zei hoeveel er in een balk past.

     Hier is die regel, en hij MEET in plaats van te tellen. Een vaste
     bovengrens ("hoogstens drie") is net zo fout: drie lange labels passen
     niet en vier pictogrammen wel.

     ios.css houdt daarnaast de kolom zelf krimpbaar. Die twee doen niet
     hetzelfde: het blad garandeert dat de pagina niet meer verbreedt, deze
     functie zorgt dat de acties daarbij leesbaar blijven in plaats van
     samengeperst. Zonder het blad schuift de pagina; zonder deze functie
     staan er zeven knoppen op de ruimte van drie.

     Twee dingen blijven altijd staan. De menuknop van appmenu.js (.amn-knop),
     want dat is de uitweg zelf -- die wegzetten is de deur achter je
     dichttrekken. En de terugknop, die staat in kolom 1 en komt hier niet
     langs.

     Wat naar beneden gaat is niet weg: appmenu.js leest .ios-nav-extra al even
     goed als .ios-nav-acties (zie uitKnoppen daar), dus een uitgeweken actie
     staat nog steeds in het menu. En de weg terug is er ook: wordt het venster
     breder, dan gaat alles eerst terug naar de balk en meet hij opnieuw. */
  var UITGEWEKEN = 'data-ios-uitgeweken';

  function overloopVak(kop) {
    var extra = kop.querySelector('.ios-nav-extra');
    if (!extra) {
      extra = el('div', 'ios-nav-extra');
      var eersteRij = kop.querySelector('.ios-nav-rij');
      kop.insertBefore(extra, eersteRij ? eersteRij.nextSibling : kop.firstChild);
    }
    var vak = extra.querySelector('.ios-nav-overloop');
    if (!vak) { vak = el('div', 'ios-nav-overloop'); extra.appendChild(vak); }
    return vak;
  }

  function pasActiesIn(kop) {
    var acties = kop.querySelector('.ios-nav-acties');
    if (!acties) return;

    /* Eerst alles terug. Anders zakt de balk bij elke resize verder leeg: hij
       zou wel kunnen uitplaatsen en nooit meer terughalen. */
    var terug = kop.querySelectorAll('[' + UITGEWEKEN + ']');
    for (var i = terug.length - 1; i >= 0; i--) {
      terug[i].removeAttribute(UITGEWEKEN);
      acties.appendChild(terug[i]);
    }

    /* HET BUDGET. Meten op overloop alleen is niet genoeg, en dat bleek pas op
       een echte telefoon. De balk van vrienden.html liep namelijk NIET over:
       de kolommen kregen 82 + 11 + 264 op 390 en pasten precies. Maar die 11
       is de titelkolom, tot een streep geknepen, en de acties namen 68% van de
       balk. Technisch klopte alles; het zag eruit alsof er zes dingen over
       elkaar heen stonden, en dat was de melding.

       Een navigatiebalk is navigatie en geen werkbalk. Meer dan 45% aan acties
       betekent dat er geen balk meer is maar een rij knoppen met een pijl
       ervoor. Vandaar twee voorwaarden: hij wijkt uit als het NIET PAST, en
       ook als het wel past maar te vol staat. */
    var BUDGET = 0.45;
    var rij = acties.parentElement;
    function teVol() {
      if (acties.scrollWidth > acties.clientWidth + 1) return true;
      if (!rij || !rij.clientWidth) return false;
      return acties.getBoundingClientRect().width > rij.clientWidth * BUDGET;
    }

    var vak = null, rem = 40;
    while (teVol() && rem--) {
      var kandidaat = null;
      for (var j = acties.children.length - 1; j >= 0; j--) {
        var k = acties.children[j];
        if (k.className && String(k.className).indexOf('amn-knop') >= 0) continue;
        kandidaat = k; break;
      }
      if (!kandidaat) break;
      if (!vak) vak = overloopVak(kop);
      kandidaat.setAttribute(UITGEWEKEN, '');
      vak.insertBefore(kandidaat, vak.firstChild);
    }

    /* Een lege wikkel is het behang waar dit bestand elders vanaf wil. */
    var oud = kop.querySelector('.ios-nav-overloop');
    if (oud && !oud.children.length) oud.remove();
  }

  function bouwBalk(kop) {
    merkWegChrome(kop);

    var acties = bedienbaar(kop);
    var titel = kopTitel(kop);
    /* NU verzamelen, niet straks: de herbouw hieronder haalt de kop uit elkaar
       en dan is niet meer te zien wat er bij de titel hoorde. */
    if (titel) titel.bij = bijregelsVan(kop, titel);
    var oudeTerug = zoekTerug(kop);

    /* De balk die niets doet: geen terugweg, geen bediening, en niets wat de
       app aanspreekt. Dat is behang -- weg ermee, de titel komt groot boven
       de inhoud, zoals iOS een scherm zonder navigatie opent. */
    if (!acties.length && !oudeTerug) {
      /* Ook de kop ZELF kan de drager zijn. Foundation bouwt twee lege
         <header id="balk">-elementen later pas op vanuit de sessie. Die kop
         verwijderen maakt de daaropvolgende initialisatie stilletjes dood. */
      var houdt = draagtId(kop);
      for (var q = 0; q < kop.children.length; q++) {
        if (titel && kop.children[q] === titel.element) continue;
        if (draagtId(kop.children[q])) { houdt = true; break; }
      }
      if (!houdt) {
        if (titel) grooteTitel(titel, null);
        kop.remove();
        return;
      }
    }

    var rij = el('div', 'ios-nav-rij');
    // de acties krijgen hun ondergrens van de component zelf, want niet elk
    // scherm dat ios.js laadt laadt ook ios.css (zie navStijlEenmalig)
    navStijlEenmalig();
    var actieVak = el('div', 'ios-nav-acties');
    var extra = el('div', 'ios-nav-extra');

    if (oudeTerug) {
      var label = terugLabel(oudeTerug);
      oudeTerug.classList.add('ios-terug');
      oudeTerug.textContent = '';
      oudeTerug.appendChild(chevron());
      oudeTerug.appendChild(el('span', null, label));
      rij.appendChild(oudeTerug);
    } else {
      rij.appendChild(el('span'));
    }

    rij.appendChild(el('span', 'ios-nav-titel', titel ? titel.tekst : ''));

    for (var j = 0; j < acties.length; j++) {
      var a = acties[j];
      var groep = groepVan(a);
      if (naarTweedeRij(a)) {
        var blok = groep || a;
        if (blok.parentElement !== extra) extra.appendChild(blok);
      } else if (groep) {
        // de groep als geheel, zodat een kiezer als `nav [data-tab]` blijft werken
        if (groep.parentElement !== actieVak) actieVak.appendChild(groep);
      } else {
        actieVak.appendChild(a);
      }
    }
    rij.appendChild(actieVak);

    /* Wat er nu nog in de kop staat is geen bediening meer. De ELEMENTEN MET
       EEN ID verhuizen naar de tweede rij, want die spreekt de app aan; de
       rest was opmaak en mag weg. De titel slaan we over: die krijgt hieronder
       zijn eigen plek.

       Let op het verschil tussen een drager en zijn WIKKEL. Berichten zet zijn
       teller in `<div class="kop">…<span id="tel" hidden></span></div>`. Nam ik
       die div in zijn geheel mee, dan stond er een lege, niet-verborgen wikkel
       in de balk -- en die houdt de balk 70 punten hoog en zichtbaar, ook als
       er niets in staat. Precies het behang dat hier weg moest. Dus: de
       dragers eruit, de wikkel niet. */
    var over = [].slice.call(kop.childNodes);
    for (var k = 0; k < over.length; k++) {
      var n = over[k];
      if (n === rij || n === extra) continue;
      if (titel && n === titel.element) continue;
      if (n.nodeType === 1 && n.id) { extra.appendChild(n); continue; }
      if (draagtId(n)) {
        var dragers = n.querySelectorAll('[id]');
        for (var m = 0; m < dragers.length; m++) extra.appendChild(dragers[m]);
      }
      if (n.parentNode === kop) kop.removeChild(n);
    }

    kop.insertBefore(rij, kop.firstChild);
    if (extra.childNodes.length) kop.insertBefore(extra, rij.nextSibling);
    kop.classList.add('ios-nav');
    kop.setAttribute('role', 'banner');

    if (titel) grooteTitel(titel, kop);
  }

  function chevron() {
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M15 4l-8 8 8 8');
    svg.appendChild(p);
    return svg;
  }
  /* Afgesplitst van ios-02.js, dat over de 10 KB ging toen de bijregels van de
     kop meeverhuisden. De snede loopt langs de grens tussen de BALK (wat er
     bovenin komt te staan) en de GROTE TITEL eronder, met de regels die erbij
     horen. */

  /* DE BIJREGELS VAN DE KOP: de zinnen die naast de titel in de kopbalk staan.

     Een kop draagt in dit huis vaak meer dan een titel. Boven de titel een
     bovenregel (.ey: "Alleen voor leden", "Belastingdienst · inspecteur"),
     ernaast een ondertitel (.stil "dating op codenaam", .badge "Alles in één ·
     live gps"). Dat is de zin die zegt WAT een scherm is en VOOR WIE.

     De herbouw hieronder gooide uit de kopbalk alles weg wat geen id droeg. Dat
     was bedoeld voor lege wikkels en opmaak, en trof deze zinnen. Vier
     schermtoetsen zakten erop -- "zegt niet waar het voor is", "de eigen
     belofte staat er niet", "noemt niet voor welke rol dit loket is" -- en dat
     was de enige plek waar het opviel: verder was er geen foutmelding, geen
     kapotte pagina, alleen een zin minder op tweeëntachtig schermen.

     Ze verhuizen dus mee naar de grote titel, waar ze ook hoorden: de
     bovenregel erboven, de rest eronder.

     WAT ER NIET IN MEEKOMT, en waarom er zoveel voorwaarden staan:
     - iets met een id (dat blijft sowieso staan, zie draagtId);
     - iets met een knop, link of veld erin (dat is bediening en gaat naar de
       actiebalk, niet naar de titel);
     - een wikkel om andere elementen -- alleen de kale tekstdrager zelf, anders
       verhuist een ouder EN zijn kind allebei;
     - de titel zelf, en alles wat hem bevat. */
  function bijregelsVan(kop, titel) {
    var uit = [], alle = kop.querySelectorAll('*');
    for (var i = 0; i < alle.length; i++) {
      var n = alle[i];
      if (titel && (n === titel.element || n.contains(titel.element))) continue;
      if (n.id || n.querySelector('[id]')) continue;
      if (n.children.length) continue;
      if (n.closest('a, button, input, select, textarea, label')) continue;
      if (!(n.textContent || '').trim()) continue;
      uit.push(n);
    }
    return uit;
  }
  function isBoven(n) {
    return n.classList && (n.classList.contains('ey') ||
      n.classList.contains('eyebrow') || n.classList.contains('kicker'));
  }

  /* De grote titel: staat boven de inhoud en zakt bij het scrollen terug in
     de balk. Zonder balk blijft hij gewoon staan.

     Het kop-element wordt VERPLAATST, niet nagemaakt: houdt hij een id vast
     (en dat komt voor -- #kop, #titel), dan blijft die werken. Draagt de
     inhoud zijn eigen <h1> al, dan is een tweede er een te veel; dan laten we
     de kop-titel gewoon vervallen.

     EN DE REGEL ERBOVEN GAAT MEE. Boven de titel staat in dit huis vaak een
     bovenregel (.ey): "Alleen voor leden", "Overheids-PDA", de naam van de
     zaak. Zevenentachtig app-pagina's hebben er een. Die stond als broer van de
     <h1> in een kale wikkel, en de opruiming hieronder gooit uit de kopbalk
     alles weg wat geen id draagt -- dus verdween hij, samen met de wikkel.

     Dat was bedoeld voor LEGE wikkels ("anders houdt een lege wikkel de balk
     hoog") en trof hier tekst. Een regel die iets zegt is geen opmaak: op
     mall.html verdween daarmee "Alleen voor leden", en dat is nu net de zin
     die vertelt wat die winkel is. Geen foutmelding, geen kapotte pagina --
     alleen een zin minder, en dat merk je pas als je hem zoekt.

     Hij reist dus mee naar boven de grote titel, waar hij ook stond. */
  function grooteTitel(titel, nav) {
    var main = d.querySelector('main') || d.getElementById('main');
    if (!main || main.querySelector('.ios-groot, h1')) {
      // geen plek voor een grote titel: alleen opruimen wat niets vasthoudt
      if (titel.element.parentNode && !draagtId(titel.element)) titel.element.remove();
      return;
    }
    var h = titel.element;
    h.classList.add('ios-groot');
    main.insertBefore(h, main.firstChild);
    var bij = titel.bij || [];
    for (var i = 0; i < bij.length; i++) {
      if (isBoven(bij[i])) { bij[i].classList.add('ios-boven'); main.insertBefore(bij[i], h); }
      else { bij[i].classList.add('ios-onder'); main.insertBefore(bij[i], h.nextSibling); }
    }
    if (!nav) return;

    nav.setAttribute('data-groot', '');
    if (!('IntersectionObserver' in w)) { nav.setAttribute('data-titel-vast', ''); return; }
    var hoogte = parseInt(w.getComputedStyle(nav).height, 10) || 44;
    new w.IntersectionObserver(function (rijtjes) {
      for (var i = 0; i < rijtjes.length; i++) {
        if (rijtjes[i].isIntersecting) nav.removeAttribute('data-titel-vast');
        else nav.setAttribute('data-titel-vast', '');
      }
    }, { rootMargin: '-' + hoogte + 'px 0px 0px 0px' }).observe(h);
  }

  /* ------------------------------------------------ 3. de home-indicator */
  function naarThuis() {
    if (rustig) { location.href = THUIS; return; }
    body.style.transform = ''; body.style.opacity = '';
    body.classList.add('ios-weg');
    setTimeout(function () { location.href = THUIS; }, 200);
  }

  /* DE PIL BRENGT ZIJN EIGEN MAAT MEE, want niet elk scherm laadt ios.css.

     Gemeten over 259 schermen: 202 laden ios.js EN ios.css, 22 laden alleen de
     JS. Op die 22 kreeg de home-indicator dus geen enkele stijl -- een lege knop
     krimpt dan tot zijn inhoud, en dat is precies wat de raakvlakmeting liet
     zien: 4x4 op comm.html, 16x6 op geld.html. Onzichtbaar, onraakbaar, en toch
     in de tabvolgorde met de naam "Omhoog vegen brengt je naar de homescreen".
     Dat is de slechtst denkbare combinatie: een toetsenbordgebruiker landt op
     iets dat hij niet ziet en niemand anders kan aanwijzen.

     Deze regels staan daarom in de component zelf en niet in het blad. Ze zijn
     met opzet mager (alleen maat en plaats, geen kleur): waar ios.css er wel is,
     staat die later in de head en wint hij. Zelfde patroon als de ondertitelband
     in shared/ondertitelband.js. */
  function pilStijlEenmalig() {
    if (document.getElementById('rtg-ios-thuis-basis')) return;
    var st = document.createElement('style');
    st.id = 'rtg-ios-thuis-basis';
    st.textContent = '.ios-thuis{position:fixed;left:50%;transform:translateX(-50%);' +
      'bottom:calc(env(safe-area-inset-bottom,0px) + 6px);z-index:60;' +
      'width:150px;min-width:24px;height:24px;min-height:24px;' +
      'background:none;border:0;padding:0;cursor:pointer;display:flex;' +
      'align-items:center;justify-content:center;touch-action:none;}' +
      '.ios-thuis::after{content:"";width:134px;height:5px;border-radius:2.5px;' +
      'background:rgba(244,241,236,.55);}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* DEZELFDE LES ALS BIJ DE PIL, EEN LAAG HOGER. ios.js bouwt de navigatiebalk
     op elk scherm dat hem laadt, maar tweeentwintig schermen laden ios.js ZONDER
     ios.css. Daar valt de maat weg die ios.css aan de acties rechtsboven geeft
     (17px tekst met 0.3rem padding, ruim boven de 24), en dan meet een actie 15
     tot 22 pixels: te klein om te raken (WCAG 2.5.8).

     Dus brengt de component ook hier zijn eigen ondergrens mee. Alleen min-*:
     waar ios.css er wel is, verandert er niets -- die zet de padding met
     !important en komt ruim boven deze grens uit. */
  function navStijlEenmalig() {
    if (document.getElementById('rtg-ios-acties-basis')) return;
    var st = document.createElement('style');
    st.id = 'rtg-ios-acties-basis';
    st.textContent = '.ios-nav-acties > *{min-width:24px;min-height:24px;box-sizing:border-box;' +
      'display:inline-flex;align-items:center;justify-content:center;}';
    (document.head || document.documentElement).appendChild(st);
  }

  function homeIndicator() {
    pilStijlEenmalig();
    var pil = el('button', 'ios-thuis');
    pil.type = 'button';
    pil.setAttribute('aria-label', 'Omhoog vegen brengt je naar de homescreen');
    body.appendChild(pil);

    var startY = null, dy = 0, veegde = false;
    pil.addEventListener('pointerdown', function (e) {
      startY = e.clientY; dy = 0; veegde = false;
      try { pil.setPointerCapture(e.pointerId); } catch (x) {}
    });
    pil.addEventListener('pointermove', function (e) {
      if (startY == null) return;
      dy = Math.max(0, startY - e.clientY);
      if (dy > 8) veegde = true;
      if (rustig || !veegde) return;
      var p = Math.min(dy / 260, 1);
      body.style.transformOrigin = '50% 85%';
      body.style.transform = 'scale(' + (1 - p * 0.16).toFixed(4) + ') translateY(' + Math.round(-dy * 0.35) + 'px)';
      body.style.opacity = String(1 - p * 0.25);
    });
    function los() {
      if (startY == null) return;
      var afstand = dy; startY = null;
      if (!veegde) return;
      if (afstand > 70) { naarThuis(); return; }
      body.classList.add('ios-veert');
      body.style.transform = ''; body.style.opacity = '';
      setTimeout(function () { body.classList.remove('ios-veert'); }, 260);
    }
    pil.addEventListener('pointerup', los);
    pil.addEventListener('pointercancel', los);
    /* Alleen toetsenbord en hulpmiddelen (detail 0) activeren met een tik;
       een duim die de pil raakt hoort niets te doen. */
    pil.addEventListener('click', function (e) {
      if (veegde) { veegde = false; return; }
      if (e.detail === 0) naarThuis();
    });
  }
/* de randveeg: vanaf de schermrand naar binnen vegen */

  /* ---------------------------------------------------- 4. de randveeg */
  function randveeg() {
    var start = null, bezig = false;
    d.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      if (!t || t.clientX > 24) { start = null; return; }
      start = t.clientX; bezig = false;
    }, { passive: true });
    d.addEventListener('touchmove', function (e) {
      if (start == null) return;
      var t = e.touches[0];
      if (t && t.clientX - start > 60) bezig = true;
    }, { passive: true });
    d.addEventListener('touchend', function () {
      if (start != null && bezig) {
        if (w.history.length > 1) w.history.back(); else naarThuis();
      }
      start = null; bezig = false;
    }, { passive: true });
  }

  /* -------------------------------------------------------- 5. bladen */
  /* Wat vroeger een venster was, komt nu van onder. Een blad heeft een greep,
     sluit met een veeg omlaag, met Esc of met een tik ernaast -- en het heeft
     geen titelbalk, geen sluitknopje en geen dock. */
  function blad(inhoud, opties) {
    opties = opties || {};
    var waas = el('div', 'ios-waas');
    var vel = el('div', 'ios-blad');
    vel.setAttribute('role', 'dialog');
    vel.setAttribute('aria-modal', 'true');
    if (opties.label) vel.setAttribute('aria-label', opties.label);
    vel.appendChild(el('div', 'ios-greep'));
    if (typeof inhoud === 'string') vel.appendChild(el('div', null, inhoud));
    else if (inhoud) vel.appendChild(inhoud);

    d.body.appendChild(waas);
    d.body.appendChild(vel);
    requestAnimationFrame(function () { waas.classList.add('ios-aan'); vel.classList.add('ios-aan'); });

    function sluit() {
      waas.classList.remove('ios-aan'); vel.classList.remove('ios-aan');
      setTimeout(function () { waas.remove(); vel.remove(); }, 340);
      d.removeEventListener('keydown', opEsc);
    }
    function opEsc(e) { if (e.key === 'Escape') sluit(); }
    waas.addEventListener('click', sluit);
    d.addEventListener('keydown', opEsc);

    var greep = vel.querySelector('.ios-greep'), y0 = null;
    greep.addEventListener('pointerdown', function (e) {
      y0 = e.clientY;
      try { greep.setPointerCapture(e.pointerId); } catch (x) {}
    });
    greep.addEventListener('pointermove', function (e) {
      if (y0 == null) return;
      vel.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)';
    });
    greep.addEventListener('pointerup', function (e) {
      if (y0 == null) return;
      var afstand = e.clientY - y0; y0 = null;
      vel.style.transform = '';
      if (afstand > 90) sluit();
    });

    return { sluit: sluit, element: vel };
  }

  /* --------------------------------------------------------- aanzetten */
  body.setAttribute('data-ios', '');
  body.removeAttribute('data-osbar');

  // het merk gaat ook buiten de kopbalk weg, maar dan met de smalle bezem
  merkWegPagina();

  var kop = d.querySelector('body > header');
  if (kop && !isThuis) {
    bouwBalk(kop);
    /* Pas inmeten als de balk er echt staat -- en na deze tik, want de
       menuknop van appmenu.js komt verderop in dit bestand pas binnen en
       telt mee in de breedte. */
    var meetIn = function () { try { pasActiesIn(kop); } catch (e) {} };
    if (w.requestAnimationFrame) w.requestAnimationFrame(meetIn); else meetIn();
    w.addEventListener('resize', meetIn);
  }

  /* In een split-paneel (shared/split.js zet de app in een iframe naast een
     andere) hoort GEEN home-indicator: die van het scherm eromheen is de
     echte, en twee pillen boven elkaar is een knop die de verkeerde app
     sluit. De randveeg blijft ook aan het buitenste scherm. */
  var inPaneel = false;
  try { inPaneel = w.self !== w.top; } catch (e) { inPaneel = true; }
  if (!isThuis && !inPaneel) { homeIndicator(); randveeg(); }

  w.RTGiOS = { blad: blad, thuis: naarThuis, THUIS: THUIS };

  /* 6. HET MENU. De hamburger rechtsboven, met de functies van deze app en de
     vaste weg naar huis en naar de instellingen (shared/appmenu.js). Hij hangt
     hier om dezelfde reden als al het andere in dit bestand: dit is de laag die
     al op elke app-pagina staat en die de navigatiebalk net heeft gebouwd, dus
     dit is de plek waar de knop erbij kan zonder elke pagina te openen.

     Na de balk, want het menu zoekt zijn plek in .ios-nav-acties. In een
     split-paneel niet: daar hoort één menu bij het scherm eromheen, net als de
     home-indicator hierboven. */
  if (!inPaneel && !d.getElementById('rtgAppMenuJs')) {
    var menuS = d.createElement('script');
    menuS.id = 'rtgAppMenuJs';
    menuS.src = '/shared/appmenu.js';
    menuS.defer = true;
    (d.head || d.documentElement).appendChild(menuS);
  }
})(window, document);
