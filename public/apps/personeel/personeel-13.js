    if (o.guestArrived) return '<div style="font-size:0.74rem;color:#7BC79B;margin-bottom:0.4rem;">'+T('kds.gastin','De gast is binnen.')+'</div>';
    if (Number.isFinite(o.guestEtaMin)) return '<div style="font-size:0.74rem;color:var(--soft);margin-bottom:0.4rem;">'+T('kds.gast','Gast onderweg, ~')+o.guestEtaMin+' min</div>';
    return '';
  }
  // het overschot op de pas: wat er ligt hoef je niet te maken
  const pkOverLijst = () => (state && state.overschot) || [];
  const pkOverQty = naam => pkOverLijst().filter(x => x.name === naam).reduce((n,x) => n + x.qty, 0);
  const pkMinOver = per => { Object.keys(per).forEach(n => { const ov = pkOverQty(n); if (ov){ per[n] = Math.max(0, per[n] - ov); if (!per[n]) delete per[n]; } }); return per; };
  // pas-meldingen (tril + toast) per toestel aan of uit: de gekozen personen
  let pdaPasBel = (() => { try { return localStorage.getItem('rtg_pda_pasbel') !== 'uit'; } catch(e){ return true; } })();
  // pings gaan alleen naar wie echt ingeklokt is: niet ingeklokt = geen tril
  const ikBinnen = () => !!(me && state && state.klok && (state.klok.binnen || []).includes(me.name));

  /* ---- (video)bellen met ingeklokte collega's: echte WebRTC ----
     De gespreks-UI en de verbindingen zitten in shared/teamcall.js; hier
     alleen de koppeling met de eigen login en het SSE-kanaal. */
  if (window.TeamCall) TeamCall.init({ API, mij: () => me, T, toast });
  // en het directe chatbericht naar een collega (shared/collegachat.js)
  if (window.CollegaChat) CollegaChat.init({ API, mij: () => me, T, toast });
  /* De voorraadbalk op zak: laag, op en 86-adviezen uit het keukenbrein,
     dezelfde informatie als op het grote keuken- en barscherm. */
  let pkWv = null, pkWvAt = 0, pkWvBezig = false;
  function pkLaadWerkvloer(){
    if (pkWvBezig || Date.now() - pkWvAt < 20000) return;
    pkWvBezig = true;
    API.call('/supplier/keuken/werkvloer').then(d => { pkWv = d; pkWvAt = Date.now(); pkWvBezig = false; renderKeuken(); }).catch(() => { pkWvBezig = false; pkWvAt = Date.now(); });
  }
  function pkVoorraadKaart(){
    if (!pkWv || (!(pkWv.adviezen||[]).length && !(pkWv.op||[]).length && !(pkWv.laag||[]).length)) return '';
    return '<div class="card" style="border-left:4px solid var(--gold,#A98F1C);"><div class="k">'+T('st.voorraad','Voorraad')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem;align-items:center;">'+
      (pkWv.adviezen||[]).map(a => '<button class="abtn" data-pk86="'+a.menuItemId+'" style="border-color:#E5484D;color:#FF8589;">86: '+esc(a.gerecht)+' ('+esc(a.ingredient)+' '+T('st.isop','is op')+')</button>').join('')+
      (pkWv.op||[]).map(a => '<span style="font-size:0.78rem;color:#FF8589;font-weight:600;">'+esc(a.naam)+' '+T('st.op','OP')+'</span>').join('')+
      (pkWv.laag||[]).map(a => '<span style="font-size:0.78rem;color:var(--soft);">'+esc(a.naam)+' '+T('st.laag','laag')+' ('+a.aantal+' '+esc(a.eenheid)+')</span>').join('')+
      '<button class="abtn ghost" data-pkderf>'+T('st.derf','Derving melden')+'</button></div></div>';
  }
  function renderKeuken(){
    const tabBtn = document.getElementById('tabKeuken');
    if (tabBtn) tabBtn.style.display = (heeftKeuken() || heeftBar()) ? '' : 'none';
    const wrap = $('#keukenWrap'); if (!wrap) return;
    if (!heeftKeuken() && !heeftBar()){ wrap.innerHTML = ''; return; }
    // een pure bar of club heeft alleen de barkant; stuur de keuze daarheen
    if (!heeftKeuken() && pdaKant !== 'bar') pdaKant = 'bar';
    if (!heeftBar() && pdaKant === 'bar') pdaKant = 'warm';
    pkLaadWerkvloer();
    const live = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status) && pkSecties(o).length);
    // kant kiezen = inloggen op dat station; de keuze blijft op dit toestel staan
    const kanten = Object.keys(PDA_KANTEN).filter(k => k === 'bar' ? heeftBar() : (heeftKeuken() || k === 'bar'));
    let html = '<div class="card" style="display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;">'+kanten.map(k =>
      '<button class="abtn'+(pdaKant===k?'':' ghost')+'" data-pkkant="'+k+'">'+PDA_KANTEN[k][0]+' '+T('ks.'+k, PDA_KANTEN[k][1])+'</button>').join('')+
      '<button class="abtn'+(pdaPasBel?'':' ghost')+'" data-pkbel style="margin-left:auto;">'+(pdaPasBel?'':'')+' '+T('pd.k.pasbel','Pas-bel')+'</button>'+
      (ikBinnen()?'':'<span style="flex-basis:100%;font-size:0.68rem;color:var(--soft);">'+T('pd.k.nietin','Niet ingeklokt: pings staan uit tot je inklokt (tab Vandaag).')+'</span>')+'</div>';
    html += pkVoorraadKaart();
    if (pdaKant === 'pas'){
      const opDePas = live.filter(o => (o.stations||{}).keuken === 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.pasAt||a.at)-new Date(b.pasAt||b.at)));
      const bezig = live.filter(o => (o.stations||{}).keuken !== 'klaar');
      // staat alles van een tafel op de pas, dan kan de hele tafel in een keer uit
      const tafels = {};
      opDePas.forEach(o => { if (o.table) (tafels[o.table] = tafels[o.table] || []).push(o); });
      const compleet = Object.keys(tafels).filter(t => !bezig.some(o => (o.table||'') === t));
      if (compleet.length) html += '<div class="card" style="border-left:4px solid #2E7D5B;"><div class="k">'+T('pas.compleet','Tafel compleet')+'</div>'+
        compleet.map(t => '<div style="margin-top:0.35rem;font-size:0.85rem;"><b>'+esc(t)+'</b> · '+tafels[t].map(o=>o.pickup).join(', ')+' · '+T('pas.samen','stuur samen uit')+'</div>').join('')+'</div>';
      if (pkOverLijst().length) html += '<div class="card"><div class="k">'+T('over.h','Op de pas over')+'</div>'+
        pkOverLijst().map(x=>'<div class="task"><div class="t"><b>'+x.qty+'× '+esc(x.name)+'</b><span>'+esc(x.door||'')+'</span></div><button class="abtn" data-pkover="'+x.id+'">'+T('over.gebruikt','Gebruikt')+'</button></div>').join('')+'</div>';
      html += '<div class="card"><div class="k">'+T('ks.pas.klaar','Op de pas, samenstellen en doorgeven')+' ('+opDePas.length+')</div>'+
        (opDePas.length ? opDePas.map(o => { const pa = pkAge(o.pasAt || o.at);
          return '<div class="task"><span class="ic"></span><div class="t"><b>'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span>'+(o.items||[]).filter(it=>pkSectieOf(it)).map(it=>it.qty+'× '+esc(it.name)).join(', ')+(Number.isFinite(o.guestEtaMin)&&!o.guestArrived?' ·  ~'+o.guestEtaMin+'m':o.guestArrived?' · ':'')+'</span></div><span style="font-size:0.72rem;font-weight:700;color:'+(pa>=6?'#FF8589':pa>=3?'#E2B93B':'#7BC79B')+';">'+pa+'m</span></div>'; }).join('')
          : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('ks.pas.leeg','Nog niets op de pas. Zodra alle kanten klaar zijn, komt de bestelling hier binnen.')+'</div>')+'</div>';
      if (bezig.length) html += '<div class="card"><div class="k">'+T('ks.pas.bezig','In de maak, per kant')+' ('+bezig.length+')</div>'+
        bezig.map(o => '<div class="task"><span class="ic"></span><div class="t"><b>'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span>'+pkSecties(o).map(s2 => PDA_KANTEN[s2][0]+' '+((o.secties||{})[s2]||T('pd.k.wacht','wacht'))).join(' · ')+'</span></div><span style="font-size:0.72rem;color:var(--soft);">'+pkAge(o.at)+'m</span></div>').join('')+'</div>';
    } else if (pdaKant === 'bar'){
      /* de barkant op zak: alle bonnen met drankjes, los van de keukenkanten;
         start en klaar lopen via hetzelfde station als het grote barscherm */
      const barLive = (state.orders||[]).filter(o => !['geserveerd','geweigerd','terugbetaald'].includes(o.status) && (o.items||[]).some(pkBarItem));
      const mijn = barLive.filter(o => (o.stations||{}).bar !== 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.at)-new Date(b.at)));
      const laat = mijn.filter(o => pkAge(o.at) >= 8).length;
      const per = {};
      mijn.forEach(o => (o.items||[]).forEach(it => { if (pkBarItem(it)) per[it.name] = (per[it.name]||0) + it.qty; }));
      const allday = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 8);
      html += '<div class="card" style="display:flex;gap:1.2rem;align-items:center;"><div><b style="font-size:1.3rem;">'+mijn.length+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.open','Open bonnen')+'</span></div>'+
        '<div><b style="font-size:1.3rem;color:'+(laat?'#FF8589':'#7BC79B')+';">'+laat+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.laat','Te laat')+'</span></div>'+
        (allday.length?'<div style="flex:1;font-size:0.72rem;color:var(--soft);">'+T('kds.allday','All day')+': '+allday.map(r => r[1]+'× '+esc(r[0])).join(', ')+'</div>':'')+'</div>';
      html += mijn.length ? mijn.map(o => {
        const a = pkAge(o.at);
        const fase = (o.stations||{}).bar;
