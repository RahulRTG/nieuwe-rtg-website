/* =================== HET APP-MENU: één hamburger, in de apps ===================

   WAAROM DIT ER IS. In de apps van het OS was er niets: je stond in Muziek of
   in de Mall en er was geen weg terug naar huis, geen instellingen, geen
   overzicht van wat die app kon; alleen de veeg van de onderrand, die je moest
   kennen. Eén hamburger rechtsboven, op elk app-scherm, lost dat op.

   HET BEGINSCHERM KRIJGT HEM NIET, en dat is een keuze en geen vergeetpost.
   Daar droeg de statusbalk eerst drie losse knopjes (batterij, bel,
   bedieningspaneel); die zijn weggehaald omdat drie tekens naast elkaar boven
   een scherm van lucht en een klok precies de stapeling zijn waar de
   merkregels tegen waarschuwen. Er een vierde teken voor terugzetten is dan
   niet veel beter. Het beginscherm is de rustplek: mappen, klok, functies, de
   balk van Rahul, en verder niets. Wat er aan systeem achter zit haal je van
   de bovenrand omlaag (shared/randen.js opent daar het bedieningspaneel), en
   dat paneel draagt zoeken, meldingen, scannen, je Zegel en je backoffice.

   WAT ER IN HET MENU STAAT, en waar het vandaan komt:

     1. DEZE APP -- de functies van het scherm waar je staat. Niet met de hand
        per app opgeschreven (dat zijn ruim honderdveertig bestanden die binnen
        een week uit elkaar lopen), maar gelezen uit wat de pagina AL heeft:
        de delenbalk van shared/deelmenu.js, de tabs, de knoppen die
        shared/ios.js in de navigatiebalk heeft gezet, en anders de eerste
        schakelrij die op vorm te herkennen is. Een app
        die iets beters te bieden heeft zegt dat zelf met RTGAppMenu.zet().

     2. OVERAL -- de vaste rijen: naar het beginscherm, terug, instellingen,
        meldingen, Rahul, delen, uitloggen. Elke rij verschijnt alleen als er
        op dit scherm ook echt iets achter zit.

   Dit bestand wordt door shared/ios.js binnengehaald, dus het staat vanzelf op
   elke app-pagina; er hoefde geen enkele HTML voor open. Uitzetten kan met
   <body data-appmenu-uit>. */
(function (w, d) {
  'use strict';
  const dsBijStart = document.documentElement.hasAttribute('data-ds');
  if (w.RTGAppMenu) return;

  var body = d.body;
  if (!body || body.hasAttribute('data-appmenu-uit')) return;
  /* Het beginscherm doet niet mee: zie de kop. Daar is de bovenrand de ingang
     naar het systeem, niet een knop in beeld. */
  if (body.hasAttribute('data-ios-home')) return;

  /* Eén controller, dezelfde hooks en één canonieke presentatie. De oude
     klassennamen blijven als gedragscontract bestaan; de DS-klassen tekenen. */
  function menuKlasse(oud, nieuw) {
    return oud + ' ' + nieuw;
  }

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };

  /* HET MENU BRENGT ZIJN EIGEN WOORDEN MEE.

     shared/i18n.js leest de vertalingen uit window.I18N, en dat object wordt
     per PAGINA gevuld -- prima voor teksten die in die pagina staan, maar dit
     menu staat op alle pagina's en zou dan overal buiten apps/app.html in het
     Nederlands blijven hangen, ook voor wie Engels heeft gekozen. Een gedeelde
     laag hoort zijn eigen woordenboek bij zich te dragen.

     Aanvullen, nooit overschrijven: wat de pagina zelf al zegt wint, en via
     window.I18N.en lopen deze regels ook gewoon mee in de wereldtalen
     (i18n.js laadWereldDict vertaalt de Engelse set).

     Op een pagina die shared/i18n.js helemaal niet laadt -- en dat zijn de
     meeste app-schermen, die staan bewust in het Nederlands -- gebeurt er
     niets en blijft het menu Nederlands. Dat is ook goed: één Engelse
     menuknop op een verder Nederlands scherm is erger dan geen. */
  (function () {
    var eigen = {
      'menu.label': 'Menu', 'menu.sluit': 'Close menu', 'menu.thuis': 'Home screen',
      'menu.terug': 'One step back', 'menu.instel': 'Settings', 'menu.rahul': 'Ask Rahul',
      'menu.deel': 'Share this screen', 'menu.deze': 'This app',
      'menu.overal': 'Everywhere', 'menu.app': 'This app',
      'menu.niets': 'There is nothing extra to do on this screen.',
      'os.zoek': 'Search', 'app.notifs': 'Notifications', 'app.logout': 'Sign out',
      'os.cc.scan': 'Scan', 'os.cc.zegel': 'My Seal', 'os.cc.bo': 'My back office',
      'os.cc.vol': 'Full screen'
    };
    w.I18N = w.I18N || {};
    w.I18N.en = w.I18N.en || {};
    for (var k in eigen) if (!(k in w.I18N.en)) w.I18N.en[k] = eigen[k];
  })();
/* de stijl van het bedieningspaneel */
  /* De vormtaal van het bedieningspaneel (shared/bediening.js): een blad dat
     van onderen opkomt, donker, met een gouden accent. Bewust dezelfde vorm --
     het is hetzelfde soort ding, en twee soorten bladen naast elkaar is weer
     een device erbij. */
  function laadAppmenuPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var appmenuStijlLink = document.createElement('link');
    appmenuStijlLink.id = 'rtgDsRuntimeCss';
    appmenuStijlLink.rel = 'stylesheet';
    appmenuStijlLink.href = pad;
    document.head.appendChild(appmenuStijlLink);
  }

  function stijl() { laadAppmenuPresentatie('/ds/rtg-ds.css'); }

  /* ------------------------------------------------------------ tekens */
  /* Een handvol lijntekeningen, in dezelfde taal als de rest van het OS
     (1.6 lijndikte, ronde uiteinden). Meer iconen dan dit hoeft niet: wat
     geen eigen teken heeft krijgt de neutrale stip. */
  var TEKEN = {
    thuis: 'M4 11l8-7 8 7M6 10v9h12v-9',
    terug: 'M15 5l-7 7 7 7',
    /* Instellingen krijgt de schuifjes en niet nog een keer drie streepjes:
       dat is het teken van de menuknop zelf, en een rij die eruitziet als de
       knop waarmee je hem opende zegt niets. */
    instel: 'M4 8h16M4 16h16M9 6v4M15 14v4',
    bel: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    rahul: 'M20.5 11.6a8.2 8.2 0 0 1-8.7 8.2L4 21l1.3-3.6a8.2 8.2 0 1 1 15.2-5.8z',
    zoek: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.6-3.6',
    deel: 'M12 15V4M8.5 7.5L12 4l3.5 3.5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5',
    scan: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16',
    zegel: 'M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3zM9 12l2 2 4-4',
    kantoor: 'M4 20V8l8-4 8 4v12M9 20v-5h6v5',
    vol: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
    uit: 'M12 3v9M6.6 7a8 8 0 1 0 10.8 0',
    stip: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
  };
  function teken(naam) {
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', TEKEN[naam] || TEKEN.stip);
    svg.appendChild(p);
    return svg;
  }
  /* -------------------------------------------------- de eigen functies */
  /* Wat een app kan, staat al op zijn scherm. Vier bronnen, van beste naar
     minst goede, en we stoppen zodra er genoeg is. De volgorde is niet
     willekeurig: een delenbalk is door de pagina zelf als navigatie bedoeld,
     een kopje in de inhoud is dat pas bij gebrek aan beter. */
  var GEZET = [];        // wat een app zelf heeft opgegeven (RTGAppMenu.zet)
  var MAX = 8;

  function labelVan(node) {
    var t = (node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '')
      .replace(/\s+/g, ' ').trim();
    /* Een pijl of kruisje is geen functie, en een zin ook niet: wat niet in
       twee, drie woorden te zeggen is hoort niet in een menu thuis. */
    if (!t || t.length < 2 || t.length > 28) return null;
    if (/^[^\wÀ-ɏ]+$/.test(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function uitKnoppen(kiezer, uit, gezien) {
    var alle = d.querySelectorAll(kiezer);
    for (var i = 0; i < alle.length && uit.length < MAX; i++) {
      var k = alle[i];
      /* Onszelf niet opnemen. De hamburger hangt in .ios-nav-acties -- precies
         een van de plekken waar hieronder gezocht wordt -- dus zonder deze
         regel stond in elk app-menu een tegel "Menu" die het menu opent dat je
         net had geopend. En erger: die ene tegel maakte de lijst niet-leeg,
         waardoor de terugval op de kopjes van de inhoud nooit aan bod kwam en
         apps zonder tabs een menu kregen met alleen zichzelf erin. */
      if (k === knop || k.closest('.amn-blad,.bdn-scrim')) continue;
      if (k.disabled || k.hidden) continue;
      var l = labelVan(k);
      if (!l || gezien[l.toLowerCase()]) continue;
      gezien[l.toLowerCase()] = true;
      uit.push({ label: l, knop: k });
    }
  }

  /* DE SCHAKELRIJ, op vorm herkend en niet op klassenaam.

     Bijna elke app heeft er een: "Alle / Hotels / Appartementen / Villa's" in
     Verblijven, "alles / nieuws / reizen / lifestyle / zaken" in Nieuws. Maar
     ze heten allemaal anders -- .chips, .rubrieken, .filters, en op de meeste
     pagina's een naam die maar één keer voorkomt. Een lijst klassenamen
     bijhouden is hetzelfde probleem als elk menu met de hand: die lijst loopt
     achter zodra er een app bijkomt.

     De VORM is wel overal gelijk: een vakje waarvan de directe kinderen op één
     na allemaal knoppen zijn, drie tot acht stuks, elk met een kort label. Dat
     is precies wat een schakelrij is en wat een lijst met inhoud niet is (die
     heeft lange labels, of één kind, of tientallen). We nemen de eerste die we
     zo tegenkomen -- de bovenste op het scherm is de hoofdschakelaar. */
  function uitSegment(uit, gezien) {
    var wortel = d.querySelector('main') || d.getElementById('main') || d.body;
    var vakken = wortel.querySelectorAll('div, nav, section, ul, p');
    for (var i = 0; i < vakken.length && i < 400; i++) {
      var vak = vakken[i], kids = vak.children;
      if (vak.closest('.amn-blad,.bdn-scrim')) continue;
      if (kids.length < 3 || kids.length > 8) continue;
      var labels = [], goed = true;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        if (k === knop || (k.tagName !== 'BUTTON' && k.tagName !== 'A')) { goed = false; break; }
        if (k.disabled || k.hidden) { goed = false; break; }
        var l = labelVan(k);
        if (!l || l.length > 22 || gezien[l.toLowerCase()]) { goed = false; break; }
        labels.push({ label: l, knop: k });
      }
      if (!goed) continue;
      for (var m = 0; m < labels.length && uit.length < MAX; m++) {
        gezien[labels[m].label.toLowerCase()] = true;
        uit.push(labels[m]);
      }
      return;
    }
  }

  function eigenFuncties() {
    var uit = [], gezien = {};
    for (var g = 0; g < GEZET.length && uit.length < MAX; g++) {
      var it = GEZET[g];
      if (!it || !it.label) continue;
      gezien[String(it.label).toLowerCase()] = true;
      uit.push(it);
    }
    /* De naam van de app staat al boven het menu. Stond hij ook nog eens als
       enige tegel eronder (Reisboek, Table, Cellier hadden dat: hun <h2> is de
       titel van de pagina), dan leek het menu een functie te hebben die het
       niet heeft. Eén keer noemen is genoeg. */
    gezien[titel().toLowerCase()] = true;
    uitKnoppen('.rtgdeel-balk button', uit, gezien);
    /* De tweede rij van de navigatiebalk: daar zet shared/ios.js de filter- en
       tabrijen van de app neer ("Alles / Mensen / Werk / Officieel / Archief"
       in Berichten, "Feed / Ontdekken / Plaatsen" in De Salon). Dat IS wat die
       app doet, dus het is de beste bron die er is -- beter dan de kopjes van
       de inhoud, en op deze twee apps de enige. */
    uitKnoppen('.ios-nav-extra button, .ios-nav-extra a[href]', uit, gezien);
    uitKnoppen('[role="tab"], [data-tab], .tabs button', uit, gezien);
    uitKnoppen('.ios-nav-acties button, .ios-nav-acties a[href]', uit, gezien);
    if (!uit.length) uitSegment(uit, gezien);
    if (!uit.length) {
      /* Niets bedienbaars gevonden: dan maar de kopjes van de inhoud, als
         springpunten. Beter een inhoudsopgave dan een leeg menu. */
      var main = d.querySelector('main') || d.getElementById('main');
      var koppen = main ? main.querySelectorAll('h2, h3.sec') : [];
      for (var j = 0; j < koppen.length && uit.length < 6; j++) {
        var kop = koppen[j], t = labelVan(kop);
        if (!t || gezien[t.toLowerCase()]) continue;
        gezien[t.toLowerCase()] = true;
        uit.push({ label: t, spring: kop });
      }
    }
    return uit;
  }
  /* ------------------------------------------------- de vaste functies */
  function el(id) { return d.getElementById(id); }
  function klik(id) { var k = el(id); if (k) k.click(); }
  function bestaat(id) { return !!el(id); }

  function vasteFuncties() {
    var uit = [];

    uit.push({ label: T('menu.thuis', 'Beginscherm'), icoon: 'thuis', doe: function () {
      if (w.RTGiOS && w.RTGiOS.thuis) w.RTGiOS.thuis();
      else location.href = '/apps/app.html';
    } });
    if (w.history.length > 1) {
      uit.push({ label: T('menu.terug', 'Een stap terug'), icoon: 'terug',
        doe: function () { w.history.back(); } });
    }

    /* Instellingen: het paneel van shared/bediening.js, dat voor dit ene
       scherm dezelfde rol speelt als het bedieningspaneel van het OS. Is het
       er niet, dan valt er niets in te stellen en staat de rij er ook niet. */
    if (w.RTGBediening && w.RTGBediening.aanwezig) {
      uit.push({ label: T('menu.instel', 'Instellingen'), icoon: 'instel',
        doe: function () { w.RTGBediening.open(); } });
    }

    /* Rahul: het menu opent zijn venster, het tekent er zelf geen tweede. */
    if (w.RTGMetgezel && w.RTGMetgezel.rahul) {
      uit.push({ label: T('menu.rahul', 'Vraag Rahul'), icoon: 'rahul',
        doe: function () { w.RTGMetgezel.rahul(); } });
    }

    if (w.RTGVol && w.RTGVol.wissel && w.RTGVol.mogelijk && w.RTGVol.mogelijk()) {
      uit.push({ label: T('bdn.vol.aan', 'Rand tot rand'), icoon: 'vol',
        doe: function () { if (w.RTGVol.mogelijk()) w.RTGVol.wissel(); } });
    }

    /* Delen kan alleen als de browser het aanbiedt (en dat is buiten https
       nergens zo), dus de rij hangt aan de echte mogelijkheid en niet aan een
       aanname. */
    if (w.navigator && w.navigator.share) {
      uit.push({ label: T('menu.deel', 'Deel dit scherm'), icoon: 'deel', doe: function () {
        w.navigator.share({ title: d.title, url: location.href })['catch'](function () {});
      } });
    }

    if (bestaat('logoutBtn')) {
      uit.push({ label: T('app.logout', 'Uitloggen'), icoon: 'uit',
        doe: function () { klik('logoutBtn'); } });
    }
    return uit;
  }
/* het blad dat van onderen opkomt */
  var scrim = null, blad = null, knop = null, laatstFocus = null;

  /* De titel zegt WAAR JE BENT: de naam van deze app, uit de navigatiebalk of
     de grote titel. Nooit een woordmerk -- dat is precies wat shared/ios.js
     overal uit de chrome veegt. */
  function titel() {
    var nav = d.querySelector('.ios-nav-titel');
    if (nav && nav.textContent.trim()) return nav.textContent.trim();
    var groot = d.querySelector('.ios-groot');
    if (groot && groot.textContent.trim()) return groot.textContent.trim();
    var h1 = d.querySelector('main h1, h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return (d.title || '').split(/[,·|-]/)[0].trim() || T('menu.app', 'Deze app');
  }

  function maakTegel(item) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = menuKlasse('amn-tegel', 'ds-appmenu__tegel');
    /* Alleen een teken als er een teken IS. De functies die hier gevonden
       worden ("Feed", "Ontdekken", "Alle", "Hotels") hebben er geen, en er dan
       maar een neutrale stip bij zetten geeft zes identieke stipjes onder
       elkaar -- ruis die niets toevoegt. De vaste rijen hieronder hebben elk
       hun eigen teken en dragen het wel. */
    if (item.icoon) b.appendChild(teken(item.icoon));
    var s = d.createElement('span'); s.textContent = item.label;
    b.appendChild(s);
    b.addEventListener('click', function () { voerUit(item); });
    return b;
  }

  function maakRij(item) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = menuKlasse('amn-rij', 'ds-appmenu__rij');
    b.appendChild(teken(item.icoon || 'stip'));
    var s = d.createElement('span'); s.textContent = item.label;
    b.appendChild(s);
    var tel = item.tel && item.tel();
    if (tel) { var e = d.createElement('em'); e.textContent = tel; b.appendChild(e); }
    b.addEventListener('click', function () { voerUit(item); });
    return b;
  }

  /* Een menukeuze sluit het menu EERST en doet daarna pas iets. Andersom
     lag het blad over het paneel dat er net was opengegaan, en dan lijkt het
     alsof de knop niets deed. */
  function voerUit(item) {
    sluit();
    setTimeout(function () {
      if (typeof item.doe === 'function') return item.doe();
      if (item.knop) return item.knop.click();
      if (item.spring) {
        item.spring.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }

  function bouw() {
    scrim = d.createElement('div'); scrim.className = menuKlasse('amn-scrim', 'ds-appmenu');
    blad = d.createElement('div'); blad.className = menuKlasse('amn-blad', 'ds-dialoog ds-appmenu__blad');
    blad.setAttribute('role', 'dialog');
    blad.setAttribute('aria-modal', 'true');
    blad.setAttribute('aria-label', T('menu.label', 'Menu'));
    blad.setAttribute('tabindex', '-1');
    scrim.appendChild(blad);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) sluit(); });
    d.body.appendChild(scrim);
  }

  function vul() {
    blad.textContent = '';
    blad.appendChild(Object.assign(d.createElement('div'), { className: menuKlasse('amn-greep', 'ds-appmenu__greep') }));

    var kop = d.createElement('div'); kop.className = menuKlasse('amn-kop', 'ds-appmenu__kop');
    var naam = d.createElement('b'); naam.textContent = titel();
    var x = d.createElement('button');
    x.type = 'button'; x.className = menuKlasse('amn-x', 'ds-appmenu__sluit'); x.textContent = '✕';
    x.setAttribute('aria-label', T('menu.sluit', 'Menu sluiten'));
    x.addEventListener('click', sluit);
    kop.appendChild(naam); kop.appendChild(x);
    blad.appendChild(kop);

    var eigen = eigenFuncties();
    if (eigen.length) {
      blad.appendChild(sectie(T('menu.deze', 'Deze app')));
      var rooster = d.createElement('div'); rooster.className = menuKlasse('amn-rooster', 'ds-appmenu__rooster');
      for (var i = 0; i < eigen.length; i++) rooster.appendChild(maakTegel(eigen[i]));
      blad.appendChild(rooster);
    }

    var vast = vasteFuncties();
    if (vast.length) {
      blad.appendChild(sectie(T('menu.overal', 'Overal')));
      var lijst = d.createElement('div'); lijst.className = menuKlasse('amn-lijst', 'ds-appmenu__lijst');
      for (var j = 0; j < vast.length; j++) lijst.appendChild(maakRij(vast[j]));
      blad.appendChild(lijst);
    }

    if (!eigen.length && !vast.length) {
      var p = d.createElement('p'); p.className = menuKlasse('amn-leeg', 'ds-appmenu__leeg');
      p.textContent = T('menu.niets', 'Op dit scherm valt niets extra\'s te doen.');
      blad.appendChild(p);
    }
  }

  function sectie(tekst) {
    var s = d.createElement('div'); s.className = menuKlasse('amn-sectie', 'ds-appmenu__sectie'); s.textContent = tekst;
    return s;
  }

  function open() {
    /* Ook het blad kan met de body zijn meegeveegd (zie bewaakKnop). Het staat
       dan nog wel in deze variabele maar niet meer in het document, en dan gaat
       er bij een tik niets open zonder dat er iets misgaat -- de stilste storing
       die er is. */
    var wasOpen = scrim && scrim.isConnected && scrim.classList.contains('amn-open');
    if (scrim && !scrim.isConnected) scrim = null;
    if (!scrim) bouw();
    if (!wasOpen) laatstFocus = d.activeElement;
    vul();
    scrim.classList.add('amn-open');
    if (knop) knop.setAttribute('aria-expanded', 'true');
    d.addEventListener('keydown', opEsc);
    var eerste = blad.querySelector('.amn-tegel, .amn-rij, .amn-x');
    if (eerste) eerste.focus();
  }

  function sluit() {
    if (!scrim) return;
    scrim.classList.remove('amn-open');
    if (knop) knop.setAttribute('aria-expanded', 'false');
    d.removeEventListener('keydown', opEsc);
    var terug = laatstFocus && laatstFocus.isConnected ? laatstFocus : knop;
    if (terug && terug.isConnected && terug.focus) { try { terug.focus({ preventScroll: true }); } catch (e) {} }
    laatstFocus = null;
  }

  function opEsc(e) {
    if (!scrim || !scrim.isConnected || !scrim.classList.contains('amn-open') || blad.closest('[inert]')) return;
    if (e.key === 'Escape') { e.stopPropagation(); sluit(); return; }
    if (e.key !== 'Tab') return;
    /* De bestaande basislaag sluit de achtergrond met inert. Ook zonder die
       laag blijft de toetsenbordvolgorde in dit menu: geen tweede controller. */
    var kan = [].filter.call(blad.querySelectorAll('button'), function (b) {
      return !b.disabled && b.tabIndex >= 0 && zichtbaar(b) && !b.closest('[inert]');
    });
    var eerste = kan[0], laatste = kan[kan.length - 1];
    if (!eerste) { e.preventDefault(); blad.focus(); return; }
    if (!blad.contains(d.activeElement) || (e.shiftKey && d.activeElement === eerste) || (!e.shiftKey && d.activeElement === laatste)) {
      e.preventDefault(); (e.shiftKey ? laatste : eerste).focus();
    }
  }
  function wissel() { (scrim && scrim.isConnected && scrim.classList.contains('amn-open')) ? sluit() : open(); }
/* de knop: de hamburger staat links, en verder niets */
  /* DE RTG-HEADERSTANDAARD: de hamburger staat LINKS, en verder niets.
     Hij stond rechtsboven in een afgerond vierkant met een eigen achtergrond,
     een rand en een blur -- een knopvlak dus, en daarmee het zwaarste element
     van elke kopbalk terwijl het het minst belangrijke is. Op ruim
     tweehonderd pagina's.
     Links, omdat dat de plek is waar het oog begint te lezen en waar je duim
     staat; zonder vlak, omdat een teken van drie streepjes geen doos nodig
     heeft om een knop te zijn.

     Drie plekken, in deze volgorde: de navigatiebalk die shared/ios.js van de
     kopbalk maakte, de eigen kopbalk van een pagina, en anders zwevend
     linksboven. Die laatste is de vangnet-stand voor de handvol pagina's
     zonder kopbalk -- zonder dat zou "op elke app" gewoon niet waar zijn. */
  function plaatsKnop() {
    knop = d.createElement('button');
    knop.type = 'button';
    knop.className = menuKlasse('amn-knop', 'ds-appmenu__knop');
    knop.id = 'osMenuBtn';
    knop.setAttribute('aria-label', T('menu.label', 'Menu'));
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    ['M4 7h16', 'M4 12h16', 'M4 17h16'].forEach(function (dd) {
      var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', dd); svg.appendChild(p);
    });
    knop.appendChild(svg);
    knop.addEventListener('click', wissel);

    hangOp();
  }

  /* De linkercel van de navigatiebalk. Die bestaat nog niet: het raster van
     .ios-nav-rij is [auto | titel | auto] en de eerste kolom wordt door de
     terugknop gevuld. We maken er een cel van die BEIDE draagt -- eerst de
     hamburger, dan de terugweg -- zodat ze niet om dezelfde kolom vechten. */
  function linkerCel(rij) {
    var cel = rij.querySelector(':scope > .ios-nav-links');
    if (cel) return cel;
    cel = d.createElement('div');
    cel.className = menuKlasse('ios-nav-links', 'ds-appmenu__links');
    rij.insertBefore(cel, rij.firstChild);
    var terug = rij.querySelector(':scope > .ios-terug');
    if (terug) cel.appendChild(terug);
    return cel;
  }

  /* Staat het er ECHT? offsetParent is null zodra een voorouder display:none of
     hidden is. Twee keer heeft die vraag hier een gat opgeleverd, allebei van
     dezelfde soort: de knop was aanwezig, en onzichtbaar.
       - techniek.html en foundation/gevoel.html hebben een `header.kop` binnen
         een blok dat pas na inloggen verschijnt;
       - gemeentepda.html en leverancier-rtmail.html hebben wel een `.ios-nav`
         maar die staat er niet. Vroeger viel de knop daar door naar zwevend
         omdat ik op `.ios-nav-acties` zocht en dat element er niet was; sinds
         ik op `.ios-nav-rij` zoek bestaat hij wel, en verdween de knop in een
         verborgen balk.
     Een aanwezige knop die je niet ziet is erger dan geen knop: de toets die
     alleen op bestaan kijkt, kleurt groen. */
  function zichtbaar(e) {
    if (!e || !(e.offsetParent || e.getClientRects().length)) return false;
    var s = w.getComputedStyle ? w.getComputedStyle(e) : null;
    return !s || (s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0);
  }

  function hangOp() {
    knop.classList.remove('amn-zweef');
    /* De body vertelt of er linksboven een zwevende knop ligt. Een blad kan dat
       zelf niet weten -- de knop wordt hier pas geplaatst -- en zonder dat feit
       schuift een pagina die linksboven begint eronder. Dat gebeurde ook: de
       apprij van de RTFoundation begon op 20px en de knop ligt van 11 tot 49,
       dus "Living Lab" las als "ving Lab". Zolang elke naam nog in een doosje
       met rand stond viel het niet op; die doosjes zijn weg (CANVAS.md). */
    d.body.classList.remove('amn-zwevend');
    var rij = d.querySelector('.ios-nav .ios-nav-rij');
    if (rij && zichtbaar(rij)) { linkerCel(rij).insertBefore(knop, linkerCel(rij).firstChild); return; }

    /* Geen iOS-balk? Dan de eigen kopbalk van de pagina, vooraan.
       Een echte <header> heeft al een eigen rij, dus daar kan de knop zo in.
       Maar veel pagina's hebben helemaal geen header: die zetten alleen een
       losse terugweg als eerste kind van de body. Legde ik de zwevende knop
       daaroverheen, dan lag de hamburger LETTERLIJK op "naar de app" -- en dat
       is wat er gebeurde toen ik hem van rechts naar links verhuisde. Zwevend
       linksboven is alleen veilig als er links bovenin niets staat.
       Daarom krijgen die twee samen een rij. */
    var kop = null;
    /* World Desktop verplaatst ook eigen werkbalken (zoals de browser) onder
       .wd-page. Die behouden hun eigen rij; de knop mag er niet over zweven. */
    /* Expliciete geneste DS-hosts bieden ruimte in hun bestaande koprij.
       Geen algemene headerzoektocht: kaartkoppen zijn geen menu-eigenaar. */
    var koppen = d.querySelectorAll('header.kop, header.merkkop, body > header' +
      (d.documentElement.hasAttribute('data-ds') ? ', header.ds-kop, header[data-rtg-menu-host], .ds-wereldwerkruimte .wd-page > header' : ''));
    for (var i = 0; i < koppen.length; i++) { if (zichtbaar(koppen[i])) { kop = koppen[i]; break; } }
    if (kop) {
      if (d.documentElement.hasAttribute('data-ds') && kop.classList.contains('ds-kop')) {
        /* De DS-kop heeft drie plaatsen. Menu + bestaande terug-/zoekactie
           delen de eerste; merk en profiel blijven op hun eigen plaats. */
        var cel = kop.querySelector(':scope > .ds-appmenu__links');
        if (!cel) {
          var eerste = kop.firstElementChild;
          cel = d.createElement('div'); cel.className = 'ds-appmenu__links';
          kop.insertBefore(cel, kop.firstChild);
          if (eerste && !eerste.classList.contains('ds-kop__merk')) cel.appendChild(eerste);
        }
        kop.classList.add('ds-appmenu__host');
        cel.insertBefore(knop, cel.firstChild);
      } else kop.insertBefore(knop, kop.firstChild);
      return;
    }

    /* De terugweg staat lang niet altijd direct onder de body -- op
       boardroom.html zit hij binnen <main class="rtg-wrap">. Zoeken op de
       KLASSE en niet op de plek in de boom; wel eerst kijken of hij ook
       werkelijk bovenaan staat, want een terugweg onderaan de pagina is geen
       kopbalk. */
    var terug = d.querySelector('.rtg-terug');
    if (terug && (!zichtbaar(terug) || terug.getBoundingClientRect().top > 220)) terug = null;
    if (terug && terug.parentNode) {
      var rijtje = d.createElement('div');
      rijtje.className = menuKlasse('amn-koprij', 'ds-appmenu__koprij');
      terug.parentNode.insertBefore(rijtje, terug);
      rijtje.appendChild(knop);
      rijtje.appendChild(terug);
      return;
    }
    knop.classList.add('amn-zweef');
    d.body.classList.add('amn-zwevend');
    d.body.appendChild(knop);
  }

  /* WEGGEVEEGD WORDEN EN TERUGKOMEN. Een pagina mag zijn eigen body opnieuw
     schrijven, en sommige doen dat ook: shared/deur.js zet er een
     "hier kom je niet in"-scherm neer met innerHTML, en dat neemt alles mee wat
     erin stond -- de kopbalk van de app, en dus ook deze knop. Precies op zo'n
     scherm heb je het menu het hardst nodig, want het is de enige weg terug
     naar huis.

     De wacht kijkt alleen naar de directe kinderen van de body; dat is waar
     zo'n herschrijving zich afspeelt en het kost bijna niets. Zonder
     MutationObserver blijft de knop gewoon staan waar hij stond. */
  function bewaakKnop() {
    if (!w.MutationObserver) return;
    new w.MutationObserver(function () {
      if (!knop.isConnected) hangOp();
    }).observe(d.body, { childList: true });
  }

  /* --------------------------------------------------------- aanzetten */
  stijl();
  plaatsKnop();
  bewaakKnop();

  w.RTGAppMenu = {
    open: open, sluit: sluit, wissel: wissel,
    knop: function () { return knop; },
    /* Een app die zelf beter weet wat er in zijn menu hoort, zegt het hier.
       zet() vervangt de lijst, voegToe() vult hem aan; allebei worden ze pas
       gelezen als het menu opengaat, dus een app mag dit ook later nog doen. */
    zet: function (lijst) { GEZET = Array.isArray(lijst) ? lijst.slice(0, MAX) : []; },
    voegToe: function (item) { if (item && item.label) GEZET.push(item); },
    /* WAT KAN IK HIER DOEN -- dezelfde lijst die het menu toont, opvraagbaar
       door een andere laag. shared/sprong.js zet hem bovenaan zijn lijst, zodat
       je met een tik niet alleen naar een SCHERM kunt springen maar ook naar
       een HANDELING op het scherm waar je staat.

       Een accessor en geen kopie: hij leest bij elke aanroep opnieuw wat de
       pagina op dat moment heeft (de delenbalk, de tabs, de navigatiebalk, of
       wat de app zelf opgaf). Een tweede lijst handelingen aanleggen zou hier
       dezelfde fout zijn als een tweede lijst apps in de bank. */
    functies: function () { try { return eigenFuncties(); } catch (e) { return []; } },
    /* De vaste systeemfuncties blijven van Appmenu: deze accessor laat de
       canonieke DS Edge dezelfde actuele, capability-gebonden lijst tonen
       zonder haar opnieuw te definiëren. */
    systeemfuncties: function () { try { return vasteFuncties(); } catch (e) { return []; } }
  };
})(window, document);
