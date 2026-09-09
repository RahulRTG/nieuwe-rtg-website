/* Eén onderrand: bestaande appknoppen verhuizen intact naar de witte Edge.
   Er worden geen knoppen gekloond; de app houdt haar eigen gedrag en staat. */
(function (w, d) {
  'use strict';

  var api = {}, actief = null;

  function zichtbaarVast(el) {
    if (!w.getComputedStyle || !el.getBoundingClientRect) return false;
    var stijl = w.getComputedStyle(el), r = el.getBoundingClientRect();
    var onder = parseFloat(stijl.bottom);
    return stijl.position === 'fixed' && stijl.display !== 'none' && stijl.visibility !== 'hidden' &&
      r.width > 40 && r.height >= 40 && Number.isFinite(onder) && onder <= 24;
  }

  function kandidaat(el, root) {
    if (!el || root.contains(el) || el.closest('dialog,[role="dialog"],.rtg-edge-chrome')) return false;
    if (el.matches('.wos-dock,.cmd-balk,nav.balk[aria-label="Hoofdnavigatie"]')) return false;
    /* Geneste bediening leunt op haar eigen ouder voor CSS en klikdelegatie.
       Alleen een uitdrukkelijke aansluiting mag haar daaruit verplaatsen. */
    return el.hasAttribute('data-rtg-edge-bar') || (el.parentElement === d.body && zichtbaarVast(el));
  }

  function herstel(rt) {
    if (!rt) return;
    rt.balken.slice().reverse().forEach(function (r) {
      if (r.volgende && r.volgende.parentNode === r.ouder) r.ouder.insertBefore(r.el, r.volgende);
      else r.ouder.appendChild(r.el);
      r.el.classList.remove('rtg-edge-owned-bar');
    });
    rt.body.removeAttribute('data-rtg-edge-appbar');
    rt.balken = [];
    if (rt.observer) rt.observer.disconnect();
    if (rt.resize) w.removeEventListener('resize', rt.resize);
    actief = null;
  }

  function neem(rt, el) {
    rt.balken.push({ el: el, ouder: el.parentNode, volgende: el.nextSibling });
    el.classList.add('rtg-edge-owned-bar');
    rt.slot.appendChild(el);
    rt.body.setAttribute('data-rtg-edge-appbar', 'true');
  }

  function scan(rt) {
    if (rt.bezig) return;
    if (!d.documentElement.contains(rt.root)) { herstel(rt); return; }
    rt.bezig = true;
    Array.from(d.querySelectorAll('[data-rtg-edge-bar],nav,footer')).forEach(function (el) {
      if (kandidaat(el, rt.root)) neem(rt, el);
    });
    rt.bezig = false;
  }

  api.start = function (doc) {
    doc = doc || d;
    var root = doc.querySelector('.rtg-edge-chrome');
    var slot = root && root.querySelector('.rtg-edge-appslot');
    if (!root || !slot || doc.body.getAttribute('data-rtg-edge-2-rendered') !== 'true') return null;
    if (actief && actief.root === root) { scan(actief); return actief; }
    if (actief) herstel(actief);
    var rt = actief = { root: root, slot: slot, body: doc.body, balken: [], bezig: false };
    scan(rt);
    if (w.MutationObserver) {
      rt.observer = new w.MutationObserver(function () { w.setTimeout(function () { scan(rt); }, 0); });
      rt.observer.observe(doc.body, { childList: true, subtree: true });
    }
    rt.resize = function () { scan(rt); };
    w.addEventListener('resize', rt.resize, { passive: true });
    return rt;
  };
  api.destroy = function () { herstel(actief); };
  w.RTGEdgeAppBar = api;
}(window, document));
