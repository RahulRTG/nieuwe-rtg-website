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
