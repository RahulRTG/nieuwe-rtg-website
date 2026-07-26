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
