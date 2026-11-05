/* Sneltoetsen: dezelfde handgrepen in elke app.

   Dit was het grootste gat tussen de apps die hier volwaardig heten en de
   rest (65% tegen 28%). Een werksysteem waarin u de muis moet pakken voor
   iets wat u tien keer per dag doet, voelt nooit als gereedschap.

   De laag verzint geen functies: hij zoekt de knoppen die de app AL heeft
   en geeft ze een toets. Vindt hij er geen, dan gebeurt er niets -- geen
   toets die iets belooft wat er niet is.

     /   naar het zoekveld
     n   nieuw (de eerste knop die "nieuw", "toevoegen" of "+" heet)
     e   meenemen (shared/uitvoer.js, alleen als er iets te halen valt)
     1-9 naar dat deel van het deelmenu
     ?   het overzicht van deze toetsen
     Esc sluit het overzicht, of het bovenste open venster

   Niet in een invoerveld, niet met Ctrl/Cmd/Alt erbij (dan is het van de
   browser), en niet als de gebruiker rust wil: wie prefers-reduced-motion
   aan heeft krijgt geen animatie, maar de toetsen blijven -- rust gaat over
   beweging, niet over bedienbaarheid. */
(function () {
  'use strict';
  if (window.RTGSneltoets) return;

  function laadSneltoetsPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var sneltoetsStijlLink = document.createElement('link');
    sneltoetsStijlLink.setAttribute('id', 'rtgDsRuntimeCss');
    sneltoetsStijlLink.rel = 'stylesheet';
    sneltoetsStijlLink.href = pad;
    document.head.appendChild(sneltoetsStijlLink);
  }

  /* De rij voor "n" draagt het LABEL van de nieuw-knop, en dat label komt uit
     de pagina -- soms door een ander getypt. Veel schoonmakers hier gooien <
     en > eruit, maar niet allemaal: kern/metier/index.js laat een vaardigheid
     door als String(w).slice(0,40).trim(), en metier.html zet die als knoplabel
     neer. Een label dat via esc() als &lt; op het scherm staat, geeft via
     textContent gewoon weer < terug. Dus schermen we af waar het de HTML in
     gaat, net als shared/deur.js -- en niet per bron, want die zijn met 170
     schermen niet te overzien. */
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function zichtbaar(el) { return el && !el.hidden && el.offsetParent !== null; }
  function eerste(kies) {
    var l = document.querySelectorAll(kies);
    for (var i = 0; i < l.length; i++) if (zichtbaar(l[i])) return l[i];
    return null;
  }
  // de knop die "nieuw" betekent, in de woorden die dit huis gebruikt
  function nieuwKnop() {
    var k = document.querySelectorAll('button, a.knop, .knop');
    for (var i = 0; i < k.length; i++) {
      var t = (k[i].textContent || '').trim().toLowerCase();
      if (!zichtbaar(k[i])) continue;
      if (/^\+|^nieuw|^nieuwe |toevoegen$|^maak |^start /.test(t)) return k[i];
    }
    return null;
  }
  function zoekVeld() {
    return eerste('input[type="search"]') ||
      eerste('input[placeholder*="oek" i]') || eerste('#zoek, #zoekveld, [data-zoek]');
  }

  var blad = null, ingang = null;
  var ds = document.documentElement.hasAttribute('data-ds');
  function sluit() {
    if (!blad) return;
    if (ds && blad.open) blad.close();
    blad.hidden = true;
    if (ds && ingang && ingang.isConnected) ingang.focus();
    ingang = null;
  }
  function overzicht(rijen) {
    if (!blad) {
      laadSneltoetsPresentatie('/ds/rtg-ds.css');
      blad = document.createElement(ds ? 'dialog' : 'div');
      blad.className = 'rtgsnel ds-sneltoets' + (ds ? ' ds-dialoog' : ' ds-sneltoets--overlay');
      blad.hidden = true;
      blad.setAttribute('role', 'dialog');
      // ook dit blad dekt het scherm af, dus het valt onder vensterOpen()
      blad.setAttribute('aria-modal', 'true');
      blad.setAttribute('aria-label', 'Sneltoetsen');
      blad.addEventListener('click', function (e) { if (!ds || e.target === blad) sluit(); });
      if (ds) {
        blad.addEventListener('cancel', function (e) { e.preventDefault(); sluit(); });
        blad.addEventListener('close', function () { if (!blad.open) blad.hidden = true; });
      }
      document.body.appendChild(blad);
    }
    blad.innerHTML = '<div class="rtgsnel-kaart ds-sneltoets__kaart"><h2>Sneltoetsen</h2><dl>' +
      rijen.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      '</dl>' + (ds ? '<div class="ds-dialoog__acties"><button type="button" class="ds-knop" autofocus>Sluiten</button></div>' : '') + '</div>';
    if (ds) {
      ingang = document.activeElement;
      blad.querySelector('button').addEventListener('click', sluit);
    }
    blad.hidden = false;
    if (ds && !blad.open) blad.showModal();
  }

  function inVeld(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    return /^(input|textarea|select)$/i.test(el.tagName);
  }

  /* Staat er een venster open, dan zijn de toetsen van dat venster en niet van
     het scherm eronder. inVeld() dekt dat niet: in zo'n venster staat de focus
     meestal op een KNOP, en dan drukte "n" gewoon de nieuw-knop achter de
     dialoog in en wisselde een cijfer van deel achter de dialoog.
     offsetParent kan hier niet als zichtbaarheidstoets dienen: een overlay
     staat position:fixed en heeft er per definitie geen. */
  function vensterOpen() {
    // Een native modale dialoog heeft geen extra aria-modal nodig. Dat is
    // onder meer het contract van Hotels, Reisboek en de chauffeurdialoog.
    if (document.querySelector('dialog:modal')) return true;
    var l = document.querySelectorAll('[aria-modal="true"]');
    for (var i = 0; i < l.length; i++) if (!l[i].hidden && l[i].offsetWidth > 0) return true;
    return false;
  }

  function start() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;      // dan is de toets van de browser
      if (e.key === 'Escape') {
        // Native DS-modaliteit verwerkt uitsluitend Escape voor de bovenste
        // dialoog via cancel; een onderliggend blad sluit niet per ongeluk mee.
        if (blad && !blad.hidden && !ds) { sluit(); e.preventDefault(); }
        return;
      }
      if (inVeld(document.activeElement)) return;          // typen gaat voor
      if (vensterOpen()) return;                           // het venster is aan zet

      var z, n;
      if (e.key === '/') { z = zoekVeld(); if (z) { z.focus(); e.preventDefault(); } return; }
      if (e.key === 'n') { n = nieuwKnop(); if (n) { n.click(); e.preventDefault(); } return; }
      if (e.key === 'e') {
        if (window.RTGUitvoer && RTGUitvoer.beschikbaar()) { RTGUitvoer.neemMee('csv'); e.preventDefault(); }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        /* De delen komen van het deelmenu zelf, niet uit "elke knop in de
           balk". Die aanname stond er wel, en dan verschuift een knop die GEEN
           deel is de hele nummering die het overzicht hieronder belooft --
           stil, want niets klaagt over een cijfer dat het verkeerde opent. */
        var ids = window.RTGDeel && RTGDeel.delen ? RTGDeel.delen() : [];
        var id = ids[Number(e.key) - 1];
        if (id) { RTGDeel.open(id); e.preventDefault(); }
        return;
      }
      if (e.key === '?') {
        var rijen = [];
        if (zoekVeld()) rijen.push(['/', 'naar het zoekveld']);
        if (nieuwKnop()) rijen.push(['n', 'nieuw: ' + (nieuwKnop().textContent || '').trim()]);
        if (window.RTGUitvoer && RTGUitvoer.beschikbaar()) rijen.push(['e', 'meenemen als CSV']);
        if (window.RTGDeel && RTGDeel.delen && RTGDeel.delen().length) rijen.push(['1-9', 'naar dat deel van de app']);
        rijen.push(['Esc', 'sluiten']);
        overzicht(rijen);
        e.preventDefault();
      }
    });
  }

  window.RTGSneltoets = { zoekVeld: zoekVeld, nieuwKnop: nieuwKnop };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
