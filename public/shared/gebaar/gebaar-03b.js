/* Vervolg van gebaar-03: VASTHOUDEN, in zijn twee betekenissen. Lang drukken
   opent de acties als lijst; vasthouden op een borg-actie voert hem uit. Apart
   bestand omdat de maat het vroeg (check.js regel 13) en omdat het een eigen
   onderwerp is: alles hierboven gaat over EEN tik of EEN toets, hier gaat het
   over de tijd die een vinger ergens blijft. */
  /* ------------------------------------------------------- vasthouden --
     Lang drukken opent dezelfde acties als lijst. Niet alleen via contextmenu:
     die gebeurtenis komt op een <a> in iOS Safari niet, en juist daar is bijna
     elke regel een <a>. Een eigen teller is hier eerlijker dan vertrouwen op
     een gebeurtenis die op de helft van de toestellen uitblijft.

     HOE LANG, EN HOE STIL: DREMPELS.lang en DREMPELS.stil uit de grammatica,
     gelezen bij het neerdrukken (EDGE.md par. 11, ronde 2). Hier stonden 520 ms
     en 8 px, naast de 480 die de balk, de orb en de invoerlaag lezen. Zonder
     tabel loopt er geen timer: lang drukken is dan uit, en de acties blijven
     bereikbaar via de greep, de menutoets en een rechtermuisklik. Stil blijft
     per as gemeten; of dat een afstand moet worden, is een eigen meting. */
  var langTimer = 0, langStil = 0;
  d.addEventListener('pointerdown', function (e) {
    clearTimeout(langTimer); langTimer = 0;
    if (e.button != null && e.button !== 0) return;
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (!rij || !actiesVan(rij)) return;
    if (e.target.closest('.gb-lade,.gb-greep')) return;
    var D = drempels();
    if (!D) return;
    langStil = D.stil;
    langTimer = setTimeout(function () {
      if (g && g.vast) return;                 // dit is een veeg, geen vasthouden
      g = null;
      slikRij = rij;                           // de klik erna is de staart hiervan
      tik(9);
      opendActielade(rij);
    }, D.lang);
  }, { passive: true });
  d.addEventListener('pointermove', function (e) {
    if (!langTimer) return;
    if (g && !g.vast && Math.abs(e.clientX - g.x0) < langStil && Math.abs(e.clientY - g.y0) < langStil) return;
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
     naar de actielade, waar een echte knop staat om vast te houden.

     BORGTIJD STAAT HIER NOG, EN DAT IS EEN BESLUIT (K-borg, 23 september 2026).
     Een regelactie die niet terug kan is in GRAMMATICA.md `bewust`: een vraag met
     inhoud, geen vasthouden. Die trap krijgt hij in ronde 3, langs
     RTGGewicht.voer; tot dan blijft 800 ms staan en pint test/gebaar.e2e.js het
     gedrag vast -- kort vasthouden doet niets, met een muis en met een vinger. */
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
       Enter zet hem op scherp, dezelfde toets erna voert uit. Scherp VERVALT na
       DREMPELS.herbevestig, zoals de tweede weg van vasthoud.js ("vier seconden
       geldig", GRAMMATICA.md): een borg die later nog op scherp staat, voert uit
       op een druk die er niets meer mee te maken heeft. Zonder tabel gaat hij niet
       op scherp -- een scherp dat nooit vervalt, is het open falen dat
       vasthoud.js ook niet toestaat. */
    var scherp = 0;
    function bot() { clearTimeout(scherp); scherp = 0; knop.removeAttribute('data-scherp'); }
    knop.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (ev.detail > 0) return;               // dit was de muis; die hield al vast
      if (scherp) { bot(); klaar(); return; }
      var D = drempels();
      if (!D) return;
      knop.setAttribute('data-scherp', '');
      scherp = setTimeout(bot, D.herbevestig);
    });
  }
