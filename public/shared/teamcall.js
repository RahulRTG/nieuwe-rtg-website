/* De teamcall: echt (video)bellen op de werkvloer via WebRTC.

   - 1-op-1: bel een ingeklokte collega; het toestel rinkelt, aannemen of
     weigeren, daarna video en geluid rechtstreeks tussen de toestellen.
   - Groep: een gesprek per zaak (kamer "team"). Ieder toestel verbindt
     rechtstreeks met alle anderen (mesh, peer-to-peer); de kamer telt tot
     100 deelnemers. Het beeld loopt nooit over de server: die geeft alleen
     de signalen door (/api/staff/call, SSE-event "rtc").
     NB: mesh betekent dat elk toestel met iedereen verbindt; met heel veel
     video's tegelijk bepaalt het toestel zelf hoeveel het aankan.

   Gebruik (na inloggen):
     TeamCall.init({ API, mij: () => me, T, toast });
     src.addEventListener('rtc', TeamCall.event);
     TeamCall.bel(staffId, naam);   // 1-op-1 video
     TeamCall.groep();              // stap in de teamcall van de zaak */
(function (w) {
  'use strict';
  var doc = w.document;
  if (doc && doc.documentElement && !doc.documentElement.hasAttribute('data-ds') && !doc.getElementById('rtgDsRuntimeCss')) {
    var link = doc.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    doc.head.appendChild(link);
  }
  const MAX = 100;
  let API = null, mij = () => null, T = (k, nl) => nl, toast = () => {};
  let stream = null;                 // eigen camera en microfoon
  let peers = new Map();             // staffId -> { pc, naam, queue, el }
  let kamer = null;                  // 'team' in een groepsgesprek
  let mee = null;                    // de tekstbaan van het gesprek (shared/meelezen.js)
  let uitgaand = null;               // { naar, naam } zolang 1-op-1 overgaat
  let binnenkomend = null;           // { van, vanNaam } zolang het rinkelt
  let ice = null, timer = null, t0 = 0;

  function esc(x){ return String(x == null ? '' : x).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';'); }
  const zend = (kind, extra) => API.call('/staff/call', Object.assign({ kind, video: true }, extra || {})).catch(() => {});
  async function haalIce(){
    try { ice = (await API.call('/ice', {})).iceServers; }
    catch (e) { ice = [{ urls: 'stun:' + location.hostname + ':3478' }]; }
  }
  async function pakMedia(){
    if (stream) return stream;
    // shared/media.js noemt de oorzaak; de toast krijgt de korte regel en de
    // volle uitleg staat in de eigen melding van die laag.
    try { stream = await RTGMedia.camera({ voor: true, audio: true }); return stream; }
    catch (e) { toast((e.rtg && e.rtg.kort) || T('tc.geenmedia', 'Geen toegang tot camera of microfoon.')); return null; }
  }

  /* De gesprekspresentatie staat centraal in het bestaande Design System. */
  function overlay(){
    let el = document.getElementById('tcOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tcOverlay';
    el.className = 'ds-teamcall';
    el.innerHTML = '<div id="tcKop"></div><div id="tcGrid"></div>' +
      '<div id="tcBalk">' +
        '<button id="tcMic" aria-label="microfoon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3"/></svg></button>' +
        '<button id="tcCam" aria-label="camera"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg></button>' +
        '<button id="tcWeg" aria-label="ophangen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5c5.5-4.5 12.5-4.5 18 0l-2.6 3-3.4-1v-2a12 12 0 0 0-6 0v2l-3.4 1z"/><path d="M4.5 19.5l15-15"/></svg></button>' +
      '</div>';
    document.body.appendChild(el);
    // een gesprek gaat vóór: RTG Sound wijkt zolang de call loopt
    if (w.RTGGeluid) try { w.RTGGeluid.focus('teamcall', { exclusief: true }); } catch (e) {}
    el.querySelector('#tcWeg').addEventListener('click', einde);
    el.querySelector('#tcMic').addEventListener('click', ev => {
      const t = stream && stream.getAudioTracks()[0];
      if (t){ t.enabled = !t.enabled; ev.currentTarget.classList.toggle('uit', !t.enabled); }
    });
    el.querySelector('#tcCam').addEventListener('click', ev => {
      const t = stream && stream.getVideoTracks()[0];
      if (t){ t.enabled = !t.enabled; ev.currentTarget.classList.toggle('uit', !t.enabled); }
    });
    /* MEELEZEN. Een teamcall is beeld en geluid; wie doof is heeft zonder tekst
       alleen het beeld. De baan hangt onder de knoppenbalk in dezelfde overlay
       (shared/meelezen.js) -- getypt door mensen, niet uit spraak herkend. */
    if (w.RTGMeelezen && !mee){
      mee = w.RTGMeelezen.maak({ ik: (mij() || {}).name || 'Jij',
        stroom: () => stream,
        stuur: regel => {
        if (kamer) zend('tekst', { kamer, payload: { r: regel } });
        else peers.forEach((p, id) => zend('tekst', { staffId: id, payload: { r: regel } }));
      } });
      mee.el.classList.add('tc-meelezen');
      el.appendChild(mee.el);
    }
    // de eigen tegel (gedempt: je hoort jezelf niet)
    const eigen = document.createElement('div');
    eigen.className = 'tc-tegel';
    eigen.id = 'tcIk';
    eigen.innerHTML = '<video autoplay playsinline muted></video><span class="nm">' + esc((mij() || {}).name || '') + '</span>';
    el.querySelector('#tcGrid').appendChild(eigen);
    if (stream) eigen.querySelector('video').srcObject = stream;
    return el;
  }
  function kop(tekst){ const k = document.getElementById('tcKop'); if (k) k.textContent = tekst; }
  function klok(){
    const s = Math.round((Date.now() - t0) / 1000);
    const namen = [...peers.values()].map(p => p.naam.split(' ')[0]).join(', ');
    kop((kamer ? T('tc.team', 'Teamcall') + ' · ' + (peers.size + 1) + '/' + MAX : namen) + ' · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
  }
  function tegel(id, p){
    overlay();
    if (p.el) return p.el.querySelector('video');
    const d = document.createElement('div');
    d.className = 'tc-tegel';
    d.innerHTML = '<video autoplay playsinline></video><span class="nm">' + esc(p.naam) + '</span>';
    document.getElementById('tcGrid').appendChild(d);
    p.el = d;
    return d.querySelector('video');
  }

  /* ---------- de verbindingen (mesh) ---------- */
  function maakPeer(id, naam){
    const pc = new RTCPeerConnection({ iceServers: ice || [{ urls: 'stun:' + location.hostname + ':3478' }] });
    const p = { pc, naam: naam || ('#' + id), queue: [], el: null };
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = ev => { if (ev.candidate) zend('ice', { staffId: id, payload: ev.candidate, kamer }); };
    pc.ontrack = ev => { const v = tegel(id, p); if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0]; };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && !t0){ t0 = Date.now(); timer = setInterval(klok, 1000); }
      if (['failed', 'closed'].includes(pc.connectionState)) sluitPeer(id);
    };
    peers.set(id, p);
    return p;
  }
  async function verbind(id, naam){
    const p = peers.get(id) || maakPeer(id, naam);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    zend('offer', { staffId: id, payload: offer, kamer });
  }
  async function slikIce(p){
    while (p.queue.length && p.pc.remoteDescription){
      try { await p.pc.addIceCandidate(p.queue.shift()); } catch (e) {}
    }
  }
  function sluitPeer(id){
    const p = peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch (e) {}
    if (p.el) p.el.remove();
    peers.delete(id);
    if (!peers.size && !kamer) einde();
    else klok();
  }
  function einde(){
    if (kamer) zend('leave', { kamer });
    peers.forEach((p, id) => { if (!kamer) zend('hangup', { staffId: id }); try { p.pc.close(); } catch (e) {} });
    peers.clear();
    kamer = null; uitgaand = null; binnenkomend = null;
    clearInterval(timer); timer = null; t0 = 0;
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    const o = document.getElementById('tcOverlay'); if (o) o.remove();
    const r = document.getElementById('tcRing'); if (r) r.remove();
    if (w.RTGGeluid) try { w.RTGGeluid.losFocus('teamcall'); } catch (e) {}  // muziek mag weer terug
  }

  /* ---------- rinkelen (1-op-1) ---------- */
  function ringUI(html){
    let el = document.getElementById('tcRing');
    if (!el){ el = document.createElement('div'); el.id = 'tcRing'; el.className = 'ds-teamcall-ring'; document.body.appendChild(el); }
    el.innerHTML = '<div class="kaart">' + html + '</div>';
    return el;
  }
  function ringWeg(){ const el = document.getElementById('tcRing'); if (el) el.remove(); }
/* TeamCall-presentatie staat in het bestaande Design System. */
  /* ---------- de publieke knoppen ---------- */
  async function bel(staffId, naam){
    if (stream || kamer){ toast(T('tc.bezig', 'Er loopt al een gesprek.')); return; }
    await haalIce();
    if (!(await pakMedia())) return;
    try { await API.call('/staff/call', { kind: 'ring', staffId, video: true }); }
    catch (e) { toast(e.message); einde(); return; }
    uitgaand = { naar: staffId, naam };
    overlay();
    kop(esc(naam) + ' · ' + T('tc.gaat', 'gaat over...'));
  }
  async function groep(){
    if (stream && !kamer){ toast(T('tc.bezig', 'Er loopt al een gesprek.')); return; }
    if (kamer) return;
    await haalIce();
    if (!(await pakMedia())) return;
    kamer = 'team';
    overlay();
    kop(T('tc.team', 'Teamcall') + ' · 1/' + MAX + ' · ' + T('tc.wacht', 'wacht op collega’s...'));
    zend('join', { kamer });
  }

  /* ---------- binnenkomende signalen ---------- */
  async function event(e){
    let d;
    try { d = JSON.parse(e.data || '{}'); } catch (err) { return; }
    const me = mij();
    if (!me || d.van === me.staffId) return;
    if (d.naar != null && d.naar !== me.staffId) return;
    if (d.kind === 'ring'){
      if (stream || kamer){ zend('decline', { staffId: d.van }); return; }
      binnenkomend = { van: d.van, vanNaam: d.vanNaam };
      if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200]);
      const el = ringUI('<div class="tc-ring-icoon"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg></div><b class="tc-ring-naam">' + esc(d.vanNaam) + '</b>' +
        '<div class="tc-ring-uitleg">' + T('tc.belt', 'belt je (video)...') + '</div>' +
        '<div class="knoppen"><button class="ja" id="tcJa">' + T('tc.aan', 'Neem aan') + '</button><button class="nee" id="tcNee">' + T('tc.weiger', 'Weiger') + '</button></div>');
      el.querySelector('#tcJa').addEventListener('click', async () => {
        ringWeg();
        await haalIce();
        if (!(await pakMedia())){ zend('decline', { staffId: d.van }); binnenkomend = null; return; }
        overlay();
        kop(esc(d.vanNaam) + ' · ' + T('tc.verbinden', 'verbinden...'));
        zend('accept', { staffId: d.van });
      });
      el.querySelector('#tcNee').addEventListener('click', () => { ringWeg(); zend('decline', { staffId: d.van }); binnenkomend = null; });
      return;
    }
    if (d.kind === 'accept' && uitgaand && d.van === uitgaand.naar){
      kop(esc(uitgaand.naam) + ' · ' + T('tc.verbinden', 'verbinden...'));
      await verbind(d.van, uitgaand.naam);
      uitgaand = null;
      return;
    }
    if (d.kind === 'decline'){
      if (uitgaand && d.van === uitgaand.naar){ toast(T('tc.nee', 'Niet aangenomen.')); einde(); }
      return;
    }
    if (d.kind === 'join' && kamer && d.kamer === kamer){
      // een collega stapt de teamcall in: wie er al zit, verbindt met de nieuwkomer
      if (peers.size + 1 >= MAX) return;
      await verbind(d.van, d.vanNaam);
      return;
    }
    if (d.kind === 'offer' && stream){
      // een offer hoort bij mijn 1-op-1 (na accept) of bij mijn kamer
      if (d.kamer && d.kamer !== kamer) return;
      const p = peers.get(d.van) || maakPeer(d.van, d.vanNaam);
      await p.pc.setRemoteDescription(new RTCSessionDescription(d.payload));
      const answer = await p.pc.createAnswer();
      await p.pc.setLocalDescription(answer);
      zend('answer', { staffId: d.van, payload: answer, kamer });
      slikIce(p);
      return;
    }
    if (d.kind === 'answer'){
      const p = peers.get(d.van);
      if (p){ await p.pc.setRemoteDescription(new RTCSessionDescription(d.payload)); slikIce(p); }
      return;
    }
    if (d.kind === 'ice'){
      const p = peers.get(d.van);
      if (!p) return;
      if (p.pc.remoteDescription){ try { await p.pc.addIceCandidate(d.payload); } catch (err) {} }
      else p.queue.push(d.payload);
      return;
    }
    if (d.kind === 'tekst'){
      if (mee && d.payload && d.payload.r) mee.voed(d.payload.r, { wie: d.vanNaam || d.van, bron: 'mens' });
      return;
    }
    if (d.kind === 'hangup' || d.kind === 'leave'){
      sluitPeer(d.van);
      if (!peers.size && !kamer && stream) einde();
    }
  }

  w.TeamCall = {
    init(opties){ API = opties.API; mij = opties.mij; T = opties.T || T; toast = opties.toast || toast; },
    bel, groep, event,
    actief: () => !!stream
  };
})(window);
