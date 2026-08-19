/* Vervolg van gebaar-02: DE TIK, DE GREEP EN DE TOETSEN -- alle wegen naar
   dezelfde acties die geen veeg zijn.

   WCAG 2.5.7 zegt het kortst: geen enkele handeling mag ALLEEN met slepen te
   doen zijn. Dat is hier geen vinkje maar de reden dat dit deel bestaat. */

  /* --------------------------------------------------------- de tik erop --
     In de VANG-fase, want bijna elke regel is zelf een <a>: doen we dit later,
     dan is de pagina al aan het navigeren voor de actie is uitgevoerd. */
  d.addEventListener('click', function (e) {
    var doe = e.target.closest && e.target.closest('.gb-doe');
    if (doe) {
      e.preventDefault(); e.stopPropagation();
      var rij = doe.closest('.gb-rij');
      var lade = doe.closest('.gb-lade');
      var acties = rij && actiesVan(rij);
      if (!acties || !lade) return;
      var lijst = acties[lade.getAttribute('data-kant')] || [];
      var a = lijst[Number(doe.getAttribute('data-i')) || 0];
      sluit(rij, true);
      if (a && a.borg) vraagBorg(a, rij);
      else voerUit(a, rij);
      return;
    }
    /* De klik die op een veeg volgt is geen klik maar de staart van het gebaar.
       Zonder dit slikje opent elke veeg over een regel ook nog de regel zelf. */
    if (netGeveegd) { e.preventDefault(); e.stopPropagation(); return; }
    if (openLade && !(e.target.closest && e.target.closest('.gb-rij') === openLade.rij)) sluitAlles();
  }, true);

  /* ------------------------------------------------------------ de greep --
     Een gebaar dat je niet ziet, bestaat niet voor wie het niet toevallig
     probeert. Bij aanwijzen en bij focus komt daarom een greep in beeld naar
     dezelfde acties.

     TWEE VORMEN, EN DAT IS GEEN SLORDIGHEID. Is de regel zelf een link of een
     knop, dan wordt de greep een <span> zonder tabstop: een knop in een link is
     ongeldige HTML, en een schermlezer krijgt daar een knop-in-een-link van.
     Die regel is met de TOETSEN te bedienen (hieronder), en de greep is dan
     alleen het zichtbare teken dat er iets te halen valt. Is de regel geen
     link, dan is de greep een echte knop met een echte naam. */
  function interactief(rij) {
    return /^(A|BUTTON)$/.test(rij.tagName) || rij.hasAttribute('href') ||
      rij.getAttribute('role') === 'button' || rij.getAttribute('role') === 'link';
  }
  function zetGreep(rij) {
    if (!rij || rij.querySelector(':scope > .gb-greep')) return;
    if (!actiesVan(rij)) return;
    var el;
    if (interactief(rij)) {
      el = d.createElement('span');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el = d.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', T('gebaar.acties', 'Acties voor deze regel', 'Actions for this row'));
      el.setAttribute('aria-haspopup', 'dialog');
    }
    el.className = 'gb-greep';
    el.innerHTML = svg('meer');
    el.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      opendActielade(rij);
    });
    rij.appendChild(el);
  }
  function wegGreep(rij) {
    var el = rij && rij.querySelector(':scope > .gb-greep');
    if (el && el !== d.activeElement) el.remove();
  }
  d.addEventListener('pointerover', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij) zetGreep(rij);
  }, { passive: true });
  d.addEventListener('pointerout', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij && !rij.contains(e.relatedTarget)) wegGreep(rij);
  }, { passive: true });
  d.addEventListener('focusin', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij) zetGreep(rij);
  });
  d.addEventListener('focusout', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij && !rij.contains(e.relatedTarget)) wegGreep(rij);
  });

  /* ---------------------------------------------------------- de toetsen --
     Pijl links en pijl rechts openen de acties van die kant; de menutoets (of
     Shift+F10, of een rechtermuisklik) opent ze allemaal. Escape sluit.

     De pijlen openen de ACTIELADE en niet de zichtbare lade. Dat is met opzet:
     een lade die je met een toets openschuift, laat je vervolgens met dezelfde
     toets door onbereikbare elementen lopen -- want de lade is aria-hidden en
     hoort dat te blijven. De actielade heeft echte knoppen en echte focus. */
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (openLade) { sluitAlles(true); } return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    var rij = t && t.closest && t.closest('.gb-rij');
    if (!rij) return;
    var acties = actiesVan(rij);
    if (!acties) return;
    if (e.key === 'ArrowLeft' && acties.rechts.length) { e.preventDefault(); opendActielade(rij, 'rechts'); }
    else if (e.key === 'ArrowRight' && acties.links.length) { e.preventDefault(); opendActielade(rij, 'links'); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); opendActielade(rij); }
  });
  d.addEventListener('contextmenu', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (!rij || !actiesVan(rij)) return;
    e.preventDefault();
    opendActielade(rij);
  });

  /* DE VEEG DIE DE BROWSER AFPAKT. Bijna elke regel hier is een <a>, en een
     ingedrukte muis die over een link beweegt is voor de browser het begin van
     een sleepactie: hij stuurt dragstart, kaapt de aanwijzer en stuurt ons een
     pointercancel. Het gevolg is een veeg die na twee pixels dooft -- en die
     precies zo lang leek te werken dat je hem in een demo niet ziet.

     Dit is geen scherm-eigenaardigheid maar de oorzaak zelf, dus hij staat hier
     en niet als draggable="false" op tweehonderd regels (LAT.md regel 1). Alleen
     terwijl er ECHT een gebaar loopt: buiten een gebaar mag een link gewoon
     versleepbaar blijven. */
  d.addEventListener('dragstart', function (e) {
    if (g && e.target.closest && e.target.closest('.gb-rij')) e.preventDefault();
  });

  /* Scrollen sluit een openstaande lade. Een lade die tien regels verderop nog
     openstaat is geen geheugen maar een vergeten venster. */
  addEventListener('scroll', function () { if (openLade) sluitAlles(true); }, { passive: true, capture: true });

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
      netGeveegd = true;                       // de klik erna is de staart hiervan
      setTimeout(function () { netGeveegd = false; }, 400);
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
