/* de afspraken en hun status */
    for (const d of (s.dates || [])){
      const metNaam = escT(d.met);
      if (d.status === 'wacht-op-tekenen'){
        blokken += '<div class="s-1ygaeju">' +
          '<b class="s-2tvgiv">' +RTGGlyf.tekst(d.icon)+ ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div class="s-m8u63a">' + T('ont.tekenuitleg','Teken het veiligheidscontract om te starten. RTG-kantoor kijkt dan mee voor jullie veiligheid.') + '</div>' +
          '<pre class="s-n0q1ml">' + escT(d.contract) + '</pre>' +
          '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
          (d.ikTekende
            ? '<span style="flex:1;font-size:0.72rem;color:var(--rtg-leesgoud,var(--gold));align-self:center;">✓ ' + T('ont.jijtekende','Jij tekende. ') + (d.anderTekende ? '' : T('ont.wachtander','Wachten op ') + metNaam) + '</span>'
            : '<button class="js-oteken" data-d="' + d.id + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:0;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('ont.teken','Contract tekenen') + '</button>') +
          '<button class="js-ostop s-1xcc3mv" data-d="' + d.id + '">' + T('ont.annuleer','Annuleren') + '</button>' +
          '</div></div>';
      } else if (d.status === 'actief' || d.status === 'noodgeval'){
        const nood = d.status === 'noodgeval';
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;' + (nood ? 'background:rgba(220,40,40,0.08);border-radius:0;padding:0.7rem;' : '') + '">' +
          '<b class="s-2tvgiv">' +RTGGlyf.tekst(d.icon)+ ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div class="s-78xvax">' + T('ont.kijktmee','RTG-kantoor kijkt live mee voor jullie veiligheid, tot jullie afronden.') + '</div>' +
          (nood ? '<div class="s-qny34e">' + T('ont.noodloopt','Noodsignaal actief. Kantoor kijkt mee via je camera.') + '</div>' : '') +
          '<div style="display:flex;gap:0.5rem;">' +
          '<button class="js-osos" data-d="' + d.id + '" style="flex:1;background:#c62828;color:#fff;border:none;border-radius:0;padding:0.6rem;font-weight:700;font-family:inherit;cursor:pointer;">' + T('ont.sos','SOS') + '</button>' +
          '<button class="js-ostop s-1txy447" data-d="' + d.id + '">' + T('ont.afronden','Afronden') + '</button>' +
          '</div></div>';
      }
    }
    // open voorstellen
    let voors = '';
    for (const v of (s.voorstellen || [])){
      const metNaam = escT(v.met);
      voors += '<div class="s-1ygaeju">' +
        '<b class="s-2tvgiv">' + metNaam + ' ' + T('ont.indebuurt','is in de buurt') + '</b>';
      if (v.mijnKeuze){
        voors += '<div class="s-1dmjw6v">✓ ' + T('ont.jijkoos','Jij koos') + ' ' + escT((s.activiteiten.find(a => a.id === v.mijnKeuze) || {}).label || v.mijnKeuze) + '. ' + T('ont.wachtkeuze','Wachten op de keuze van ') + metNaam + '.</div>';
      } else {
        voors += '<div class="s-6yvbc8">' + T('ont.kiessamen','Kies samen. Niets doen betekent afwijzen.') + '</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' + ontmoetActBtns(v.id) + '</div>' +
          '<button class="js-oweiger s-1oqk5rc" data-v="' + v.id + '">' + T('ont.nietnu','Niet nu') + '</button>';
      }
      voors += '</div>';
    }
    if (!blokken && !voors) h += '<div class="s-czkj07">' + T('ont.aanuitleg','Staat aan. Zodra een connectie vlakbij is, verschijnt hier een voorstel.') + '</div>';
    el.innerHTML = kaart(h + blokken + voors);
    bindOntmoet();
  }
  function bindOntmoet(){
    const el = $('#ontmoetPaneel');
    const tg = el.querySelector('#ontToggle');
    if (tg) tg.addEventListener('click', async () => {
      const aan = !(ontmoetState && ontmoetState.aan);
      try { const r = await API.call('/ontmoeten/aan', { aan }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-oa').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, b.dataset.a)));
    el.querySelectorAll('.js-oweiger').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, 'afwijzen')));
    el.querySelectorAll('.js-oteken').forEach(b => b.addEventListener('click', () => ontmoetTeken(b.dataset.d)));
    el.querySelectorAll('.js-ostop').forEach(b => b.addEventListener('click', () => ontmoetStop(b.dataset.d)));
    el.querySelectorAll('.js-osos').forEach(b => b.addEventListener('click', () => ontmoetSos(b.dataset.d)));
  }
  async function ontmoetKies(voorstelId, keuze){
    try { const r = await API.call('/ontmoeten/kies', { voorstelId, keuze }); ontmoetState = r.state;
      if (r.status === 'gematcht') toast('' + T('ont.match','Match! Teken het contract om te starten.'));
      renderOntmoet();
    } catch(e){ toast(e.message); }
  }
  async function ontmoetTeken(dateId){
    if (!confirm(T('ont.tekenbevestig','Ik ben 18+ met een geverifieerd paspoort en ga akkoord met het veiligheidscontract: RTG-kantoor mag mijn live-locatie zien tot de afspraak klaar is, en bij SOS meekijken via de camera en 112 bellen.'))) return;
    try { const r = await API.call('/ontmoeten/teken', { dateId }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer();
      if (r.status === 'actief') toast('' + T('ont.gestart','Afspraak gestart. RTG kijkt mee voor jullie veiligheid.'));
    } catch(e){ toast(e.message); }
  }
  async function ontmoetStop(dateId){
    try { const r = await API.call('/ontmoeten/stop', { dateId }); ontmoetState = r.state; ontmoetSosStop(); renderOntmoet(); beheerOntmoetTimer(); }
    catch(e){ toast(e.message); }
  }
  async function ontmoetSos(dateId){
    const pos = await ontmoetPositie();
    try {
      await API.call('/ontmoeten/sos', { dateId, bericht: T('ont.sosbericht','Ik voel me niet veilig'), lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined });
      toast('' + T('ont.sosverstuurd','SOS verstuurd. RTG-kantoor is gewaarschuwd en kijkt mee.'));
      ontmoetSosLive(dateId);         // camera + microfoon naar kantoor
      try { window.location.href = 'tel:112'; } catch(e){}   // en direct de hulpdiensten
      await laadOntmoet();
    } catch(e){ toast(e.message); }
  }
  // WebRTC: stuur camera + microfoon naar RTG-kantoor (kantoor beantwoordt via SSE)
  async function ontmoetSosLive(dateId){
    if (ontmoetSosPc) return;
    try {
      await haalIce();
      const stream = await RTGMedia.camera({ achter: true, audio: true });
      const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
      ontmoetSosPc = pc; ontmoetSosDate = dateId;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate) API.call('/ontmoeten/signaal', { dateId, payload: { ice: e.candidate } }).catch(() => {}); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await API.call('/ontmoeten/signaal', { dateId, payload: { sdp: pc.localDescription } });
    } catch(e){ /* camera geweigerd of niet beschikbaar: de SOS zelf is al binnen */ }
  }
  function ontmoetSosStop(){
    if (ontmoetSosPc){ try { ontmoetSosPc.getSenders().forEach(s => s.track && s.track.stop()); ontmoetSosPc.close(); } catch(e){} ontmoetSosPc = null; ontmoetSosDate = null; }
  }
  // antwoord van RTG-kantoor op ons SOS-beeld (WebRTC-signaal)
  async function opOntmoetSignaal(d){
    if (!ontmoetSosPc || !d || d.dateId !== ontmoetSosDate || !d.payload) return;
    try {
      if (d.payload.sdp) await ontmoetSosPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      else if (d.payload.ice) await ontmoetSosPc.addIceCandidate(new RTCIceCandidate(d.payload.ice));
    } catch(e){}
  }

  /* ---------- taal gewijzigd: dynamische schermen opnieuw opbouwen ---------- */
  let renderedLanguage = lang();
  window.addEventListener('rtglang', async () => {
    const changed = renderedLanguage !== lang(); renderedLanguage = lang();
    if (!user || !API.live || !onbEl('onbGate').hidden) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset;
