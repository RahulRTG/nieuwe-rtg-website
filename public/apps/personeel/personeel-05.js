    if (wisselOpties.length){
      $('#todayWrap').insertAdjacentHTML('beforeend',
        '<div class="card"><div class="k">'+T('pd.ws.h','Andere afdeling')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">'+T('pd.ws.sub','U bent hier ook geaccrediteerd; wisselen kan direct, uw inlog reist mee.')+'</div>'+
        wisselOpties.map(o => '<div class="task"><span class="ic">'+(BEDRIJVEN[o.code]?BEDRIJVEN[o.code].icon:'🏢')+'</span><div class="t"><b>'+esc(o.naam)+'</b><span>'+T('pd.ws.acc','Geaccrediteerd via het personeelsnetwerk')+'</span></div>'+
          '<button class="abtn" data-wissel="'+esc(o.code)+'">'+T('pd.ws.ga','Wissel')+'</button></div>').join('')+'</div>');
      document.querySelectorAll('[data-wissel]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const d = await API.call('/supplier/wissel', { code: b.dataset.wissel });
          try {
            localStorage.setItem('rtg_pda_token', d.token);
            localStorage.setItem('rtg_pda_code', d.supplier.code);
            localStorage.setItem('rtg_pda_bedrijf', d.supplier.code);
          } catch(e){}
          toast('🔁 ' + T('pd.ws.ok','Gewisseld naar') + ' ' + d.supplier.name);
          setTimeout(() => location.reload(), 400);
        } catch(e){ toast(e.message); b.disabled = false; }
      }));
    }
    // 1x aanmelden: wie met het eigen RTG-account is ingelogd en bij meer bedrijven
    // werkt, wisselt hier direct van werkplek. Inklokken doet u daar zelf, apart.
    const andere = (mijnPosities || []).filter(p => p.code !== code);
    if (andere.length){
      $('#todayWrap').insertAdjacentHTML('beforeend',
        '<div class="card"><div class="k">'+T('pd.mw.h','Mijn werkplekken')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">'+T('pd.mw.sub','U werkt bij meer bedrijven; wissel met één tik. U klokt daar zelf in.')+'</div>'+
        andere.map(p => '<div class="task"><span class="ic">'+(BEDRIJVEN[p.code]?BEDRIJVEN[p.code].icon:'🏢')+'</span><div class="t"><b>'+esc(p.naam)+'</b><span>'+esc(p.func || (p.manager?'Manager':T('pd.staff','Medewerker')))+'</span></div>'+
          '<button class="abtn" data-mijn="'+esc(p.code)+'">'+T('pd.ws.ga','Wissel')+'</button></div>').join('')+'</div>');
      document.querySelectorAll('[data-mijn]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const d = await API.call('/supplier/mijn/wissel', { code: b.dataset.mijn });
          toast('🔁 ' + T('pd.ws.ok','Gewisseld naar') + ' ' + d.supplier.name);
          await landMijn(d); openTab('vandaag');
        } catch(e){ toast(e.message); b.disabled = false; }
      }));
    }
  }

  function renderRooster(){
    if (!week){ $('#roosterWrap').innerHTML = ''; return; }
    $('#roosterWrap').innerHTML = week.days.map((d,i) =>
      '<div class="rooster-day"><div class="dh">'+d.label+' · '+d.date.slice(8,10)+'-'+d.date.slice(5,7)+'</div>'+
      d.staff.map(m => '<div class="rrow'+(m.id===me.staffId?' me':'')+'"><b>'+esc(m.name)+(m.id===me.staffId?' ('+T('pd.you','u')+')':'')+'</b><span>'+m.shift+'</span></div>').join('')+
      '</div>'
    ).join('');
  }

  function renderTaken(){
    const tasks = taskList();
    $('#takenWrap').innerHTML = '<div class="card">'+(tasks.length ? tasks.map(t => {
      let act = '';
      if (t.kind==='ticket') act = t.status==='open'
        ? '<button class="abtn" data-tk="'+t.id+'" data-st="bezig">'+T('pd.pickup','Oppakken')+'</button>'
        : '<button class="abtn" data-tk="'+t.id+'" data-st="klaar">'+T('pd.done','Klaar')+'</button>';
      if (t.kind==='hk') act = '<button class="abtn" data-hk="'+t.id+'">'+T('pd.clean','Schoon')+'</button>';
      return '<div class="task"><span class="ic">'+t.icon+'</span><div class="t"><b>'+esc(t.b)+'</b><span>'+esc(t.s)+'</span></div>'+act+'</div>';
    }).join('') : '<div style="font-size:0.84rem;color:var(--green);padding:0.4rem 0;">✓ '+T('pd.alldone','Alles is bij.')+'</div>')+'</div>';
    const tw = $('#takenWrap');
    // melden hoort bij iedereen: een klus doorgeven en gevonden voorwerpen registreren
    const kamers = (state && state.rooms || []).map(r => r.name);
    const kamerSel = id => '<select class="hin" id="'+id+'" style="flex:1;"><option value="">'+T('hk.geenk','geen kamer')+'</option>'+kamers.map(k=>'<option>'+esc(k)+'</option>').join('')+'</select>';
    tw.innerHTML += '<div class="card"><div class="k">🔧 '+T('hk.klus.meld','Meld klus')+'</div>'+
      '<div class="row"><input class="hin" id="klusTekst" placeholder="'+T('hk.klus.ph','Omschrijf de klus...')+'" style="flex:2;">'+kamerSel('klusKamer')+'</div>'+
      '<button class="abtn" id="klusMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.klus.meld','Meld klus')+'</button></div>';
    const lf = (state && state.lostfound || []).slice(0, 6);
    tw.innerHTML += '<div class="card"><div class="k">🧳 '+T('hk.lf','Gevonden voorwerp')+'</div>'+
      '<div class="row"><input class="hin" id="lfItem" placeholder="'+T('hk.lf.item','Wat heb je gevonden?')+'" style="flex:2;">'+kamerSel('lfKamer')+'</div>'+
      '<div class="row"><input class="hin" id="lfPlek" placeholder="'+T('hk.lf.plek','Bewaarplek')+'"></div>'+
      '<button class="abtn" id="lfMeld" style="width:100%;margin-top:0.5rem;">'+T('hk.lf.meld','Registreer')+'</button>'+
      (lf.length ? '<div class="k" style="margin-top:0.8rem;">'+T('hk.lf.recent','Laatst geregistreerd')+'</div>'+
        lf.map(x => '<div class="task"><div class="t"><b>'+esc(x.item)+'</b><span>'+(x.room?esc(x.room)+' · ':'')+(x.storage?esc(x.storage)+' · ':'')+timeAgo(x.at)+'</span></div></div>').join('') : '')+'</div>';
    tw.querySelectorAll('[data-tk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ticket/status', { id:b.dataset.tk, status:b.dataset.st }); toast(b.dataset.st==='klaar'?T('pd.tickdone','Klus afgerond.'):T('pd.tickbusy','Opgepakt.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    }));
    tw.querySelectorAll('[data-hk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/hk', { id:b.dataset.hk, status:'schoon' }); toast(T('pd.cleaned','Kamer staat op schoon.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    }));
    const km = $('#klusMeld'); if (km) km.addEventListener('click', async () => {
      const text = $('#klusTekst').value.trim(); if (!text) return;
      try { await API.call('/supplier/ticket/add', { text, room: $('#klusKamer').value }); toast('🔧 '+T('hk.klusok','Klus gemeld.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    });
    const lm = $('#lfMeld'); if (lm) lm.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim(); if (!item) return;
      try { await API.call('/supplier/lost/add', { item, room: $('#lfKamer').value, storage: $('#lfPlek').value }); toast('🧳 '+T('hk.lfok','Geregistreerd.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Kamers: het volledige housekeeping-bord in de PDA ----------
     Alle PDA's leven in deze ene app. Voor zaken met kamers (hotel,
     appartementen) is dit het kamerbord met een tik per stap, vroege
     check-in vrijgeven en de minibar. Voor zaken zonder kamers
     (schoonmaakbedrijven, zzp'ers) werkt dezelfde tab op opdrachten. */
  const HK_ORDE = { defect: 0, vuil: 1, bezig: 2, schoon: 3, bezet: 4 };
  const hkVan = r => (r.hk && r.hk.status) || (r.available ? 'schoon' : 'bezet');
  const heeftKamers = () => !!(state && (state.rooms || []).length);
  const heeftOpdrachten = () => !!(state && !(state.rooms || []).length && (state.boekingen || []).length);
  // het eigen dorp op zak: bars, clubs, beachclubs en restaurants krijgen het afdelingenbord
  const heeftClubdorp = () => !!(state && !(state.rooms || []).length && state.supplier && ['bar', 'club', 'beachclub', 'restaurant'].includes(state.supplier.type));
  // het zorgprofiel van de gast, kort op een regel (reist mee met toestemming)
  const pkZorg = z => [((z.allergenen || []).length ? T('zorg.allergie', 'Allergie') + ': ' + z.allergenen.join(', ') : ''), z.dieet, z.medisch].filter(Boolean).join(' · ');
  let mbOpen = null;          // kamer waarvan de minibar-teller openstaat
  let mbTel = {};             // minibar-aantallen van die kamer
  // het receptiebord op zak: alleen de housekeeping-prioriteit is hier nodig
  let pkReceptie = null, pkReceptieAt = 0, pkReceptieBezig = false;
  function pkLaadReceptie(){
    if (pkReceptieBezig || Date.now() - pkReceptieAt < 30000) return;
    pkReceptieBezig = true;
    API.call('/supplier/receptie').then(d => { pkReceptie = d; pkReceptieAt = Date.now(); pkReceptieBezig = false; renderKamers(); })
      .catch(() => { pkReceptieBezig = false; pkReceptieAt = Date.now(); });
  }

  function renderKamers(){
    const tabBtn = $('#tabKamers');
    const aan = heeftKamers() || heeftOpdrachten() || heeftClubdorp();
    const tabNaam = heeftKamers() ? T('pd.t.kamers','Kamers') : heeftClubdorp() ? T('pd.t.dorp','Afdelingen') : T('pd.t.opdr','Opdrachten');
