/* de directe berichten: versturen en aan het gesprek toevoegen */
    $('#dmInput').value = '';
    try {
      const d = await API.call('/member/dm/send', { toKey: dmWith, text });
      dmToevoegen(d.message);
    } catch(e){ toast(e.message); }
  }
  $('#dmSend').addEventListener('click', stuurDm);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuurDm(); });
  // RTG-eigen emoji-kiezer bij de DM-invoer
  (function(){ const inp = $('#dmInput'); if (inp && inp.parentNode && window.RTGEmoji && !inp.parentNode.querySelector('.rtg-emo-knop')) { inp.parentNode.insertBefore(RTGEmoji.knop(inp), inp); } })();
  const dmDicht = () => { $('#dm-sheet').classList.remove('open'); $('#dm-scrim').classList.remove('open'); dmWith = null; };
  $('#dmClose').addEventListener('click', dmDicht);
  $('#rideGo').addEventListener('click', verstuurRit);
  $('#rideClose').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#ride-scrim').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#dm-scrim').addEventListener('click', dmDicht);

  /* ---- post delen ---- */
  let deelPost = null;
  function openShare(postId){
    if (!socialOK){ toast(T('sal.eerstlid','Alleen voor leden.')); return; }
    if (!(social.connections || []).length){ toast(T('sal.geenconn','Nog geen connecties. Voeg eerst iemand toe in De Salon.')); return; }
    deelPost = postId;
    $('#shareList').innerHTML = social.connections.map(c =>
      '<button class="sc-hit" style="width:100%;cursor:pointer;" data-deel="' + escT(c.key) + '"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(c.codename) + '</span><b>' + escT(c.codename) + '</b><span style="color:var(--rtg-leesgoud,var(--gold));font-size:0.72rem;">↗</span></button>'
    ).join('');
    $('#shareList').querySelectorAll('[data-deel]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/dm/send', { toKey: b.dataset.deel, postId: deelPost, text: '' });
        toast(T('sal.gedeeld','Gedeeld.'));
        $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open');
      } catch(e){ toast(e.message); }
    }));
    $('#share-sheet').classList.add('open'); $('#share-scrim').classList.add('open');
  }
  $('#shareClose').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });
  $('#share-scrim').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });

  /* ---- bellen en videobellen (WebRTC) ---- */
  let call = null;        // { pc, stream, withKey, naam, video, richting, pendingIce, timer, t0 }
  let inkomend = null;    // { from, codename, video }
  let csMee = null;       // de tekstbaan van het gesprek (shared/meelezen.js)

  /* MEELEZEN. Zonder tekstbaan kan wie doof is niet meedoen aan een gesprek in
     dit huis (TOEGANKELIJK.md). Getypt EN, waar een lokaal model draait,
     herkend uit de eigen stem -- zie /shared/meelezen.js en /shared/meeluister.js. */
  function csBaan(){
    if (csMee || !window.RTGMeelezen) return csMee;
    csMee = window.RTGMeelezen.maak({
      stroom: () => (call && call.stream) || null,
      stuur: r => {
        if (call) API.call('/member/call', { toKey: call.withKey, kind: 'tekst', payload: { r } }).catch(()=>{});
      } });
    csMee.el.style.cssText += 'position:absolute;left:12px;right:12px;bottom:96px;z-index:4;color:#F7F5F1;';
    const scherm = $('#callScreen'); if (scherm) scherm.appendChild(csMee.el);
    return csMee;
  }

  function belUI(open){
    $('#callScreen').classList.toggle('open', !!open);
    if (open) csBaan();
    if (!open){ $('#csRemote').srcObject = null; $('#csLocal').srcObject = null; if (csMee) csMee.leeg(); }
  }
  function belTimer(){
    if (!call) return;
    const s = Math.round((Date.now() - call.t0) / 1000);
    $('#csTijd').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  async function haalIce(){ try { iceConfig = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ iceConfig = [{ urls:'stun:stun.l.google.com:19302' }]; } return iceConfig; }
  function maakPc(){
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
    // shared/media.js noemt de oorzaak en plaatst de volle uitleg zelf
    try { return await RTGMedia.vraag({ audio: true, video: video ? { facingMode: 'user' } : false }); }
    catch(e){ toast((e.rtg && e.rtg.kort) || T('sal.geenmedia','Geen toegang tot microfoon of camera.')); return null; }
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
