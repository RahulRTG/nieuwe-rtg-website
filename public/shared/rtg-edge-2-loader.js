/* Laadt Edge 2 pas nadat het bestaande Edge-casco aantoonbaar gereed is.
   Mislukt een onderdeel, dan blijft Edge 1 volledig bruikbaar en wordt er
   geen oude bediening verborgen. */
(function (w, d) {
  'use strict';
  if (!d.body || d.getElementById('rtg-edge-2-css')) return;

  var b = d.body, h = d.head || d.documentElement;
  b.classList.remove('rtg-edge-fold');
  b.setAttribute('data-rtg-edge-2', '');
  if (!b.hasAttribute('data-rtg-edge-2-context')) b.setAttribute('data-rtg-edge-2-context', 'none');
  if (!b.hasAttribute('data-rtg-edge-2-state')) b.setAttribute('data-rtg-edge-2-state', 'overview');
  if (!b.hasAttribute('data-rtg-edge-2-auto')) b.setAttribute('data-rtg-edge-2-auto', 'true');

  /* De onderrand krijgt alleen een expliciete, niet-destructieve hoofdactie.
     De bestaande knop of focusplek blijft eigenaar van het gedrag. */
  function vind(q) { return d.querySelector(q); }
  function klik(q) { var n = vind(q); if (n) n.click(); }
  function focus(q) {
    var n = vind(q); if (!n) return;
    if (!n.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) n.tabIndex = -1;
    n.focus();
  }
  function hoofdactie(tekst, doe) {
    var e = w.RTGEdge && w.RTGEdge.active, k = e && e.root.querySelector('.rtg-edge-action button');
    if (!e || !k) return;
    e.onAction = doe; e.ctx.actie = tekst; k.textContent = tekst;
  }
  function neemHoofdactie(tekst, q) {
    hoofdactie(tekst, function () { klik(q); });
    b.setAttribute('data-rtg-edge-2-hoofdactie', 'edge');
  }

  /* Een bediening uit een opgeheven oude strook blijft alleen geldig als zij
     in de ene Edge-onderrand terechtkomt. We verplaatsen de echte knop, met
     zijn eigen luisteraar; er ontstaat dus geen kloon en geen tweede status. */
  function neemRandknop(q) {
    var e = w.RTGEdge && w.RTGEdge.active;
    var slot = e && e.root.querySelector('.rtg-edge-action');
    if (!slot) return;
    var zet = function () {
      var oud = vind(q);
      if (!oud) return false;
      if (!slot.contains(oud)) slot.appendChild(oud);
      return true;
    };
    if (zet() || !w.MutationObserver) return;
    var wacht = new w.MutationObserver(function () { if (zet()) wacht.disconnect(); });
    wacht.observe(b, { childList: true, subtree: true });
    setTimeout(function () { wacht.disconnect(); }, 10000);
  }

  /* Werk heeft al een volwaardige Rahul-werkruimte. De zichtbare Edge-mond
     opent daarom die bestaande ruimte; het generieke lege Edge-paneel zou een
     tweede, minder capabele waarheid zijn. Open/dicht blijft afgeleid van het
     oorspronkelijke paneel. */
  function koppelWerkRahul() {
    var e = w.RTGEdge && w.RTGEdge.active;
    var rand = e && e.root.querySelector('.rtg-edge-ai');
    var tab = vind('#wkRahulTab'), werk = vind('.wk-rahul'), sluit = vind('#wkRahulExpand');
    if (!rand || !tab || !werk) return;
    var sluitEdge = rand.onclick;
    var sync = function () {
      var open = !werk.hidden && werk.classList.contains('page');
      rand.setAttribute('aria-expanded', String(open));
      var leeg = e.root.querySelector('.rtg-edge-ai-panel');
      if (leeg) leeg.setAttribute('aria-hidden', 'true');
    };
    var sluitWerk = function () {
      if (!werk.hidden && werk.classList.contains('page') && sluit) sluit.click();
      sync();
    };
    /* Exclusiviteit werkt in beide richtingen. Niet alleen Rahul sluit een al
       geopende Edge-laag; elke echte Edge-laagbediening sluit eerst de echte
       Werk-Rahul. Zo kunnen DOM, beeld en aria nooit twee open lagen melden. */
    /* De contextknop wordt pas door Edge 2 toegevoegd nadat deze loader al
       draait. Delegeer daarom op het blijvende casco; dit dekt ook een veilige
       herbouw zonder een tweede luisteraar op een nieuwe knop. */
    e.root.addEventListener('click', function (ev) {
      var doel = ev.target && ev.target.closest && ev.target.closest(
        '.rtg-edge-menu,.rtg-edge-state,.rtg-edge-2-context-button');
      if (doel && e.root.contains(doel)) sluitWerk();
    }, true);
    rand.onclick = function (ev) {
      /* Edge 2 bezit zijn contextlade; sluit haar via haar echte bediening.
         De oorspronkelijke Rahul-handler sluit daarna index, status en het
         generieke AI-paneel. Pas dan wisselen we naar de rijkere Werkruimte. */
      var context = e.root.querySelector('.rtg-edge-2-context-button[aria-expanded="true"]');
      if (context) context.click();
      if (sluitEdge) sluitEdge.call(rand, ev);
      if (!werk.hidden && werk.classList.contains('page') && sluit) sluit.click();
      else tab.click();
      var leeg = e.root.querySelector('.rtg-edge-ai-panel');
      if (leeg) leeg.setAttribute('aria-hidden', 'true');
      sync();
    };
    if (w.MutationObserver) new w.MutationObserver(sync).observe(werk, {
      attributes: true, attributeFilter: ['class', 'hidden']
    });
    sync();
  }

  /* EEN MODAAL VENSTER HEEFT VOORRANG OP DE RANDEN. De oude Rahul-tab week
     al voor een open dialoog, maar de ene Edge-onderrand bleef erboven liggen.
     Daardoor was in Clips de knop "Sluit" zichtbaar en toch niet aan te
     raken. We verwijderen geen rand en bouwen geen tweede: zolang een echt
     zichtbaar venster openstaat trekt hetzelfde casco tijdelijk weg, waarna
     de eerder gekozen Edge-stand vanzelf terugkomt. */
  var VENSTER_ATTR = 'data-rtg-edge-venster-open';
  function zichtbaarVenster(el) {
    if (!el || el.hidden || (el.closest && el.closest('.rtg-edge-chrome'))) return false;
    var stijl = w.getComputedStyle ? w.getComputedStyle(el) : null;
    if (stijl && (stijl.display === 'none' || stijl.visibility === 'hidden' || Number(stijl.opacity) === 0)) return false;
    return !!(el.getClientRects && el.getClientRects().length);
  }
  function stemVensterAf() {
    var lijst = d.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]');
    var open = false;
    for (var i = 0; i < lijst.length; i++) if (zichtbaarVenster(lijst[i])) { open = true; break; }
    if (b.hasAttribute(VENSTER_ATTR) === open) return;
    if (open) b.setAttribute(VENSTER_ATTR, 'true'); else b.removeAttribute(VENSTER_ATTR);
  }
  function bewaakVensters() {
    stemVensterAf();
    if (!w.MutationObserver) return;
    new w.MutationObserver(stemVensterAf).observe(b, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'open', 'role', 'aria-modal']
    });
  }
  var pad = w.location.pathname;
  if (pad === '/apps/rtg.html') {
    hoofdactie('Bekijk uw dag', function () { klik('.rtg-vandaag-luxe__cta'); });
    neemRandknop('.xp-trigger');
  }
  else if (pad === '/apps/kantoor.html') hoofdactie('Open werkbank', function () { klik('.wereldtab-plus'); });
  else if (pad === '/apps/reizen.html') hoofdactie('Open reizen', function () { klik('[data-tab="reizen"]'); });
  else if (pad === '/apps/foundation/os-publiek.html') hoofdactie('Bekijk uw stad', function () {
    var a = vind('[data-heen="activiteiten"]'); if (b.getAttribute('data-rtg-vandaag-luxe') === 'surface' && a) a.click(); else focus('#steden');
  });
  else if (pad === '/apps/agenda.html') hoofdactie('Nieuwe afspraak', function () { klik('#nieuwBtn'); });
  else if (pad === '/apps/reisboek.html') hoofdactie('Naar reisinhoud', function () { focus('#main'); });
  else if (pad === '/apps/werk.html') {
    hoofdactie('Nieuw project', function () {
      var inlog = vind('#inlogGa');
      if (inlog && inlog.offsetParent !== null) inlog.click(); else focus('#a_h0_naam, #mKeuze, #main');
    });
    koppelWerkRahul();
  }
  else if (pad === '/apps/clips.html') neemHoofdactie('Maak een clip', '#studioOpen');

  function script(bron, naam, klaar) {
    if (w[naam]) { klaar(); return; }
    var s = d.createElement('script');
    s.src = bron;
    s.onload = klaar;
    h.appendChild(s);
  }

  var css = d.createElement('link');
  css.id = 'rtg-edge-2-css';
  css.rel = 'stylesheet';
  css.href = '/shared/rtg-edge-2.css';
  css.onload = function () {
    script('/shared/rtg-edge-2-context.js', 'RTGEdge2Context', function () {
      script('/shared/rtg-edge-2.js', 'RTGEdge2', function () {
        if (w.RTGEdge2) { w.RTGEdge2.start(d, w); bewaakVensters(); }
      });
    });
  };
  h.appendChild(css);
})(window, document);
