/* De bovenrand opent bestaande instellingen met haal of toetsenbord. Dezelfde
   ingang start de ene Edge; bij een bronfout blijft de oude UI onaangeroerd. */
(function (w, d) {
  'use strict';
  if (w.RTGRanden || w.__RTGRandenBoot) return;
  w.__RTGRandenBoot = true;
  var inKader = false;
  try { inKader = w.self !== w.top; } catch (e) { inKader = true; }
  var isEmbed = inKader || new URLSearchParams(w.location.search).get('embed') === '1';
  var isDs = d.documentElement.hasAttribute('data-ds');

  function bron(tag, attribuut, pad) {
    var lijst = d.querySelectorAll(tag + '[' + attribuut + ']');
    for (var i = 0; i < lijst.length; i++) {
      try { if (new URL(lijst[i].getAttribute(attribuut), w.location.href).pathname === pad) return lijst[i]; }
      catch (fout) {}
    }
    return null;
  }
  function blad(pad, klaar) {
    if (document.documentElement.hasAttribute('data-ds')) return klaar(false);
    var bestaandBlad = bron('link[rel~="stylesheet"]', 'href', pad), gedaan = false;
    function af(ok) {
      if (gedaan) return; gedaan = true;
      if (ok && bestaandBlad) bestaandBlad.setAttribute('data-rtg-geladen', 'true');
      klaar(ok);
    }
    if (bestaandBlad) {
      bestaandBlad.addEventListener('load', function () { af(true); }, { once: true });
      bestaandBlad.addEventListener('error', function () { af(false); }, { once: true });
      if (bestaandBlad.getAttribute('data-rtg-geladen') === 'true' || bestaandBlad.sheet) af(true);
      return;
    }
    var randStyleNode = document.createElement('link');
    randStyleNode.rel = 'stylesheet'; randStyleNode.href = pad;
    randStyleNode.addEventListener('load', function () { bestaandBlad = randStyleNode; af(true); }, { once: true });
    randStyleNode.addEventListener('error', function () { af(false); }, { once: true });
    document.head.appendChild(randStyleNode);
  }
  function laad(pad, naam, klaar) {
    if (document.documentElement.hasAttribute('data-ds')) return klaar(false);
    if (w[naam]) { klaar(true); return; }
    var bestaandScript = bron('script', 'src', pad), gedaan = false;
    function af(ok) {
      if (gedaan) return; gedaan = true;
      if (ok && bestaandScript) bestaandScript.setAttribute('data-rtg-geladen', 'true');
      klaar(ok && !!w[naam]);
    }
    if (bestaandScript) {
      bestaandScript.addEventListener('load', function () { af(true); }, { once: true });
      bestaandScript.addEventListener('error', function () { af(false); }, { once: true });
      if (bestaandScript.getAttribute('data-rtg-geladen') === 'true') af(true);
      return;
    }
    var randScriptNode = document.createElement('script');
    randScriptNode.src = pad; randScriptNode.async = true;
    randScriptNode.addEventListener('load', function () { bestaandScript = randScriptNode; af(true); }, { once: true });
    randScriptNode.addEventListener('error', function () { af(false); }, { once: true });
    document.head.appendChild(randScriptNode);
  }

  /* Elk zelfstandig scherm uit de vier werelden bereikt deze ene ingang via
     basis.js. Zo krijgen alle schermen hetzelfde Edge-casco zonder honderden
     HTML-kopieen van de boven- en onderbalk. Een embed of projectiescherm houdt
     uitsluitend de chrome van zijn bovenliggende zelfstandige scherm. */
  function startPlatformEdge() {
    if (document.documentElement.hasAttribute('data-ds')) return false;
    var pad = w.location.pathname, wereld = null;
    if (pad.indexOf('/apps/foundation/') === 0 || (pad === '/apps/office.html' && new URLSearchParams(w.location.search).get('werk') === 'rtf')) wereld = 'foundation';
    else if (['/apps/leven.html','/apps/geld.html','/apps/maison.html','/apps/table.html','/apps/garderobe.html','/apps/veilig.html'].includes(pad)) wereld = 'living';
    else if (['/apps/reizen.html'].includes(pad)) wereld = 'travel';
    else if (['/apps/kantoor.html','/apps/kantoren.html','/apps/personeel.html','/apps/agenda.html','/apps/office.html','/apps/rtmail.html','/apps/bestanden.html','/apps/sitemaker.html','/apps/browser.html','/apps/rtgone.html','/apps/onderneming.html','/apps/magnaat.html','/apps/backoffice.html','/apps/command.html','/apps/rtgschool.html'].includes(pad)) wereld = 'work';
    /* De statische wereldidentiteit is leidend; de lijsten hierboven blijven
       alleen als uitwijk voor oudere, nog niet herbouwde documenten. */
    if (d.body && ['living', 'work', 'travel', 'foundation'].includes(d.body.dataset.rtgWorld)) wereld = d.body.dataset.rtgWorld;
    if (!wereld) return false;
    if (isEmbed) {
      d.body.classList.add('rtg-edge-embed');
      d.body.dataset.rtgWorld = wereld;
      blad('/shared/rtg-edge-system.css', function () {});
      return true;
    }
    var over = 4, mislukt = false;
    function afhankelijk(ok) {
      if (!ok) mislukt = true;
      if (--over || mislukt) return;
      laad('/shared/rtg-edge-system.js', 'RTGEdge', function (systeemKlaar) {
        var cfg = w.RTGEdgeWorlds && w.RTGEdgeWorlds[wereld];
        if (!systeemKlaar || !cfg || !w.RTGEdge || !w.RTGEdge.start) return;
        var huidig = cfg.all.find(function (item) {
          try { return new URL(item[3], w.location.href).pathname === w.location.pathname; } catch (fout) { return false; }
        });
        /* Geen gegokte eerste knop. Edge 2 opent de hoofdactie uitsluitend
           voor routes met een expliciet, getest doel. */
        try { w.RTGEdge.start({ world: wereld, context: { scope: cfg.kort,
          title: huidig ? huidig[1] : d.title, tool: huidig ? huidig[0] : '', actie: null } }); } catch (fout) {}
      });
    }
    /* Vorm, catalogus, tekens en bibliotheek zijn onderling onafhankelijk. */
    blad('/shared/rtg-edge-system.css', afhankelijk);
    laad('/shared/rtg-edge-worlds.js', 'RTGEdgeWorlds', afhankelijk);
    laad('/shared/rtg-edge-icons.js', 'RTGEdgeIcons', afhankelijk);
    laad('/shared/rtg-edge-library.js', 'RTGEdgeLibrary', afhankelijk);
    return true;
  }
  if (startPlatformEdge() && isEmbed) return;
  if (isDs && isEmbed) return;
  if (!isDs) blad('/ds/componenten/randen.css', function () {});

  var RAND = 24;   // hoe dicht bij de rand een haal mag beginnen
  var HAAL = 40;   // hoeveel pixels de goede kant op voordat hij opengaat

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  /* ---- wat er te openen valt ----
     Niets hiervan bouwen we zelf; we wijzen alleen aan wat er al is. */
  function openBoven() {
    if (w.RTGBediening && w.RTGBediening.aanwezig && w.RTGBediening.open) { w.RTGBediening.open(); return true; }
    var cc = d.getElementById('osCcBtn');           // het leden-OS heeft zijn eigen paneel
    if (cc) { cc.click(); return true; }
    return false;
  }
  function kanBoven() {
    return !!((w.RTGBediening && w.RTGBediening.aanwezig) || d.getElementById('osCcBtn'));
  }


  function hint(waar) {
    var el = d.createElement('div');
    el.className = 'rnd-hint ' + waar + ' ds-randen-hint';
    el.setAttribute('aria-hidden', 'true');
    d.body.appendChild(el);
    return el;
  }

  function toetsknop(tekst, doe) {
    /* Een eigen systeemelement voorkomt dat brede legacyregels als
       `button { color: inherit }` de centrale componentpresentatie overnemen.
       Rol en toetsenbordcontract blijven expliciet gelijk aan een knop. */
    var b = d.createElement('rtg-randen-toets');
    b.className = 'rnd-toets ds-randen-toets';
    b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0');
    b.textContent = tekst;
    b.addEventListener('click', doe);
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); doe();
    });
    return b;
  }

  /* ---- het gebaar ---- */
  function start() {
    if (!d.body) return;
    // De shell kan DS activeren terwijl deze bestaande ingang op DOM-ready
    // wacht. Gebruik bij opbouw dezelfde actuele keuze als de stijlguard.
    isDs = d.documentElement.hasAttribute('data-ds');
    var boven = kanBoven();
    if (!boven) return;
    var hBoven = hint('boven');
    d.body.appendChild(toetsknop(T('rnd.bov', 'Instellingen openen'), openBoven));

    var bezig = null, y0 = 0, gedaan = false;

    /* Een geslaagde haal moet de klik eronder slikken. De buitenste 24 px is op
       veel schermen ook de onderbalk of de statusbalk; zonder dit opent het
       paneel en volgt daarna alsnog de knop waar je toevallig op begon (op
       Kantoren sprong het scherm zo naar een heel andere app). We luisteren
       eenmalig in de vangfase -- een gewone tik op die balk blijft dus werken,
       alleen de klik die bij het slepen hoort niet. */
    function slikKlik() {
      var eenmalig = function (e) {
        d.removeEventListener('click', eenmalig, true);
        e.preventDefault(); e.stopPropagation();
      };
      d.addEventListener('click', eenmalig, true);
      setTimeout(function () { d.removeEventListener('click', eenmalig, true); }, 700);
    }


    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gedaan = false;
      if (e.clientY <= RAND) {
        bezig = 'boven'; y0 = e.clientY;
        /* Edge draagt echte links in de bovenrand. Pointer capture houdt de
           haal bij ons wanneer de aanwijzer zo'n link verlaat. */
        try { e.target.setPointerCapture(e.pointerId); } catch (fout) {}
      }
      else bezig = null;
    }, { capture: true, passive: true });

    d.addEventListener('dragstart', function (e) {
      if (bezig === 'boven') e.preventDefault();
    }, true);

    var stop = function () {
      hBoven.classList.remove('aan'); hBoven.style.width = '44px';
      bezig = null;
    };

    d.addEventListener('pointermove', function (e) {
      if (!bezig || gedaan) return;
      var dy = e.clientY - y0;
      hBoven.classList.toggle('aan', dy > 6);
      hBoven.style.width = Math.min(120, 44 + Math.max(0, dy)) + 'px';
      if (dy < HAAL) return;
      gedaan = true; stop();
      // eerst openen, dan pas de slik aanzetten: sommige panelen worden met een
      // eigen klik geopend, en die mag de slik natuurlijk niet opeten
      openBoven();
      slikKlik();
    }, { passive: true });

    d.addEventListener('pointerup', stop, { passive: true });
    d.addEventListener('pointercancel', stop, { passive: true });

    w.RTGRanden = { boven: openBoven };
  }

  // achteraan in de rij: de panelen die we openen moeten er eerst zijn
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(start, 60); });
  else setTimeout(start, 60);
})(window, document);
