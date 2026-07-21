/* De in-pagina helper voor onze browser-driver (server/lib/browser.js). Deze
   broncode wordt via Page.addScriptToEvaluateOnNewDocument in ELKE nieuwe
   document geinjecteerd, zodat window.__rtgdrv altijd klaarstaat voordat een
   test iets opvraagt. Hij lost selectors op (gewone CSS plus Playwright-achtig
   "a >> b" en "text=..."), meet zichtbaarheid en bootst klik/typ na met echte,
   bubbelende events. Puur onze eigen code; geen axe, geen playwright. */
'use strict';

// Als string, zodat de driver hem letterlijk kan injecteren.
const BRON = `(function () {
  if (window.__rtgdrv) return;
  var drv = {
    splits: function (sel) { return String(sel).split('>>').map(function (s) { return s.trim(); }).filter(Boolean); },
    tekstZoek: function (root, naald) {
      naald = naald.replace(/^["']|["']$/g, '');
      var alle = root.querySelectorAll('*'), gevonden = null;
      for (var i = 0; i < alle.length; i++) {
        var el = alle[i];
        if (!el.textContent || el.textContent.indexOf(naald) < 0) continue;
        var kindMatcht = false;
        for (var j = 0; j < el.children.length; j++) {
          if (el.children[j].textContent && el.children[j].textContent.indexOf(naald) >= 0) { kindMatcht = true; break; }
        }
        if (!kindMatcht) { gevonden = el; break; }
      }
      return gevonden;
    },
    stap: function (root, deel) {
      if (deel.indexOf('text=') === 0) return this.tekstZoek(root, deel.slice(5).trim());
      return root.querySelector(deel);
    },
    zoek: function (sel) {
      var delen = this.splits(sel), root = document, el = null;
      for (var i = 0; i < delen.length; i++) { el = this.stap(root, delen[i]); if (!el) return null; root = el; }
      return el;
    },
    zoekAlle: function (sel) {
      var delen = this.splits(sel);
      if (delen.length === 1) {
        if (delen[0].indexOf('text=') === 0) { var e = this.tekstZoek(document, delen[0].slice(5).trim()); return e ? [e] : []; }
        return Array.prototype.slice.call(document.querySelectorAll(delen[0]));
      }
      var root = document;
      for (var i = 0; i < delen.length - 1; i++) { root = this.stap(root, delen[i]); if (!root) return []; }
      var laatste = delen[delen.length - 1];
      if (laatste.indexOf('text=') === 0) { var t = this.tekstZoek(root, laatste.slice(5).trim()); return t ? [t] : []; }
      return Array.prototype.slice.call(root.querySelectorAll(laatste));
    },
    zichtbaar: function (el) {
      if (!el) return false;
      var s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    klik: function (el) {
      if (!el) throw new Error('klik: geen element');
      try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
      var o = { bubbles: true, cancelable: true, view: window };
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
        var C = t.indexOf('pointer') === 0 && window.PointerEvent ? PointerEvent : MouseEvent;
        el.dispatchEvent(new C(t, o));
      });
    },
    vul: function (el, waarde) {
      if (!el) throw new Error('vul: geen veld');
      el.focus();
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, waarde);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  window.__rtgdrv = drv;
})();`;

module.exports = { BRON };
