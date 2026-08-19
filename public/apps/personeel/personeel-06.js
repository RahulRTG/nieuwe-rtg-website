/* de borden van dit personeelslid */
    const wrap = $('#pdBordenWrap');
    if (!wrap || !window.BordenUI) return;
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
  let horecaMissies = []; // persoonlijke chef-missies; de PDA is het verlengstuk
  let horecaOverdrachten = []; // pas van eigenaar na akkoord van de opvolger
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
    try { const hm = await API.call('/supplier/horeca/missions', {}); horecaMissies = hm.mijn || []; horecaOverdrachten = hm.overdrachten || []; } catch(e){ horecaMissies = []; horecaOverdrachten = []; }
  }
  // Blijf ingelogd: met een bewaard token direct naar Vandaag, zonder PIN.
  async function restoreSession(){
    let t = null, c = null;
    try { t = localStorage.getItem('rtg_pda_token'); c = localStorage.getItem('rtg_pda_code'); } catch(e){}
    if (!t || !geldigeBedrijfscode(c)) return;
    // de PDA staat vast op een bedrijf: een sessie van een ander bedrijf herstellen we niet
    const vast = pdaBedrijf();
    if (vast && vast !== c){ try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e){} return; }
    API.token = t;
    try {
      const st = (await API.call('/supplier/state')).state;
      if (!st.actor || !st.actor.staffId){ API.token = null; return; } // alleen persoonlijke logins herstellen
      onthoudBedrijf(st.supplier || { code: c, name: c });
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
    horecaMissies.filter(x=>x.status!=='klaar').forEach(x => t.push({ icon:'', b:x.titel,
      s:'Rahul · '+x.sectie+' · '+x.minuten+' min'+(x.status==='bezig'?' · bezig':'')+(x.prioriteit==='hoog'?' · PRIORITEIT':''),
      kind:'mission', id:x.id, status:x.status, detail:x.detail }));
    (state.tickets||[]).filter(x=>x.status!=='klaar').forEach(x => t.push({ icon:'', b:x.text, s:(x.room?x.room+' · ':'')+(x.status==='bezig'?T('pd.busy','wordt opgepakt'):T('pd.open','open')), kind:'ticket', id:x.id, status:x.status }));
    (state.rooms||[]).filter(r=>r.hk&&r.hk.status==='vuil').forEach(r => t.push({ icon:'', b:r.name, s:T('pd.toclean','schoonmaken'), kind:'hk', id:r.id }));
    if (state.minibar){
      (state.rooms||[]).map(r=>r.name).filter(n=>!state.minibar.countedToday.includes(n)).forEach(n => t.push({ icon:'', b:T('pd.minibar','Minibar tellen')+': '+n, s:T('pd.inapp','via de bedrijfsapp'), kind:'info' }));
    }
    (state.orders||[]).filter(o=>o.status==='nieuw').forEach(o => t.push({ icon:'', b:T('pd.order','Nieuwe bestelling')+' '+o.customerCodename, s:eur(o.total)+' · code '+o.pickup, kind:'info' }));
    (state.rides||[]).filter(r=>r.status==='aangevraagd').forEach(r => t.push({ icon:'', b:T('pd.ride','Ritaanvraag')+' '+r.customerCodename, s:(r.from||'')+' → '+(r.to||''), kind:'info' }));
    (state.guestChats||[]).filter(c=>c.unread).forEach(c => t.push({ icon:'', b:c.codename+' ('+c.dept+')', s:c.last, kind:'info' }));
    return t;
  }
