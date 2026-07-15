  /* ================= werkplekken: keuken, bar, bediening =================
     Elk gerecht op de kaart hoort bij een station (keuken of bar). Een
     bestelling verschijnt als ticket op elk station dat iets moet maken;
     pas als alle stations klaar zijn, is de bestelling klaar en ziet de
     bedieningspost hem bij "Uit te serveren". */
  let stationMode = null, stClockTimer = null;
  // een scherm per keukensectie: hetzelfde keukenscherm, zes kanten
  const KSECTIES = {
    chef:    ['\uD83D\uDC68\u200D\uD83C\uDF73', 'Chef'],
    warm:    ['\uD83D\uDD25', 'Warme kant'],
    koud:    ['\u2744\uFE0F', 'Koude kant'],
    snack:   ['\uD83C\uDF5F', 'Snacks'],
    dessert: ['\uD83C\uDF70', 'Desserts'],
    pas:     ['\uD83C\uDF7D\uFE0F', 'De pas']
  };
  let keukenSectie = (() => { try { return localStorage.getItem('rtg_sup_ksectie') || 'chef'; } catch(e){ return 'chef'; } })();
  function sectieOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return (m && m.station !== 'bar') ? (m.sectie || 'warm') : null;
  }
  function sectiesVanOrder(o){
    const set = new Set();
    (o.items||[]).forEach(it => { const s2 = sectieOf(it); if (s2) set.add(s2); });
    return [...set];
  }

  function stationOf(it){
    const m = (state && state.menu || []).find(x => x.id === it.id);
    return m && m.station === 'bar' ? 'bar' : 'keuken';
  }

  /* ---- het vuurplan: zelfde rekenregels als de servercoach ----
     Nominale tijd per kant (prepMin op het gerecht wint); klaar telt 0,
     bezig de halve tijd, niet gestart de volle tijd. De langzaamste kant
     bepaalt het doel; de rest start precies zo laat dat alles tegelijk
     warm op de pas ligt. */
  const KTIJD = { warm: 12, koud: 6, snack: 8, dessert: 5 };
  function sectieDuur(o, sec){
    let t = KTIJD[sec] || 8;
    (o.items||[]).forEach(it => {
      const m = (state && state.menu || []).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie||'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin);
    });
    return t;
  }
  function vuurplan(o){
    const nodig = sectiesVanOrder(o);
    const fase = o.secties || {};
    const faseVan = k => k === 'bar' ? (o.stations||{}).bar : fase[k];
    const rest = {};
    nodig.forEach(sec => { const t = sectieDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    // de bar telt als eigen kant mee: drankjes gaan met de rest van de bon samen uit
    if ((o.items||[]).some(it => stationOf(it) === 'bar')){
      const bf = (o.stations||{}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? 2 : 4;
    }
    const alle = Object.keys(rest);
    let doel = alle.length ? Math.max.apply(null, alle.map(k => rest[k])) : 0;
    // de deurhost-koppeling: deelt de gast zijn reis (GPS), dan mikt het
    // vuurplan op de aankomst, zodat alles warm klaarstaat als de gast zit
    // (behalve bij spoed: dan telt alleen de kooktijd)
    if (!o.spoed && !o.guestArrived && Number.isFinite(o.guestEtaMin) && o.guestEtaMin > doel) doel = o.guestEtaMin;
    const plan = {};
    alle.forEach(k => {
      const f = faseVan(k);
      if (f==='klaar') plan[k] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (f==='bezig') plan[k] = { doe:'bezig', min:rest[k] };
      else { const w = doel - rest[k]; plan[k] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    // spoed van de bediening: niets houdt nog in, alles start nu
    if (o.spoed) alle.forEach(k => { if (plan[k].doe === 'wacht') plan[k] = { doe:'nu', min:0 }; });
    return { doel, plan };
  }
  // spoedbonnen bovenaan, daarna de oudste eerst; het spoedmerkje per gerecht
  const spoedEerst = (a,b) => ((b.spoed?1:0) - (a.spoed?1:0)) || opTijd(a,b);
  const spoedMerk = (o, it) => (o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id)) ? '⚡ ' : '';
  // KDS-tijdbanden: groen tot 6 min, amber tot 12, rood daarna, knipperen vanaf 18
  function ageKlasse(a){ return a >= 18 ? ' late flash' : a >= 12 ? ' late' : a >= 6 ? ' warn' : ' ok'; }
  function vpChip(sec, p){
    if (!p) return '';
    const kant = KSECTIES[sec] || (sec === 'bar' ? ['🍸','Bar'] : ['·', sec]);
    const lbl = { nu: T('vp.nu','start nu'), wacht: T('vp.wacht','wacht'), bezig: T('vp.bezig','bezig'), warm: T('vp.warm','houd warm'), pas: T('vp.pas','naar de pas') }[p.doe] || '';
    const min = (p.doe==='wacht'||p.doe==='bezig'||p.doe==='warm') && p.min ? ' ~'+p.min+'m' : '';
    return '<span class="vp '+p.doe+'">'+kant[0]+' '+T('ks.'+sec, kant[1])+' · '+lbl+min+'</span>';
  }
  // de deurhost-regel op de bon: waar is de gast (GPS uit de leden-app)
  function gastRegel(o){
    if (o.guestArrived) return '<div class="tkc-who">✅ '+T('kds.gastin','De gast is binnen.')+'</div>';
    if (Number.isFinite(o.guestEtaMin)) return '<div class="tkc-who">🧭 '+T('kds.gast','Gast onderweg, ~')+o.guestEtaMin+' min</div>';
    return '';
  }
  // hoe lang staat het al op de pas: sneller rood dan de bontijd (eten wordt koud)
  function pasKlasse(a){ return a >= 6 ? ' late flash' : a >= 3 ? ' warn' : ' ok'; }
  // de statusbalk boven de bonnen: open, te laat, oudste
  function stStats(list){
    const ages = list.map(o => ageMin(o.at));
    const laat = ages.filter(a => a >= 12).length;
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
    return '<div class="allday"><span class="ad-h">🥡 '+T('over.h','Op de pas over')+'</span>'+
      l.map(x => '<span class="ad"><b>'+x.qty+'×</b>'+x.name+'</span>').join('')+'</div>';
  }
  // de melder voor de pas-schermen: is over, gebruikt of afschrijven
  function overschotBlok(){
    const l = overschotLijst();
    return '<div class="tkc" style="grid-column:1/-1;"><h3>🥡 '+T('over.h','Op de pas over')+'</h3>'+
      '<div class="tkc-who">'+T('over.deck','Te veel gemaakt? Meld het hier; elk scherm telt het van de maaklijst af en de coach zegt: gebruik eerst wat er ligt.')+'</div>'+
      '<div class="row-gap"><select class="st-in" id="ovGerecht" style="flex:2;">'+
        (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
      '<input class="st-in" id="ovAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
      '<button class="tkc-start" id="ovBij" style="flex:1;border-radius:10px;">'+T('over.is','Is over')+'</button></div>'+
      (l.length ? l.map(x => '<div class="st-row"><span><b style="color:var(--gold);">'+x.qty+'×</b> '+x.name+'<span class="sub">'+timeAgo(x.at)+' · '+(x.door||'')+'</span></span>'+
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
      '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+secIcon(it)+it.name+'</span>').join('')+'</div>'+
      (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
      (o.leeftijdOk?'<div class="tkc-alg" style="background:rgba(45,140,80,0.14);color:#2d8c50;">\uD83D\uDD1E '+T('st.agever','Leeftijd in de app geverifieerd (paspoort)')+'</div>':'')+
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
    out.sort((a, b) => a.due.localeCompare(b.due) || (a.it.time.localeCompare(b.it.time)));
    return out;
  }
  const RUN_ICON = { keuken:'\uD83D\uDD25', bar:'\uD83C\uDF78', bediening:'\uD83E\uDDFE', party:'\uD83C\uDF9F', alle:'\uD83D\uDCE2' };
  function runsheetStrip(station){
    const rows = runsheetFor(station);
    if (!rows.length) return '';
    const today = new Date().toISOString().slice(0, 10);
    return '<div class="st-sec">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' & '+T('rs.mep','mise en place')+'</div>'+
      '<div class="tkc" style="grid-column:1/-1;">'+rows.map(r =>
        '<div class="st-row'+(r.it.done?'" style="opacity:0.5;':'"')+'">'+
        '<span>'+
        '<span style="display:inline-block;min-width:5.4rem;margin-right:0.5rem;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;color:'+(r.due===today?'var(--burgundy)':'var(--soft)')+';">'+dueLabel(r.due, r.it.daysBefore)+'</span>'+
        '<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+r.it.time+'</b>'+
        (station==='party'?'<span style="margin-right:0.4rem;">'+(RUN_ICON[r.it.station]||'')+'</span>':'')+
        (r.it.done?'<s>'+r.it.text+'</s>':r.it.text)+
        '<span class="sub">'+r.e.name+' \u00b7 '+r.e.date+(r.it.done&&r.it.doneBy?' \u00b7 \u2713 '+r.it.doneBy:'')+'</span></span>'+
        '<button class="obtn'+(r.it.done?' primary':'')+'" data-rundone="'+r.e.id+'" data-item="'+r.it.id+'">'+(r.it.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>'
      ).join('')+'</div>';
  }

  function renderStation(){
    const el = $('#stBody'); if (!el || !state) return;
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(stationMode) + (stationMode === 'keuken' ? ' \u00b7 ' + T('ks.'+keukenSectie, (KSECTIES[keukenSectie]||['',''])[1]) : '');
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    let html = '';
    if (stationMode === 'bediening'){
      /* De bedieningspas: wat kan er NU gelopen worden en waarheen. Spoed en
         het langst wachtende eerst; de bestemming (tafel of ophaalcode) staat
         groot; de tafelklok bundelt complete tafels in een loop. */
      const serve = live.filter(o => o.status === 'klaar')
        .sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.pasAt||a.at) - new Date(b.pasAt||b.at)));
      const making = live.filter(o => o.status !== 'klaar').sort(spoedEerst);
      // wie is er echt ingeklokt: de pas weet op wie hij kan rekenen
      const binnen = (state.klok && state.klok.binnen) || [];
      html += '<div class="allday"><span class="ad-h">\uD83D\uDC65 '+T('bp.binnen','Ingeklokt')+'</span>'+
        (binnen.length ? '<span class="ad">'+binnen.join(', ')+'</span>' : '<span class="ad">'+T('bp.niemand','Niemand ingeklokt')+'</span>')+'</div>';
      const tafelsKlaar = {};
      serve.forEach(o => { if (o.table) (tafelsKlaar[o.table] = tafelsKlaar[o.table] || []).push(o); });
      const loop = Object.keys(tafelsKlaar).filter(t => !making.some(o => (o.table||'') === t));
      if (loop.length)
        html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
          loop.map(t => '<span class="ad"><b>'+t+'</b>'+tafelsKlaar[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('bp.eenloop','pak alles in een loop')+'</span>').join('')+'</div>';
      html += '<div class="st-sec">'+T('bp.h','Bedieningspas, klaar om te lopen')+' ('+serve.length+')</div>';
      html += serve.length ? serve.map(o => {
        const pa = ageMin(o.pasAt || o.at);
        return '<div class="tkc'+pasKlasse(pa)+'">'+
          '<div class="tkc-top"><span class="tkc-code">'+(o.table?'\uD83E\uDE91 '+o.table:'\uD83D\uDCE6 '+o.pickup)+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
          '<div class="tkc-who">'+(o.table?T('bp.naar','breng naar de tafel'):T('bp.ophaal','ophaalbestelling, code ')+o.pickup)+' \u00b7 '+o.customerCodename+(o.spoed?' \u00b7 \u26A1 '+T('spoed.chip','Spoed'):'')+'</div>'+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span><b>'+it.qty+'\u00D7</b>'+it.name+'</span>').join('')+'</div>'+
          gastRegel(o)+
          (o.allergyNote?'<div class="tkc-alg">\u26A0 '+o.allergyNote+'</div>':'')+
          '<div class="tkc-act"><button class="tkc-serve" data-stserve="'+o.ref+'">'+T('st.served','Geserveerd')+'</button></div></div>';
      }).join('') : '<div class="st-empty">'+T('st.noserve','Niets klaar om uit te serveren. Zodra keuken en bar klaar zijn, verschijnt de bestelling hier.')+'</div>';
      // de spoedbon: een enkel gerecht komt als gewone bon op de lijn en telt
      // gewoon mee in de maak-nu- en all-day-tellingen; geen bel, geen flits
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>\u26A1 '+T('spoed.h','Spoedbon')+'</h3>'+
        '<div class="tkc-who">'+T('spoed.deck','Gerecht gevallen of vergeten? Zet het als gewone bon op de lijn; de keuken ziet gewoon een bon erbij.')+'</div>'+
        '<div class="row-gap"><select class="st-in" id="spGerecht" style="flex:2;">'+
          (state.menu||[]).map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
        '<input class="st-in" id="spAantal" type="number" inputmode="numeric" min="1" value="1" style="flex:0 0 4.5rem;">'+
        '<select class="st-in" id="spTafel" style="flex:1;"><option value="">'+T('spoed.geentafel','geen tafel')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name+'">'+t.name+'</option>').join('')+'</select></div>'+
        '<div class="tkc-act"><button class="tkc-ready" id="spGo">\u26A1 '+T('spoed.go','Zet op de lijn')+'</button></div></div>';
      html += overschotBlok();
      html += '<div class="st-sec">'+T('st.making','In de maak')+' ('+making.length+')</div>';
      html += making.length ? making.map(o => {
        const vp = vuurplan(o);
        return '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
          (o.intern?'<div class="tkc-who">\u26A1 '+T('spoed.van','Spoedbon van ')+(o.spoed&&o.spoed.door?o.spoed.door:'')+'</div>':'')+
          '<div class="tkc-items">'+(o.items||[]).map(it=>'<span>'+spoedMerk(o,it)+'<b>'+it.qty+'\u00D7</b>'+it.name+'</span>').join('')+'</div>'+
          '<div class="st-badges">'+Object.entries(vp.plan).map(([k,p])=>vpChip(k,p)).join('')+'</div>'+
          gastRegel(o)+
          '<div class="tkc-act"><button class="tkc-start" data-settbl="'+o.ref+'" data-cur="'+(o.table||'')+'">\uD83E\uDE91 '+(o.table?o.table+' \u00b7 '+T('st.tblwissel','wijzig'):T('st.tblset','Tafel kiezen'))+'</button>'+
          (o.intern?'<button class="obtn" data-spoedaf="'+o.ref+'" style="margin-left:0.5rem;">'+T('spoed.af','Intrekken')+'</button>':'')+'</div></div>';
      }).join('') : '<div class="st-empty">'+T('st.nomaking','Geen lopende bestellingen.')+'</div>';
      html += runsheetStrip('bediening');
      const tables = state.tables || [];
      if (tables.length){
        html += '<div class="st-sec">'+T('st.tables','Tafels, tik om te wisselen')+'</div><div class="st-tblgrid">'+
          tables.map(t=>'<button class="tbl tbl-'+t.status+'" data-sttbl="'+t.id+'" data-cur="'+t.status+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i></button>').join('')+'</div>';
      }
      html += '<div class="st-sec">'+T('st.more','Meer')+'</div>'+
        '<a class="tkc" style="text-decoration:none;align-items:flex-start;" href="/apps/personeel.html"><b style="font-size:0.95rem;">\uD83D\uDCF1 '+T('st.pda','Open de volledige PDA')+'</b><span style="font-size:0.74rem;color:var(--soft);">'+T('st.pda.s','Rooster, taken, teamchat, videobellen en SOS.')+'</span></a>';
    } else if (stationMode === 'events'){
      const evs = state.events || [];
      html += runsheetStrip('party');
      html += evs.length ? evs.map(e => {
        const taken = (e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const inb = (e.guests||[]).filter(g=>g.checkedIn).reduce((n,g)=>n+g.qty,0);
        return '<div class="tkc'+(e.published?'':' dim')+'">'+
          '<div class="tkc-top"><span style="font-size:1.05rem;font-weight:600;">'+e.name+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
          (e.desc?'<div class="tkc-who">'+e.desc+'</div>':'')+
          '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+' \u00b7 '+inb+' '+T('ev.inside','binnen')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+'</div>'+
          '<div class="ev-bar"><i style="width:'+Math.min(100, Math.round(taken/e.capacity*100))+'%;"></i></div>'+
          ((e.guests||[]).length ? '<div style="display:flex;flex-direction:column;">'+e.guests.map(g =>
            '<div class="st-row"><span>'+g.codename+' \u00b7 '+g.qty+' '+T('ev.pers','pers.')+'</span>'+
            '<button class="obtn'+(g.checkedIn?' primary':'')+'" data-evcheck="'+e.id+'" data-key="'+g.key+'">'+(g.checkedIn?'\u2713 '+T('ev.in','binnen'):T('ev.checkin','Check in'))+'</button></div>'
          ).join('')+'</div>' : '<div class="tkc-who">'+T('ev.noguests','Nog geen aanmeldingen.')+'</div>')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ev.none','Nog geen events. De manager maakt ze aan in het Kantoor; leden melden zich aan via de leden-app.')+'</div>';
    } else if (stationMode === 'kantoor'){
      html += renderKantoor();
    } else if (stationMode === 'chauffeur'){
      // de chauffeurspost: mijn actieve rit groot in beeld, open ritten om te
      // pakken, en de verdiensten van vandaag
      const mij = actor().staffId;
      const ritten = state.rides || [];
      const actief = ritten.filter(r => !RIT_KLAAR(r.status) && r.driver && r.driver.staffId === mij);
      const straks = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpen = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpen.filter(r => !straks(r));
      const gepland = alleOpen.filter(straks);
      const vandaag = new Date().toISOString().slice(0, 10);
      const klaarVandaag = ritten.filter(r => (r.status === 'afgerond' || r.status === 'gearriveerd') && r.driver && r.driver.staffId === mij && String(r.finishedAt || r.at).slice(0, 10) === vandaag);
      const omzet = klaarVandaag.reduce((s2, r) => s2 + (r.quote || 0), 0);
      html += '<div class="st-sec">'+T('ch.mijn','Mijn rit')+' ('+actief.length+')</div>';
      html += actief.length ? actief.map(r => {
        const nxt = NEXT_RIDE[r.status];
        return '<div class="tkc" style="grid-column:1/-1;">'+
          '<div class="tkc-top"><span class="tkc-code" style="font-size:1.3rem;">'+r.customerCodename+'</span><span class="tkc-age">'+tStatus(r.status)+'</span></div>'+
          '<div class="tkc-who" style="font-size:0.95rem;">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
          '<div class="tkc-who">'+ritRegel(r)+(r.vehicle?' · 🚘 '+r.vehicle.name+' ('+(r.vehicle.plate||'')+')':'')+'</div>'+
          (r.note?'<div class="tkc-alg">📝 '+r.note+'</div>':'')+
          (r.pickupEtaMin!=null && r.status==='onderweg' ? '<div class="tkc-who">🧭 ~'+r.pickupEtaMin+' min '+T('ch.naargast','naar de gast')+'</div>':'')+
          (r.dropEtaMin!=null && r.status==='aan-boord' ? '<div class="tkc-who">🏁 ~'+r.dropEtaMin+' min '+T('ch.naarbestemming','naar de bestemming')+'</div>':'')+
          (nxt?'<div class="tkc-act"><button class="tkc-ready" data-chgo="'+r.ref+'" data-st="'+nxt+'">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button></div>':'')+
        '</div>';
      }).join('') : '<div class="st-empty">'+T('ch.geenrit','Geen actieve rit. Neem hieronder een open rit aan.')+'</div>';
      html += '<div class="st-sec">'+T('ch.open','Open ritten')+' ('+open.length+')</div>';
      html += open.length ? open.map(r =>
        '<div class="tkc">'+
          '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age">'+timeAgo(r.at)+'</span></div>'+
          '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
          '<div class="tkc-who">'+ritRegel(r)+' · '+r.when+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
        '</div>'
      ).join('') : '<div class="st-empty">'+T('ch.geenopen','Geen open aanvragen. Nieuwe ritten verschijnen hier vanzelf.')+'</div>';
      if (gepland.length){
        html += '<div class="st-sec">'+T('ch.gepland','Gepland')+' ('+gepland.length+')</div>';
        html += gepland.map(r =>
          '<div class="tkc dim">'+
            '<div class="tkc-top"><span class="tkc-code">'+r.customerCodename+'</span><span class="tkc-age">📅</span></div>'+
            '<div class="tkc-who">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+'</div>'+
            '<div class="tkc-who">'+ritRegel(r)+' · <b>'+r.when+'</b></div>'+
            '<div class="tkc-act"><button class="tkc-start" data-chneem="'+r.ref+'">'+T('ch.neem','Neem deze rit')+'</button></div>'+
          '</div>'
        ).join('');
      }
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarVandaag.length+' '+T('ch.ritten','rit(ten) afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzet)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else if (stationMode === 'agenda'){
      // de agenda van de zelfstandige professional: aanvragen bevestigen,
      // leveren en afronden, met de verdiensten van vandaag eronder
      const bs = state.boekingen || [];
      const openB = bs.filter(b => b.status === 'aangevraagd');
      const komend = bs.filter(b => b.status === 'bevestigd');
      const vandaagB = new Date().toISOString().slice(0, 10);
      const klaarB = bs.filter(b => b.status === 'afgerond' && String(b.finishedAt || b.at).slice(0, 10) === vandaagB);
      const omzetB = klaarB.reduce((x, b) => x + (b.price || 0), 0);
      const kaartB = (b, acties) => '<div class="tkc" style="grid-column:1/-1;">'+
        '<div class="tkc-top"><span class="tkc-code" style="font-size:1.2rem;">'+b.customerCodename+'</span><span class="tkc-age">'+(b.wanneer || timeAgo(b.at))+'</span></div>'+
        '<div class="tkc-who" style="font-size:0.95rem;">'+(b.service.soort==='product'?'📦 ':'🗓️ ')+b.service.name+(b.service.duurMin?' · '+b.service.duurMin+' min':'')+' · <b style="color:var(--gold);">'+eur(b.price)+'</b></div>'+
        (b.note?'<div class="tkc-alg">📝 '+b.note+'</div>':'')+
        (acties?'<div class="tkc-act">'+acties+'</div>':'')+
      '</div>';
      html += '<div class="st-sec">'+T('ag.open','Nieuwe aanvragen')+' ('+openB.length+')</div>';
      html += openB.length ? openB.map(b => kaartB(b,
        '<button class="tkc-start" data-bkgo="'+b.ref+'" data-st="bevestigd">'+T('ag.bevestig','Bevestig')+'</button>'+
        '<button class="obtn warn" data-bkgo="'+b.ref+'" data-st="geweigerd" style="margin-left:0.5rem;">'+T('ag.weiger','Weiger')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenopen','Geen nieuwe aanvragen. Leden boeken uw diensten en producten via de RTG-app; betaald is definitief.')+'</div>';
      html += '<div class="st-sec">'+T('ag.komend','Bevestigd')+' ('+komend.length+')</div>';
      html += komend.length ? komend.map(b => kaartB(b,
        '<button class="tkc-ready" data-bkgo="'+b.ref+'" data-st="afgerond">'+T('ag.rondaf','Rond af')+'</button>')).join('')
        : '<div class="st-empty">'+T('ag.geenkomend','Nog niets bevestigd.')+'</div>';
      html += '<div class="st-sec">'+T('ch.vandaag','Vandaag')+'</div>'+
        '<div class="tkc"><div class="tkc-top"><span style="font-weight:600;">'+klaarB.length+' '+T('ag.klaar','afspraak/afspraken afgerond')+'</span>'+
        '<span class="tkc-code">'+eur(omzetB)+'</span></div><div class="tkc-who">'+T('ch.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</div></div>';
    } else {
      const st = stationMode;
      if (st === 'keuken'){
        // kies de kant: chef ziet alles, elke sectie alleen het eigen werk, de pas verzamelt
        html += '<div class="st-chips">'+Object.keys(KSECTIES).map(k =>
          '<button data-ksel="'+k+'"'+(keukenSectie===k?' class="on"':'')+'>'+KSECTIES[k][0]+' '+T('ks.'+k, KSECTIES[k][1])+'</button>').join('')+'</div>';
        html += '<div id="coachBox" style="grid-column:1/-1;display:none;"></div>';
        if (keukenSectie !== 'chef' && keukenSectie !== 'pas'){
          const sec = keukenSectie;
          const mijn = live.filter(o => sectiesVanOrder(o).includes(sec));
          const actief = mijn.filter(o => (o.secties||{})[sec] !== 'klaar').sort(spoedEerst);
          const klaarHier = mijn.filter(o => (o.secties||{})[sec] === 'klaar');
          const kaart = (o, dim) => {
            const items = (o.items||[]).filter(it => sectieOf(it) === sec);
            const a = ageMin(o.at);
            const tier = dim ? '' : ageKlasse(a);
            const fase = (o.secties||{})[sec];
            const advies = dim ? null : vuurplan(o).plan[sec];
            return '<div class="tkc'+tier+(dim?' dim':'')+'">'+
              '<div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+a+' min</span></div>'+
              '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+o.ref+'</div>'+
              '<div class="tkc-items">'+items.map(it=>'<span class="rcp-item" data-rcp="'+it.id+'"><b>'+it.qty+'\u00d7</b>'+it.name+'</span>').join('')+'</div>'+
              (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+
              (advies?'<div class="st-badges">'+vpChip(sec, advies)+'</div>':'')+
              (dim?'':'<div class="tkc-act">'+(!fase?'<button class="tkc-start" data-secgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>':'')+
                '<button class="tkc-ready" data-secgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div>')+
            '</div>';
          };
          html += stStats(actief) + allDay(actief, sec) + overschotChips();
          // de bezetting: wie staat er op deze kant; het scherm rekent per kok
          const koks = ((state.lijn||{})[sec]) || [];
          const ikSta = koks.some(k => k.id === actor().staffId);
          const perKok = koks.length ? Math.ceil(actief.length / koks.length) : actief.length;
          html += '<div class="allday"><span class="ad-h">👥 '+T('lijn.h','Bezetting')+'</span>'+
            (koks.length ? '<span class="ad">'+koks.map(k=>k.name.split(' ')[0]).join(', ')+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.')+'</span>' : '<span class="ad">'+T('lijn.leeg','Niemand aangemeld')+'</span>')+
            '<button class="obtn'+(ikSta?' primary':'')+'" data-lijnaan="'+sec+'">'+(ikSta?'✔ '+T('lijn.af','Aangemeld, tik om af te melden'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
          // maak nu: wat deze kant NU in een keer maakt, gebundeld over de bonnen
          const nuPer = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || (p.doe !== 'nu' && p.doe !== 'bezig')) return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = nuPer[it.name] = nuPer[it.name] || { n:0, bonnen:[] }; r.n += it.qty; r.bonnen.push(o.pickup); } });
          });
          minOverschot(nuPer);
          const nuRows = Object.entries(nuPer).sort((a,b)=>b[1].n-a[1].n);
          if (nuRows.length)
            html += '<div class="tkc" style="grid-column:1/-1;border-top:4px solid #2E7D5B;"><h3>🔥 '+T('lijn.maaknu','Maak nu, in een keer')+'</h3>'+
              nuRows.map(([naam,r])=>'<div class="st-row"><span><b style="color:var(--gold);">'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.bonnen','bonnen ')+[...new Set(r.bonnen)].join(', ')+'</span></span></div>').join('')+'</div>';
          // tussendoor: slim gebruik van de wachttijd (voorbereiden, MEP, de lijn)
          const straks = {};
          actief.forEach(o => {
            const p = vuurplan(o).plan[sec];
            if (!p || p.doe !== 'wacht') return;
            (o.items||[]).forEach(it => { if (sectieOf(it) === sec){ const r = straks[it.name] = straks[it.name] || { n:0, min:p.min }; r.n += it.qty; r.min = Math.min(r.min, p.min); } });
          });
          const straksRows = Object.entries(straks).sort((a,b)=>a[1].min-b[1].min).slice(0,6);
          const dmsK = (state.dailyMeps||{})[new Date().toISOString().slice(0,10)];
          const mepOpen = dmsK ? (dmsK.tasks||[]).filter(x=>!x.done).slice(0,3) : [];
          if (straksRows.length || mepOpen.length || !actief.length)
            html += '<div class="tkc" style="grid-column:1/-1;"><h3>⏳ '+T('lijn.tussendoor','Tussendoor')+'</h3>'+
              straksRows.map(([naam,r])=>'<div class="st-row"><span>'+T('lijn.zetklaar','Zet vast klaar: ')+'<b>'+r.n+'×</b> '+naam+'<span class="sub">'+T('lijn.startover','start over ~')+r.min+' min</span></span></div>').join('')+
              mepOpen.map(x=>'<div class="st-row"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.5rem;">'+x.time+'</b>'+x.task+'<span class="sub">'+T('lijn.mep','mise en place van vandaag')+'</span></span></div>').join('')+
              (!straksRows.length && !mepOpen.length ? '<div class="tkc-who">'+T('lijn.hygiene','Rustig moment: werkbank afnemen, koeling en parstock checken, garnituur bijvullen.')+'</div>' : '')+
            '</div>';
          html += actief.length ? actief.map(o=>kaart(o,false)).join('') : '<div class="st-empty">'+T('ks.calm','Niets voor deze kant. Nieuwe bestellingen met werk voor ')+T('ks.'+sec, KSECTIES[sec][1]).toLowerCase()+T('ks.calm2',' verschijnen hier vanzelf.')+'</div>';
          if (klaarHier.length){
            html += '<div class="st-sec">'+T('ks.done','Klaargemeld door deze kant')+'</div>';
            html += klaarHier.map(o=>kaart(o,true)).join('');
          }
          el.innerHTML = html;
          bindStation(el);
          return;
        }
        if (keukenSectie === 'pas'){
          const keukenOrders = live.filter(o => sectiesVanOrder(o).length);
          const bezig = keukenOrders.filter(o => (o.stations||{}).keuken !== 'klaar').sort(spoedEerst);
          const opDePas = keukenOrders.filter(o => (o.stations||{}).keuken === 'klaar')
            .sort((a,b) => new Date(a.pasAt||a.at) - new Date(b.pasAt||b.at));
          const badge = o => '<div class="st-badges">'+Object.entries(vuurplan(o).plan).map(([s2,p]) => vpChip(s2, p)).join('')+'</div>';
          // de tafelklok van de pas: staat alles van een tafel op de pas, dan
          // kan de hele tafel in een keer uit
          const tafels = {};
          opDePas.forEach(o => { if (o.table) (tafels[o.table] = tafels[o.table] || []).push(o); });
          const compleet = Object.keys(tafels).filter(t => !bezig.some(o => (o.table||'') === t));
          if (compleet.length)
            html += '<div class="allday" role="status"><span class="ad-h">\uD83E\uDE91 '+T('pas.compleet','Tafel compleet')+'</span>'+
              compleet.map(t => '<span class="ad"><b>'+t+'</b>'+tafels[t].map(o=>o.pickup).join(', ')+' \u00b7 '+T('pas.samen','stuur samen uit')+'</span>').join('')+'</div>';
          html += overschotBlok();
          html += '<div class="st-sec">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>';
          html += opDePas.length ? opDePas.map(o => {
            const pa = ageMin(o.pasAt || o.at);
            return '<div class="tkc'+pasKlasse(pa)+'"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+pa+' '+T('pas.op','min op de pas')+'</span></div>'+
            '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+(o.status==='klaar'?T('ks.pas.wacht','wacht op bediening'):T('ks.pas.bar','wacht nog op de bar'))+'</div>'+
            '<div class="tkc-items">'+(o.items||[]).filter(it=>sectieOf(it)).map(it=>'<span><b>'+it.qty+'\u00d7</b>'+KSECTIES[sectieOf(it)][0]+' '+it.name+'</span>').join('')+'</div>'+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>';
          }).join('') : '<div class="st-empty">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>';
          html += '<div class="st-sec">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>';
          html += bezig.map(o =>
            '<div class="tkc"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
            badge(o)+
            gastRegel(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>'
          ).join('');
          el.innerHTML = html;
          bindStation(el);
          return;
        }
      }
      const mine = live.filter(o => (o.items||[]).some(it => stationOf(it) === st));
      const act = mine.filter(o => (o.stations||{})[st] !== 'klaar').sort(spoedEerst);
      const done = mine.filter(o => (o.stations||{})[st] === 'klaar');
      if (st === 'keuken' || st === 'bar') html += stStats(act);
      if (st === 'keuken') html += allDay(act);
      if (st === 'bar') html += allDay(act, 'bar') + overschotChips() + overschotBlok();
      html += act.length ? act.map(o => ticketCard(o, st, {})).join('') : '<div class="st-empty">'+T('st.calm','Rustig. Nieuwe bestellingen verschijnen hier vanzelf, met geluid van de bel in de app.')+'</div>';
      if (done.length){
        html += '<div class="st-sec">'+T('st.done','Klaargemeld, wacht op uitserveren')+'</div>';
        html += done.map(o => ticketCard(o, st, { dim:true })).join('');
      }
      if (st === 'keuken'){
        const vandaagStr = new Date().toISOString().slice(0, 10);
        const morgenStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const dms = state.dailyMeps || {};
        html += '<div class="st-sec">\uD83D\uDCC5 '+T('dm.h','Dagelijkse mise en place (\u00e0 la carte)')+'</div>';
        const dmCard = (plan, label) => {
          const open = plan.tasks.filter(x=>!x.done).length;
          return '<div class="tkc" style="grid-column:1/-1;">'+
            '<div class="tkc-top"><span style="font-weight:600;">'+label+' \u00b7 \u00b1'+plan.covers+' couverts</span><span class="tkc-age">'+plan.factorLabel+' \u00b7 '+T('dm.by','voorspeld door')+' '+plan.by+'</span></div>'+
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+plan.portions.map(p=>'<span class="st-badge">'+p.name+' \u00b7 <b style="color:var(--gold);">'+p.n+'\u00d7</b></span>').join('')+'</div>'+
            plan.tasks.map(x=>'<div class="st-row'+(x.done?'" style="opacity:0.5;':'"')+'"><span><b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+x.time+'</b>'+(x.done?'<s>'+x.task+'</s>':x.task)+(x.done&&x.doneBy?'<span class="sub">\u2713 '+x.doneBy+'</span>':'')+'</span>'+
              '<button class="obtn'+(x.done?' primary':'')+'" data-dmdone="'+plan.date+'" data-item="'+x.id+'">'+(x.done?'\u2713':T('rs.doit','Gedaan'))+'</button></div>').join('')+
            (open?'':'<div class="tkc-who">\u2705 '+T('dm.alldone','Alles afgevinkt, de lijn staat.')+'</div>')+
          '</div>';
        };
        if (dms[vandaagStr]) html += dmCard(dms[vandaagStr], T('rs.today','vandaag').toUpperCase());
        if (dms[morgenStr]) html += dmCard(dms[morgenStr], T('rs.tomorrow','morgen').toUpperCase());
        html += '<div class="tkc"><div class="tkc-who">'+T('dm.deck','De voorspelling rekent met de verkoop van de afgelopen drie weken, de tafelcapaciteit en de weekdag.')+'</div>'+
          '<div class="tkc-act"><button class="tkc-start" data-dmgen="vandaag">\u2728 '+(dms[vandaagStr]?T('dm.redo','Opnieuw voor vandaag'):T('dm.today','Voorspel vandaag'))+'</button>'+
          '<button class="tkc-start" data-dmgen="morgen">\u2728 '+(dms[morgenStr]?T('dm.redo2','Opnieuw voor morgen'):T('dm.tomorrow','Voorspel morgen'))+'</button></div></div>';
        const evs2 = (state.events||[]).filter(e => e.published && (e.date||'') >= vandaagStr && (e.catering && e.catering.mode !== 'geen' || (e.allergies||[]).length));
        if (evs2.length){
          html += '<div class="st-sec">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</div>';
          html += evs2.map(e => {
            const dishes = e.catering.mode === 'menu'
              ? e.catering.itemIds.map(id => (state.menu||[]).find(m => m.id === id)).filter(Boolean)
              : (state.menu||[]).filter(m => m.station !== 'bar');
            const covers = Math.max((e.guests||[]).reduce((n,g)=>n+g.qty,0), Math.ceil(e.capacity*0.6));
            return '<div class="tkc">'+
              '<div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+'</span></div>'+
              '<div class="tkc-who">'+(e.catering.mode==='menu'?T('ek.menu','Vast menu')+' \u00b7 '+dishes.length+' '+T('ek.courses','gangen'):e.catering.mode==='alacarte'?'\u00c0 la carte':'')+' \u00b7 \u00b1'+covers+' couverts</div>'+
              (e.catering.mode==='menu' && dishes.length ? '<div class="tkc-items" style="font-size:0.82rem;">'+dishes.map(d=>'<span>\u2022 '+d.name+'</span>').join('')+'</div>' : '')+
              ((e.allergies||[]).length ? (e.allergies||[]).map(a =>
                '<div class="tkc-alg">\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
                (a.alternative?'<br>\u2192 <b>'+a.alternative.name+'</b>'+(a.alternative.desc?': '+a.alternative.desc:''):'<br>'+T('ek.noalt','Nog geen vervangend gerecht, vraag het Kantoor of tik hieronder.'))+'</div>').join('') : '')+
              '<div class="tkc-act"><button class="tkc-ready" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
            '</div>';
          }).join('');
        }
      }
      html += runsheetStrip(st);
    }
    el.innerHTML = html;
    bindStation(el);
  }

  // de keukenhulp: haalt live advies op (Claude of de regel-coach) en toont het
  let coachSeq = 0;
  async function loadCoach(el){
    const box = el.querySelector('#coachBox'); if (!box) return;
    const mijn = ++coachSeq;
    try {
      const d = await API.call('/supplier/kitchen/coach', {});
      if (mijn !== coachSeq) return; // er is al een nieuwere render
      if (!d.lines || !d.lines.length){ box.style.display = 'none'; return; }
      box.style.display = 'block';
      box.innerHTML = '<div class="tkc" style="border-color:rgba(169,143,28,0.5);">'+
        '<h3>\uD83E\uDD16 '+T('kc.h','Keukenhulp')+(d.ai?' \u00b7 Claude':'')+'</h3>'+
        d.lines.map(l=>'<div style="font-size:0.9rem;line-height:1.6;padding:0.2rem 0;">'+l+'</div>').join('')+'</div>';
    } catch(e){ box.style.display = 'none'; }
  }
  /* Het gerechtenmenu: tik op een gerecht en kies recept, bereidingswijze,
     allergenen met vervangers, een dranksuggestie of een 86-melding
     (uitverkocht; leden kunnen het per direct niet meer bestellen). */
  function sluitDish(){ const d = document.getElementById('dishSheet'); if (d) d.remove(); }
  function dishSheet(itemId){
    sluitDish();
    const m = (state.menu||[]).find(x => x.id === itemId); if (!m) return;
    const host = $('#station') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'dishSheet';
    const alg = (m.allergens||[]).length
      ? m.allergens.map(a => '<span class="ds-alg">⚠ '+a+'</span>').join('')
      : '<span class="ds-alg ok">'+T('ds.noalg','geen allergenen geregistreerd')+'</span>';
    const icoon = KSECTIES[m.sectie||'warm'] && m.station !== 'bar' ? KSECTIES[m.sectie||'warm'][0]+' ' : (m.station==='bar'?'🍸 ':'');
    wrap.innerHTML = '<div class="ds-scrim"></div>'+
      '<div class="ds-card" role="dialog" aria-modal="true" aria-label="'+m.name+'">'+
        '<div class="ds-top"><div><b>'+icoon+m.name+'</b>'+
          (m.desc?'<span class="ds-desc">'+m.desc+'</span>':'')+
          '<div class="ds-algs">'+alg+'</div></div>'+
          '<button class="st-exit" data-dsluit>'+T('ds.sluit','Sluit')+'</button></div>'+
        '<div class="ds-acts">'+
          '<button data-dsk="recept">📖 '+T('ds.recept','Recept')+'</button>'+
          '<button data-dsk="bereiding">👨‍🍳 '+T('ds.bereiding','Bereidingswijze')+'</button>'+
          '<button data-dsk="allergenen">⚠️ '+T('ds.allergenen','Allergenen en vervangers')+'</button>'+
          '<button data-dsk="pairing">🍷 '+T('ds.pairing','Dranksuggestie')+'</button>'+
          '<button data-ds86'+(m.uitverkocht?' class="aan"':'')+'>⛔ '+(m.uitverkocht?T('ds.86off','86 opheffen'):T('ds.86','86, uitverkocht'))+'</button>'+
        '</div>'+
        (m.uitverkocht?'<div class="ds-86">'+T('ds.86nu','Dit gerecht staat op 86: leden kunnen het nu niet bestellen.')+'</div>':'')+
        '<div class="ds-body" id="dsBody">'+T('ds.kies','Kies hierboven wat je wilt zien.')+'</div>'+
      '</div>';
    host.appendChild(wrap);
    wrap.querySelector('.ds-scrim').addEventListener('click', sluitDish);
    wrap.querySelector('[data-dsluit]').addEventListener('click', sluitDish);
    wrap.querySelectorAll('[data-dsk]').forEach(b => b.addEventListener('click', async () => {
      const body = wrap.querySelector('#dsBody');
      wrap.querySelectorAll('[data-dsk]').forEach(x => x.classList.toggle('aan', x === b));
      body.textContent = T('ds.laden','De AI-chef schrijft...');
      try {
        const d = await API.call('/supplier/menu/kennis', { itemId, soort: b.dataset.dsk });
        body.textContent = d.tekst;
        if (b.dataset.dsk === 'recept') m.recept = d.tekst;
      } catch(e){ body.textContent = e.message; }
    }));
    wrap.querySelector('[data-ds86]').addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/menu/86', { itemId, op: !m.uitverkocht });
        m.uitverkocht = d.uitverkocht;
        toast(m.uitverkocht ? '⛔ 86: '+m.name : '✅ '+m.name+' '+T('ds.weerbeschikbaar','is weer beschikbaar'));
        dishSheet(itemId);
      } catch(e){ toast(e.message); }
    });
  }

  function bindStation(el){
    if (stationMode === 'keuken') loadCoach(el);
    el.querySelectorAll('.rcp-item').forEach(s2 => s2.addEventListener('click', () => dishSheet(s2.dataset.rcp)));
    el.querySelectorAll('[data-settbl]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('st.tblq','Welke tafel? (leeg = geen tafel)'), b.dataset.cur || '');
      if (t === null) return;
      try { await API.call('/supplier/order/table', { ref: b.dataset.settbl, table: t.trim() }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // het overschot: is over melden, gebruikt afboeken of afschrijven
    const ovBij = el.querySelector('#ovBij'); if (ovBij) ovBij.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'erbij', itemId: el.querySelector('#ovGerecht').value, qty: el.querySelector('#ovAantal').value }); toast('🥡 '+T('over.toast','Gemeld; elk scherm telt het nu van de maaklijst af.')); await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-overgebruikt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'gebruikt', id: b.dataset.overgebruikt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-overweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/overschot', { op: 'weg', id: b.dataset.overweg }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de spoedbon: als gewone bon op de lijn zetten, of intrekken
    const spGo = el.querySelector('#spGo'); if (spGo) spGo.addEventListener('click', async () => {
      try {
        await API.call('/supplier/order/spoed', { itemId: el.querySelector('#spGerecht').value, qty: el.querySelector('#spAantal').value, table: el.querySelector('#spTafel').value });
        toast('⚡ '+T('spoed.toast','Spoedbon staat op de lijn, als gewone bon.'));
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-spoedaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/spoed', { ref: b.dataset.spoedaf, op: false }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-lijnaan]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/lijn', { sectie: b.dataset.lijnaan }); toast(d.aangemeld ? '👥 '+T('lijn.aant','Aangemeld op deze kant.') : T('lijn.aftoast','Afgemeld van deze kant.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ksel]').forEach(b => b.addEventListener('click', () => {
      keukenSectie = b.dataset.ksel;
      try { localStorage.setItem('rtg_sup_ksectie', keukenSectie); } catch(e){}
      renderStation();
    }));
    el.querySelectorAll('[data-secgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/sectie', { ref: b.dataset.secgo, sectie: keukenSectie, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/station', { ref: b.dataset.stgo, station: stationMode, phase: b.dataset.phase }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-stserve]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/order/status', { ref: b.dataset.stserve, status: 'geserveerd' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-sttbl]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/status', { id: b.dataset.sttbl, status: TBL_NEXT[b.dataset.cur]||'vrij' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-evcheck]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/checkin', { eventId: b.dataset.evcheck, key: b.dataset.key }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-rundone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet/done', { id: b.dataset.rundone, itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        toast('\u2705 '+d.added+' '+T('ek.planned','MEP-taken ingepland voor '+d.covers+' couverts.'));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmgen]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('dm.busy','Voorspellen...');
      try { const d = await API.call('/supplier/mep/daily', { day: b.dataset.dmgen });
        toast('\u2728 '+T('dm.done1','Voorspelling klaar:')+' '+d.plan.covers+' couverts ('+d.plan.factorLabel+')'+(d.histDagen?', '+T('dm.hist','op basis van')+' '+d.histDagen+' '+T('dm.days','dagen historie'):''));
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-dmdone]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/mep/daily/done', { date: b.dataset.dmdone, taskId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    if (stationMode === 'kantoor') bindKantoor(el);
    // chauffeurspost: ritfase doorzetten of een open rit aannemen
    el.querySelectorAll('[data-chgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ride/status', { ref: b.dataset.chgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-bkgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bkgo, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-chneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref: b.dataset.chneem });
        await API.call('/supplier/ride/assign', { ref: b.dataset.chneem, self: true, vehicleId: s2.vehicleId });
        toast(T('ch.genomen','Rit is van u.') + (s2.vehicleName ? ' 🚘 ' + s2.vehicleName : ''));
        await refresh();
      } catch(e){ toast(e.message); }
    }));
  }

