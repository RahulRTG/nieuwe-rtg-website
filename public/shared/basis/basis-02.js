  /* ---- 5. het lopende werk: de gangreserve-laag van het huis ---- */
  if (!ds) {
    var uw = document.createElement('script');
    uw.src = '/shared/uurwerk.js'; uw.async = true;
    (document.head || document.documentElement).appendChild(uw);
  }

  /* ---- 6. de kaart-uitwijk: geo:-links op desktop/iOS opvangen met een eigen
     paneeltje (coördinaten tonen + kopiëren), zonder iets naar derden ---- */
  if (!ds) {
    var km = document.createElement('script');
    km.src = '/shared/kaart.js'; km.async = true;
    (document.head || document.documentElement).appendChild(km);
  }

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
  /* Eén springlink per scherm. tabindex=-1 verplaatst ook werkelijk de focus,
     zodat de volgende Tab bij de inhoud begint. De bundeldelen zijn de bron. */
  function springNaarInhoud() {
    function koppelSpring(anker, doel) {
      if (!anker || !doel || !doel.id) return false;
      var href = '#' + doel.id;
      if (anker.getAttribute('href') !== href) anker.setAttribute('href', href);
      return true;
    }
    var actueleDs = document.documentElement.hasAttribute('data-ds');
    var bestaandeSpring = document.querySelector('.rtg-spring');
    /* Een werkende route-eigen springlink blijft eigenaar. */
    var eigen = document.querySelector('a.skip, a.skiplink, a[href^="#"][class*="skip"]');
    if (eigen) {
      var eersteFocus = null;
      var kand = document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      for (var i = 0; i < kand.length; i++) {
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

    var basisSpringLink = bestaandeSpring || document.createElement('a');
    var springKlasse = 'rtg-spring' + (actueleDs ? ' ds-basis__spring' : '');
    if (basisSpringLink.className !== springKlasse) basisSpringLink.className = springKlasse;
    koppelSpring(basisSpringLink, doel);
    if (basisSpringLink.textContent !== 'Naar de inhoud') basisSpringLink.textContent = 'Naar de inhoud';
    if (basisSpringLink.hasAttribute('hidden')) basisSpringLink.removeAttribute('hidden');
    if (basisSpringLink.hasAttribute('inert')) basisSpringLink.removeAttribute('inert');
    if (basisSpringLink.hasAttribute('aria-hidden')) basisSpringLink.removeAttribute('aria-hidden');
    if (!basisSpringLink.dataset.rtgSpringGebonden) {
      basisSpringLink.dataset.rtgSpringGebonden = '1';
      basisSpringLink.addEventListener('click', function () {
        var id = (basisSpringLink.getAttribute('href') || '').slice(1);
        var actueelDoel = id && document.getElementById(id);
        if (!actueelDoel) return;
        try { actueelDoel.focus({ preventScroll: false }); } catch (e) { actueelDoel.focus(); }
      });
    }
    if (document.body.firstChild !== basisSpringLink) document.body.insertBefore(basisSpringLink, document.body.firstChild);
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
        springNaarInhoud();
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
    var sheet = null, gidsFocus = null;
    function sluit() {
      if (!sheet) return;
      if (ds && sheet.open) sheet.close();
      sheet.remove(); sheet = null;
      if (gidsFocus && gidsFocus.isConnected) gidsFocus.focus({ preventScroll: true });
      gidsFocus = null;
    }
    function openGids() {
      if (sheet && sheet.isConnected) return;
      gidsFocus = document.activeElement;
      sheet = document.createElement(ds ? 'dialog' : 'section');
      sheet.className = 'bss-sheet' + (ds ? ' ds-basis__gids ds-dialoog' : '');
      sheet.setAttribute('aria-label', 'Uitleg over deze app');
      sheet.innerHTML = '<div class="bss-kop"><span></span><button class="bss-x" type="button" aria-label="Sluiten">✕</button></div>' +
        '<div class="bss-wat">Even ophalen…</div>';
      sheet.querySelector('.bss-kop span').textContent = document.title || 'Deze app';
      document.body.appendChild(sheet);
      sheet.querySelector('.bss-x').addEventListener('click', sluit);
      if (ds) {
        sheet.addEventListener('cancel', function (e) { e.preventDefault(); sluit(); });
        sheet.showModal();
      }
      sheet.querySelector('.bss-x').focus();
      var gs = gidsSessie(); // de sessie van dit scherm: ./basis-01ae-sessie.js
      var eigenSheet = sheet;
      function actueel() { return sheet === eigenSheet && eigenSheet.isConnected && JSON.stringify(gidsSessie()) === JSON.stringify(gs); }
      fetch('/api/gids/app', { method: 'POST', headers: gs.kop, body: JSON.stringify({ pad: location.pathname, code: gs.code, token: gs.token }) })
        .then(function (r) { if (!r.ok) throw new Error('uitleg niet beschikbaar'); return r.json(); })
        .then(function (d) {
          if (!actueel()) return;
          if (!d || d.error || !d.gids) throw new Error('uitleg ontbreekt');
          var g = d.gids, wat = sheet.querySelector('.bss-wat');
          wat.textContent = g.wat;
          var ul = document.createElement('ul'); ul.className = 'bss-doe';
          (g.doe || []).forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
          sheet.appendChild(ul);
          var tip = document.createElement('div'); tip.className = 'bss-tip'; tip.textContent = '' + g.tip;
          sheet.appendChild(tip);
        })
        .catch(function () { if (actueel()) sheet.querySelector('.bss-wat').textContent = 'De uitleg is er zo weer; sluit dit venster en probeer opnieuw.'; });
      hulplaag();
    }

    /* De hulplaag (4b) staat in ./basis-02b.js: dit bestand ging er met 15,6 KB
       mee over de omvangsgrens van keuringsregel 13. De delen worden rauw
       aaneengeplakt op alfabet (scripts/bundel.js), dus de knip loopt gewoon
       midden door start() heen -- net als die tussen basis-01 en -01b. */
