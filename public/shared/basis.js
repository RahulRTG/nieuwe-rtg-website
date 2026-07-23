/* De gedeelde basis-laag: het vangnet dat elke app-pagina op 9+-niveau houdt.
   Eén klein script, vier stille taken:
   1. offline: registreert de juiste service worker (leden-OS of RTFoundation),
      zodat elke pagina ook zonder bereik opent, en meldt rustig als de
      verbinding wegvalt of terugkomt
   2. rust: respecteert prefers-reduced-motion (alle animaties uit) en geeft
      toetsenbord-gebruikers een zichtbare focusrand
   3. begrenzing: zet een maxlength-vangnet op tekstvelden die er geen hebben
      (de server begrenst altijd al; dit voorkomt stil afgekapte invoer)
   4. leren: het ?-knopje linksonder opent de app-gids (wat is dit, wat kun je
      hier, een leerzame tip) via /api/gids/app
   5. sfeer: laadt het lopende werk bij (shared/uurwerk.js), de gangreserve
      van het huis die als een stil verhaal over alle pagina's doorloopt
   6. kaart: laadt de kaart-uitwijk bij (shared/kaart.js), die geo:-links op
      desktop/iOS opvangt met een eigen paneeltje - coördinaten tonen en laten
      kopiëren, zonder ook maar iets naar een kaart-provider te sturen
   7. horloge: laadt het 3D-skelethorloge bij (shared/klok3d.js), dat waar een
      RTG-klok-ring staat een gouden cassement, saffierglas en een opengewerkt
      3D-uurwerk overheen legt (progressief; met een harde 2D-terugval)
   Geen inloggegevens nodig; werkt hetzelfde in beide werelden. */
(function () {
  'use strict';
  if (window.__rtgBasis) return; window.__rtgBasis = true;
  var rtf = location.pathname.indexOf('/apps/foundation/') === 0;

  /* ---- 1. offline: de service worker + een rustig verbindingsseintje ---- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try {
      if (rtf) navigator.serviceWorker.register('/apps/foundation/sw.js', { scope: '/apps/foundation/' }).catch(function () {});
      else navigator.serviceWorker.register('/sw.js').catch(function () {});
    } catch (e) {}
  }

  var css = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}' +
    ':focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
    '.bss-net{position:fixed;left:50%;transform:translateX(-50%);top:.6rem;z-index:60;background:#0C0C0B;border:1px solid #444;border-radius:10px;color:#eee;font:500 .8rem Inter,system-ui,sans-serif;padding:.45rem .8rem;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;}' +
    '.bss-vraag{position:fixed;left:1rem;bottom:1rem;z-index:34;width:2.1rem;height:2.1rem;border-radius:999px;border:1px solid #555;background:rgba(12,12,11,.82);color:#ddd;font:600 .95rem Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);}' +
    '.bss-vraag:hover{border-color:var(--gold,#A98F1C);color:#fff;}' +
    '.bss-sheet{position:fixed;left:1rem;bottom:1rem;z-index:38;width:min(340px,92vw);background:#151312;border:1px solid var(--gold,#A98F1C);border-radius:16px;padding:1rem;color:#eee;font-family:Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:.55rem;}' +
    '.bss-sheet[hidden]{display:none;}' +
    '.bss-kop{display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-weight:600;font-size:.92rem;}' +
    '.bss-x{background:transparent;border:1px solid #444;border-radius:8px;color:#eee;padding:.12rem .5rem;cursor:pointer;font:inherit;}' +
    '.bss-wat{font-size:.84rem;color:#ccc;line-height:1.55;}' +
    '.bss-doe{margin:0;padding-left:1.1rem;font-size:.82rem;color:#bbb;line-height:1.6;}' +
    '.bss-tip{font-size:.8rem;color:#d7c690;line-height:1.5;border-top:1px solid rgba(255,255,255,.08);padding-top:.55rem;}';
  var st = document.createElement('style'); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

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

  /* ---- 7. het 3D-skelethorloge: waar een RTG-klok-ring staat, legt deze laag
     er een gouden cassement, saffierglas en een opengewerkt 3D-uurwerk overheen
     (progressief; zonder WebGL/bij reduced-motion blijft het horloge zoals het is) ---- */
  var k3 = document.createElement('script');
  k3.src = '/shared/klok3d.js'; k3.async = true;
  (document.head || document.documentElement).appendChild(k3);

  /* ---- 8. de 3D-tegellaag voor de werk-apps: KPI-tegels ([data-tegel3d] of
     .kpi-tegel) krijgen diepte + muiskantel, en <canvas data-vonk3d> tekent een
     klein isometrisch grafiekje. Rustig en zuinig; niets op touch/reduced-motion ---- */
  var t3 = document.createElement('script');
  t3.src = '/shared/tegel3d.js'; t3.async = true;
  (document.head || document.documentElement).appendChild(t3);

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

    /* ---- 4. het ?-knopje: de app-gids als rustige leerlaag ---- */
    var knop = document.createElement('button');
    knop.type = 'button'; knop.className = 'bss-vraag'; knop.textContent = '?';
    knop.setAttribute('aria-label', 'Uitleg over deze app');
    document.body.appendChild(knop);
    var sheet = null;
    function sluit() { if (sheet) { sheet.remove(); sheet = null; knop.hidden = false; } }
    knop.addEventListener('click', function () {
      knop.hidden = true;
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
          var tip = document.createElement('div'); tip.className = 'bss-tip'; tip.textContent = '💡 ' + g.tip;
          sheet.appendChild(tip);
        })
        .catch(function () { if (sheet) sheet.querySelector('.bss-wat').textContent = 'De uitleg is er zo weer; probeer het straks opnieuw.'; });
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') sluit(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
