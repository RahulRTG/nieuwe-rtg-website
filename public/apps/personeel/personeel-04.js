    if (pdBordenUI) { pdBordenUI.refresh(); return; }
    pdBordenUI = BordenUI.mount(wrap, {
      laad: () => API.call('/supplier/borden'),
      doe: b => API.call('/supplier/bord', b),
      teamleden: () => (state && state.staff || []).map(m => ({ id: m.id, name: m.name })),
      kanBeheren: () => !!(me && me.role === 'manager'),
      T, toast
    });
  }
  async function refresh(){ try { state = (await API.call('/supplier/state')).state; await laadZaken(); renderAll(); } catch(e){} }

  // eigen personeelszaken: kloktijden, verlofaanvragen en de vertrouwenslijn
  let zaken = null;
  let pdContracten = [];
  let aandacht = null;   // gasten die aandacht vragen + te lang stille tafels
  let netwerk = [];      // verbindingen met andere zaken (personeelsnetwerk)
  let trainData = null;  // training & tips: tip van de dag, rol-tips, eigen tips
  let coachAntwoord = null; // laatste antwoord van de AI-coach
  let tipsOpen = false;     // toon de volledige tip-lijst
  let coachRef = null;      // coaching voor een concrete tafel/bestelling
  let coachRefTafel = null; // leesbare naam van die tafel
  let wisselOpties = []; // verbonden zaken waar dit personeelslid ook op het rooster staat
  let mijnPosities = []; // eigen werkplekken (RTG-account) om tussen te wisselen na 1x aanmelden
  async function laadZaken(){
    try { zaken = await API.call('/staff/mine', {}); } catch(e){ zaken = null; }
    try { wisselOpties = (await API.call('/supplier/wissel/opties', {})).opties || []; } catch(e){ wisselOpties = []; }
    try { mijnPosities = (await API.call('/supplier/mijn/opties', {})).posities || []; } catch(e){ mijnPosities = []; }
    try { pdContracten = (await API.call('/supplier/contracten', {})).contracten || []; } catch(e){ pdContracten = []; }
    try { aandacht = await API.call('/supplier/aandacht', {}); } catch(e){ aandacht = null; }
    try { netwerk = (await API.call('/supplier/net/lijst', {})).verbindingen || []; } catch(e){ netwerk = []; }
    try { trainData = await API.call('/supplier/training', {}); } catch(e){ trainData = null; }
  }

  // Blijf ingelogd: met een bewaard token direct naar Vandaag, zonder PIN.
  async function restoreSession(){
    let t = null, c = null;
    try { t = localStorage.getItem('rtg_pda_token'); c = localStorage.getItem('rtg_pda_code'); } catch(e){}
    if (!t || !c || !BEDRIJVEN[c]) return;
    // de PDA staat vast op een bedrijf: een sessie van een ander bedrijf herstellen we niet
    const vast = pdaBedrijf();
    if (vast && vast !== c){ try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e){} return; }
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      if (!st.actor || !st.actor.staffId){ API.token = null; return; } // alleen persoonlijke logins herstellen
      state = st; code = c;
      me = { name: st.actor.name, role: st.actor.role, staffId: st.actor.staffId };
      week = await API.call('/supplier/schedule', {}).catch(()=>null);
      enter();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e2){}
    }
  }

  function myShift(dayIndex){
    if (!week) return null;
    const d = week.days[dayIndex]; if (!d) return null;
    const m = d.staff.find(x => x.id === me.staffId);
    return m ? m.shift : null;
  }
  function taskList(){
    const t = [];
    (state.tickets||[]).filter(x=>x.status!=='klaar').forEach(x => t.push({ icon:'🔧', b:x.text, s:(x.room?x.room+' · ':'')+(x.status==='bezig'?T('pd.busy','wordt opgepakt'):T('pd.open','open')), kind:'ticket', id:x.id, status:x.status }));
    (state.rooms||[]).filter(r=>r.hk&&r.hk.status==='vuil').forEach(r => t.push({ icon:'🧹', b:r.name, s:T('pd.toclean','schoonmaken'), kind:'hk', id:r.id }));
    if (state.minibar){
      (state.rooms||[]).map(r=>r.name).filter(n=>!state.minibar.countedToday.includes(n)).forEach(n => t.push({ icon:'🧊', b:T('pd.minibar','Minibar tellen')+': '+n, s:T('pd.inapp','via de bedrijfsapp'), kind:'info' }));
    }
    (state.orders||[]).filter(o=>o.status==='nieuw').forEach(o => t.push({ icon:'🛎️', b:T('pd.order','Nieuwe bestelling')+' '+o.customerCodename, s:eur(o.total)+' · code '+o.pickup, kind:'info' }));
    (state.rides||[]).filter(r=>r.status==='aangevraagd').forEach(r => t.push({ icon:'🚗', b:T('pd.ride','Ritaanvraag')+' '+r.customerCodename, s:(r.from||'')+' → '+(r.to||''), kind:'info' }));
    (state.guestChats||[]).filter(c=>c.unread).forEach(c => t.push({ icon:'💬', b:c.codename+' ('+c.dept+')', s:c.last, kind:'info' }));
    return t;
  }

  // de voorspeller op de PDA: het team ziet de piek van morgen aankomen
  let vwPda = null, vwPdaBezig = false;
  function laadVwPda(){
    if (vwPdaBezig || vwPda) return;
    vwPdaBezig = true;
    API.call('/staff/voorspel', {}).then(d => { vwPda = d; renderToday(); })
      .catch(() => {}).finally(() => { vwPdaBezig = false; });
  }
  function renderToday(){
    const shift = myShift(0);
    const tasks = taskList();
    $('#todaySub').textContent = new Date().toLocaleDateString(lang()==='en'?'en-GB':'nl-NL', { weekday:'long', day:'numeric', month:'long' });
    const klok = zaken && zaken.klok;
    $('#todayWrap').innerHTML =
      '<div class="card"><div class="k">'+T('pd.myshift','Uw dienst vandaag')+'</div><div class="shift-big">'+(shift||T('pd.noshift','Geen dienst'))+'</div>'+
      (klok ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.8rem;margin-top:0.7rem;padding-top:0.7rem;border-top:1px solid var(--line);">'+
        '<span style="font-size:0.76rem;color:var(--soft);">⏱ '+T('pd.k.vandaag','Vandaag')+' <b style="color:var(--txt);">'+klok.vandaagUren+' u</b> · '+T('pd.k.week','deze week')+' <b style="color:var(--txt);">'+klok.weekUren+' u</b></span>'+
        '<button class="abtn'+(klok.open?'':' ghost')+'" id="klokBtn">'+(klok.open?'⏹ '+T('pd.k.uit','Klok uit'):'▶ '+T('pd.k.in','Klok in'))+'</button></div>' : '')+
      '</div>'+
      '<div class="card"><div class="k">'+T('pd.tasksnow','Nu aandacht nodig')+' ('+tasks.length+')</div>'+
      (tasks.length ? tasks.slice(0,6).map(t=>'<div class="task"><span class="ic">'+t.icon+'</span><div class="t"><b>'+esc(MTX(t.b))+'</b><span>'+esc(MTX(t.s))+'</span></div></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--green);">✓ '+T('pd.alldone','Alles is bij.')+'</div>')+
      (tasks.length>6?'<div style="margin-top:0.5rem;font-size:0.74rem;color:var(--soft);">+'+(tasks.length-6)+' '+T('pd.more','meer onder Taken')+'</div>':'')+'</div>'+
      (vwPda && vwPda.ok && vwPda.morgen
        ? '<div class="card"><div class="k">🔮 '+T('pd.vw','Morgen verwacht')+'</div>'+
          '<div style="margin-top:0.4rem;font-size:0.8rem;line-height:1.55;color:var(--soft);">'+
          '~<b style="color:var(--txt);">'+vwPda.morgen.verwachtTransacties+'</b> '+T('pd.vw.trans','transacties')+' ('+vwPda.morgen.dagNaam+')'+
          (vwPda.morgen.drukUren.length ? ' · '+T('pd.vw.piek','piek rond')+' '+vwPda.morgen.drukUren.map(u=>u.uur+':00').join(', ') : '')+
          '<br>'+esc(vwPda.morgen.advies||'')+'</div></div>'
        : '');
    laadVwPda();
    // Service op sterrenniveau: gasten die aandacht vragen en te lang stille
    // tafels staan bovenaan, zodat niemand ooit wordt vergeten.
    const A = (aandacht && aandacht.aandacht) || [], TT = (aandacht && aandacht.traagTafels) || [];
    if (A.length || TT.length){
      let h = '<div class="card" style="border-color:var(--gold);"><div class="k" style="color:var(--gold);">'+T('pd.attn','Aandacht gevraagd')+' ('+(A.length+TT.length)+')</div>';
      h += A.map(a => '<div class="task"><span class="ic">🔔</span><div class="t"><b>'+esc(a.reden)+(a.tafel?' · '+esc(a.tafel):'')+'</b><span>'+esc(a.codename)+' · '+timeAgo(a.at)+'</span></div><button class="abtn" data-aankl="'+a.id+'">'+T('pd.help','Help')+'</button></div>').join('');
      h += TT.map(t => '<div class="task"><span class="ic">⏳</span><div class="t"><b>'+esc(t.tafel||t.ref)+'</b><span>'+esc(t.codename)+' · '+t.minuten+' min '+T('pd.waiting','zonder aandacht')+'</span></div><button class="abtn ghost" data-coachref="'+esc(t.ref)+'" data-coachtafel="'+esc(t.tafel||t.ref)+'" title="'+T('pd.tr.coachtable','Vraag de coach over deze tafel')+'">🎓</button></div>').join('');
      h += '</div>';
      $('#todayWrap').insertAdjacentHTML('afterbegin', h);
      document.querySelectorAll('[data-aankl]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/supplier/aandacht/klaar', { id:b.dataset.aankl }); toast(T('pd.helped','Gast geholpen.')); await refresh(); openTab('vandaag'); } catch(e){ toast(e.message); }
      }));
      document.querySelectorAll('[data-coachref]').forEach(b => b.addEventListener('click', () => {
        coachRef = b.dataset.coachref; coachRefTafel = b.dataset.coachtafel; coachAntwoord = null;
        renderHulp(); openTab('hulp');
        const inp = document.getElementById('coachVraag'); if (inp) inp.focus();
      }));
    }
    const kb = document.getElementById('klokBtn');
    if (kb) kb.addEventListener('click', async () => {
      kb.disabled = true;
      try {
        const d = await API.call('/staff/clock', {});
        if (zaken) zaken.klok = d.klok;
        toast(d.actie === 'in' ? '▶ ' + T('pd.k.ingeklokt','Ingeklokt. Werk ze!') : '⏹ ' + T('pd.k.uitgeklokt','Uitgeklokt. Tot de volgende dienst.'));
        renderToday();
      } catch(e){ toast(e.message); kb.disabled = false; }
    });
    // geaccrediteerd wisselen: wie ook bij een verbonden zaak op het rooster
    // staat, stapt met een tik over, zonder opnieuw een PIN in te voeren
