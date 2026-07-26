    // de maat-greep rechtsonder in het gesprek
    var maat = document.createElement('div');
    maat.className = 'hv-maat';
    maat.setAttribute('aria-hidden', 'true');
    maat.title = 'Groter of kleiner slepen';
    kamer.vak.appendChild(maat);
    var mneer = null;
    maat.addEventListener('pointerdown', function (e) {
      if (!bureau) return;
      var h = huidig();
      mneer = { x: e.clientX, y: e.clientY, b: h.b, h: h.h, bx: h.x, by: h.y };
      try { maat.setPointerCapture(e.pointerId); } catch (er) {}
      e.stopPropagation();
    });
    maat.addEventListener('pointermove', function (e) {
      if (!mneer) return;
      zetPlek(mneer.bx, mneer.by, mneer.b + (e.clientX - mneer.x), mneer.h + (e.clientY - mneer.y));
      e.preventDefault();
    });
    maat.addEventListener('pointerup', function () { mneer = null; });
    return true;
  }
  pasPlekToe();
  if (!haakSleep()) {
    var hp = 0;
    var ht = setInterval(function () { if (haakSleep() || ++hp > 20) clearInterval(ht); }, 100);
  }
  // het venster kleiner maken mag de console niet buiten beeld duwen
  root.addEventListener('resize', function () { if (plek) zetPlek(plek.x, plek.y, plek.b, plek.h); });

  /* ---------- de sneltoets ----------
     Ctrl/Cmd+K is de toets die iedereen al kent van zoeken. handenvrij-balk.js
     vangt losse letters al op, maar die laat sneltoetsen (met ctrl/cmd) bewust
     met rust; deze regel hoort dus hier en niet daar. */
  document.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    if (String(ev.key).toLowerCase() !== 'k') return;
    var inp = document.querySelector('.hv-balk input');
    if (!inp) return;
    ev.preventDefault();
    inp.focus(); inp.select();
  });

  /* ---------- de kliklaag op werkpagina's ----------
     De knoppen komen uit dezelfde plekkenlijst die Rahul gebruikt. Zo klikt de
     medewerker op precies wat Rahul ook zou aanroepen; er is maar een waarheid
     over wat deze pagina kan. */
  if (!opWerk || !api || !api.plekken) return;
  var rij = document.createElement('div');
  rij.className = 'hv-werk';
  rij.setAttribute('role', 'group');
  rij.setAttribute('aria-label', 'Snel naar (het broodnodige; de rest gaat via Rahul)');

  /* Wat er nu in de rij staat, als tekst. Nodig om te kunnen zien of er echt
     iets veranderd is: zonder die vergelijking herschrijft vul() de rij, ziet
     de waarnemer hieronder zijn eigen wijziging, en draait het geheel voor
     altijd rond in een lus van een halve seconde. */
  var laatste = null;
  function vul() {
    var lijst = [];
    try { lijst = api.plekken() || []; } catch (e) { lijst = []; }
    // hooguit vijf: dit is een uitwijk, geen werkbalk
    var kies = lijst.slice(0, 5);
    var vinger = kies.map(function (p) { return p.naam; }).join('|');
    if (vinger === laatste) return;
    laatste = vinger;
    if (!kies.length) { rij.hidden = true; document.body.classList.remove('hv-werkrij'); return; }
    rij.hidden = false;
    document.body.classList.add('hv-werkrij');
    rij.innerHTML = '<span class="hv-werk-kop">Snel</span>';
    kies.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = p.naam; b.title = p.naam;
      b.addEventListener('click', function () { try { p.doen(); } catch (e) {} });
      rij.appendChild(b);
    });
  }

  function hang() {
    var balk = document.querySelector('.hv-balk');
    if (!balk || !balk.parentNode) return false;
    if (!rij.parentNode) document.body.appendChild(rij);
    vul();
    return true;
  }
  if (!hang()) {
    var n = 0;
    var t = setInterval(function () { if (hang() || ++n > 20) clearInterval(t); }, 100);
  }
  /* De pagina wisselt voortdurend van scherm en tab; de lijst hoort dat te
     volgen. Een waarnemer op de body is hier goedkoper dan om de seconde de
     hele DOM aflopen, en hij reageert meteen in plaats van een tel later. */
  if (root.MutationObserver) {
    var wacht = null;
    new MutationObserver(function () {
      clearTimeout(wacht);
      wacht = setTimeout(function () { if (rij.parentNode) vul(); }, 400);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class'] });
  }
})(typeof self !== 'undefined' ? self : this);
