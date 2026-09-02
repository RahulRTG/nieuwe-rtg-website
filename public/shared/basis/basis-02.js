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
