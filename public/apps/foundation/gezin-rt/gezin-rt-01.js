/* GezinRT: chatten en (beeld)bellen tussen gezinsleden, in de app.
   Zelfstandige module: opent het live-kanaal (SSE), regelt WebRTC-bellen en
   spuit zijn eigen belscherm in. Werkt met een basis-URL + profieltoken, zodat
   zowel de RTFoundation-app als de RTG-app hem kan gebruiken.
   Init: GezinRT.init({ base, code, token, mijnId, mijnNaam, leden, onChat, onBelStatus }) */
(function (w) {
  var S = { base: '/api/foundation', code: '', token: '', mijnId: '', mijnNaam: '', leden: {} };
  var es = null, onChat = null, onBelStatus = null;
  var call = null, inkomend = null, ingezet = false;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function post(pad, body) {
    return fetch(S.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ code: S.code, token: S.token }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Er ging iets mis.'); return d; }); });
  }
  function lidNaam(id) { var l = S.leden[id]; return l ? l.naam : 'Gezinslid'; }
  function lidAvatar(id) { var l = S.leden[id]; return l ? (l.avatar || '🙂') : '🙂'; }

  var GezinRT = {
    init: function (opts) {
      S.base = opts.base || S.base; S.code = opts.code; S.token = opts.token;
      S.mijnId = opts.mijnId; S.mijnNaam = opts.mijnNaam || 'ik';
      GezinRT.setLeden(opts.leden || []);
      onChat = opts.onChat || null; onBelStatus = opts.onBelStatus || null;
      haalIce();
      injectUI();
      verbind();
    },
    setLeden: function (arr) { S.leden = {}; (arr || []).forEach(function (l) { S.leden[l.id] = l; }); },
    // chat
    stuur: function (naarId, tekst) { return post('/gezin/chat', { naar: naarId, tekst: tekst }); },
    thread: function (metId) { return fetch(S.base + '/gezin/' + S.code + '/chat/' + metId + '?token=' + encodeURIComponent(S.token)).then(function (r) { return r.json(); }); },
    chats: function () { return fetch(S.base + '/gezin/' + S.code + '/chats?token=' + encodeURIComponent(S.token)).then(function (r) { return r.json(); }); },
    // bellen
    bel: function (naarId, video) { beginGesprek(naarId, video); },
    stop: function () { try { if (es) es.close(); } catch (e) {} eindeGesprek(false); }
  };

  function verbind() {
    try { if (es) es.close(); } catch (e) {}
    es = new EventSource(S.base + '/gezin/' + S.code + '/kanaal?token=' + encodeURIComponent(S.token));
    es.addEventListener('chat', function (e) { try { var d = JSON.parse(e.data); if (onChat) onChat(d); } catch (x) {} });
    es.addEventListener('bel', function (e) { try { opBelsignaal(JSON.parse(e.data)); } catch (x) {} });
    es.onerror = function () { /* de browser verbindt vanzelf opnieuw (retry) */ };
  }

  /* ---------- WebRTC bellen ---------- */
  function seinNaar(naar, kind, payload, video) { post('/gezin/bel', { naar: naar, kind: kind, payload: payload || null, video: !!video }).catch(function () {}); }
  function belUI(open) { var s = document.getElementById('grt-call'); if (s) s.style.display = open ? 'flex' : 'none'; if (!open) { var r = document.getElementById('grt-remote'), l = document.getElementById('grt-local'); if (r) r.srcObject = null; if (l) l.srcObject = null; } }
  function tijdTik() { if (!call) return; var s = Math.round((Date.now() - call.t0) / 1000); var el = document.getElementById('grt-tijd'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function pakMedia(video) { return navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }).catch(function () { return null; }); }
  var iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  function haalIce() { return fetch('/api/ice').then(function (r) { return r.json(); }).then(function (d) { iceConfig = d.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]; return iceConfig; }).catch(function () { iceConfig = [{ urls: 'stun:stun.l.google.com:19302' }]; return iceConfig; }); }
  function maakPc() {
    var pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(function (t) { pc.addTrack(t, call.stream); });
    pc.onicecandidate = function (ev) { if (ev.candidate && call) seinNaar(call.met, 'ice', ev.candidate); };
    pc.ontrack = function (ev) { var v = document.getElementById('grt-remote'); if (v && v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0]; };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'connected' && call && !call.t0) { call.t0 = Date.now(); call.timer = setInterval(tijdTik, 1000); var st = document.getElementById('grt-status'); if (st) st.textContent = ''; }
      if (['failed', 'closed'].indexOf(pc.connectionState) >= 0) eindeGesprek(false);
    };
    call.pc = pc; w.__grtCall = function () { return call; };
    return pc;
  }
  function toonScherm(naam, video, statusTekst) {
    document.getElementById('grt-naam').textContent = naam;
    document.getElementById('grt-av').textContent = (S.leden[call ? call.met : (inkomend && inkomend.van)] || {}).avatar || '🙂';
    document.getElementById('grt-av').style.display = video ? 'none' : 'flex';
    document.getElementById('grt-local').style.display = video ? '' : 'none';
    document.getElementById('grt-status').textContent = statusTekst || '';
    document.getElementById('grt-cam').style.display = video ? '' : 'none';
    belUI(true);
  }
  function beginGesprek(naarId, video) {
    if (call) { return; }
    haalIce();
    pakMedia(video).then(function (stream) {
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
    var inb = inkomend;
    pakMedia(inb.video).then(function (stream) {
      if (!stream) { seinNaar(inb.van, 'decline'); inkomend = null; return; }
      call = { met: inb.van, video: inb.video, richting: 'in', pendingIce: [], stream: stream, t0: 0 };
      document.getElementById('grt-local').srcObject = stream;
      toonScherm(lidNaam(inb.van), inb.video, 'verbinden...');
      seinNaar(call.met, 'accept', null, inb.video);
      inkomend = null;
    });
  }
  function eindeGesprek(zeggen) {
    if (call) {
      if (zeggen) seinNaar(call.met, 'hangup');
      clearInterval(call.timer);
      try { call.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (call.pc) call.pc.close(); } catch (e) {}
      call = null;
    }
    belUI(false);
  }
  function flushIce() { if (!call || !call.pc || !call.pc.remoteDescription) return Promise.resolve(); var ps = call.pendingIce.splice(0).map(function (c) { return call.pc.addIceCandidate(c).catch(function () {}); }); return Promise.all(ps); }
  function opBelsignaal(d) {
    if (d.naar !== S.mijnId) return;
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
    if (d.kind === 'accept') {
      var pc = maakPc();
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o).then(function () { seinNaar(call.met, 'offer', o); }); });
    } else if (d.kind === 'offer') {
      var pc2 = maakPc();
      pc2.setRemoteDescription(d.payload).then(flushIce).then(function () { return pc2.createAnswer(); }).then(function (a) { return pc2.setLocalDescription(a).then(function () { seinNaar(call.met, 'answer', a); }); });
    } else if (d.kind === 'answer') {
      call.pc.setRemoteDescription(d.payload).then(flushIce);
    } else if (d.kind === 'ice') {
      if (call.pc && call.pc.remoteDescription) { call.pc.addIceCandidate(d.payload).catch(function () {}); } else call.pendingIce.push(d.payload);
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy') {
      eindeGesprek(false);
    }
  }

  function injectUI() {
