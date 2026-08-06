  /* De bediening. Die was er niet: neemMee() had als enige aanroeper de
     letter "e" uit sneltoets.js, en een telefoon heeft geen toetsenbord.
     Vandaar een knop in duimmaat en een venster met een eigen sluitknop,
     want Esc bestaat daar net zo min. 44 staat in PIXELS en niet in rem:
     een duim schaalt niet mee met de basismaat van een pagina. De dubbele
     klasse moet, omdat "header button{border:0}" al in de <head> staat en
     van een enkele klasse wint. */
  var LIJN = '1px solid var(--line,var(--lijn,#2A2724))';
  var ZACHT = 'var(--muted,var(--zacht,#8A8680))';
  var css = '.rtguitvoer-knop.rtguitvoer-knop,.rtguitvoer-rij button{background:none;cursor:pointer;' +
      'min-height:44px;padding:.5rem .9rem;white-space:nowrap;border:' + LIJN + ';color:' + ZACHT + ';' +
      'font:600 .72rem Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;}' +
    '.rtguitvoer-knop.rtguitvoer-knop{margin-left:.5rem;align-self:center;}' +
    '.rtguitvoer-knop:hover{color:var(--txt,#F7F5F1);}' +
    '.rtguitvoer-laag{position:fixed;inset:0;z-index:9991;display:flex;align-items:flex-end;' +
      'justify-content:center;background:rgba(0,0,0,.6);}' +
    '.rtguitvoer-laag[hidden]{display:none;}' +
    '.rtguitvoer-blad{width:min(26rem,100%);background:var(--paneel,#151412);color:var(--txt,#F7F5F1);' +
      'border:' + LIJN + ';padding:1.3rem 1.4rem calc(1.4rem + env(safe-area-inset-bottom));}' +
    '.rtguitvoer-blad h2{font:500 1.15rem var(--serif),Georgia,serif;margin:0 0 .5rem;}' +
    '.rtguitvoer-blad p{margin:0 0 1.1rem;font:.85rem/1.6 Inter,system-ui,sans-serif;color:' + ZACHT + ';}' +
    '.rtguitvoer-rij{display:flex;gap:.5rem;flex-wrap:wrap;}' +
    '.rtguitvoer-rij button{flex:1 1 6rem;}';

  var knop = null, laag = null, melding = null, tik = 0, pogingen = 0;

  function sluit() {
    laag.hidden = true;
    if (knop && knop.isConnected) knop.focus();   // terug naar de tik
  }

  function paneel() {
    if (laag) return;
    // alleen vaste tekst als markup; aantallen en uitkomst gaan met textContent
    document.body.insertAdjacentHTML('beforeend',
      '<div class="rtguitvoer rtguitvoer-laag" hidden role="dialog" aria-modal="true" aria-label="Meenemen">' +
      '<div class="rtguitvoer-blad"><h2>Meenemen</h2><p></p><div class="rtguitvoer-rij">' +
      '<button type="button" data-vorm="csv">CSV</button><button type="button" data-vorm="json">JSON</button>' +
      '<button type="button" class="rtguitvoer-sluit">Sluiten</button></div></div></div>');
    laag = document.body.lastElementChild;
    melding = laag.querySelector('p');
    laag.addEventListener('click', function (e) {
      if (e.target === laag) return sluit();                 // naast het venster tikken sluit ook
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('rtguitvoer-sluit')) return sluit();
      var uit = neemMee(b.getAttribute('data-vorm'));
      melding.textContent = uit.ok ? uit.aantal + ' regels meegenomen als ' + b.textContent + '.' : uit.reden;
    });
    /* aria-modal="true" is een belofte die ook in code hoort (LAT regel 6):
       Tab loopt er niet uit, Esc sluit. Dat de sneltoetsen van het scherm
       ERONDER stilvallen regelt sneltoets.js. */
    document.addEventListener('keydown', function (e) {
      if (laag.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { sluit(); e.preventDefault(); return; }
      if (e.key !== 'Tab') return;
      var k = laag.querySelectorAll('button');
      var i = [].indexOf.call(k, document.activeElement);
      var n = e.shiftKey ? (i <= 0 ? k.length - 1 : i - 1) : (i < 0 || i === k.length - 1 ? 0 : i + 1);
      k[n].focus(); e.preventDefault();
    });
  }

  function toon() {
    paneel();
    var d = verzamel();
    melding.textContent = d ? d.rijen.length + ' regels, ' + d.kolommen.length +
      ' kolommen. Het bestand wordt hier gemaakt; er gaat niets naar een server.' : LEEG;
    laag.hidden = false;
    laag.querySelector('button').focus();
  }

  /* Binnen beeld, in de breedte. Een kop van een app is vaak een flexrij die
     NIET afbreekt (display:flex zonder flex-wrap) en bovendien position:fixed:
     staat die rij op telefoonmaat al vol, dan schuift onze knop er aan de
     rechterkant uit, en juist doordat de rij vast staat valt er niet naartoe te
     scrollen. Gemeten op 390 breed viel hij zo van het scherm bij navigatie en
     ov. Vandaar deze toets na het plaatsen: een knop die je niet kunt zien is
     geen knop. */
  function inBeeld(k) {
    var r = k.getBoundingClientRect();
    var breed = window.innerWidth || document.documentElement.clientWidth;
    return r.width > 0 && r.left >= 0 && r.right <= breed + 0.5;
  }

  /* Waar de knop landt, in de volgorde uit de kop hierboven. Een kop DIEPER
     in main is geen anker: die hoort bij een deel (dan neemt een deelwissel
     de knop mee) of bij een scherm dat de app verborgen houdt. */
  function plaats(k) {
    var l = document.querySelectorAll('h1, h2'), kop = null, w = wortel();
    for (var i = 0; i < l.length && !kop; i++) if (l[i].offsetParent !== null) kop = l[i];
    var h = kop && kop.closest('header');
    // staat de gastheer zelf niet meer aan (app.html sluit zijn #gate), dan
    // is de zichtbare kop het enige anker dat nog iets oplevert
    var aan = w === document.body || w.offsetParent !== null;
    /* De plekken in volgorde van voorkeur; de eerste die de knop ook echt in
       beeld zet, wint. Loopt de kop over, dan valt hij terug op de plek eronder
       in gewone stroom, en die kan per definitie niet overlopen. */
    var plekken = [];
    if (h) plekken.push(function () { h.appendChild(k); });
    if (kop && (kop.parentNode === w || !aan)) plekken.push(function () { kop.parentNode.insertBefore(k, kop.nextSibling); });
    plekken.push(function () { w.insertBefore(k, w.firstChild); });
    for (var p = 0; p < plekken.length; p++) {
      plekken[p]();
      if (p === plekken.length - 1 || inBeeld(k)) return;
      k.remove();
    }
  }

  /* De app verandert (gegevens komen later binnen, een scherm wordt
     hertekend), dus de knop wordt telkens opnieuw gewogen. rtgdeel-vast
     zegt tegen het deelmenu: geen inhoud -- zo telt de knop niet als deel
     en verdwijnt hij niet bij een deelwissel.

     Een knop die niet meer GETEKEND wordt telt hier als weg: op app.html
     sluit de gastheer ([role=main] #gate) zodra de app opstart, en dan zou
     de bediening stil verdwijnen. Na vijf verhuizingen houdt hij op, want
     een pagina waar geen enkele plek zichtbaar is hoort geen eeuwige
     verhuizing te betalen (LAT regel 5: dan is het stil, maar niet druk). */
  function herzie() {
    if (!document.body) return;
    if (!verzamel()) { if (knop) { knop.remove(); knop = null; } return; }   // niets te halen, geen knop
    if (knop && knop.isConnected && (knop.offsetParent !== null || ++pogingen > 5)) return;
    if (!knop) {
      knop = document.createElement('button');
      knop.type = 'button';
      knop.className = 'rtguitvoer rtguitvoer-knop rtgdeel-vast';
      knop.textContent = 'Meenemen';
      knop.addEventListener('click', toon);
    }
    plaats(knop);
  }

  function start() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    herzie();
    if (!window.MutationObserver) return;
    new MutationObserver(function () { clearTimeout(tik); tik = setTimeout(herzie, 300); })
      .observe(wortel(), { childList: true, subtree: true });
  }

  window.RTGUitvoer = {
    bron: function (f) { eigenBron = typeof f === 'function' ? f : null; herzie(); },
    beschikbaar: function () { return !!verzamel(); },
    gegevens: verzamel,
    neemMee: neemMee
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
