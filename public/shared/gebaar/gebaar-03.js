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
       Zonder dit slikje opent elke veeg over een regel ook nog de regel zelf.
       EENMALIG en op de REGEL: de verwijzing gaat weg bij de eerstvolgende klik,
       wat er ook gebeurt, en alleen een klik OP die regel wordt geslikt. Zie de
       toelichting bij slikRij in gebaar-02.js voor wat hier eerst stond. */
    if (slikRij) {
      var vanDeVeeg = e.target.closest && e.target.closest('.gb-rij') === slikRij;
      slikRij = null;
      if (vanDeVeeg) { e.preventDefault(); e.stopPropagation(); return; }
    }
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

