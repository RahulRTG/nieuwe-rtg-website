/* RTG Continue Key: verrijkt exact de bestaande Edge-hoofdactie. De knop,
   onclick en bevoegdheid blijven van Edge/de app; deze laag voegt alleen
   veilige interactie toe. */
(function (g, fabriek) {
  'use strict';
  var kern = typeof module === 'object' && module.exports ? require('./rtg-continue-key-core.js') : g && g.RTGContinueKeyCore;
  if (!kern) return;
  var api = fabriek(kern);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) { g.RTGContinueKey = api; api.boot(g.document, g); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  var runtimes = typeof WeakMap === 'function' ? new WeakMap() : null;
  var actief = null, observer = null, teller = 0, gepland = false;

  function planMeet(rt) {
    var raf = rt.win.requestAnimationFrame || function (fn) { return rt.win.setTimeout(fn, 0); };
    raf(function () { C.measure(rt); });
  }
  function pasAnker(rt, waarde, bewaren) {
    waarde = C.normalizeAnchor(waarde); if (!waarde) return false;
    C.setAttr(rt.button, 'data-rtg-key-anchor', waarde); C.updatePicker(rt); planMeet(rt);
    if (bewaren) { rt.heeftVoorkeur = C.writePreference(rt.win, waarde) || rt.heeftVoorkeur; C.announce(rt, waarde); }
    return waarde;
  }
  function openPicker(rt, focus) {
    rt.picker.hidden = false; C.setAttr(rt.button, 'aria-expanded', 'true'); C.setAttr(rt.button, 'data-rtg-key-expanded', 'true');
    C.updatePicker(rt); planMeet(rt);
    if (focus) { var gekozen = rt.picker.querySelector('[aria-pressed="true"]'); if (gekozen) gekozen.focus(); }
  }
  function sluitPicker(rt, focus) {
    rt.picker.hidden = true; C.setAttr(rt.button, 'aria-expanded', 'false'); rt.button.removeAttribute('data-rtg-key-expanded');
    if (focus) rt.button.focus();
  }
  function stopTimer(rt) { if (rt.timer) { rt.win.clearTimeout(rt.timer); rt.timer = 0; } }
  function bind(rt) {
    var b = rt.button, win = rt.win;
    b.addEventListener('click', function (ev) {
      if (!rt.slikKlik) return; rt.slikKlik = false; ev.preventDefault(); ev.stopImmediatePropagation();
    }, true);
    b.addEventListener('pointerdown', function (ev) {
      if (!C.isMobilePress(rt, ev)) return;
      stopTimer(rt); rt.druk = { id: ev.pointerId, x: ev.clientX, y: ev.clientY,
        voor: b.getAttribute('data-rtg-key-anchor'), actief: false, bewogen: false };
      rt.timer = win.setTimeout(function () {
        if (!rt.druk) return; rt.timer = 0; rt.druk.actief = true; rt.slikKlik = true;
        try { b.setPointerCapture(rt.druk.id); } catch (e) {}
        openPicker(rt, false); C.announce(rt, b.getAttribute('data-rtg-key-anchor'));
      }, 520);
    });
    b.addEventListener('pointermove', function (ev) {
      var d = rt.druk; if (!d || d.id !== ev.pointerId) return;
      var afstand = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      if (!d.actief) { if (afstand > 10) { stopTimer(rt); rt.druk = null; } return; }
      ev.preventDefault(); var r = rt.slot.getBoundingClientRect(); var nieuw = C.anchorForX(ev.clientX, r.left, r.width);
      if (nieuw !== b.getAttribute('data-rtg-key-anchor')) { d.bewogen = true; pasAnker(rt, nieuw, false); }
    });
    b.addEventListener('pointerup', function (ev) {
      var d = rt.druk; if (!d || d.id !== ev.pointerId) return; stopTimer(rt); rt.druk = null;
      if (!d.actief) return; ev.preventDefault(); rt.slikKlik = true;
      /* Alleen de compatibiliteitsklik uit deze pointerup valt nog in dezelfde
         taak. Daarna is de echte hoofdactie meteen weer vrij. */
      win.setTimeout(function () { rt.slikKlik = false; }, 0);
      if (d.bewogen) { pasAnker(rt, b.getAttribute('data-rtg-key-anchor'), true); sluitPicker(rt, false); }
      else { var gekozen = rt.picker.querySelector('[aria-pressed="true"]'); if (gekozen) gekozen.focus(); }
    });
    b.addEventListener('pointercancel', function () {
      var d = rt.druk; stopTimer(rt); rt.druk = null;
      if (d && d.actief) { pasAnker(rt, d.voor, false); sluitPicker(rt, false); } rt.slikKlik = false;
    });
    b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); openPicker(rt, true); });
    b.addEventListener('keydown', function (ev) {
      if (ev.key === 'ContextMenu' || (ev.shiftKey && ev.key === 'F10')) { ev.preventDefault(); openPicker(rt, true); return; }
      if (ev.altKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
        ev.preventDefault(); var i = C.ANCHORS.indexOf(b.getAttribute('data-rtg-key-anchor'));
        pasAnker(rt, C.ANCHORS[Math.max(0, Math.min(2, i + (ev.key === 'ArrowLeft' ? -1 : 1)))], true); return;
      }
      if (ev.key === 'Escape' && !rt.picker.hidden) { ev.preventDefault(); sluitPicker(rt, true); }
    });
    rt.picker.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); sluitPicker(rt, true); } });
    win.addEventListener('resize', function () { pasViewport(rt); planMeet(rt); }, { passive: true });
    win.addEventListener('rtg-hand', function () { if (!rt.heeftVoorkeur) pasAnker(rt, C.handAnchor(win), false); });
    if (win.visualViewport) {
      win.visualViewport.addEventListener('resize', function () { pasViewport(rt); }, { passive: true });
      win.visualViewport.addEventListener('scroll', function () { pasViewport(rt); }, { passive: true });
    }
  }
  function pasViewport(rt) {
    var vv = rt.win.visualViewport, lift = 0, hoogte = Number(rt.win.innerHeight) || 0;
    if (vv && hoogte && (!rt.win.matchMedia || rt.win.matchMedia('(max-width: 767px)').matches)) {
      lift = Math.max(0, hoogte - (Number(vv.height) + Number(vv.offsetTop || 0)));
      var focus = rt.doc.activeElement;
      if (lift && C.isInput(focus) && focus.getBoundingClientRect && rt.button.getBoundingClientRect) {
        var veld = focus.getBoundingClientRect(), key = rt.button.getBoundingClientRect();
        /* De gemeten Key kan de vorige tijdelijke lift al bevatten. Tel die
           eerst terug, anders zou herhaald visualViewport-resize oscilleren. */
        var top = key.top + (rt.lift || 0) - lift, bottom = key.bottom + (rt.lift || 0) - lift;
        if (key.right > veld.left && key.left < veld.right && bottom > veld.top && top < veld.bottom) lift += bottom - veld.top + 8;
      }
    }
    rt.lift = lift;
    var px = Math.max(0, Math.round(lift)) + 'px';
    rt.slot.style.setProperty('--rtg-key-keyboard-lift', px); rt.picker.style.setProperty('--rtg-key-keyboard-lift', px);
    planMeet(rt); return lift;
  }
  function verrijk(button, doc, win) {
    if (!button || !doc || !win || button.getAttribute('data-rtg-edge-primary') === null || !button.parentElement) return null;
    var rt = runtimes && runtimes.get(button);
    if (!rt) {
      var slot = button.parentElement, voet = slot.parentElement;
      rt = { button: button, slot: slot, layer: voet && voet.parentElement || slot,
        doc: doc, win: win, id: ++teller, slikKlik: false };
      rt.heeftVoorkeur = !!C.readPreference(win);
      C.makePicker(rt, function (waarde) { pasAnker(rt, waarde, true); sluitPicker(rt, true); });
      bind(rt); if (runtimes) runtimes.set(button, rt);
    }
    if (!button.querySelector('[data-rtg-action-copy]')) C.buildContent(rt);
    C.setAttr(button, 'data-rtg-continue-key', '');
    if (!C.normalizeAnchor(button.getAttribute('data-rtg-key-anchor'))) {
      pasAnker(rt, C.readPreference(win) || C.handAnchor(win), false);
    }
    pasViewport(rt); C.measure(rt); actief = rt; return rt;
  }
  function synchroniseer(doc, win) {
    var gevonden = Array.prototype.filter.call(doc.querySelectorAll(C.SELECTOR), function (e) {
      return C.isUsable(e, win);
    });
    if (gevonden.length !== 1) return null;
    var rt = verrijk(gevonden[0], doc, win), body = doc.body;
    if (rt && body && (body.getAttribute('data-rtg-edge-2-state') === 'focus' ||
        body.getAttribute('data-rtg-edge-venster-open') === 'true') && !rt.picker.hidden) sluitPicker(rt, false);
    return rt;
  }
  function start(doc, win) {
    if (!doc || !win) return null; synchroniseer(doc, win);
    if (observer) observer.disconnect();
    if (win.MutationObserver && doc.documentElement) {
      observer = new win.MutationObserver(function () {
        if (gepland) return; gepland = true;
        (win.queueMicrotask || function (fn) { win.setTimeout(fn, 0); })(function () { gepland = false; synchroniseer(doc, win); });
      });
      observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-rtg-edge-2-state', 'data-rtg-edge-venster-open'] });
    }
    return actief;
  }
  function boot(doc, win) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { start(doc, win); }, { once: true });
    else start(doc, win);
  }
  function zetStatus(staat, opties) {
    if (!actief) return false; var motion = actief.win.RTGHeritageMotion;
    return !!(motion && motion.setAction && motion.setAction(actief.button, staat, opties));
  }
  function zetVoortgang(waarde) {
    if (!actief) return false; var motion = actief.win.RTGHeritageMotion;
    return !!(motion && motion.setProgress && motion.setProgress(actief.button, waarde));
  }
  function stop() { if (observer) observer.disconnect(); observer = null; actief = null; gepland = false; }

  return Object.freeze({ SELECTOR: C.SELECTOR, STORAGE_KEY: C.STORAGE_KEY, ANCHORS: C.ANCHORS,
    normalizeAnchor: C.normalizeAnchor, anchorForX: C.anchorForX, readPreference: C.readPreference,
    writePreference: C.writePreference, measure: C.measure, enhance: verrijk, sync: synchroniseer,
    setPosition: function (waarde) { return actief ? pasAnker(actief, waarde, true) : false; },
    openPositions: function () { if (!actief) return false; openPicker(actief, true); return true; },
    setState: zetStatus, setProgress: zetVoortgang, start: start, boot: boot, stop: stop });
}));
