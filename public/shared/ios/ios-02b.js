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
