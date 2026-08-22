/* Vervolg van gebaar-03: VASTHOUDEN, in zijn twee betekenissen. Lang drukken
   opent de acties als lijst; vasthouden op een borg-actie voert hem uit. Apart
   bestand omdat de maat het vroeg (check.js regel 13) en omdat het een eigen
   onderwerp is: alles hierboven gaat over EEN tik of EEN toets, hier gaat het
   over de tijd die een vinger ergens blijft. */
  /* ------------------------------------------------------- vasthouden --
     Lang drukken opent dezelfde acties als lijst. Niet alleen via contextmenu:
     die gebeurtenis komt op een <a> in iOS Safari niet, en juist daar is bijna
     elke regel een <a>. Een eigen teller is hier eerlijker dan vertrouwen op
     een gebeurtenis die op de helft van de toestellen uitblijft. */
  var langTimer = 0;
  d.addEventListener('pointerdown', function (e) {
    clearTimeout(langTimer);
    if (e.button != null && e.button !== 0) return;
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (!rij || !actiesVan(rij)) return;
    if (e.target.closest('.gb-lade,.gb-greep')) return;
    langTimer = setTimeout(function () {
      if (g && g.vast) return;                 // dit is een veeg, geen vasthouden
      g = null;
      slikRij = rij;                           // de klik erna is de staart hiervan
      tik(9);
      opendActielade(rij);
    }, 520);
  }, { passive: true });
  d.addEventListener('pointermove', function (e) {
    if (!langTimer) return;
    if (g && !g.vast && Math.abs(e.clientX - g.x0) < 8 && Math.abs(e.clientY - g.y0) < 8) return;
    clearTimeout(langTimer); langTimer = 0;
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    d.addEventListener(n, function () { clearTimeout(langTimer); langTimer = 0; }, { passive: true });
  });

  /* ------------------------------------------------- vasthouden om te doen --
     Wat niet terug te draaien is, gaat niet op een tik en niet op een veeg. Je
     houdt hem vast en ziet de rand vollopen; laat je los, dan gebeurt er niets.
     Dit is LIFE.md in een knop: klaarzetten mag de machine, bevestigen doet de
     mens. Een borg-actie kan daarom NOOIT door een doorveeg worden geraakt
     (gebaar-02 sluit hem uit de drempel uit) en een tik erop in de lade leidt
     naar de actielade, waar een echte knop staat om vast te houden. */
  var BORGTIJD = 800;
  function vraagBorg(actie, rij) { opendActielade(rij, null, actie); }

  function houdVast(knop, klaar) {
    var t0 = 0, bezig = false, raf = 0;
    function stop() {
      bezig = false; cancelAnimationFrame(raf);
      knop.style.setProperty('--gb-borg', '0%');
    }
    function stap(nu) {
      if (!bezig) return;
      var p = Math.min(1, (nu - t0) / BORGTIJD);
      knop.style.setProperty('--gb-borg', (p * 100).toFixed(1) + '%');
      if (p >= 1) { stop(); tik([9, 40, 9]); klaar(); return; }
      raf = requestAnimationFrame(stap);
    }
    knop.classList.add('gb-borg');
    knop.addEventListener('pointerdown', function (e) {
      if (bezig) return;
      bezig = true; t0 = performance.now();
      try { knop.setPointerCapture(e.pointerId); } catch (err) {}
      raf = requestAnimationFrame(stap);
    });
    knop.addEventListener('pointerup', stop);
    knop.addEventListener('pointercancel', stop);
    knop.addEventListener('pointerleave', stop);
    /* Met een toets is vasthouden geen gebaar maar een tweede druk: spatie of
       Enter zet hem op scherp, dezelfde toets erna voert uit. */
    var scherp = false;
    knop.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (ev.detail > 0) return;               // dit was de muis; die hield al vast
      if (!scherp) { scherp = true; knop.setAttribute('data-scherp', ''); return; }
      knop.removeAttribute('data-scherp'); klaar();
    });
  }
