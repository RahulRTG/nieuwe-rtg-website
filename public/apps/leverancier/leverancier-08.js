    const oudste = ages.length ? Math.max.apply(null, ages) : 0;
    return '<div class="st-stats">'+
      '<div class="st-stat"><b>'+list.length+'</b><span>'+T('kds.open','Open bonnen')+'</span></div>'+
      '<div class="st-stat'+(laat?' rood':' groen')+'"><b>'+laat+'</b><span>'+T('kds.laat','Te laat')+'</span></div>'+
      '<div class="st-stat"><b>'+oudste+'m</b><span>'+T('kds.oudste','Oudste bon')+'</span></div>'+
    '</div>';
  }
  // de all-day-telling: totalen per gerecht over alle open bonnen, zoals op een echte lijn
  function allDay(list, filt){
    const per = {};
    list.forEach(o => (o.items||[]).forEach(it => {
      if (filt === 'bar'){
        // de barkant: alle drankjes die nog gemaakt moeten worden
        if (stationOf(it) !== 'bar' || (o.stations||{}).bar === 'klaar') return;
        per[it.name] = (per[it.name]||0) + it.qty;
        return;
      }
      const sec = sectieOf(it); if (!sec) return;
      if (filt && sec !== filt) return;
      if ((o.secties||{})[sec] === 'klaar') return;
      per[it.name] = (per[it.name]||0) + it.qty;
    }));
    minOverschot(per);
    const rows = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 14);
    if (!rows.length) return '';
    return '<div class="allday"><span class="ad-h">'+T('kds.allday','All day')+'</span>'+rows.map(r => '<span class="ad"><b>'+r[1]+'×</b>'+r[0]+'</span>').join('')+'</div>';
  }
  const opTijd = (a,b) => new Date(a.at) - new Date(b.at);
  /* ---- het overschot: te veel gemaakt is voorraad op de pas ----
     De AI verrekent het overal: maak-nu en all day tellen het eraf, en de
     coach zegt: gebruik eerst wat er ligt. */
  const overschotLijst = () => (state && state.overschot) || [];
  const overQty = naam => overschotLijst().filter(x => x.name === naam).reduce((n,x) => n + x.qty, 0);
  // trek het overschot van de telling af (wat er ligt hoef je niet te maken)
  function minOverschot(per){
    Object.keys(per).forEach(n => {
      const ov = overQty(n);
      if (!ov) return;
      if (typeof per[n] === 'number') per[n] = Math.max(0, per[n] - ov);
      else per[n].n = Math.max(0, per[n].n - ov);
      if ((typeof per[n] === 'number' ? per[n] : per[n].n) <= 0) delete per[n];
    });
    return per;
  }
  function overschotChips(){
    const l = overschotLijst();
    if (!l.length) return '';
    return '<div class="allday"><span class="ad-h">'+T('over.h','Op de pas over')+'</span>'+
      l.map(x => '<span class="ad"><b>'+x.qty+'×</b>'+MTX(x.name)+'</span>').join('')+'</div>';
  }
  // de melder voor de pas-schermen: is over, gebruikt of afschrijven
  function overschotBlok(){
    const l = overschotLijst();
    return '<div class="tkc st-hulp" style="grid-column:1/-1;"><h3>'+T('over.h','Op de pas over')+'</h3>'+
      '<div class="tkc-who">'+T('over.deck','Te veel gemaakt? Meld het hier; elk scherm telt het van de maaklijst af en de coach zegt: gebruik eerst wat er ligt.')+'</div>'+
      '<div class="row-gap"><select class="st-in" id="ovGerecht" style="flex:2;">'+
        (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
      '<input class="st-in" id="ovAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
      '<button class="tkc-start" id="ovBij" style="flex:1;border-radius:10px;">'+T('over.is','Is over')+'</button></div>'+
      (l.length ? l.map(x => '<div class="st-row"><span><b style="color:var(--gold);">'+x.qty+'×</b> '+MTX(x.name)+'<span class="sub">'+timeAgo(x.at)+' · '+(x.door||'')+'</span></span>'+
        '<span class="acts"><button class="obtn primary" data-overgebruikt="'+x.id+'">'+T('over.gebruikt','Gebruikt')+'</button><button class="obtn warn" data-overweg="'+x.id+'">✕</button></span></div>').join('')
      : '<div class="tkc-who">'+T('over.leeg','Er ligt nu niets over.')+'</div>')+'</div>';
  }
  function orderStations(o){
    const set = new Set();
    (o.items||[]).forEach(it => set.add(stationOf(it)));
    return [...set];
  }
  function stationLabel(st){
    return { keuken: T('st.keuken','Keuken-scherm'), bar: T('st.bar','Bar-scherm'), bediening: T('st.bediening','Bedieningspost'),
             events: T('st.events','Events-scherm'), kantoor: T('st.kantoor','Kantoor'),
             chauffeur: (S && S.type === 'jet') ? T('st.crew','Crew-post') : T('st.chauffeur','Chauffeurspost') }[st] || st;
  }
  function tickClock(){
    const el = $('#stClock');
    if (el) el.textContent = new Date().toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL', { hour:'2-digit', minute:'2-digit' });
  }
  function enterStation(st){
    stationMode = st;
    $('#staffPick').classList.remove('open');
    $('#spPin').classList.remove('open');
    $('#gate').style.display = 'none';
    $('#app').classList.add('active');
    $('#station').classList.add('on');
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(st);
    tickClock();
    clearInterval(stClockTimer);
    stClockTimer = setInterval(tickClock, 20000);
    renderStation();
    startStream();
    // de kok of barman ziet zijn scherm en zijn bonnen in zijn moedertaal
    if (window.MoederTaal) MoederTaal.start((p, b) => API.call(p, b), () => { try { renderStation(); } catch(e){} });
  }
  $('#stExit').addEventListener('click', () => {
    stationMode = null;
    clearInterval(stClockTimer);
    $('#station').classList.remove('on');
    try { localStorage.removeItem('rtg_sup_station'); } catch(e){}
    buildTabs();
    renderAll();
  });

  function ageMin(iso){ return Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); }
  function ticketCard(o, st, opts){
    opts = opts || {};
    const items = (o.items||[]).filter(it => !st || stationOf(it) === st);
    const secIcon = it => (st === 'keuken' && sectieOf(it)) ? KSECTIES[sectieOf(it)][0] + ' ' : '';
    const a = ageMin(o.at);
    const tier = opts.dim ? '' : ageKlasse(a);
    const phase = (o.stations||{})[st];
    let act = '';
    if (opts.serve){
      act = '<div class="tkc-act"><button class="tkc-serve" data-stserve="'+o.ref+'">'+T('st.served','Geserveerd')+'</button></div>';
    } else if (st && !opts.dim){
      act = '<div class="tkc-act">'+
        (!phase ? '<button class="tkc-start" data-stgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>' : '')+
        '<button class="tkc-ready" data-stgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div>';
    }
    return '<div class="tkc'+tier+(opts.dim?' dim':'')+'">'+
      '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+a+' min</span></div>'+
      '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+o.ref+(o.paid?'':' \u00b7 '+T('st.unpaid','onbetaald'))+'</div>'+
      '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+secIcon(it)+MTX(it.name)+'</span>').join('')+'</div>'+
      (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
      /* De leeftijdscontrole hoort bij wie schenkt en wie uitserveert, niet bij
         wie kookt. Op het keukenscherm nam die regel de plek in van een
         gerechtregel zonder dat de kok er iets mee kan; bij de bar staat er
         alcohol op de bon en daar telt hij wel. */
      (o.leeftijdOk && st !== 'keuken'?'<div class="tkc-alg" style="background:rgba(45,140,80,0.14);color:#2d8c50;">\uD83D\uDD1E '+T('st.agever','Leeftijd in de app geverifieerd (paspoort)')+'</div>':'')+
      ((st==='keuken'||st==='bar')&&!opts.dim?(function(){
        const vp = vuurplan(o);
        const kanten = Object.keys(vp.plan);
        return kanten.length ? '<div class="st-badges">'+kanten.map(s2 => vpChip(s2, vp.plan[s2])).join('')+'</div>' : '';
      })():'')+
      (opts.dim?'':gastRegel(o))+
      (opts.badges?'<div class="st-badges">'+orderStations(o).map(s2=>{
        const p=(o.stations||{})[s2]||'';
        return '<span class="st-badge '+p+'">'+(s2==='bar'?'\uD83C\uDF78':'\uD83D\uDD25')+' '+s2+(p?' \u00b7 '+(p==='klaar'?T('st.b.klaar','klaar'):T('st.b.bezig','bezig')):'')+'</span>';
      }).join('')+'</div>':'')+
      act+'</div>';
  }

  // draaiboek-regels voor een werkplek: alle gepubliceerde events vanaf vandaag
  function dueOf(e, it){
    const d = new Date((e.date || '2099-01-01') + 'T00:00:00');
    d.setDate(d.getDate() - (it.daysBefore || 0));
    return d.toISOString().slice(0, 10);
  }
  function dueLabel(due, daysBefore){
    const today = new Date().toISOString().slice(0, 10);
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const naam = due === today ? T('rs.today','vandaag') : due === morgen ? T('rs.tomorrow','morgen') : due;
    return naam + (daysBefore ? ' \u00b7 D-' + daysBefore : '');
  }
  function runsheetFor(station){
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    for (const e of (state.events || [])){
      if (!e.published || (e.date || '') < today) continue;
      for (const it of (e.runsheet || [])){
        if (station === 'party' || it.station === station || it.station === 'alle')
          out.push({ e, it, due: dueOf(e, it) });
      }
    }
