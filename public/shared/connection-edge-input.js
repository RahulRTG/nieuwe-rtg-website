/* Toetsen, halen, scrollvorm en haptics staan los van de renderer. Geen van
   deze ingangen verandert productstate of voegt een capability toe. */
(function (g, fabriek) {
  'use strict';
  var kern = typeof module === 'object' && module.exports ? require('./connection-edge-core.js') : g && g.RTGConnectionEdgeCore;
  var api = kern && fabriek(kern);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && api) g.RTGConnectionEdgeInput = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (kern) {
  'use strict';
  function toetsen(rail, doc, toestand, naarRoot) {
    function handler(event) {
      var knoppen = Array.from(rail.querySelectorAll('button')), index = knoppen.indexOf(doc.activeElement);
      if (event.key === 'Escape' && toestand.layer() === 'child') { event.preventDefault(); naarRoot(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !knoppen.length) return;
      event.preventDefault();
      var stap = doc.documentElement.dir === 'rtl' ? -1 : 1;
      var volgende = event.key === 'Home' ? 0 : event.key === 'End' ? knoppen.length - 1
        : (index + (event.key === 'ArrowRight' ? stap : -stap) + knoppen.length) % knoppen.length;
      knoppen.forEach(function (b, i) { b.tabIndex = i === volgende ? 0 : -1; });
      knoppen[volgende].focus();
    }
    rail.addEventListener('keydown', handler);
    return function () { rail.removeEventListener('keydown', handler); };
  }
  function halen(host, win, toestand, naarRoot, naarKind) {
    var begin = null, slik = false;
    function neer(event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      begin = { x:event.clientX, y:event.clientY, id:event.pointerId };
    }
    function op(event) {
      if (!begin || begin.id !== event.pointerId) return;
      var dx = event.clientX - begin.x, dy = event.clientY - begin.y; begin = null;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      slik = true; win.setTimeout(function () { slik = false; }, 450);
      var doel = kern.layerAfterSwipe(toestand.layer(), dx > 0 ? 'right' : 'left', toestand.hasChild());
      if (doel === 'root') naarRoot(); else if (doel === 'child') naarKind();
    }
    function klik(event) { if (slik) { event.preventDefault(); event.stopPropagation(); slik = false; } }
    host.addEventListener('pointerdown', neer, { passive:true });
    host.addEventListener('pointerup', op, { passive:true }); host.addEventListener('click', klik, true);
    return function () { host.removeEventListener('pointerdown', neer); host.removeEventListener('pointerup', op);
      host.removeEventListener('click', klik, true); };
  }
  function scrollvorm(host, win) {
    var laatste = win.scrollY || 0, gepland = false, compact = false;
    function scroll() {
      if (gepland) return; gepland = true;
      win.requestAnimationFrame(function () {
        gepland = false; var y = win.scrollY || 0, delta = y - laatste; laatste = y;
        compact = y > 72 && delta > 5 ? true : y < 36 || delta < -8 ? false : compact;
        host.classList.toggle('is-compact', compact);
      });
    }
    win.addEventListener('scroll', scroll, { passive:true });
    return function () { win.removeEventListener('scroll', scroll); };
  }
  function haptic(win) { try { if (win.navigator && typeof win.navigator.vibrate === 'function') win.navigator.vibrate(8); } catch (e) {} }
  return Object.freeze({ bindKeyboard:toetsen, bindSwipe:halen, bindScroll:scrollvorm, haptic:haptic });
}));
