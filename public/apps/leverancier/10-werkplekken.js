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
    const rest = {};
    nodig.forEach(sec => { const t = sectieDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    const doel = nodig.length ? Math.max.apply(null, nodig.map(s2 => rest[s2])) : 0;
    const plan = {};
    nodig.forEach(sec => {
      if (fase[sec]==='klaar') plan[sec] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (fase[sec]==='bezig') plan[sec] = { doe:'bezig', min:rest[sec] };
      else { const w = doel - rest[sec]; plan[sec] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    return { doel, plan };
  }
  // KDS-tijdbanden: groen tot 6 min, amber tot 12, rood daarna, knipperen vanaf 18
  function ageKlasse(a){ return a >= 18 ? ' late flash' : a >= 12 ? ' late' : a >= 6 ? ' warn' : ' ok'; }
  function vpChip(sec, p){
    if (!p) return '';
    const lbl = { nu: T('vp.nu','start nu'), wacht: T('vp.wacht','wacht'), bezig: T('vp.bezig','bezig'), warm: T('vp.warm','houd warm'), pas: T('vp.pas','naar de pas') }[p.doe] || '';
    const min = (p.doe==='wacht'||p.doe==='bezig'||p.doe==='warm') && p.min ? ' ~'+p.min+'m' : '';
    return '<span class="vp '+p.doe+'">'+KSECTIES[sec][0]+' '+T('ks.'+sec, KSECTIES[sec][1])+' · '+lbl+min+'</span>';
  }
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
      const sec = sectieOf(it); if (!sec) return;
      if (filt && sec !== filt) return;
      if ((o.secties||{})[sec] === 'klaar') return;
      per[it.name] = (per[it.name]||0) + it.qty;
    }));
    const rows = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 14);
    if (!rows.length) return '';
    return '<div class="allday"><span class="ad-h">'+T('kds.allday','All day')+'</span>'+rows.map(r => '<span class="ad"><b>'+r[1]+'×</b>'+r[0]+'</span>').join('')+'</div>';
  }
  const opTijd = (a,b) => new Date(a.at) - new Date(b.at);
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
      (st==='keuken'&&!opts.dim&&sectiesVanOrder(o).length?(function(){
        const vp = vuurplan(o);
        return '<div class="st-badges">'+sectiesVanOrder(o).map(s2 => vpChip(s2, vp.plan[s2])).join('')+'</div>';
      })():'')+
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
      const serve = live.filter(o => o.status === 'klaar');
      const making = live.filter(o => o.status !== 'klaar');
      html += '<div class="st-sec">'+T('st.toserve','Uit te serveren')+' ('+serve.length+')</div>';
      html += serve.length ? serve.map(o => ticketCard(o, null, { serve:true })).join('') : '<div class="st-empty">'+T('st.noserve','Niets klaar om uit te serveren. Zodra keuken en bar klaar zijn, verschijnt de bestelling hier.')+'</div>';
      html += '<div class="st-sec">'+T('st.making','In de maak')+' ('+making.length+')</div>';
      html += making.length ? making.map(o => ticketCard(o, null, { dim:false, badges:true }).replace('</div>$','') .replace(/<\/div>$/, '<div class="tkc-act"><button class="tkc-start" data-settbl="'+o.ref+'" data-cur="'+(o.table||'')+'">\uD83E\uDE91 '+(o.table?o.table+' \u00b7 '+T('st.tblwissel','wijzig'):T('st.tblset','Tafel kiezen'))+'</button></div></div>')).join('') : '<div class="st-empty">'+T('st.nomaking','Geen lopende bestellingen.')+'</div>';
      html += runsheetStrip('bediening');
      const tables = state.tables || [];
      if (tables.length){
        html += '<div class="st-sec">'+T('st.tables','Tafels, tik om te wisselen')+'</div><div class="st-tblgrid">'+
          tables.map(t=>'<button class="tbl tbl-'+t.status+'" data-sttbl="'+t.id+'" data-cur="'+t.status+'"><b>'+t.name+'</b><span>'+t.seats+' '+T('tbl.pers','pers.')+'</span><i>'+tTbl(t.status)+'</i></button>').join('')+'</div>';
      }
      html += '<div class="st-sec">'+T('st.more','Meer')+'</div>'+
        '<a class="tkc" style="text-decoration:none;align-items:flex-start;" href="/apps/personeel.html"><b style="font-size:0.95rem;">\uD83D\uDCF1 '+T('st.pda','Open de volledige PDA')+'</b><span style="font-size:0.74rem;color:var(--soft);">'+T('st.pda.s','Rooster, taken, teamchat, walkie-talkie en SOS.')+'</span></a>';
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
          const actief = mijn.filter(o => (o.secties||{})[sec] !== 'klaar').sort(opTijd);
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
          html += stStats(actief) + allDay(actief, sec);
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
          const bezig = keukenOrders.filter(o => (o.stations||{}).keuken !== 'klaar').sort(opTijd);
          const opDePas = keukenOrders.filter(o => (o.stations||{}).keuken === 'klaar').sort(opTijd);
          const badge = o => '<div class="st-badges">'+sectiesVanOrder(o).map(s2=>{
            const p2=(o.secties||{})[s2]||'';
            return '<span class="st-badge '+p2+'">'+KSECTIES[s2][0]+' '+T('ks.'+s2, KSECTIES[s2][1])+(p2?' \u00b7 '+(p2==='klaar'?T('st.b.klaar','klaar'):T('st.b.bezig','bezig')):'')+'</span>';
          }).join('')+'</div>';
          html += '<div class="st-sec">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>';
          html += opDePas.length ? opDePas.map(o =>
            '<div class="tkc"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
            '<div class="tkc-who">'+o.customerCodename+' \u00b7 '+(o.status==='klaar'?T('ks.pas.wacht','wacht op bediening'):T('ks.pas.bar','wacht nog op de bar'))+'</div>'+
            '<div class="tkc-items">'+(o.items||[]).filter(it=>sectieOf(it)).map(it=>'<span><b>'+it.qty+'\u00d7</b>'+KSECTIES[sectieOf(it)][0]+' '+it.name+'</span>').join('')+'</div>'+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>'
          ).join('') : '<div class="st-empty">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>';
          html += '<div class="st-sec">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>';
          html += bezig.map(o =>
            '<div class="tkc"><div class="tkc-top"><span class="tkc-code">'+o.pickup+(o.table?' <span class="txt-md">\uD83E\uDE91 '+o.table+'</span>':'')+'</span><span class="tkc-age">'+ageMin(o.at)+' min</span></div>'+
            badge(o)+
            (o.allergyNote?'<div class="tkc-alg">\u26a0 '+o.allergyNote+'</div>':'')+'</div>'
          ).join('');
          el.innerHTML = html;
          bindStation(el);
          return;
        }
      }
      const mine = live.filter(o => (o.items||[]).some(it => stationOf(it) === st));
      const act = mine.filter(o => (o.stations||{})[st] !== 'klaar').sort(opTijd);
      const done = mine.filter(o => (o.stations||{})[st] === 'klaar');
      if (st === 'keuken' || st === 'bar') html += stStats(act);
      if (st === 'keuken') html += allDay(act);
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
  // recept uitrollen onder het gerecht; nog geen recept? Dan schrijft de AI er een.
  async function toggleRecept(span){
    const bestaand = span.parentElement.querySelector('.rcp-open[data-for="'+span.dataset.rcp+'"]');
    if (bestaand){ bestaand.remove(); return; }
    const m = (state.menu||[]).find(x => x.id === span.dataset.rcp);
    const div = document.createElement('div');
    div.className = 'rcp-open';
    div.dataset.for = span.dataset.rcp;
    div.style.cssText = 'grid-column:1/-1;white-space:pre-line;font-size:0.78rem;color:var(--muted);background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.8rem;margin:0.2rem 0 0.3rem;line-height:1.6;';
    if (m && m.recept){
      div.textContent = m.recept;
      span.insertAdjacentElement('afterend', div);
    } else {
      div.textContent = T('rcp.making','Nog geen recept; de AI schrijft er nu een...');
      span.insertAdjacentElement('afterend', div);
      try {
        const d = await API.call('/supplier/menu/recipe', { itemId: span.dataset.rcp });
        div.textContent = d.recept;
        if (m) m.recept = d.recept;
      } catch(e){ div.textContent = e.message; }
    }
  }

  function bindStation(el){
    if (stationMode === 'keuken') loadCoach(el);
    el.querySelectorAll('.rcp-item').forEach(s2 => s2.addEventListener('click', () => toggleRecept(s2)));
    el.querySelectorAll('[data-settbl]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('st.tblq','Welke tafel? (leeg = geen tafel)'), b.dataset.cur || '');
      if (t === null) return;
      try { await API.call('/supplier/order/table', { ref: b.dataset.settbl, table: t.trim() }); await refresh(); } catch(e){ toast(e.message); }
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

