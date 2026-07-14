/* posture.js - vouwtelefoon-detectie voor de RTG-apps.

   Luistert naar de Device Posture API (navigator.devicePosture) en naar de
   viewport-segment media-queries en bepaalt daaruit een layout-modus:

     - 'single'       : rechtop, plat of geen foldable  -> een kolom
     - 'dual' + book  : opengeklapt, verticale scharnier -> twee kolommen
     - 'dual' + laptop: half-gevouwen, horizontale scharnier -> twee kolommen

   De module zet drie attributen op een wortel-element (standaard elk element
   met [data-posture-split], anders <html>):
     data-posture = 'folded' | 'continuous' | 'unknown'
     data-layout  = 'single' | 'dual'
     data-fold    = 'none' | 'book' | 'laptop'
   en zet de custom properties --list-size en --fold-gap uit de echte
   scharniermaten, zodat posture.css de kolommen exact op de segmenten legt.

   Bij elke wijziging vuurt hij een 'posturechange'-event op elk wortel-element
   (event.detail = de toestand) en roept een optionele callback aan.

   Laden:  <script src="/apps/posture.js"></script>  (window.Posture)
   Starten: Posture.init();   // of Posture.init({ onChange: fn })
   Zonder ondersteuning valt hij netjes terug op 'single'.

   Bereikbaar als window.Posture. Geen afhankelijkheden. */
(function (w) {
  'use strict';

  var mqCache = {};
  function mm(q) {
    if (!w.matchMedia) return { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
    if (!mqCache[q]) mqCache[q] = w.matchMedia(q);
    return mqCache[q];
  }

  // De media-queries die we volgen. Modern (viewport-segments) plus de oudere
  // experimentele varianten (spanning), zodat meer toestellen meedoen.
  var Q = {
    hseg2: '(horizontal-viewport-segments: 2)',
    vseg2: '(vertical-viewport-segments: 2)',
    spanV: '(spanning: single-fold-vertical)',
    spanH: '(spanning: single-fold-horizontal)'
  };

  // Wat zeggen de segment-queries op dit moment?
  function segmentInfo() {
    return {
      book: mm(Q.hseg2).matches || mm(Q.spanV).matches,   // twee segmenten naast elkaar
      laptop: mm(Q.vseg2).matches || mm(Q.spanH).matches  // twee segmenten boven elkaar
    };
  }

  // De posture-type uit de Device Posture API ('folded' | 'continuous') of null
  // als de API ontbreekt.
  function postureType() {
    return (w.navigator && w.navigator.devicePosture && w.navigator.devicePosture.type) || null;
  }

  // Bepaal de volledige toestand uit posture + segmenten.
  function bepaal() {
    var seg = segmentInfo();
    var pt = postureType();
    // Gevouwen in beeld? De Device Posture API is leidend; ontbreekt die, dan
    // gebruiken we het bestaan van twee segmenten als bewijs dat het toestel
    // gevouwen wordt gebruikt.
    var folded = pt === 'folded' || (pt == null && (seg.book || seg.laptop));

    if (!folded) {
      return { posture: pt || 'unknown', layout: 'single', fold: 'none', gehelen: 1 };
    }
    // Gevouwen: book (verticale scharnier) of laptop (horizontale scharnier)?
    var fold = seg.book ? 'book' : seg.laptop ? 'laptop' : 'book';
    return { posture: 'folded', layout: 'dual', fold: fold, gehelen: 2 };
  }

  // De echte scharniermaten uitlezen en als custom properties zetten, zodat de
  // CSS de kolommen op de segmenten kan leggen. We lezen ze via een tijdelijk
  // element omdat env() alleen in CSS bestaat, niet in JS.
  function metenEnZetten(root, st) {
    var meter = document.createElement('div');
    meter.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
    if (st.fold === 'book') {
      meter.style.setProperty('--l', 'env(viewport-segment-right 0 0, env(fold-left, 50%))');
      meter.style.setProperty('--g', 'calc(env(viewport-segment-left 1 0, 50%) - env(viewport-segment-right 0 0, 50%))');
      // fallback naar de oudere env(fold-*) als de moderne 0 oplevert
      meter.style.width = 'var(--l)';
    } else if (st.fold === 'laptop') {
      meter.style.setProperty('--g', 'calc(env(viewport-segment-top 0 1, 50%) - env(viewport-segment-bottom 0 0, 50%))');
    }
    document.body.appendChild(meter);
    var cs = w.getComputedStyle(meter);
    if (st.fold === 'book') {
      var l = cs.getPropertyValue('--l').trim();
      var g = cs.getPropertyValue('--g').trim();
      if (l) root.style.setProperty('--list-size', l);
      if (g) root.style.setProperty('--fold-gap', g);
    } else if (st.fold === 'laptop') {
      var gh = cs.getPropertyValue('--g').trim();
      if (gh) root.style.setProperty('--fold-gap', gh);
    } else {
      root.style.removeProperty('--list-size');
      root.style.removeProperty('--fold-gap');
    }
    document.body.removeChild(meter);
  }

  var roots = [];        // de elementen die we besturen
  var luisteraars = [];  // opgeruimd via destroy()
  var opties = {};

  function wortels() {
    if (opties.root) return [opties.root];
    var found = document.querySelectorAll('[data-posture-split]');
    if (found.length) return Array.prototype.slice.call(found);
    return [document.documentElement];
  }

  var vorige = null;
  function toepassen() {
    var st = bepaal();
    roots = wortels();
    roots.forEach(function (root) {
      root.setAttribute('data-posture', st.posture);
      root.setAttribute('data-layout', st.layout);
      root.setAttribute('data-fold', st.fold);
      // in twee kolommen is de master-det-navigatie niet nodig
      if (st.layout === 'dual') root.removeAttribute('data-active');
      if (st.fold === 'none') { root.style.removeProperty('--list-size'); root.style.removeProperty('--fold-gap'); }
      else if (document.body) metenEnZetten(root, st);
      root.dispatchEvent(new CustomEvent('posturechange', { detail: st, bubbles: false }));
    });
    var sig = st.posture + '|' + st.layout + '|' + st.fold;
    if (sig !== vorige) {
      vorige = sig;
      if (typeof opties.onChange === 'function') { try { opties.onChange(st); } catch (e) {} }
    }
    return st;
  }

  function on(target, type, fn) {
    if (target && target.addEventListener) { target.addEventListener(type, fn); luisteraars.push([target, type, fn]); }
  }

  var gestart = false;
  function init(cfg) {
    opties = cfg || {};
    if (gestart) { return toepassen(); }
    gestart = true;

    // 1) Device Posture API
    if (w.navigator && w.navigator.devicePosture) on(w.navigator.devicePosture, 'change', toepassen);
    // 2) de segment-media-queries
    Object.keys(Q).forEach(function (k) { on(mm(Q[k]), 'change', toepassen); });
    // 3) gewone resize/orientatie als vangnet (env-maten kunnen zonder mq-event wijzigen)
    on(w, 'resize', toepassen);
    on(w, 'orientationchange', toepassen);

    if (document.body) return toepassen();
    on(document, 'DOMContentLoaded', toepassen);
    return bepaal();
  }

  // De master-detail-navigatie in de enkele-kolomsstand: toon het detail of de
  // lijst. In de tweekolomsstand doet dit niets (beide staan al in beeld).
  function toonDetail(aan) {
    wortels().forEach(function (root) {
      if (root.getAttribute('data-layout') === 'dual') return;
      if (aan) root.setAttribute('data-active', 'detail');
      else root.removeAttribute('data-active');
    });
  }
  function toonLijst() { toonDetail(false); }

  function huidige() { return bepaal(); }
  function isDual() { return bepaal().layout === 'dual'; }

  function destroy() {
    luisteraars.forEach(function (l) { try { l[0].removeEventListener(l[1], l[2]); } catch (e) {} });
    luisteraars = [];
    gestart = false; vorige = null;
    roots.forEach(function (root) {
      ['data-posture', 'data-layout', 'data-fold', 'data-active'].forEach(function (a) { root.removeAttribute(a); });
      root.style.removeProperty('--list-size'); root.style.removeProperty('--fold-gap');
    });
  }

  w.Posture = {
    init: init,
    refresh: toepassen,
    current: huidige,
    isDual: isDual,
    showDetail: toonDetail,
    showList: toonLijst,
    destroy: destroy
  };
})(window);
