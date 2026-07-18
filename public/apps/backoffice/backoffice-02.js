      const namen = dt.deelnemers.map(p => escHtml(p.codenaam) + (p.getekend ? ' ✓' : ' ⌛')).join(' · ');
      const pos = dt.deelnemers.filter(p => p.pos).map(p => escHtml(p.codenaam) + ': ' + p.pos.lat.toFixed(4) + ', ' + p.pos.lng.toFixed(4)).join(' · ') || T('bo.ontgeenpos','nog geen locatie');
      const status = dt.status === 'noodgeval' ? '🚨 '+T('bo.ontnood','NOODGEVAL') : dt.status === 'actief' ? '🛰️ '+T('bo.ontactief','loopt') : '⌛ '+T('bo.onttekenen','wacht op tekenen');
      let sosBlok = '';
      if (nood) sosBlok = dt.sos.map(s =>
        '<div style="margin-top:0.4rem;background:rgba(220,40,40,0.12);border-radius:8px;padding:0.5rem 0.7rem;">'+
        '<b style="color:#ff8a8a;">🚨 '+escHtml(s.door)+'</b> · '+escHtml(s.bericht)+
        '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+
        '<button class="vbtn ok" data-live="'+dt.id+'" data-naam="'+escHtml(s.door)+'">📹 '+T('bo.ontlive','Live meekijken')+'</button>'+
        '<a class="vbtn" href="tel:112" style="text-decoration:none;background:#c62828;color:#fff;">'+T('bo.ont112','Bel 112')+'</a>'+
        '<button class="vbtn" data-sosaf="'+dt.id+'" data-sosid="'+s.id+'">'+T('bo.ontsosaf','SOS afgehandeld')+'</button>'+
        '</div></div>').join('');
      return '<div class="vrow" style="'+(nood?'border:1px solid #c62828;border-radius:12px;':'')+'"><div class="vi" style="width:100%;">'+
        '<div class="nm">'+dt.icon+' '+escHtml(dt.activiteitLabel)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+namen+'</span></div>'+
        '<div class="sub">'+status+' · 📍 '+pos+'</div>'+ sosBlok +'</div></div>';
    }).join('');
    el.querySelectorAll('[data-sosaf]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/ontmoeting/sos-af', { dateId: b.dataset.sosaf, sosId: b.dataset.sosid }); loadOntmoetingen(); } catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-live]').forEach(b => b.addEventListener('click', () => ontLiveWacht(b.dataset.live, b.dataset.naam)));
  }

  /* Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office-
     stream ('ontmoeting-signaal'); wij openen het beeld en antwoorden terug. */
  let ontPc = null, ontLiveDate = null, ontIce = null;
  async function ontHaalIce(){ try { ontIce = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ ontIce = [{ urls:'stun:stun.l.google.com:19302' }]; } return ontIce; }
  function ontLiveWacht(dateId, naam){
    ontLiveDate = dateId;
    $('#ontLiveNaam').textContent = '🚨 ' + naam;
    $('#ontLiveStatus').textContent = T('bo.ontwacht','Wachten op het camerabeeld van het lid…');
    $('#ontLiveVid').srcObject = null;
    $('#ontLiveScrim').style.display = 'flex';
  }
  function ontLiveSluit(){
    $('#ontLiveScrim').style.display = 'none';
    if (ontPc){ try { ontPc.close(); } catch(e){} ontPc = null; }
    ontLiveDate = null;
  }
  async function opOntSignaal(d){
    if (!d || !d.payload || (ontLiveDate && d.dateId !== ontLiveDate)) return;
    // een nieuw aanbod: open het scherm als dat nog niet openstaat
    if (d.payload.sdp && d.payload.sdp.type === 'offer'){
      ontLiveDate = d.dateId;
      if ($('#ontLiveScrim').style.display !== 'flex'){ $('#ontLiveNaam').textContent = '🚨 ' + (d.codenaam||'SOS'); $('#ontLiveScrim').style.display = 'flex'; }
      await ontHaalIce();
      if (ontPc){ try { ontPc.close(); } catch(e){} }
      ontPc = new RTCPeerConnection({ iceServers: ontIce || [{ urls:'stun:stun.l.google.com:19302' }] });
      ontPc.ontrack = e => { $('#ontLiveVid').srcObject = e.streams[0]; $('#ontLiveStatus').textContent = T('bo.ontlivenu','Live beeld en geluid van het lid.'); };
      ontPc.onicecandidate = e => { if (e.candidate) call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { ice: e.candidate } }).catch(()=>{}); };
      await ontPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      const ans = await ontPc.createAnswer();
      await ontPc.setLocalDescription(ans);
      await call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { sdp: ontPc.localDescription } });
    } else if (d.payload.ice && ontPc){
      try { await ontPc.addIceCandidate(new RTCIceCandidate(d.payload.ice)); } catch(e){}
    }
  }
  document.getElementById('ontLiveClose').addEventListener('click', ontLiveSluit);

  let convData = [], convUser = null;
  async function loadConcierge(){
    try { convData = (await call('/office/conversations')).conversations || []; } catch(e){ return; }
    $('#concierge').innerHTML = convData.length ? convData.map(c =>
      '<div class="vrow" data-uid="'+c.userId+'"><div class="vi"><div class="nm">'+escHtml(c.codename)+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(c.tier)+'</span>'+
        (c.needsConcierge?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
        '<div class="sub">'+(c.lastFrom==='concierge'?'↩ ':'')+escHtml((c.last||'').slice(0,55))+'</div></div>'+
        '<button class="vbtn ok" data-open>'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.noconv','Nog geen gesprekken.')+'</div>';
    $('#concierge').querySelectorAll('.vrow').forEach(row =>
      row.querySelector('[data-open]').addEventListener('click', () => openThread(Number(row.dataset.uid))));
    if (convUser && $('#convScrim').classList.contains('open')) openThread(convUser);
  }
  // Vertrouwenslijn: personeel van partners bereikt hier vertrouwelijk de
  // vertrouwenspersoon van RTG; de werkgever ziet deze gesprekken nooit.
  let trustData = [], trustId = null;
  async function loadTrust(){
    try { trustData = (await call('/office/trust')).threads || []; } catch(e){ return; }
    $('#trustList').innerHTML = trustData.length ? trustData.map(t =>
      '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(t.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(t.company)+'</span>'+
      (t.open?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
      '<div class="sub">'+escHtml(((t.messages[t.messages.length-1]||{}).text||'').slice(0,55))+'</div></div>'+
      '<button class="vbtn ok" data-trust="'+t.id+'">'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.notrust','Geen berichten. De vertrouwenslijn is er voor het personeel van partners; werkgevers zien hier niets van.')+'</div>';
    $('#trustList').querySelectorAll('[data-trust]').forEach(b => b.addEventListener('click', () => openTrustThread(b.dataset.trust)));
    if (trustId && $('#convScrim').classList.contains('open')) openTrustThread(trustId);
  }
  function openTrustThread(id){
    const t = trustData.find(x => x.id === id); if (!t) return;
    trustId = id; convUser = null;
    $('#convWho').textContent = '🤝 ' + t.name + ' · ' + t.company;
    $('#convBody').innerHTML = t.messages.map(m =>
      '<div class="cmsg '+(m.from==='staff'?'in':'out')+'">'+escHtml(m.text)+'</div>').join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }

  function openThread(uid){
    const c = convData.find(x => x.userId === uid); if (!c) return;
    convUser = uid;
    trustId = null;
    $('#convWho').textContent = c.codename + ' · ' + c.tier;
    $('#convBody').innerHTML = c.messages.map(m =>
      '<div class="cmsg '+(m.from==='member'?'in':'out')+'">'+escHtml(m.text)+'</div>'
    ).join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }
  $('#convClose').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convScrim').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convReply').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('#convText').value.trim(); if (!t) return;
    if (trustId){
      try { await call('/office/trust/reply', { id: trustId, text: t }); $('#convText').value=''; await loadTrust(); openTrustThread(trustId); refresh(); }
      catch(e2){ alert(e2.message); }
      return;
    }
    if (!convUser) return;
    try { convData = (await call('/office/reply', { userId: convUser, text: t })).conversations || convData; $('#convText').value=''; openThread(convUser); loadConcierge(); }
    catch(e2){ alert(e2.message); }
  });

  function render(){
    const st2 = state.stats || {};
    const alerts = state.alerts || [];
    // globale zoekfilter: een veld dat door alle lijsten heen zoekt
    const q = (($('#zoekInp')||{}).value || '').trim().toLowerCase();
