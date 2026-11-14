/* GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app.
   Zelfstandige module: opent het live-kanaal (SSE), regelt WebRTC-bellen en
   spuit zijn eigen belscherm in. Werkt met een basis-URL + profieltoken, zodat
   zowel de RTFoundation-app als de RTG-app hem kan gebruiken.
   Init: GezinRT.init({ base, code, token, mijnId, mijnNaam, leden, onChat, onBelStatus }) */
(function (w) {
  var S = { base: '/api/foundation', code: '', token: '', mijnId: '', mijnNaam: '', leden: {} };
  var es = null, onChat = null, onBelStatus = null;
  var call = null, inkomend = null, ingezet = false, mee = null;   // mee: de tekstbaan (shared/meelezen.js)
  var epoch = 0;
  function actief(n) { return n === epoch && !!S.code && !!S.token; }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function post(pad, body) {
    var n = epoch;
    if (!actief(n)) return Promise.reject(new Error('De gezinssessie is gesloten.'));
    return fetch(S.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code: S.code, token: S.token }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!actief(n)) throw new Error('De gezinssessie is gesloten.'); if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  }
  function lidNaam(id) { var l = S.leden[id]; return l ? l.naam : 'Gezinslid'; }
  function lidAvatar(id) { var l = S.leden[id]; return l ? (l.avatar || 'emo-blij') : 'emo-blij'; }
  function lees(pad) {
    var n = epoch;
    if (!actief(n)) return Promise.reject(new Error('De gezinssessie is gesloten.'));
    return fetch(S.base + '/gezin/' + S.code + pad, { headers: { Authorization: 'Bearer ' + S.token } })
      .then(function (r) { return r.json(); }).then(function (d) { if (!actief(n)) throw new Error('De gezinssessie is gesloten.'); return d; });
  }

  var GezinRT = {
    init: function (opts) {
      GezinRT.stop();
      S.base = opts.base || S.base; S.code = opts.code; S.token = opts.token;
      S.mijnId = opts.mijnId; S.mijnNaam = opts.mijnNaam || 'ik';
      GezinRT.setLeden(opts.leden || []);
      onChat = opts.onChat || null; onBelStatus = opts.onBelStatus || null;
      haalIce();
      injectUI();
      verbind();
    },
    setLeden: function (arr) { S.leden = {}; (arr || []).forEach(function (l) { S.leden[l.id] = l; }); },
    /* Een verse gezinssessie (de RTG-app haalt per keer een nieuwe van 12 uur via
       /api/rtf/kanaal). Het kanaal verbindt opnieuw, behalve midden in een gesprek. */
    setToken: function (t) { if (!actief(epoch) || !t || t === S.token) return; S.token = t; if (!call) verbind(); },
    // chat
    stuur: function (naarId, tekst) { return post('/gezin/chat', { naar: naarId, tekst: tekst }); },
    thread: function (metId) { return lees('/chat/' + metId); },
    chats: function () { return lees('/chats'); },
    // bellen
    bel: function (naarId, video) { beginGesprek(naarId, video); },
    stop: function () {
      epoch++; clearTimeout(wacht); wacht = null;
      try { if (es) es.close(); } catch (e) {} es = null;
      S.code = ''; S.token = ''; S.mijnId = ''; S.mijnNaam = ''; S.leden = {};
      onChat = null; onBelStatus = null; iceConfig = null; eindeGesprek(false);
    }
  };

  /* De sessie gaat niet in de URL (B18): eerst een eenmalig stroomticket van een
     minuut met de sessie in de header. Verbindt de browser vanzelf opnieuw, dan
     is dat ticket al op (401) en sluit EventSource; dan halen we een nieuw. */
  var wacht = null;
  function verbind() {
    try { if (es) es.close(); } catch (e) {}
    es = null; clearTimeout(wacht);
    var token = S.token, n = epoch;
    function geldig() { return actief(n) && token === S.token; }
    function later(ms) { if (actief(n)) wacht = setTimeout(function () { if (actief(n)) verbind(); }, ms); }
    if (!geldig()) return;
    fetch(S.base + '/gezin/stroom/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ code: S.code, kanaal: 'gezin' }) })
      .then(function (r) { return r.ok ? r.json() : (r.status === 403 ? 'weg' : null); })
      .then(function (t) {
        if (t === 'weg' || !geldig()) return;
        if (!t || !t.ticket) { later(30000); return; }
        var kanaal = new EventSource(S.base + '/gezin/' + S.code + '/kanaal?ticket=' + encodeURIComponent(t.ticket)); es = kanaal;
        // Tokenverversing onderbreekt een actief gesprek niet. Het geopende
        // kanaal blijft eigendom van deze epoch, niet van het oude ticket-token.
        function eigenaar() { return actief(n) && es === kanaal; }
        kanaal.addEventListener('chat', function (e) { if (!eigenaar()) return; try { var d = JSON.parse(e.data); if (onChat) onChat(d); } catch (x) {} });
        kanaal.addEventListener('bel', function (e) { if (!eigenaar()) return; try { opBelsignaal(JSON.parse(e.data)); } catch (x) {} });
        kanaal.onerror = function () { if (eigenaar() && kanaal.readyState === 2) { es = null; later(3000); } };
      }, function () { if (geldig()) later(10000); });
  }
  /* ---------- WebRTC bellen ---------- */
  function seinNaar(naar, kind, payload, video) { post('/gezin/bel', { naar: naar, kind: kind, payload: payload || null, video: !!video }).catch(function () {}); }
  function belUI(open) { var s = document.getElementById('grt-call'); if (s) s.style.display = open ? 'flex' : 'none'; if (!open) { var r = document.getElementById('grt-remote'), l = document.getElementById('grt-local'); if (r) r.srcObject = null; if (l) l.srcObject = null; } }
  function tijdTik() { if (!call) return; var s = Math.round((Date.now() - call.t0) / 1000); var el = document.getElementById('grt-tijd'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  // shared/media.js meldt zelf waarom het niet gaat; hier bleef anders een
  // stille null over, en dan gebeurde er bij "bellen" gewoon niets.
  function pakMedia(video) { return window.RTGMedia.vraag({ audio: true, video: video ? { facingMode: 'user' } : false }).catch(function () { return null; }); }
  var iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  function haalIce() { var n = epoch; if (!actief(n)) return Promise.resolve(null); return fetch(S.base + '/gezin/ice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, token: S.token }) }).then(function (r) { return r.json(); }).then(function (d) { if (!actief(n)) return null; iceConfig = d.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]; return iceConfig; }).catch(function () { if (!actief(n)) return null; iceConfig = [{ urls: 'stun:stun.l.google.com:19302' }]; return iceConfig; }); }
  function maakPc() {
    var gesprek = call;
    var pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(function (t) { pc.addTrack(t, call.stream); });
    pc.onicecandidate = function (ev) { if (ev.candidate && call === gesprek) seinNaar(gesprek.met, 'ice', ev.candidate); };
    pc.ontrack = function (ev) { if (call !== gesprek) return; var v = document.getElementById('grt-remote'); if (v && v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0]; };
    pc.onconnectionstatechange = function () {
      if (call !== gesprek) return;
      if (pc.connectionState === 'connected' && call && !call.t0) { call.t0 = Date.now(); call.timer = setInterval(tijdTik, 1000); var st = document.getElementById('grt-status'); if (st) st.textContent = ''; }
      if (['failed', 'closed'].indexOf(pc.connectionState) >= 0) eindeGesprek(false);
    };
    call.pc = pc; w.__grtCall = function () { return call; };
    return pc;
  }
  function toonScherm(naam, video, statusTekst) {
    document.getElementById('grt-naam').textContent = naam;
    document.getElementById('grt-av').textContent = (S.leden[call ? call.met : (inkomend && inkomend.van)] || {}).avatar || 'emo-blij';
    document.getElementById('grt-av').style.display = video ? 'none' : 'flex';
    document.getElementById('grt-local').style.display = video ? '' : 'none';
    document.getElementById('grt-status').textContent = statusTekst || '';
    document.getElementById('grt-cam').style.display = video ? '' : 'none';
    belUI(true);
  }
  function beginGesprek(naarId, video) {
    var n = epoch;
    if (call || !actief(n)) { return; }
    haalIce();
    pakMedia(video).then(function (stream) {
      if (!actief(n)) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      if (!stream) { alert('Geen toegang tot microfoon of camera.'); return; }
      call = { met: naarId, video: video, richting: 'uit', pendingIce: [], stream: stream, t0: 0 };
      document.getElementById('grt-local').srcObject = stream;
      toonScherm(lidNaam(naarId), video, 'gaat over...');
      seinNaar(naarId, 'ring', null, video);
    });
  }
  function neemOp() {
    document.getElementById('grt-incoming').style.display = 'none';
    if (!inkomend) return;
    var inb = inkomend, n = epoch;
    pakMedia(inb.video).then(function (stream) {
      if (!actief(n) || inkomend !== inb) { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      if (!stream) { seinNaar(inb.van, 'decline'); inkomend = null; return; }
      call = { met: inb.van, video: inb.video, richting: 'in', pendingIce: [], stream: stream, t0: 0 };
      document.getElementById('grt-local').srcObject = stream;
      toonScherm(lidNaam(inb.van), inb.video, 'verbinden...');
      seinNaar(call.met, 'accept', null, inb.video);
      inkomend = null;
    });
  }
  function eindeGesprek(zeggen) {
    var gesprek = call; call = null; inkomend = null;
    if (gesprek) {
      if (zeggen) seinNaar(gesprek.met, 'hangup');
      clearInterval(gesprek.timer);
      try { gesprek.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (gesprek.pc) gesprek.pc.close(); } catch (e) {}
    }
    var inv = document.getElementById('grt-incoming'); if (inv) inv.style.display = 'none';
    ['grt-naam','grt-inaam','grt-av','grt-iav','grt-status','grt-isoort','grt-tijd'].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = ''; });
    if (mee) mee.leeg();
    belUI(false);
  }
  function flushIce() { if (!call || !call.pc || !call.pc.remoteDescription) return Promise.resolve(); var ps = call.pendingIce.splice(0).map(function (c) { return call.pc.addIceCandidate(c).catch(function () {}); }); return Promise.all(ps); }
  function opBelsignaal(d) {
    if (!actief(epoch) || d.naar !== S.mijnId) return;
    if (d.kind === 'ring') {
      if (call) { seinNaar(d.van, 'busy'); return; }
      inkomend = { van: d.van, video: d.video };
      document.getElementById('grt-iav').textContent = lidAvatar(d.van);
      document.getElementById('grt-inaam').textContent = d.vanNaam || lidNaam(d.van);
      document.getElementById('grt-isoort').textContent = d.video ? 'Videogesprek' : 'Spraakoproep';
      document.getElementById('grt-incoming').style.display = 'flex';
      return;
    }
    if (!call || d.van !== call.met) return;
    var gesprek = call, n = epoch;
    function geldig() { return actief(n) && call === gesprek; }
    if (d.kind === 'accept') {
      var pc = maakPc();
      pc.createOffer().then(function (o) { if (!geldig()) return; return pc.setLocalDescription(o).then(function () { if (geldig()) seinNaar(gesprek.met, 'offer', o); }); }).catch(function () { if (geldig()) eindeGesprek(false); });
    } else if (d.kind === 'offer') {
      var pc2 = maakPc();
      pc2.setRemoteDescription(d.payload).then(function () { if (geldig()) return flushIce(); }).then(function () { if (geldig()) return pc2.createAnswer(); }).then(function (a) { if (!geldig()) return; return pc2.setLocalDescription(a).then(function () { if (geldig()) seinNaar(gesprek.met, 'answer', a); }); }).catch(function () { if (geldig()) eindeGesprek(false); });
    } else if (d.kind === 'answer') {
      call.pc.setRemoteDescription(d.payload).then(function () { if (geldig()) return flushIce(); }).catch(function () { if (geldig()) eindeGesprek(false); });
    } else if (d.kind === 'ice') {
      if (call.pc && call.pc.remoteDescription) { call.pc.addIceCandidate(d.payload).catch(function () {}); } else call.pendingIce.push(d.payload);
    } else if (d.kind === 'tekst') {
      if (mee && d.payload && d.payload.r) mee.voed(d.payload.r, { wie: d.vanNaam || lidNaam(d.van), bron: 'mens' });
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy') {
      eindeGesprek(false);
    }
  }
/* Gezin-RT, deel 3: HET GESPREKSSCHERM zelf -- de stijl en de opbouw van de
   overlay, plus de tekstbaan erin (shared/meelezen.js).

   Stond in deel 2, en is er afgeknipt toen dat deel met die baan erbij over de
   tienkilobytelat ging. De naad is een echte: deel 2 voert het GESPREK (seinen,
   verbinding, op- en ophangen), dit deel bepaalt hoe het ERUITZIET. De delen
   worden op naam gesorteerd aan elkaar geplakt binnen dezelfde omhulsel-functie,
   dus `injectUI()` ziet `call`, `mee` en `seinNaar` gewoon staan. */
  function injectUI() {
    if (ingezet) return; ingezet = true;
    var css = '#grt-call,#grt-incoming{position:fixed;inset:0;z-index:9999;background:#0C0C0B;color:#F7F5F1;display:none;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;}' +
      '#grt-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}' +
      '#grt-local{position:absolute;right:14px;top:14px;width:88px;height:120px;object-fit:cover;border-radius:0;border:2px solid rgba(255,255,255,.5);z-index:2;background:#111;}' +
      '#grt-av{width:96px;height:96px;border-radius:50%;background:#2a2417;display:flex;align-items:center;justify-content:center;font-size:2.6rem;z-index:1;}' +
      '#grt-naam,#grt-inaam{font-size:1.5rem;margin-top:1rem;z-index:1;}#grt-status,#grt-isoort{color:#A79F92;margin-top:.3rem;z-index:1;font-family:Arial,sans-serif;font-size:.9rem;}' +
      '#grt-tijd{position:absolute;top:20px;left:0;right:0;text-align:center;color:#fff;z-index:2;font-family:Arial,sans-serif;}' +
      '.grt-knoppen{position:absolute;bottom:40px;display:flex;gap:1.2rem;z-index:3;}' +
      '.grt-b{width:60px;height:60px;border-radius:50%;border:none;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:#2a2724;}' +
      '.grt-b.weg{background:#B4574E;}.grt-b.op{background:#5FA56A;}.grt-b.dicht{background:#5a4;opacity:.6;}' +
      '#grt-iav{width:110px;height:110px;border-radius:50%;background:#2a2417;display:flex;align-items:center;justify-content:center;font-size:3rem;}' +
      /* De tekstbaan hangt boven de knoppenrij en onder het beeld: wie meeleest
         kijkt naar het gesprek en niet ernaast (shared/meelezen.js). */
      '#grt-mee{position:absolute;left:14px;right:14px;bottom:112px;z-index:4;color:#F7F5F1;font-family:Arial,sans-serif;}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="grt-call"><video id="grt-remote" autoplay playsinline></video><video id="grt-local" autoplay playsinline muted></video>' +
      '<div id="grt-tijd"></div><div id="grt-av"></div><div id="grt-naam"></div><div id="grt-status"></div>' +
      '<div class="grt-knoppen"><button class="grt-b" id="grt-mute" title="Microfoon"></button><button class="grt-b" id="grt-cam" title="Camera"></button><button class="grt-b weg" id="grt-weg" title="Ophangen"></button></div>' +
      '<div id="grt-mee"></div></div>' +
      '<div id="grt-incoming"><div id="grt-iav"></div><div id="grt-inaam"></div><div id="grt-isoort"></div>' +
      '<div class="grt-knoppen"><button class="grt-b weg" id="grt-nee"></button><button class="grt-b op" id="grt-ja"></button></div></div>';
    document.body.appendChild(wrap);
    /* MEELEZEN. Zonder tekstbaan kan wie doof is niet meedoen aan dit gesprek
       (TOEGANKELIJK.md). Wat erin staat is getypt door een mens en niet uit
       spraak herkend -- zie de kop van shared/meelezen.js. */
    if (w.RTGMeelezen) {
      mee = w.RTGMeelezen.maak({
        stroom: function () { return (call && call.stream) || null; },
        stuur: function (regel) { if (call) seinNaar(call.met, 'tekst', { r: regel }); } });
      var meeVak = document.getElementById('grt-mee'); if (meeVak) meeVak.appendChild(mee.el);
    }
    document.getElementById('grt-weg').onclick = function () { eindeGesprek(true); };
    document.getElementById('grt-ja').onclick = neemOp;
    document.getElementById('grt-nee').onclick = function () { document.getElementById('grt-incoming').style.display = 'none'; if (inkomend) seinNaar(inkomend.van, 'decline'); inkomend = null; };
    document.getElementById('grt-mute').onclick = function () { if (!call) return; var t = call.stream.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; this.classList.toggle('dicht', !t.enabled); };
    document.getElementById('grt-cam').onclick = function () { if (!call) return; var t = call.stream.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; this.classList.toggle('dicht', !t.enabled); };
  }

  w.GezinRT = GezinRT;
})(window);
