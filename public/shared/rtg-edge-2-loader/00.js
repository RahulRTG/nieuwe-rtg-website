// Edge in de applicatieschil.
(function (w, d) {
  'use strict';
  if (!d.body || w.__RTGEdge2Loader) return;
  w.__RTGEdge2Loader = true;

  var b=d.body;
  b.setAttribute('data-rtg-edge-2', '');
  if (!b.hasAttribute('data-rtg-edge-2-context')) b.setAttribute('data-rtg-edge-2-context', 'none');
  if (!b.hasAttribute('data-rtg-edge-2-state')) b.setAttribute('data-rtg-edge-2-state', 'overview');
  if (!b.hasAttribute('data-rtg-edge-2-auto')) b.setAttribute('data-rtg-edge-2-auto', 'true');

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
    e.root.addEventListener('click', function (ev) {
      var doel = ev.target && ev.target.closest && ev.target.closest(
        '.rtg-edge-menu,.rtg-edge-state,.rtg-edge-2-context-button');
      if (doel && e.root.contains(doel)) sluitWerk();
    }, true);
    rand.onclick = function (ev) {
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

  function koppelWerkScroll() {
    var stage = vind('.wk-stage');
    if (!stage) return;
    var laatste = stage.scrollTop || 0, gepland = false, gebaar = { gebaarTijd: 0 };
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) {
      stage.addEventListener(t, function (e) {
        if (w.RTGEdge2 && w.RTGEdge2.scrollGesture(e)) gebaar.gebaarTijd = Date.now();
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
        if (!w.RTGEdge2.gestureFresh(gebaar)) return;   // een eigenaar: rtg-edge-2-context.js
        if (nu <= 32 || verschil < -14) w.RTGEdge2.setState('overview', { source: 'auto' });
        else if (verschil > 14) w.RTGEdge2.setState('compact', { source: 'auto' });
      };
      if (w.requestAnimationFrame) w.requestAnimationFrame(werk); else w.setTimeout(werk, 0);
    }, { passive: true });
  }

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
