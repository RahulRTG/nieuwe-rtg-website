
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
