/* Uitvoer: bediening, dialoog en feedback. */
  var ds = true;
  var knopStijl = ' ds-knop ds-knop--stil';
  function laadUitvoerPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var uitvoerStijlLink = document.createElement('link');
    uitvoerStijlLink.id = 'rtgDsRuntimeCss';
    uitvoerStijlLink.rel = 'stylesheet';
    uitvoerStijlLink.href = pad;
    document.head.appendChild(uitvoerStijlLink);
  }

  var knop = null, laag = null, melding = null, tik = 0, pogingen = 0, terugFocus = null;
  var gastKnop = null, gastLaag = null, gekozenKnop = null, gekozenLaag = null;

  function sluit() {
    laag.hidden = true;
    var doel = terugFocus && !terugFocus.closest('.rtg-adaptive-sheet') && terugFocus.getClientRects().length ? terugFocus :
      knop && knop.getClientRects().length ? knop :
      document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="context"],.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]');
    terugFocus = null;
    if (doel && doel.isConnected) {
      doel.focus({ preventScroll: true });
      requestAnimationFrame(function () { if (doel.isConnected && document.activeElement !== doel) doel.focus({ preventScroll: true }); });
    }
  }

  function paneel() {
    if (laag) return;
    // alleen vaste tekst als markup; aantallen en uitkomst gaan met textContent
    document.body.insertAdjacentHTML('beforeend',
      '<div class="rtguitvoer rtguitvoer-laag' + (ds ? ' ds-uitvoer-laag' : '') + '" hidden role="dialog" aria-modal="true" aria-label="Meenemen">' +
      '<div class="rtguitvoer-blad' + (ds ? ' ds-dialoog ds-uitvoer-blad' : '') + '"><h2' + (ds ? ' class="ds-uitvoer-titel"' : '') + '>Meenemen</h2><p' + (ds ? ' class="ds-uitvoer-tekst"' : '') + '></p><div class="rtguitvoer-rij' + (ds ? ' ds-uitvoer-rij' : '') + '">' +
      '<button type="button" class="' + knopStijl.trim() + '" data-vorm="csv">CSV</button><button type="button" class="' + knopStijl.trim() + '" data-vorm="json">JSON</button>' +
      '<button type="button" class="rtguitvoer-sluit' + knopStijl + '">Sluiten</button></div></div></div>');
    laag = document.body.lastElementChild;
    if (gastLaag && gastLaag.isConnected) gastLaag.appendChild(laag);
    melding = laag.querySelector('p');
    laag.addEventListener('click', function (e) {
      if (e.target === laag) return sluit();                 // naast het venster tikken sluit ook
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('rtguitvoer-sluit')) return sluit();
      var uit = neemMee(b.getAttribute('data-vorm'));
      melding.textContent = uit.ok ? uit.aantal + ' regels meegenomen als ' + b.textContent + '.' : uit.reden;
    });
    /* Het modale venster bezit Tab en Escape; sneltoets.js pauzeert de laag eronder. */
    document.addEventListener('keydown', function (e) {
      if (laag.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); sluit(); return; }
      if (e.key !== 'Tab') return;
      var k = laag.querySelectorAll('button');
      var i = [].indexOf.call(k, document.activeElement);
      var n = e.shiftKey ? (i <= 0 ? k.length - 1 : i - 1) : (i < 0 || i === k.length - 1 ? 0 : i + 1);
      k[n].focus(); e.preventDefault();
    });
  }

  function toon() {
    terugFocus = document.activeElement;
    herzie(); paneel();
    var d = verzamel();
    melding.textContent = d ? d.rijen.length + ' regels, ' + d.kolommen.length +
      ' kolommen. Het bestand wordt hier gemaakt; er gaat niets naar een server.' : LEEG;
    laag.hidden = false;
    laag.querySelector('button').focus();
  }

  // Flex headers must keep the export button within the viewport.
  function inBeeld(k) {
    var r = k.getBoundingClientRect();
    var breed = window.innerWidth || document.documentElement.clientWidth;
    return r.width > 0 && r.left >= 0 && r.right <= breed + 0.5;
  }

  /* Waar de knop landt, in de volgorde uit de kop hierboven. Een kop DIEPER
     in main is geen anker: die hoort bij een deel (dan neemt een deelwissel
     de knop mee) of bij een scherm dat de app verborgen houdt. */
  function plaats(k) {
    if (gastKnop && gastKnop.isConnected) { gastKnop.appendChild(k); return; }
    var l = document.querySelectorAll('h1, h2'), kop = null, w = wortel();
    /* De koppen van het wereldkader (shared/interface/world-desktop-home.js)
       zijn niet van deze app. Zijn laadkop staat als eerste h1 in beeld en
       wordt even later VERVANGEN door de begroeting -- buiten main, dus buiten
       het zicht van de kijker hieronder. Landde de knop daar, dan ging hij mee
       met de oude kop en kwam hij niet meer terug. */
    var KADER = '.wd-greeting,.wd-people,.wd-favorites,.wd-library,.wd-focus,.wd-announcement';
    for (var i = 0; i < l.length && !kop; i++) if (l[i].offsetParent !== null && !l[i].closest(KADER)) kop = l[i];
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

  // Reassess actual data and host visibility when the screen changes.
