/* Edge 2 verrijkt pas na een volledig bestaand casco; fouten laten Edge 1 staan. */
(function (w, d) {
  'use strict';
  if (!d.body || w.__RTGEdge2Loader) return;
  w.__RTGEdge2Loader = true;

  var b = d.body, h = d.head || d.documentElement;
  b.classList.remove('rtg-edge-fold');
  b.setAttribute('data-rtg-edge-2', '');
  if (!b.hasAttribute('data-rtg-edge-2-context')) b.setAttribute('data-rtg-edge-2-context', 'none');
  if (!b.hasAttribute('data-rtg-edge-2-state')) b.setAttribute('data-rtg-edge-2-state', 'overview');
  if (!b.hasAttribute('data-rtg-edge-2-auto')) b.setAttribute('data-rtg-edge-2-auto', 'true');

  /* Alleen expliciete, niet-destructieve hoofdacties. */
  function vind(q) { return d.querySelector(q); }
  function klik(q) { var n = vind(q); if (n) n.click(); }
  function focus(q) {
    var n = vind(q); if (!n) return;
    if (!n.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) n.tabIndex = -1;
    n.focus();
  }
  function hoofdactie(tekst, doe) {
    var e = w.RTGEdge && w.RTGEdge.active, k = e && e.root.querySelector('.rtg-edge-action [data-rtg-edge-primary]');
    if (!e || !k) return;
    e.onAction = doe; e.ctx.actie = tekst; k.hidden = false; k.textContent = tekst;
    if (w.RTGContinueKey && w.RTGContinueKey.sync) w.RTGContinueKey.sync(d, w);
  }
  function neemHoofdactie(tekst, q) {
    hoofdactie(tekst, function () { klik(q); });
    b.setAttribute('data-rtg-edge-2-hoofdactie', 'edge');
  }

  /* Verplaats de echte knop; maak geen kloon of tweede status. */
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

  /* Werk gebruikt zijn bestaande Rahul-werkruimte als enige waarheid. */
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
    /* Delegatie op het casco houdt beide richtingen exclusief, ook na herbouw. */
    e.root.addEventListener('click', function (ev) {
      var doel = ev.target && ev.target.closest && ev.target.closest(
        '.rtg-edge-menu,.rtg-edge-state,.rtg-edge-2-context-button');
      if (doel && e.root.contains(doel)) sluitWerk();
    }, true);
    rand.onclick = function (ev) {
      /* Sluit context en generieke lagen vóór de bestaande Werkruimte opent. */
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

  /* WorkOS geeft zijn geneste scrollstroom aan dezelfde Edge-state door. */
  function koppelWerkScroll() {
    var stage = vind('.wk-stage');
    if (!stage) return;
    var laatste = stage.scrollTop || 0, gepland = false, gebaarTijd = 0;
    /* Alleen een scroll van de mens schakelt; een scroll die de software zelf
       veroorzaakt laat de stand staan (dezelfde regel als in rtg-edge-2.js). */
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) {
      stage.addEventListener(t, function (e) {
        if (w.RTGEdge2 && w.RTGEdge2.scrollGesture(e)) gebaarTijd = Date.now();
      }, { passive: true, capture: true });
    });
    stage.addEventListener('scroll', function () {
      if (gepland) return;
      gepland = true;
      var werk = function () {
        gepland = false;
        var nu = stage.scrollTop || 0, verschil = nu - laatste;
        laatste = nu;
        if (!w.RTGEdge2 || b.getAttribute('data-rtg-edge-2-auto') !== 'true' ||
            b.getAttribute(VENSTER_ATTR) === 'true') return;
        var tijd = Date.now();
        if (tijd - gebaarTijd > w.RTGEdge2.GESTURE_MS) return;
        gebaarTijd = tijd;
        if (nu <= 32 || verschil < -14) w.RTGEdge2.setState('overview', { source: 'auto' });
        else if (verschil > 14) w.RTGEdge2.setState('compact', { source: 'auto' });
      };
      if (w.requestAnimationFrame) w.requestAnimationFrame(werk); else w.setTimeout(werk, 0);
    }, { passive: true });
  }

  /* Een zichtbaar modaal venster laat hetzelfde casco tijdelijk wijken. */
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
    hoofdactie('Bekijk uw dag', function () { klik('.rtg-dashboard-hero-cta'); });
    neemRandknop('.xp-trigger');
  }
  else if (pad === '/apps/kantoor.html') hoofdactie('Open werkbank', function () { klik('.wereldtab-plus'); });
  else if (pad === '/apps/reizen.html') hoofdactie('Open reizen', function () { klik('[data-tab="reizen"]'); });
  else if (pad === '/apps/foundation/os-publiek.html') hoofdactie('Bekijk uw stad', function () {
    var a = vind('[data-heen="activiteiten"]'); if (b.getAttribute('data-rtg-foundation-city') === 'true' && a) a.click(); else focus('#steden');
  });
  else if (pad === '/apps/agenda.html') hoofdactie('Nieuwe afspraak', function () { klik('#nieuwBtn'); });
  else if (pad === '/apps/reisboek.html') hoofdactie('Naar reisinhoud', function () { focus('#main'); });
  else if (pad === '/apps/werk.html') {
    hoofdactie('Nieuw project', function () {
      var inlog = vind('#inlogGa');
      if (inlog && inlog.offsetParent !== null) inlog.click(); else focus('#a_h0_naam, #mKeuze, #main');
    });
    koppelWerkRahul();
    koppelWerkScroll();
  }
  else if (pad === '/apps/clips.html') neemHoofdactie('Maak een clip', '#studioOpen');

  function bron(tag, attribuut, pad) {
    var lijst = d.querySelectorAll(tag + '[' + attribuut + ']');
    for (var i = 0; i < lijst.length; i++) {
      try { if (new URL(lijst[i].getAttribute(attribuut), w.location.href).pathname === pad) return lijst[i]; }
      catch (fout) {}
    }
    return null;
  }
  function wacht(el, naam, klaar) {
    if (naam && w[naam]) { klaar(true); return; }
    var gedaan = false;
    function af(ok) {
      if (gedaan) return; gedaan = true;
      if (ok) el.setAttribute('data-rtg-geladen', 'true');
      klaar(ok && (!naam || !!w[naam]));
    }
    el.addEventListener('load', function () { af(true); }, { once: true });
    el.addEventListener('error', function () { af(false); }, { once: true });
    if (el.getAttribute('data-rtg-geladen') === 'true' || (!naam && el.sheet)) af(true);
  }
  function script(pad, naam, klaar) {
    if (w[naam]) { klaar(true); return; }
    var s = bron('script', 'src', pad), nieuw = !s;
    if (!s) { s = d.createElement('script'); s.src = pad; s.async = true; }
    wacht(s, naam, klaar);
    if (nieuw) h.appendChild(s);
  }
  function blad(pad, klaar) {
    var css = bron('link[rel~="stylesheet"]', 'href', pad), nieuw = !css;
    if (!css) { css = d.createElement('link'); css.id = 'rtg-edge-2-css'; css.rel = 'stylesheet'; css.href = pad; }
    wacht(css, '', klaar);
    if (nieuw) h.appendChild(css);
  }

  var over = 3, mislukt = false;
  function afhankelijk(ok) {
    if (!ok) mislukt = true;
    if (--over || mislukt) return;
    script('/shared/rtg-edge-2.js', 'RTGEdge2', function (klaar) {
      if (!klaar || !w.RTGEdge2) return;
      try {
        w.RTGEdge2.start(d, w); bewaakVensters(); w.RTGEdgeCommand.koppel(d, w);
        script('/shared/rtg-edge-appbar.js', 'RTGEdgeAppBar', function (appbar) {
          if (appbar) w.RTGEdgeAppBar.start(d);
          script('/shared/rtg-edge-smart-menu.js', 'RTGEdgeSmartMenu', function (slim) {
            if (slim) w.RTGEdgeSmartMenu.start(d);
          });
        });
      } catch (fout) {}
    });
  }
  /* Vorm en contextkern downloaden samen; de uitvoerder volgt pas na beide. */
  blad('/shared/rtg-edge-2.css', afhankelijk);
  script('/shared/rtg-edge-2-context.js', 'RTGEdge2Context', afhankelijk);
  script('/shared/rtg-edge-command.js', 'RTGEdgeCommand', afhankelijk);
})(window, document);
