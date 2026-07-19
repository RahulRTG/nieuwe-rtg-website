/* RTG contentbescherming: de DRM-route (Encrypted Media Extensions) plus de
   visuele guard uit rtg-protect.css. Een drop-in voor de hele code:

     <link rel="stylesheet" href="/apps/rtg-protect.js"> is NIET nodig; laad
     rtg-protect.css los. Neem dit script op en roep aan:
       RTGProtect.guardVideo(videoEl, { contentId, watermark });
       RTGProtect.guard(elementEl, { watermark });           // beeld/canvas
     of zet data-rtg-protect (+ optioneel data-content-id, data-watermark) op
     het element; dan gaat het automatisch bij het laden.

   De DRM-route: als de browser een sleutelsysteem heeft (Clear Key wordt door
   RTG zelf bediend; Widevine/PlayReady/FairPlay worden herkend) en de stream
   is versleuteld, dan haalt de speler de licentie bij /api/drm/key en speelt
   beveiligd af. Is er geen versleutelde stream of geen sleutelsysteem, dan
   blijft de zichtbare laag (blur + overlay + watermerk) de bescherming.

   Geen externe libraries; alles standaard-web. */
(function () {
  'use strict';

  var b64url = {
    // ruwe bytes -> base64url
    enc: function (buf) {
      var s = ''; var b = new Uint8Array(buf);
      for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  };

  function token() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }

  // ---- de DRM-route: welke sleutelsystemen kan deze browser? ----
  var KEY_SYSTEMS = ['org.w3.clearkey', 'com.widevine.alpha', 'com.microsoft.playready', 'com.apple.fps'];
  var _cap = null;
  function capability() {
    if (_cap) return _cap;
    var config = [{
      initDataTypes: ['cenc', 'keyids', 'webm'],
      videoCapabilities: [
        { contentType: 'video/mp4; codecs="avc1.42E01E"' },
        { contentType: 'video/webm; codecs="vp9"' }
      ]
    }];
    _cap = Promise.all(KEY_SYSTEMS.map(function (ks) {
      if (!navigator.requestMediaKeySystemAccess) return null;
      return navigator.requestMediaKeySystemAccess(ks, config)
        .then(function () { return ks; })
        .catch(function () { return null; });
    })).then(function (res) { return res.filter(Boolean); });
    return _cap;
  }

  // ---- Clear Key: de licentie komt van onze eigen server ----
  function haalLicentie(contentId, message) {
    var kids = [];
    try {
      // een Clear Key-licentieverzoek is JSON met de gevraagde key-ids
      var vraag = JSON.parse(new TextDecoder().decode(message));
      if (vraag && Array.isArray(vraag.kids)) kids = vraag.kids;
    } catch (e) { /* geen JSON-verzoek: laat kids leeg, de server kent de content */ }
    return fetch('/api/drm/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify({ contentId: contentId, kids: kids })
    }).then(function (r) { if (!r.ok) throw new Error('licentie geweigerd'); return r.json(); });
  }

  function setupEme(video, contentId, badge) {
    if (!video.mediaKeys && !navigator.requestMediaKeySystemAccess) return Promise.resolve(false);
    var config = [{
      initDataTypes: ['cenc', 'keyids', 'webm'],
      videoCapabilities: [
        { contentType: 'video/mp4; codecs="avc1.42E01E"' },
        { contentType: 'video/webm; codecs="vp9"' }
      ]
    }];
    return navigator.requestMediaKeySystemAccess('org.w3.clearkey', config)
      .then(function (access) { return access.createMediaKeys(); })
      .then(function (mk) { return video.setMediaKeys(mk).then(function () { return mk; }); })
      .then(function (mk) {
        video.addEventListener('encrypted', function (ev) {
          var session = mk.createSession('temporary');
          session.addEventListener('message', function (me) {
            haalLicentie(contentId, me.message)
              .then(function (licentie) { return session.update(new TextEncoder().encode(JSON.stringify(licentie))); })
              .then(function () { if (badge) { badge.className = 'rtgp-badge eme'; badge.textContent = 'DRM'; } })
              .catch(function () { markeerSlot(video); });
          });
          session.generateRequest(ev.initDataType, ev.initData).catch(function () { markeerSlot(video); });
        });
        return true;
      })
      .catch(function () { return false; });
  }

  // ---- de zichtbare guard: container, overlay, watermerk, badge, anti-opname ----
  function containerVan(el) {
    if (el.parentElement && el.parentElement.classList.contains('rtgp')) return el.parentElement;
    var wrap = document.createElement('div');
    wrap.className = 'rtgp';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    if (!el.classList.contains('rtgp-media')) el.classList.add('rtgp-media');
    return wrap;
  }

  function watermerkTekst(opts) {
    var wm = (opts && opts.watermark) || 'RTG beveiligd';
    var t = new Date();
    var stamp = t.toISOString().slice(0, 16).replace('T', ' ');
    return String(wm).slice(0, 40) + '  ' + stamp;
  }

  function bouwOverlay(wrap, opts) {
    if (wrap.querySelector('.rtgp-overlay')) return;
    var ov = document.createElement('div');
    ov.className = 'rtgp-overlay';
    var mark = document.createElement('div');
    mark.className = 'rtgp-mark';
    var tekst = watermerkTekst(opts);
    for (var i = 0; i < 28; i++) { var s = document.createElement('span'); s.textContent = tekst; mark.appendChild(s); }
    ov.appendChild(mark);
    wrap.appendChild(ov);

    var lock = document.createElement('div');
    lock.className = 'rtgp-lock';
    lock.innerHTML = '<span class="ic">🔒</span><b>Beschermde inhoud</b>' +
      '<span>Log in als lid om te kijken. Dit beeld is beveiligd en van een watermerk voorzien.</span>';
    wrap.appendChild(lock);

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
