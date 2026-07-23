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
      const el = ringUI('<div style="display:flex;justify-content:center;"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg></div><b style="display:block;margin-top:0.4rem;">' + esc(d.vanNaam) + '</b>' +
        '<div style="font-size:0.85rem;opacity:0.7;margin-top:0.3rem;">' + T('tc.belt', 'belt je (video)...') + '</div>' +
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
