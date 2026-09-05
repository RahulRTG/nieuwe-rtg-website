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
  if (pad === '/apps/rtg.html') hoofdactie('Bekijk uw dag', function () { klik('.rtg-vandaag-luxe__cta'); });
  else if (pad === '/apps/kantoor.html') hoofdactie('Open werkbank', function () { klik('.wereldtab-plus'); });
  else if (pad === '/apps/reizen.html') hoofdactie('Open reizen', function () { klik('[data-tab="reizen"]'); });
  else if (pad === '/apps/foundation/os-publiek.html') hoofdactie('Bekijk uw stad', function () {
    var a = vind('[data-heen="activiteiten"]'); if (b.getAttribute('data-rtg-vandaag-luxe') === 'surface' && a) a.click(); else focus('#steden');
  });
  else if (pad === '/apps/agenda.html') hoofdactie('Nieuwe afspraak', function () { klik('#nieuwBtn'); });
  else if (pad === '/apps/reisboek.html') hoofdactie('Naar reisinhoud', function () { focus('#main'); });
  else if (pad === '/apps/werk.html') hoofdactie('Nieuw project', function () {
    var inlog = vind('#inlogGa');
    if (inlog && inlog.offsetParent !== null) inlog.click(); else focus('#a_h0_naam, #mKeuze, #main');
  });
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
