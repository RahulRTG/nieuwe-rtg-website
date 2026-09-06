/* De passieve kern van de RTG Continue Key: gesloten waarden, toegankelijke
   inhoud en geometrie. Hij voert zelf geen handeling of route uit. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGContinueKeyCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SELECTOR = '.rtg-edge-action > [data-rtg-edge-primary]';
  var STORAGE = 'rtg_continue_key_anchor_v1';
  var ANCHORS = Object.freeze(['links', 'midden', 'rechts']);

  function anker(waarde) {
    waarde = String(waarde || '').toLowerCase();
    return ANCHORS.indexOf(waarde) >= 0 ? waarde : null;
  }
  function ankerVoorX(x, links, breedte) {
    breedte = Number(breedte) || 0;
    if (breedte <= 0) return 'midden';
    var deel = Math.max(0, Math.min(.999, (Number(x) - Number(links || 0)) / breedte));
    return ANCHORS[Math.floor(deel * 3)];
  }
  function opslag(win) { try { return win && win.localStorage; } catch (e) { return null; } }
  function leesVoorkeur(win) {
    try { var s = opslag(win); return anker(s && s.getItem(STORAGE)); } catch (e) { return null; }
  }
  function schrijfVoorkeur(win, waarde) {
    waarde = anker(waarde); if (!waarde) return false;
    try { var s = opslag(win); if (!s) return false; s.setItem(STORAGE, waarde); return true; } catch (e) { return false; }
  }
  function handanker(win) {
    try { return win.RTGHand && win.RTGHand.is() === 'links' ? 'links' : 'rechts'; } catch (e) { return 'rechts'; }
  }
  function maak(doc, naam, klasse, tekst) {
    var e = doc.createElement(naam); if (klasse) e.className = klasse;
    if (typeof tekst === 'string') e.textContent = tekst; return e;
  }
  function zetAttr(e, naam, waarde) { e.setAttribute(naam, String(waarde)); }
  function schoon(tekst) { return String(tekst || '').replace(/\s+/g, ' ').trim(); }
  function kopie(doc, staat, tekst) {
    var e = maak(doc, 'span', '', tekst); zetAttr(e, 'data-rtg-action-copy-for', staat); return e;
  }
  function icoon(doc) {
    var span = maak(doc, 'span', 'rtg-continue-key-icon'); zetAttr(span, 'aria-hidden', 'true');
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    zetAttr(svg, 'viewBox', '0 0 24 24'); zetAttr(svg, 'focusable', 'false');
    var pad = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    zetAttr(pad, 'd', 'M5 12h13M13 7l5 5-5 5'); svg.appendChild(pad); span.appendChild(svg); return span;
  }
  function teksten(knop, label) {
    function eigen(naam, terugval) { return schoon(knop.getAttribute('data-rtg-continue-' + naam)) || terugval; }
    return { idle: label, pending: eigen('pending', label + ': bezig…'),
      success: eigen('success', label + ': gereed'), error: eigen('error', label + ': niet gelukt') };
  }
  function bouwInhoud(rt) {
    var b = rt.button, doc = rt.doc;
    var label = schoon(b.textContent) || b.getAttribute('data-rtg-continue-label') || 'Ga verder';
    rt.label = label; b.textContent = ''; b.appendChild(icoon(doc));
    var houder = maak(doc, 'span', 'rtg-continue-key-copy'); zetAttr(houder, 'data-rtg-action-copy', '');
    var labels = teksten(b, label);
    ['idle', 'pending', 'success', 'error'].forEach(function (staat) { houder.appendChild(kopie(doc, staat, labels[staat])); });
    b.appendChild(houder); zetAttr(b, 'data-rtg-morph-action', '');
    if (!b.getAttribute('data-rtg-action-state')) zetAttr(b, 'data-rtg-action-state', 'idle');
    var motion = rt.win.RTGHeritageMotion; if (motion && motion.syncAction) motion.syncAction(b);
  }
  function updatePicker(rt) {
    var huidig = rt.button.getAttribute('data-rtg-key-anchor');
    rt.picker.querySelectorAll('[data-rtg-key-place]').forEach(function (b) {
      zetAttr(b, 'aria-pressed', b.getAttribute('data-rtg-key-place') === huidig);
    });
  }
  function kondig(rt, waarde) { rt.status.textContent = 'Positie Ga verder: ' + waarde + '.'; }
  function maakPicker(rt, gekozen) {
    var doc = rt.doc, id = 'rtg-continue-key-' + rt.id;
    rt.uitleg = maak(doc, 'span', 'rtg-continue-key-a11y', 'Houd ingedrukt of druk Shift+F10 om de positie te kiezen. Alt+pijl links of rechts verplaatst direct.');
    rt.uitleg.id = id + '-uitleg'; rt.status = maak(doc, 'span', 'rtg-continue-key-a11y');
    zetAttr(rt.status, 'role', 'status'); zetAttr(rt.status, 'aria-live', 'polite');
    rt.picker = maak(doc, 'div', 'rtg-continue-key-picker'); rt.picker.id = id; rt.picker.hidden = true;
    zetAttr(rt.picker, 'role', 'dialog'); zetAttr(rt.picker, 'aria-label', 'Positie van Ga verder');
    ANCHORS.forEach(function (waarde) {
      var b = maak(doc, 'button', '', waarde); b.type = 'button'; zetAttr(b, 'data-rtg-key-place', waarde);
      b.addEventListener('click', function () { gekozen(waarde); }); rt.picker.appendChild(b);
    });
    rt.layer.appendChild(rt.picker); rt.layer.appendChild(rt.uitleg); rt.layer.appendChild(rt.status);
    var oud = schoon(rt.button.getAttribute('aria-describedby'));
    zetAttr(rt.button, 'aria-describedby', schoon(oud + ' ' + rt.uitleg.id));
    zetAttr(rt.button, 'aria-controls', id); zetAttr(rt.button, 'aria-expanded', 'false');
    zetAttr(rt.button, 'aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Shift+F10');
  }
  function meet(rt) {
    var b = rt.button, slot = rt.slot;
    if (!b.isConnected || !b.getBoundingClientRect || !slot.getBoundingClientRect) return false;
    var br = b.getBoundingClientRect(), sr = slot.getBoundingClientRect();
    if (!br.width || !sr.width) return false;
    var lb = sr.left, rb = sr.right;
    Array.prototype.forEach.call(slot.children || [], function (e) {
      if (e === b || e === rt.picker || e === rt.uitleg || e === rt.status || !e.getBoundingClientRect) return;
      var r = e.getBoundingClientRect(); if (!r.width) return;
      if (r.right <= br.left + 1) lb = Math.max(lb, r.right + 6);
      if (r.left >= br.right - 1) rb = Math.min(rb, r.left - 6);
    });
    var vrijLinks = Math.max(44, br.right - lb), vrijRechts = Math.max(44, rb - br.left);
    var voorkeur = b.getAttribute('data-rtg-key-anchor');
    var richting = voorkeur === 'links' ? 'right' : voorkeur === 'rechts' ? 'left' : (vrijRechts >= vrijLinks ? 'right' : 'left');
    var vrij = richting === 'right' ? vrijRechts : vrijLinks, breedte = Math.max(44, Math.min(240, vrij));
    zetAttr(b, 'data-rtg-key-open-direction', richting);
    b.style.setProperty('--rtg-key-open-width', breedte + 'px');
    var venster = Number(rt.win.innerWidth) || sr.right;
    rt.picker.style.setProperty('--rtg-key-picker-left', Math.max(8, Math.min(venster - 168, br.left + br.width / 2 - 80)) + 'px');
    return { direction: richting, width: breedte };
  }
  function isMobieleDruk(rt, ev) {
    if (ev.button != null && ev.button !== 0 || ev.pointerType === 'mouse') return false;
    try { return !rt.win.matchMedia || rt.win.matchMedia('(max-width: 767px)').matches; } catch (e) { return false; }
  }
  function isInvoer(e) { return !!(e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))); }
  function isBruikbaar(e, win) {
    if (!e || e.hidden || e.disabled || e.getAttribute('aria-disabled') === 'true' || !e.isConnected) return false;
    try {
      var s = win && win.getComputedStyle && win.getComputedStyle(e);
      if (s && (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0)) return false;
      if (e.getClientRects && !e.getClientRects().length) return false;
    } catch (fout) { return false; }
    return true;
  }

  return Object.freeze({ SELECTOR: SELECTOR, STORAGE_KEY: STORAGE, ANCHORS: ANCHORS,
    normalizeAnchor: anker, anchorForX: ankerVoorX, readPreference: leesVoorkeur,
    writePreference: schrijfVoorkeur, handAnchor: handanker, setAttr: zetAttr,
    buildContent: bouwInhoud, makePicker: maakPicker, updatePicker: updatePicker,
    announce: kondig, measure: meet, isMobilePress: isMobieleDruk, isInput: isInvoer,
    isUsable: isBruikbaar });
}));
