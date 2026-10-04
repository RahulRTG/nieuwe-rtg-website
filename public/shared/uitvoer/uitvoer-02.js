  // Visible export action and modal share the active host.
  var LIJN = '1px solid var(--line,var(--lijn,#2A2724))';
  /* --rtg-muted VOOR --muted: die eerste volgt het thema, de tweede is een
     vaste grijstoon. Op een goudgetinte grond haalde #8A8680 4,07:1 waar 4,5
     moet (0,72rem halfvet is geen grote tekst). Zelfde reparatie als in de
     gedeelde tabbalk; zie A11Y-INGELOGD.json. */
  var ZACHT = 'var(--rtg-muted,var(--muted,var(--zacht,#8A8680)))';
  var css = '.rtguitvoer-knop.rtguitvoer-knop,.rtguitvoer-rij button{background:none;cursor:pointer;' +
      'min-height:44px;padding:.5rem .9rem;white-space:nowrap;border:' + LIJN + ';color:' + ZACHT + ';' +
      'font:600 .72rem Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;}' +
    '.rtguitvoer-knop.rtguitvoer-knop{margin-left:.5rem;align-self:center;}' +
    '.rtguitvoer-knop:hover{color:var(--rtg-txt,var(--txt,#F7F5F1));}' +
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
  var gastKnop = null, gastLaag = null, gekozenKnop = null, gekozenLaag = null;

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
  function herzie() {
    if (!document.body) return;
    // Standalone pages share one visible content frame. A former workspace
    // drawer must not keep the real export control inside a permanently closed host.
    var frame = document.querySelector('.wd-page');
    if (frame) {
      var output = frame.querySelector(':scope > .wd-output');
      if (!output) { output = document.createElement('div'); output.className = 'wd-output'; frame.prepend(output); }
      var bank = document.querySelector('.rtg-interface-second-screen:not(.rtg-ss-peek) .cmd-bank');
      if (bank) { gekozenLaag = bank; gekozenKnop = bank.querySelector('.rtg-ss-header'); }
      var openHost = gekozenLaag && gekozenLaag.isConnected && gekozenLaag.getClientRects().length &&
        getComputedStyle(gekozenLaag).visibility !== 'hidden' && !gekozenLaag.closest('[hidden],[aria-hidden="true"]');
      gastKnop = openHost ? gekozenKnop : output; gastLaag = openHost ? gekozenLaag : document.body;
      if (laag && laag.parentNode !== gastLaag) gastLaag.appendChild(laag);
    }
    /* hidden alleen is niet genoeg: sommige gastschermen laten #gate bestaan
       maar nemen hem via de indeling uit beeld. Alleen een werkelijk zichtbare
       poort onderdrukt de uitvoerknop. */
    if (poort && !poort.hidden && poort.getClientRects().length) {
      if (knop) { knop.remove(); knop = null; }
      return;
    }
    if (!verzamel()) { if (knop) { knop.remove(); knop = null; } return; }   // niets te halen, geen knop
    if (knop && knop.isConnected) {
      if (gastKnop && gastKnop.isConnected) { if(knop.parentNode!==gastKnop)gastKnop.appendChild(knop); return; }
      if (knop.offsetParent !== null || ++pogingen > 5) return;
    }
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
    var kijker = new MutationObserver(function () { clearTimeout(tik); tik = setTimeout(herzie, 300); });
    kijker.observe(wortel(), { childList: true, subtree: true });
    if (poort) kijker.observe(poort, { attributes: true,
      attributeFilter: ['hidden', 'class', 'style'] });
  }

  window.RTGUitvoer = {
    bron: function (f) { eigenBron = typeof f === 'function' ? f : null; herzie(); },
    beschikbaar: function () { return !!verzamel(); },
    gegevens: verzamel,
    neemMee: neemMee,
    herzie: herzie,
    zichtbaar: function () { return !!(laag && !laag.hidden); },
    /* Knop én dialoog horen bij dezelfde dominante laag. */
    mount: function (knopHost, laagHost) {
      gekozenKnop = gastKnop = knopHost || null; gekozenLaag = gastLaag = laagHost || null;
      if (laag && gastLaag && gastLaag.isConnected) gastLaag.appendChild(laag);
      herzie();
    },
    unmount: function () {
      if (laag && !laag.hidden) sluit();
      if (laag && laag.isConnected) document.body.appendChild(laag);
      gekozenKnop = gastKnop = null; gekozenLaag = gastLaag = null; setTimeout(herzie, 0);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
