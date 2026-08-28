/* SchoolBel: bellen binnen de app, in het schoolkanaal. Voor de ouder (in de
   RTF-schoolapp) en de leraar (in de School Partner-app). Spraak loopt
   peer-to-peer (WebRTC, alleen audio); de server geeft louter de belsignalen
   door. Geen telefoonnummers nodig: alles blijft binnen het huis.
   Er loopt een TEKSTBAAN mee (shared/meelezen.js): dit gesprek is alleen geluid,
   dus wie doof is heeft hier zonder tekst niets -- er valt niet eens van te
   liplezen. Wat in die baan staat is getypt en niet uit spraak herkend.
   Gebruik: SchoolBel.start({ klasCode, gezin:{code,token} }) of
            SchoolBel.start({ klasCode, leraar:{token} });
            SchoolBel.bel('leraar' | gezinCode, 'naam voor op het scherm'). */
(function () {
  'use strict';
  var S = null, es = null, pc = null, stream = null, call = null, iceQ = [], iceConfig = null, mee = null;

  function post(body) {
    var b = Object.assign({ klasCode: S.klasCode }, S.gezin ? { code: S.gezin.code, token: S.gezin.token } : { leraarToken: S.leraar.token }, body || {});
    return fetch('/api/foundation/school/bel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function sein(kind, payload) { if (call) post({ naar: call.met, kind: kind, payload: payload || null }).catch(function () {}); }
  function haalIce() {
    if (iceConfig) return Promise.resolve(iceConfig);
    return fetch('/api/ice').then(function (r) { return r.json(); })
      .then(function (d) { iceConfig = d.iceServers || []; return iceConfig; })
      .catch(function () { iceConfig = []; return iceConfig; });
  }

  /* ---------- het belscherm (zelf ingespoten, huisstijl-donker) ---------- */
  function ui() {
    var el = document.getElementById('sbel');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'sbel';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Schoolgesprek');
    el.style.cssText = 'display:none;position:fixed;inset:auto 1rem 1rem 1rem;z-index:80;background:#151312;color:#F4F1EC;' +
      'border:1px solid rgba(255,255,255,.14);border-radius:0;padding:1rem;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif;';
    el.innerHTML = '<div id="sbelWie" style="font-weight:600;margin-bottom:.6rem;"></div>' +
      '<div style="display:flex;gap:.5rem;">' +
      '<button id="sbelNeem" type="button" style="display:none;flex:1;padding:.55rem;border:0;border-radius:0;background:#69B891;color:#0C0C0B;font:inherit;font-weight:600;cursor:pointer;">Opnemen</button>' +
      '<button id="sbelWeg" type="button" style="flex:1;padding:.55rem;border:0;border-radius:0;background:#7F1634;color:#fff;font:inherit;font-weight:600;cursor:pointer;">Ophangen</button></div>' +
      '<audio id="sbelAudio" autoplay></audio>';
    document.body.appendChild(el);
    /* DE TEKSTBAAN. Dit gesprek is ALLEEN GELUID -- er valt niet eens van te
       liplezen -- dus wie doof is heeft hier zonder tekst helemaal niets. De
       baan hangt IN het belvenster en niet ernaast; wat er staat is getypt door
       een mens, niet herkend uit spraak (zie de kop van shared/meelezen.js). */
    if (window.RTGMeelezen) {
      mee = window.RTGMeelezen.maak({ stuur: function (regel) { sein('tekst', { r: regel }); } });
      el.appendChild(mee.el);
    }
    el.querySelector('#sbelWeg').addEventListener('click', function () { sein('hangup'); stop(); });
    el.querySelector('#sbelNeem').addEventListener('click', neemOp);
    return el;
  }
  function toon(tekst, metNeem) {
    var el = ui();
    el.style.display = 'block';
    el.querySelector('#sbelWie').textContent = tekst;
    el.querySelector('#sbelNeem').style.display = metNeem ? 'block' : 'none';
  }
  function stop() {
    if (pc) { try { pc.close(); } catch (e) {} pc = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    call = null; iceQ = [];
    if (mee) mee.leeg();          // een volgend gesprek begint met een lege baan
    var el = document.getElementById('sbel'); if (el) el.style.display = 'none';
  }

  /* ---------- WebRTC (alleen audio; de kamer blijft binnen het huis) ---------- */
  function maakPc() {
    pc = new RTCPeerConnection({ iceServers: iceConfig || [] });
    pc.onicecandidate = function (e) { if (e.candidate) sein('ice', e.candidate); };
    pc.ontrack = function (e) { var a = document.getElementById('sbelAudio'); if (a) a.srcObject = e.streams[0]; };
    stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
    return pc;
  }
  function metMicrofoon(fn) {
    haalIce().then(function () { return window.RTGMedia.microfoon({ stil: true }); })
      .then(function (st) { stream = st; fn(); })
      .catch(function (e) {
        // de reden erbij: "geen microfoon" is bijna nooit wat er aan de hand is
        toon((e.rtg && e.rtg.kort) || 'Geen microfoon beschikbaar op dit toestel.', false);
        if (e.rtg) window.RTGMedia.meld(e);
        setTimeout(stop, 2500);
      });
  }
  function flushIce() { iceQ.forEach(function (c) { try { pc.addIceCandidate(c); } catch (e) {} }); iceQ = []; }
  function neemOp() {
    if (!call) return;
    toon('In gesprek met ' + call.naam, false);
    metMicrofoon(function () { sein('accept'); });
  }

  function opSignaal(d) {
    if (d.kind === 'ring') {
      if (call) { post({ naar: d.van.indexOf('gezin:') === 0 ? d.van.slice(6) : 'leraar', kind: 'hangup' }); return; }
      call = { met: d.van.indexOf('gezin:') === 0 ? d.van.slice(6) : 'leraar', naam: d.vanNaam, beller: false };
      toon(d.vanNaam + ' belt via de schoolapp', true);
    } else if (d.kind === 'accept' && call && call.beller) {
      toon('In gesprek met ' + call.naam, false);
      maakPc();
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o).then(function () { sein('offer', o); }); });
    } else if (d.kind === 'offer' && call) {
      maakPc();
      pc.setRemoteDescription(d.payload).then(flushIce).then(function () { return pc.createAnswer(); })
        .then(function (a) { return pc.setLocalDescription(a).then(function () { sein('answer', a); }); });
    } else if (d.kind === 'answer' && pc) {
      pc.setRemoteDescription(d.payload).then(flushIce);
    } else if (d.kind === 'ice') {
      if (pc && pc.remoteDescription) { try { pc.addIceCandidate(d.payload); } catch (e) {} }
      else iceQ.push(d.payload);
    } else if (d.kind === 'tekst') {
      /* Een meegetypte regel van de ander. Ook zonder lopend gesprek tonen we
         hem niet: dan is er geen venster en zou hij nergens landen. */
      if (mee && d.payload && d.payload.r) mee.voed(d.payload.r, { wie: d.vanNaam, bron: 'mens' });
    } else if (d.kind === 'hangup') {
      stop();
    }
  }

  window.SchoolBel = {
    start: function (opts) {
      S = opts;
      if (es) { try { es.close(); } catch (e) {} }
      var q = 'klasCode=' + encodeURIComponent(S.klasCode) + (S.gezin
        ? '&code=' + encodeURIComponent(S.gezin.code) + '&token=' + encodeURIComponent(S.gezin.token)
        : '&leraarToken=' + encodeURIComponent(S.leraar.token));
      es = new EventSource('/api/foundation/school/belkanaal?' + q);
      es.addEventListener('bel', function (e) { try { opSignaal(JSON.parse(e.data)); } catch (x) {} });
    },
    bel: function (naar, naam) {
      if (!S || call) return;
      call = { met: naar, naam: naam || (naar === 'leraar' ? 'de leraar' : naar), beller: true };
      toon('Bellen met ' + call.naam + '...', false);
      metMicrofoon(function () {
        post({ naar: naar, kind: 'ring' }).then(function (r) {
          if (r.error) { toon(r.error, false); setTimeout(stop, 2500); }
          else if (!r.bezorgd) { toon(call.naam + ' is nu niet in de app; probeer het straks nog eens.', false); setTimeout(stop, 3000); }
        });
      });
    },
    stop: stop
  };
})();
