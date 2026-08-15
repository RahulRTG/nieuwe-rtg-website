/* RTG Meet, de kamer zelf: het WebRTC-mesh (ieder toestel verbindt met
   iedereen), microfoon en camera aan/uit, SCHERM DELEN via getDisplayMedia
   (replaceTrack, dus zonder opnieuw verbinden) en de hand opsteken.
   De seinen lopen via /api/meet/sein en komen binnen op het SSE-event
   'meet' (app.js geeft ze hier af). Alles op codenaam. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var api = null, meld = null, kamer = null, ik = null, opWeg = null;
  var stream = null, scherm = null, ice = null;
  var peers = {}; // codenaam -> { pc, wachtrij, el }

  function haalIce() {
    return fetch('/api/ice').then(function (r) { return r.json(); })
      .then(function (d) { ice = d.iceServers || null; }).catch(function () { ice = null; });
  }
  function sein(naar, kind, payload) {
    return api('sein', { id: kamer.id, naar: naar, kind: kind, payload: payload })
      .catch(function () {});
  }
  function tegel(naam) {
    var d = document.createElement('div');
    d.className = 'tegel';
    d.dataset.wie = naam;
    d.innerHTML = '<video autoplay playsinline' + (naam === ik ? ' muted' : '') + '></video>' +
      '<span class="nm">' + esc(naam === ik ? naam + ' (u)' : naam) + '</span>';
    $('#tegels').appendChild(d);
    return d.querySelector('video');
  }
  function wegTegel(naam) {
    var d = $('#tegels [data-wie="' + CSS.escape(naam) + '"]');
    if (d) d.remove();
  }
  function maakPeer(naam) {
    var pc = new RTCPeerConnection({ iceServers: ice || [] });
    var p = { pc: pc, wachtrij: [], el: null };
    (stream ? stream.getTracks() : []).forEach(function (t) { pc.addTrack(t, stream); });
    pc.onicecandidate = function (ev) { if (ev.candidate) sein(naam, 'ice', ev.candidate); };
    pc.ontrack = function (ev) {
      var v = $('#tegels [data-wie="' + CSS.escape(naam) + '"] video') || tegel(naam);
      if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') sluit(naam);
    };
    peers[naam] = p;
    return p;
  }
  function verbind(naam) {
    var p = peers[naam] || maakPeer(naam);
    p.pc.createOffer().then(function (o) {
      return p.pc.setLocalDescription(o).then(function () { sein(naam, 'offer', o); });
    }).catch(function () {});
  }
  function slik(p) {
    while (p.wachtrij.length && p.pc.remoteDescription) {
      try { p.pc.addIceCandidate(p.wachtrij.shift()); } catch (e) {}
    }
  }
  function sluit(naam) {
    var p = peers[naam];
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    delete peers[naam];
    wegTegel(naam);
    lijst();
  }
  function lijst() {
    var namen = [ik].concat(Object.keys(peers));
    $('#wieLijst').textContent = namen.join(' · ');
    $('#kamerKop').textContent = kamer.titel + ' · ' + namen.length + ' aanwezig · code ' + kamer.code;
  }

  /* ---- scherm delen: de videotrack omruilen, verbindingen blijven staan ---- */
  function deelScherm() {
    if (scherm) { stopScherm(); return; }
    /* Scherm delen loopt niet via getUserMedia maar heeft dezelfde twee stille
       oorzaken: een onveilig adres (dan bestaat mediaDevices niet) en een kader
       dat display-capture niet doorgeeft. De reden komt uit dezelfde poort. */
    var vooraf = window.RTGMedia.reden('display-capture');
    if (vooraf) return meld(window.RTGMedia.teksten[vooraf].kort + '. ' + window.RTGMedia.teksten[vooraf].uitleg);
    if (!navigator.mediaDevices.getDisplayMedia) return meld('Scherm delen kan niet op dit toestel: deze browser heeft getDisplayMedia niet.');
    navigator.mediaDevices.getDisplayMedia({ video: true }).then(function (s) {
      scherm = s;
      var track = s.getVideoTracks()[0];
      ruilVideo(track);
      $('#knopScherm').classList.add('aan');
      track.onended = stopScherm;
      meld('U deelt uw scherm.');
    }).catch(function () {});
  }
  function stopScherm() {
    if (!scherm) return;
    try { scherm.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    scherm = null;
    $('#knopScherm').classList.remove('aan');
    var cam = stream && stream.getVideoTracks()[0];
    if (cam) ruilVideo(cam);
    meld('Scherm delen is gestopt.');
  }
  function ruilVideo(track) {
    Object.keys(peers).forEach(function (naam) {
      var zender = peers[naam].pc.getSenders().find(function (x) { return x.track && x.track.kind === 'video'; });
      if (zender) zender.replaceTrack(track).catch(function () {});
    });
    var eigen = $('#tegels [data-wie="' + CSS.escape(ik) + '"] video');
    if (eigen && stream) {
      var toon = new MediaStream([track].concat(stream.getAudioTracks()));
      eigen.srcObject = toon;
    }
  }

  /* ---- binnenkomende seinen (van app.js, via SSE 'meet') ---- */
  function opSein(d) {
    if (!kamer || d.kamer !== kamer.id || d.van === ik) return;
    // de NIEUWKOMER belt (zodra zijn media klaar is); wie er zit wacht het
    // offer af -- zo draagt het eerste offer altijd echte sporen en is er
    // geen race met een camera die nog opkomt
    if (d.kind === 'kom') { if (!peers[d.van]) tegel(d.van); lijst(); return; }
    if (d.kind === 'weg') { sluit(d.van); return; }
    if (d.kind === 'dicht') { meld('De gastheer heeft de kamer gesloten.'); stop(); return; }
    if (d.kind === 'hand') { meld(d.van + ' steekt de hand op.'); return; }
    var p = peers[d.van] || maakPeer(d.van);
    if (d.kind === 'offer') {
      p.pc.setRemoteDescription(new RTCSessionDescription(d.payload)).then(function () {
        return p.pc.createAnswer();
      }).then(function (a) {
        return p.pc.setLocalDescription(a).then(function () { sein(d.van, 'answer', a); slik(p); lijst(); });
      }).catch(function () {});
      return;
    }
    if (d.kind === 'answer') {
      p.pc.setRemoteDescription(new RTCSessionDescription(d.payload)).then(function () { slik(p); }).catch(function () {});
      return;
    }
    if (d.kind === 'ice') {
      if (p.pc.remoteDescription) { try { p.pc.addIceCandidate(d.payload); } catch (e) {} }
      else p.wachtrij.push(d.payload);
    }
  }

  /* ---- starten en stoppen ---- */
  function start(opties) {
    api = opties.api; meld = opties.meld; kamer = opties.kamer; ik = opties.ik; opWeg = opties.opWeg;
    $('#lobby').style.display = 'none';
    $('#kamer').style.display = 'flex';
    $('#tegels').innerHTML = '';
    /* Een trage toestemmingsvraag mag de kamer niet op een leeg scherm laten
       wachten. Code, deelnemers en de eigen tegel zijn direct bruikbaar; beeld
       en geluid sluiten aan zodra de browser klaar is. */
    var eigen = tegel(ik);
    lijst();
    return haalIce().then(function () {
      /* shared/media.js zegt WAAROM het niet gaat. Zonder die reden bleef hier
         een stille null over en zag de gebruiker alleen een lege tegel -- de
         kamer werkte, alleen wist niemand waarom hij zelf niet in beeld kwam. */
      return window.RTGMedia.vraag({ audio: true, video: true }, { stil: true })
        .then(function (s) { return { stroom: s, waarom: null }; },
              function (e) { return { stroom: null, waarom: e }; });
    }).then(function (uit) {
      stream = uit.stroom;
      var r = uit.waarom && uit.waarom.rtg;
      if (stream) eigen.srcObject = stream;
      else meld((r ? r.kort : 'Geen camera of microfoon') +
        '; u kijkt en luistert niet mee, de kamer ziet u wel.' + (r ? ' ' + r.uitleg : ''));
      // ik ben de nieuwkomer: ik bel iedereen die er al zit, nu mijn media klaar is
      (kamer.aanwezig || []).forEach(function (naam) {
        if (naam === ik || peers[naam]) return;
        tegel(naam);
        verbind(naam);
      });
      lijst();
    });
  }
  function stop() {
    Object.keys(peers).forEach(sluit);
    stopScherm();
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
    if (kamer) api('verlaat', { id: kamer.id }).catch(function () {});
    kamer = null;
    $('#kamer').style.display = 'none';
    $('#lobby').style.display = '';
    if (opWeg) opWeg();
  }
  $('#knopMic').addEventListener('click', function () {
    var t = stream && stream.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; this.classList.toggle('uit', !t.enabled); }
  });
  $('#knopCam').addEventListener('click', function () {
    var t = stream && stream.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; this.classList.toggle('uit', !t.enabled); }
  });
  $('#knopScherm').addEventListener('click', deelScherm);
  $('#knopHand').addEventListener('click', function () {
    Object.keys(peers).forEach(function (naam) { sein(naam, 'hand', {}); });
    meld('U steekt de hand op.');
  });
  $('#knopWeg').addEventListener('click', stop);

  window.RTGMeetKamer = { start: start, stop: stop, opSein: opSein, actief: function () { return !!kamer; } };
})();
