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

