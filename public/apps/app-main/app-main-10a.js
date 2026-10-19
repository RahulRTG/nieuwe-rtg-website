/* DE BELSIGNALEN VAN DE LIVE-VERBINDING (uit app-main-10.js geknipt op de 10 kB): ICE die vooruit liep, en de eerste helft van opBelsignaal; -11 gaat erin verder. */
  async function flushIce(){
    if (!call || !call.pc || !call.pc.remoteDescription) return;
    for (const c of call.pendingIce.splice(0)) { try { await call.pc.addIceCandidate(c); } catch(e){} }
  }
  async function opBelsignaal(d){
    if (d.kind === 'ring'){
      if (call){ API.call('/api/member/call', { toKey: d.from, kind: 'busy' }).catch(()=>{}); return; }
      inkomend = { from: d.from, codename: d.codename, video: d.video };
      $('#ciAv').textContent = initCN(d.codename);
      $('#ciNaam').textContent = d.codename;
      $('#ciSoort').textContent = d.video ? T('sal.videogesprek','Videogesprek') : T('sal.spraakoproep','Spraakoproep');
      $('#callIncoming').classList.add('open');
      const wie = inkomend; toonRand({kind:'incoming-call',name:d.codename}, () => inkomend === wie);
      return;
    }
    if (!call || d.from !== call.withKey) return;
