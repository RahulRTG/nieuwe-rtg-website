      const commBtn = el.querySelector('.js-comm');
      commBtn.addEventListener('click', () => {
        if (commBtn.disabled) return;
        el.querySelector('.comments').classList.toggle('open');
      });
      el.querySelectorAll('.pa:disabled').forEach(b => {
        b.style.pointerEvents = 'auto';
        b.addEventListener('click', e => {
          e.preventDefault();
          toast(user.tier === 'rtg'
            ? T('app.salon.rtgnote','Met de RTG Pass reageert u met RTG-leden, of met wie u eerst aanspreekt.')
            : T('app.salon.nocomment','Reageren is hier niet beschikbaar.'));
        });
      });
      el.querySelector('.cform button').addEventListener('click', async () => {
        const inp = el.querySelector('.cform input');
        if (!inp.value.trim()) return;
        if (API.live){
          try { await API.call('/comment', {postId: post.id, text: inp.value.trim()}); }
          catch (e) { toast(e.message || T('app.salon.notallowed','Reageren niet toegestaan.')); return; }
        }
        post.comments.push({who: user.full, tier: user.tier, text: inp.value.trim()});
        const d = document.createElement('div');
        d.className = 'comment';
        d.innerHTML = '<b>' + user.full + '</b>, ' + inp.value.trim().replace(/</g, '&lt;');
        el.querySelector('.clist').appendChild(d);
        inp.value = '';
        commBtn.textContent = T('app.salon.comment','Reageren') + ' (' + post.comments.length + ')';
        toast(T('app.salon.posted','Reactie geplaatst.'));
      });
    });
  }

  /* ================= Salon-ontmoetingen (wederzijdse connecties in de buurt) =
     Elk lid zet dit zelf aan/uit. Aan: de app stuurt af en toe de positie mee;
     een verbonden vriend die ook aanstaat en vlakbij is levert een voorstel op.
     Beiden kiezen een activiteit (of niets = afwijzen); bij een match tekenen ze
     een veiligheidscontract, waarna RTG-kantoor live meekijkt tot het klaar is.
     Bij een SOS gaat de camera aan en kijkt kantoor mee (WebRTC). */
  let ontmoetState = null, ontmoetTimer = null, ontmoetSosPc = null, ontmoetSosDate = null, ontmoetPending = null;

  async function laadOntmoet(){
    const el = $('#ontmoetPaneel'); if (!el) return;
    if (!API.live || !user || !user.account){ el.style.display = 'none'; stopOntmoetTimer(); return; }
    try { ontmoetState = await API.call('/ontmoeten/state'); }
    catch(e){ el.style.display = 'none'; return; }
    renderOntmoet();
    beheerOntmoetTimer();
  }
  function stopOntmoetTimer(){ if (ontmoetTimer){ clearInterval(ontmoetTimer); ontmoetTimer = null; } }
  // terwijl de functie aanstaat (of er een afspraak loopt) periodiek de positie sturen
  function beheerOntmoetTimer(){
    const s = ontmoetState;
    const loopt = s && (s.aan || (s.dates && s.dates.some(d => d.status === 'actief' || d.status === 'noodgeval')));
    if (loopt && !ontmoetTimer){ ontmoetTick(); ontmoetTimer = setInterval(ontmoetTick, 20000); }
    else if (!loopt) stopOntmoetTimer();
  }
  function ontmoetPositie(){
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { maximumAge: 15000, timeout: 8000 });
    });
  }
  async function ontmoetTick(){
    const s = ontmoetState; if (!s) return;
    const pos = await ontmoetPositie();
    try {
      if (s.aan){ const r = await API.call('/ontmoeten/hier', pos || {}); ontmoetState = r.state; renderOntmoet(); }
      // live-positie voor lopende afspraken naar kantoor
      for (const d of (ontmoetState.dates || [])) if (d.status === 'actief' || d.status === 'noodgeval'){
        try { await API.call('/ontmoeten/hier-date', { dateId: d.id, lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined }); } catch(e){}
      }
    } catch(e){}
  }

  function ontmoetActBtns(voorstelId){
    return (ontmoetState.activiteiten || []).map(a =>
      '<button class="js-oa" data-v="' + voorstelId + '" data-a="' + a.id + '" style="flex:1;min-width:5.5rem;background:none;border:1px solid var(--gold);border-radius:12px;padding:0.6rem 0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;text-align:center;">' +
      '<span style="font-size:1.3rem;display:block;">' + a.icon + '</span><b style="font-size:0.78rem;">' + escT(a.label) + '</b>' +
      '<span style="display:block;font-size:0.6rem;color:var(--muted);">' + escT(a.tekst) + '</span></button>').join('');
  }
  function renderOntmoet(){
    const el = $('#ontmoetPaneel'); const s = ontmoetState;
    if (!s){ el.style.display = 'none'; return; }
    el.style.display = 'block';
    const kaart = (inner) => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.9rem 1rem;margin-bottom:0.8rem;background:rgba(255,255,255,0.02);">' + inner + '</div>';
    let h = '';
    // kop met aan/uit
    const uit = !s.aan;
    h += '<div style="display:flex;align-items:flex-start;gap:0.7rem;">' +
      '<span style="font-size:1.3rem;"></span>' +
      '<div style="flex:1;"><b style="font-size:0.9rem;">' + T('ont.titel','Ontmoetingen') + '</b>' +
      '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('ont.sub','Connecties die vlakbij zijn kunnen samen afspreken. Alleen jij bepaalt of dit aanstaat.') + '</span></div>' +
      (s.mag
        ? '<button id="ontToggle" role="switch" aria-checked="' + (s.aan ? 'true' : 'false') + '" style="flex-shrink:0;width:52px;height:30px;border-radius:999px;border:1px solid var(--gold);background:' + (s.aan ? 'var(--gold)' : 'none') + ';position:relative;cursor:pointer;" aria-label="' + T('ont.toggle','Ontmoetingen aan of uit') + '"><span style="position:absolute;top:3px;left:' + (s.aan ? '25px' : '3px') + ';width:22px;height:22px;border-radius:50%;background:' + (s.aan ? '#000' : 'var(--gold)') + ';transition:left .15s;"></span></button>'
        : '') +
      '</div>';
    if (!s.mag){
      h += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);border-top:1px solid var(--line);padding-top:0.6rem;">' + escT(s.reden || T('ont.magniet','Nog niet beschikbaar.')) + '</div>';
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    if (uit){
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    // lopende afspraken (tekenen / actief / noodgeval)
    let blokken = '';
    for (const d of (s.dates || [])){
      const metNaam = escT(d.met);
