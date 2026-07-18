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
