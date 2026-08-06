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

  var MERK_CHROME = [
    '.os-merk', '.os-merk-logo', '.brand', '.merk', '.logo', '.logo-img',
    '.os-chip', '.osbar', '.os-kick',
    '.ey', '.eyebrow', '.kicker',
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
  function bedienbaar(kop) {
    var kandidaten = kop.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]');
    var uit = [];
    for (var i = 0; i < kandidaten.length; i++) {
      if (isTerug(kandidaten[i])) continue;
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

  function bouwBalk(kop) {
    merkWegChrome(kop);

    var acties = bedienbaar(kop);
    var titel = kopTitel(kop);
    var oudeTerug = zoekTerug(kop);

    /* De balk die niets doet: geen terugweg, geen bediening, en niets wat de
       app aanspreekt. Dat is behang -- weg ermee, de titel komt groot boven
       de inhoud, zoals iOS een scherm zonder navigatie opent. */
    if (!acties.length && !oudeTerug) {
      var houdt = false;
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

  /* De grote titel: staat boven de inhoud en zakt bij het scrollen terug in
     de balk. Zonder balk blijft hij gewoon staan.

     Het kop-element wordt VERPLAATST, niet nagemaakt: houdt hij een id vast
     (en dat komt voor -- #kop, #titel), dan blijft die werken. Draagt de
     inhoud zijn eigen <h1> al, dan is een tweede er een te veel; dan laten we
     de kop-titel gewoon vervallen. */
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

  function homeIndicator() {
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
  if (kop && !isThuis) bouwBalk(kop);

  /* In een split-paneel (shared/split.js zet de app in een iframe naast een
     andere) hoort GEEN home-indicator: die van het scherm eromheen is de
     echte, en twee pillen boven elkaar is een knop die de verkeerde app
     sluit. De randveeg blijft ook aan het buitenste scherm. */
  var inPaneel = false;
  try { inPaneel = w.self !== w.top; } catch (e) { inPaneel = true; }
  if (!isThuis && !inPaneel) { homeIndicator(); randveeg(); }

  w.RTGiOS = { blad: blad, thuis: naarThuis, THUIS: THUIS };
})(window, document);
