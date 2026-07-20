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
  const MAX = 100;
  let API = null, mij = () => null, T = (k, nl) => nl, toast = () => {};
  let stream = null;                 // eigen camera en microfoon
  let peers = new Map();             // staffId -> { pc, naam, queue, el }
  let kamer = null;                  // 'team' in een groepsgesprek
  let uitgaand = null;               // { naar, naam } zolang 1-op-1 overgaat
  let binnenkomend = null;           // { van, vanNaam } zolang het rinkelt
  let ice = null, timer = null, t0 = 0;

  function esc(x){ return String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  const zend = (kind, extra) => API.call('/staff/call', Object.assign({ kind, video: true }, extra || {})).catch(() => {});
  async function haalIce(){
    try { ice = (await (await fetch('/api/ice')).json()).iceServers; }
    catch (e) { ice = [{ urls: 'stun:' + location.hostname + ':3478' }]; }
  }
  async function pakMedia(){
    if (stream) return stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } }); return stream; }
    catch (e) { toast(T('tc.geenmedia', 'Geen toegang tot camera of microfoon.')); return null; }
  }

  /* ---------- de gespreks-UI: een raster van tegels ---------- */
  function stijl(){
    if (document.getElementById('tcStijl')) return;
    const s = document.createElement('style');
    s.id = 'tcStijl';
    s.textContent = '#tcOverlay{position:fixed;inset:0;z-index:300;background:#0A0A09;display:flex;flex-direction:column;}' +
      '#tcGrid{flex:1;display:grid;gap:6px;padding:6px;overflow:hidden;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));align-content:center;}' +
      '.tc-tegel{position:relative;background:#151312;border-radius:14px;overflow:hidden;min-height:120px;}' +
      '.tc-tegel video{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.tc-tegel .nm{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,0.55);color:#fff;font:600 0.7rem Inter,sans-serif;padding:0.2rem 0.55rem;border-radius:999px;}' +
      '#tcBalk{display:flex;align-items:center;justify-content:center;gap:0.8rem;padding:0.8rem calc(env(safe-area-inset-bottom,0px) + 0.4rem);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 0.8rem);}' +
      '#tcBalk button{width:3.2rem;height:3.2rem;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:#1B1817;color:#fff;font-size:1.15rem;cursor:pointer;}' +
      '#tcBalk button.uit{background:#7F1634;}#tcBalk #tcWeg{background:#C23A5E;border:none;}' +
      '#tcKop{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:0;right:0;text-align:center;color:#F4F1EC;font:500 0.85rem Inter,sans-serif;z-index:2;text-shadow:0 1px 6px rgba(0,0,0,0.6);}' +
      '#tcRing{position:fixed;inset:0;z-index:310;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;padding:2rem;}' +
      '#tcRing .kaart{background:#151312;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:1.6rem;max-width:320px;width:100%;text-align:center;color:#F4F1EC;font-family:Inter,sans-serif;}' +
      '#tcRing .knoppen{display:flex;gap:0.6rem;margin-top:1.1rem;}' +
      '#tcRing .knoppen button{flex:1;border:none;border-radius:999px;padding:0.7rem;font:600 0.85rem Inter,sans-serif;cursor:pointer;}' +
      '#tcRing .ja{background:#2E7D5B;color:#fff;}#tcRing .nee{background:#C23A5E;color:#fff;}';
    document.head.appendChild(s);
  }
  function overlay(){
    stijl();
    let el = document.getElementById('tcOverlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tcOverlay';
    el.innerHTML = '<div id="tcKop"></div><div id="tcGrid"></div>' +
      '<div id="tcBalk">' +
        '<button id="tcMic" aria-label="microfoon">🎙️</button>' +
        '<button id="tcCam" aria-label="camera">🎥</button>' +
        '<button id="tcWeg" aria-label="ophangen">📵</button>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('#tcWeg').addEventListener('click', einde);
    el.querySelector('#tcMic').addEventListener('click', ev => {
      const t = stream && stream.getAudioTracks()[0];
      if (t){ t.enabled = !t.enabled; ev.currentTarget.classList.toggle('uit', !t.enabled); }
    });
    el.querySelector('#tcCam').addEventListener('click', ev => {
      const t = stream && stream.getVideoTracks()[0];
      if (t){ t.enabled = !t.enabled; ev.currentTarget.classList.toggle('uit', !t.enabled); }
    });
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
  }

  /* ---------- rinkelen (1-op-1) ---------- */
  function ringUI(html){
    stijl();
    let el = document.getElementById('tcRing');
    if (!el){ el = document.createElement('div'); el.id = 'tcRing'; document.body.appendChild(el); }
    el.innerHTML = '<div class="kaart">' + html + '</div>';
    return el;
  }
  function ringWeg(){ const el = document.getElementById('tcRing'); if (el) el.remove(); }

  /* ---------- de publieke knoppen ---------- */
  async function bel(staffId, naam){
    if (stream || kamer){ toast(T('tc.bezig', 'Er loopt al een gesprek.')); return; }
    await haalIce();
