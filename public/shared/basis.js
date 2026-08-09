/* De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt.
   Eén klein script, vier stille taken (RTGId woont in shared/id.js):
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
      standaard over elke ring gelegd, maar leeft als concept op /apps/horloge.html
   Geen inloggegevens nodig; werkt hetzelfde in beide werelden. */
(function () {
  'use strict';
  if (window.__rtgBasis) return; window.__rtgBasis = true;
  var rtf = location.pathname.indexOf('/apps/foundation/') === 0;

  /* In een SPLIT-paneel (same-origin iframe uit shared/split.js) staat de app
     in een halve breedte naast een andere app. De vensterbeheerder en het
     desktopframe die deze class ook zetten bestaan niet meer -- het OS is iOS
     en kent geen zwevende vensters -- maar Split View is er nog, en daar is
     een volle kopbalk per paneel te veel. Vol scherm heeft geen iframe en
     houdt zijn eigen kop. */
  if (window.self !== window.top) {
    try { document.documentElement.classList.add('rtg-in-frame'); } catch (e) {}
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
  } catch (e) {}


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
    'html.rtg-linkstreep a{text-decoration:underline!important;text-underline-offset:.18em;}' +
    '.bss-net{position:fixed;left:50%;transform:translateX(-50%);top:.6rem;z-index:60;background:#0C0C0B;border:1px solid #444;border-radius:10px;color:#eee;font:500 .8rem Inter,system-ui,sans-serif;padding:.45rem .8rem;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.bss-sheet{position:fixed;left:1rem;bottom:1rem;z-index:38;width:min(340px,92vw);background:#151312;border:1px solid var(--gold,#A98F1C);border-radius:16px;padding:1rem;color:#eee;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;}' +
    '.bss-sheet[hidden]{display:none;}' +
    '.bss-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-weight:600;font-size:.92rem;}' +
    '.bss-x{background:transparent;border:1px solid #444;border-radius:8px;color:#eee;padding:.12rem .5rem;cursor:pointer;font:inherit;}' +
    '.bss-wat{font-size:.84rem;color:#ccc;line-height:1.55;}' +
    '.bss-doe{margin:0;padding-left:1.1rem;font-size:.82rem;color:#bbb;line-height:1.6;}' +
    '.bss-tip{font-size:.8rem;color:#d7c690;line-height:1.5;border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;}' +
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

  function toost(t) {
    var m = document.createElement('div'); m.className = 'bss-net'; m.setAttribute('role', 'status'); m.textContent = t;
    document.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3500);
  }
  window.addEventListener('offline', function () { toost(rtf ? 'Even geen internet; de app werkt gewoon door waar dat kan.' : 'Geen verbinding; de app werkt door waar dat kan.'); });
  window.addEventListener('online', function () { toost('De verbinding is terug.'); });

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
     leeft nog als eigen concept op /apps/horloge.html. ---- */

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
  function start() {
    begrens(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var n = muts[i].addedNodes[j];
          if (n && n.nodeType === 1) begrens(n);
        }
      }).observe(document.body, { childList: true, subtree: true });
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
    }
    window.RTGGids = { open: openGids, sluit: sluit };
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') sluit(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
