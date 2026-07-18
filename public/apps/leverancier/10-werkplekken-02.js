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

  /* De voorraadbalk op de werkvloer: wat is laag, wat is op, en welke
     gerechten verdienen een 86 omdat een ingredient uit het recept op is.
     Gevoed door het keukenbrein (kern/keuken.js), zuinig ververst. */
  let wvInfo = null, wvAt = 0, wvBezig = false;
  function laadWerkvloer(){
    if (wvBezig || Date.now() - wvAt < 15000) return;
    wvBezig = true;
    API.call('/supplier/keuken/werkvloer').then(d => { wvInfo = d; wvAt = Date.now(); wvBezig = false; renderStation(); }).catch(() => { wvBezig = false; wvAt = Date.now(); });
  }
  function werkvloerBalk(){
    if (!wvInfo) return '';
    const chips = [];
    (wvInfo.adviezen||[]).forEach(a => chips.push('<button class="obtn warn" data-st86adv="'+a.menuItemId+'">\u26d4 86: '+esc(a.gerecht)+' ('+esc(a.ingredient)+' '+T('st.isop','is op')+')</button>'));
    (wvInfo.op||[]).forEach(a => chips.push('<span class="ad" style="color:#FF8589;font-weight:600;">'+esc(a.naam)+' '+T('st.op','OP')+'</span>'));
    (wvInfo.laag||[]).forEach(a => chips.push('<span class="ad">'+esc(a.naam)+' '+T('st.laag','laag')+' ('+a.aantal+' '+esc(a.eenheid)+')</span>'));
    chips.push('<button class="obtn ghost" data-stderf>\u267b '+T('st.derf','Derving melden')+'</button>');
    return '<div class="allday"><span class="ad-h">\ud83d\udce6 '+T('st.voorraad','Voorraad')+'</span>'+chips.join('')+'</div>';
  }
  function renderStation(){
    const el = $('#stBody'); if (!el || !state) return;
    $('#stBiz').textContent = S ? S.name : '';
    $('#stLabel').textContent = stationLabel(stationMode) + (stationMode === 'keuken' ? ' \u00b7 ' + T('ks.'+keukenSectie, (KSECTIES[keukenSectie]||['',''])[1]) : '');
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status));
    let html = '';
    if (stationMode === 'keuken' || stationMode === 'bar'){ laadWerkvloer(); html += werkvloerBalk(); }
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
