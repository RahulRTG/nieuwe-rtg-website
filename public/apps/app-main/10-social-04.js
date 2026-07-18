    const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls:'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
    pc.onicecandidate = ev => { if (ev.candidate && call) API.call('/member/call', { toKey: call.withKey, kind: 'ice', payload: ev.candidate }).catch(()=>{}); };
    pc.ontrack = ev => {
      const v = $('#csRemote');
      if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && call && !call.t0){ call.t0 = Date.now(); call.timer = setInterval(belTimer, 1000); }
      if (pc.connectionState === 'failed'){ toast(T('sal.belmislukt','Verbinding mislukt. Op een streng netwerk lukt bellen soms niet.')); eindeGesprek(false); }
      else if (pc.connectionState === 'closed') eindeGesprek(false);
    };
    call.pc = pc;
    window.__rtgCall = () => call; // voor tests
    return pc;
  }
  async function pakMedia(video){
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }); }
    catch(e){ toast(T('sal.geenmedia','Geen toegang tot microfoon of camera.')); return null; }
  }
  function toonGesprek(naam, video){
    $('#csNaam').textContent = naam; $('#csNaam2').textContent = naam;
    $('#csAv').textContent = initCN(naam);
    $('#csAudioOnly').style.display = video ? 'none' : 'flex';
    $('#csLocal').style.display = video ? '' : 'none';
    $('#csCam').style.display = video ? '' : 'none';
    $('#csTijd').textContent = T('sal.belt','gaat over…');
    belUI(true);
  }
  async function beginGesprek(video){
    if (!dmWith) return;
    if (call){ toast(T('sal.algesprek','Er loopt al een gesprek.')); return; }
    await haalIce();
    const stream = await pakMedia(video);
    if (!stream) return;
    call = { withKey: dmWith, naam: dmNaam, video, richting: 'uit', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(dmNaam, video);
    try { await API.call('/member/call', { toKey: call.withKey, kind: 'ring', video }); }
    catch(e){ toast(e.message); eindeGesprek(false); }
  }
  $('#dmBel').addEventListener('click', () => beginGesprek(false));
  $('#dmVideo').addEventListener('click', () => beginGesprek(true));
  $('#dmBlok').addEventListener('click', async () => {
    if (!dmWith) return;
    const keuze = prompt('Wat wil je doen met ' + dmNaam + '?\n\n1 = Blokkeren\n2 = Melden\n3 = Blokkeren en melden', '1');
    if (keuze === null) return;
    try {
      if (keuze === '2' || keuze === '3') { const reden = prompt('Wat is er aan de hand?', '') || ''; await API.call('/member/report', { key: dmWith, reden }); }
      if (keuze === '1' || keuze === '3') { await API.call('/member/block', { key: dmWith }); $('#dm-sheet').classList.remove('open'); loadSocial(); }
      toast(keuze === '2' ? T('sal.gemeld', 'Bedankt, je melding is doorgegeven.') : T('sal.geblokkeerd', 'Geblokkeerd.'));
    } catch (e) { toast(e.message); }
  });

  async function neemOp(){
    $('#callIncoming').classList.remove('open');
    if (!inkomend) return;
    await haalIce();
    const stream = await pakMedia(inkomend.video);
    if (!stream){ API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{}); inkomend = null; return; }
    call = { withKey: inkomend.from, naam: inkomend.codename, video: inkomend.video, richting: 'in', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(inkomend.codename, inkomend.video);
    await API.call('/member/call', { toKey: call.withKey, kind: 'accept' }).catch(()=>{});
    inkomend = null;
  }
  $('#ciJa').addEventListener('click', neemOp);
  $('#ciNee').addEventListener('click', () => {
    $('#callIncoming').classList.remove('open');
    if (inkomend) API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{});
    inkomend = null;
  });

  function eindeGesprek(zeggen){
    if (!call) { belUI(false); return; }
    if (zeggen) API.call('/member/call', { toKey: call.withKey, kind: 'hangup' }).catch(()=>{});
    clearInterval(call.timer);
    try { call.stream.getTracks().forEach(t => t.stop()); } catch(e){}
    try { if (call.pc) call.pc.close(); } catch(e){}
    call = null;
    belUI(false);
  }
  $('#csWeg').addEventListener('click', () => eindeGesprek(true));
  $('#csMute').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csMute').classList.toggle('dicht', !t.enabled);
  });
  $('#csCam').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csCam').classList.toggle('dicht', !t.enabled);
  });

  async function flushIce(){
    if (!call || !call.pc || !call.pc.remoteDescription) return;
    for (const c of call.pendingIce.splice(0)) { try { await call.pc.addIceCandidate(c); } catch(e){} }
  }
  async function opBelsignaal(d){
    if (d.kind === 'ring'){
      if (call){ API.call('/member/call', { toKey: d.from, kind: 'busy' }).catch(()=>{}); return; }
      inkomend = { from: d.from, codename: d.codename, video: d.video };
      $('#ciAv').textContent = initCN(d.codename);
      $('#ciNaam').textContent = d.codename;
      $('#ciSoort').textContent = d.video ? T('sal.videogesprek','Videogesprek') : T('sal.spraakoproep','Spraakoproep');
      $('#callIncoming').classList.add('open');
      return;
    }
    if (!call || d.from !== call.withKey) return;
    if (d.kind === 'accept'){
      const pc = maakPc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      API.call('/member/call', { toKey: call.withKey, kind: 'offer', payload: offer }).catch(()=>{});
    } else if (d.kind === 'offer'){
      const pc = maakPc();
      await pc.setRemoteDescription(d.payload);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      API.call('/member/call', { toKey: call.withKey, kind: 'answer', payload: answer }).catch(()=>{});
    } else if (d.kind === 'answer'){
      await call.pc.setRemoteDescription(d.payload);
      await flushIce();
    } else if (d.kind === 'ice'){
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(d.payload); } catch(e){} }
      else call.pendingIce.push(d.payload);
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy'){
      toast(d.kind === 'busy' ? T('sal.bezet','In gesprek.') : d.kind === 'decline' ? T('sal.geweigerd','Oproep geweigerd.') : T('sal.opgehangen','Gesprek beëindigd.'));
      eindeGesprek(false);
    }
  }

  function opSociaal(d){
    if (d.kind === 'request'){ toast('🤝 ' + d.from + ' ' + T('sal.wilverbinden','wil verbinden')); loadSocial(); }
    else if (d.kind === 'accepted'){ toast('🤝 ' + d.by + ' ' + T('sal.accepteerde','accepteerde uw verzoek')); loadSocial(); }
    else if (d.kind === 'dm'){
      if (dmWith === d.from && $('#dm-sheet').classList.contains('open')){
        dmToevoegen({ from: d.from, text: d.text, post: d.post, at: d.at });
        API.call('/member/dm', { withKey: d.from }).catch(()=>{}); // gelezen
      } else {
        toast('💬 ' + d.codename + ': ' + (d.text || '↗').slice(0, 60));
        loadSocial();
      }
    }
  }


  /* seam voor de RTG OS-laag: de eigen Bellen-, Videobellen- en Snaps-apps
     openen hiermee een kiezer en starten dan direct het gesprek of de snap */
  window.RTGSocial = {
    ok: () => socialOK,
    lijst: () => (social.connections || []),
    bel: (key, naam, video) => snelBel(key, naam, video),
    snap: key => snapKies(key)
  };
