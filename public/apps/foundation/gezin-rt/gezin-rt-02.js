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
