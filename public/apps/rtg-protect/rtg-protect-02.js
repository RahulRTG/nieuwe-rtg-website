/* het beveiligd-merk op het scherm */
    var badge = document.createElement('div');
    badge.className = 'rtgp-badge zicht';
    badge.textContent = 'Beveiligd';
    wrap.appendChild(badge);
    wrap._rtgpBadge = badge;
  }

  function markeerSlot(el) {
    var wrap = el.classList && el.classList.contains('rtgp') ? el : (el.closest ? el.closest('.rtgp') : null);
    if (wrap) wrap.classList.add('rtgp--slot');
  }
  function ontgrendel(el) {
    var wrap = el.classList && el.classList.contains('rtgp') ? el : (el.closest ? el.closest('.rtgp') : null);
    if (wrap) wrap.classList.remove('rtgp--slot');
  }

  // een gedeelde bewaker die alle containers vervaagt zodra het venster de
  // aandacht verliest (afschrikking tegen meekijken en schermopname)
  var _wachters = [];
  function registreerWachter(wrap) {
    _wachters.push(wrap);
    if (registreerWachter._aan) return;
    registreerWachter._aan = true;
    var wazig = function (aan) { _wachters.forEach(function (w) { w.classList.toggle('rtgp--wazig', aan); }); };
    document.addEventListener('visibilitychange', function () { wazig(document.hidden); });
    window.addEventListener('blur', function () { wazig(true); });
    window.addEventListener('focus', function () { wazig(false); });
  }

  /* ---- anti-sabotage: een MutationObserver bewaakt de beschermlaag ----
     Wie via de DOM (devtools, een userscript, een injectie) de overlay, het
     watermerk of het schildje probeert weg te halen of te verbergen, ziet het
     meteen hersteld worden. Bij herhaald knoeien gaat de content op slot
     (fail-closed): de blur blijft dan staan. Een tweede observer op de hele
     pagina bewaakt media die later via JS in de DOM komt. */
  var _sab = new WeakMap();
  function sabotage(wrap) {
    var n = (_sab.get(wrap) || 0) + 1; _sab.set(wrap, n);
    if (n >= 4) wrap.classList.add('rtgp--slot');
  }
  function herstel(wrap) {
    var kapot = false;
    if (!wrap.classList.contains('rtgp')) { wrap.classList.add('rtgp'); kapot = true; }
    var ov = wrap.querySelector('.rtgp-overlay');
    var mark = ov && ov.querySelector('.rtgp-mark');
    var lock = wrap.querySelector('.rtgp-lock');
    var badge = wrap.querySelector('.rtgp-badge');
    if (!ov || !mark || !lock || !badge) {
      // een laag is verwijderd: de resten opruimen en alles opnieuw opbouwen
      ['.rtgp-overlay', '.rtgp-lock', '.rtgp-badge'].forEach(function (sel) { var e = wrap.querySelector(sel); if (e) e.remove(); });
      wrap._rtgpBadge = null;
      bouwOverlay(wrap, wrap._rtgpOpts || {});
      kapot = true;
    } else {
      // via inline stijl of het hidden-attribuut verborgen gemaakt: terugzetten
      [ov, mark, lock, badge].forEach(function (e) { if (e.getAttribute('style')) { e.removeAttribute('style'); kapot = true; } });
      if (ov.hidden || lock.hidden || badge.hidden) { ov.hidden = false; lock.hidden = false; badge.hidden = false; kapot = true; }
    }
    return kapot;
  }
  function armObserver(wrap) {
    if (wrap._rtgpObs || typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function () { if (herstel(wrap)) sabotage(wrap); });
    obs.observe(wrap, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    wrap._rtgpObs = obs;
    // her-controle bij terugkeer naar de pagina (voor het geval de observer werd
    // losgekoppeld terwijl het tabblad weg was)
    document.addEventListener('visibilitychange', function () { if (!document.hidden) herstel(wrap); });
  }
  function globalWatch() {
    if (globalWatch._aan || typeof MutationObserver === 'undefined') return;
    globalWatch._aan = true;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches('[data-rtg-protect]')) autoOne(node);
          if (node.querySelectorAll) { var kids = node.querySelectorAll('[data-rtg-protect]'); for (var k = 0; k < kids.length; k++) autoOne(kids[k]); }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function guard(el, opts) {
    opts = opts || {};
    if (!el || el._rtgpGuarded) return el && el.closest ? el.closest('.rtgp') : null;
    var wrap = containerVan(el);
    wrap._rtgpOpts = opts;
    bouwOverlay(wrap, opts);
    registreerWachter(wrap);
    armObserver(wrap);
    globalWatch();
    // deterrent: geen rechtsklik/opslaan op het beschermde beeld
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    el._rtgpGuarded = true;
    return wrap;
  }

  function guardVideo(video, opts) {
    opts = opts || {};
    var wrap = guard(video, opts);
    // de DRM-route proberen; lukt het niet, dan blijft de zichtbare laag staan
    if (opts.contentId) {
      setupEme(video, opts.contentId, wrap && wrap._rtgpBadge).catch(function () {});
    }
    return wrap;
  }

  // automatische bescherming voor gemarkeerde elementen
  function autoOne(el) {
    if (!el || el._rtgpGuarded) return;
    var opts = { contentId: el.getAttribute('data-content-id') || null, watermark: el.getAttribute('data-watermark') || null };
    if (el.tagName === 'VIDEO') guardVideo(el, opts); else guard(el, opts);
  }
  function auto() {
    globalWatch();
    var els = document.querySelectorAll('[data-rtg-protect]');
    for (var i = 0; i < els.length; i++) autoOne(els[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();

  window.RTGProtect = {
    capability: capability, guard: guard, guardVideo: guardVideo,
    lock: markeerSlot, unlock: ontgrendel, b64url: b64url
  };
})();
