    document.querySelectorAll('[data-pdbzai]').forEach(b => b.addEventListener('click', async () => {
      const uit = document.getElementById('pdBzAiUit');
      uit.textContent = '\u2026';
      // eerst de AI van de zaak; lukt dat niet, dan het vaste bezorgprotocol
      const vast = {
        'adres': T('pd.bz.p1','Bel of chat de gast via de zaak; klopt het adres echt niet, overleg dan met de zaak en lever niet zomaar ergens af.'),
        'open': T('pd.bz.p2','Bel aan, wacht 2 minuten, bel de gast via de zaak. Geen gehoor? Terug naar de zaak; nooit onbeheerd achterlaten.'),
        'vertraging': T('pd.bz.p3','Meld het de zaak; de klant ziet uw GPS en ETA al live. Veilig rijden gaat voor snelheid.'),
        'beschadigd': T('pd.bz.p4','Niet afleveren. Meld het de zaak; die regelt een nieuwe bereiding of terugbetaling met de klant.')
      };
      const sleutel = /adres/i.test(b.dataset.pdbzai) ? 'adres' : /open/i.test(b.dataset.pdbzai) ? 'open' : /vertraging/i.test(b.dataset.pdbzai) ? 'vertraging' : 'beschadigd';
      try {
        const r = await API.call('/supplier/ai', { q: b.dataset.pdbzai });
        uit.textContent = r.reply || vast[sleutel];
      } catch(e){ uit.textContent = vast[sleutel]; }
    }));
  }

  /* ---- de keuken op zak: uw kant van de lijn, live met het keukenscherm ----
     Zelfde rekenregels als het KDS en de servercoach: nominale tijd per kant
     (prepMin op het gerecht wint), klaar telt 0, bezig de halve tijd, niet
     gestart de volle tijd; de langzaamste kant bepaalt wanneer de rest start,
     zodat de hele tafel tegelijk warm uitgaat. Elke actie hier staat direct
     op het keukenscherm en andersom (SSE-sync). */
  const PDA_KANTEN = { warm:['','Warme kant'], koud:['','Koude kant'], snack:['','Snacks'], dessert:['','Desserts'], bar:['','Bar'], pas:['','De pas'] };
  const PDA_KTIJD = { warm: 12, koud: 6, snack: 8, dessert: 5 };
  let pdaKant = (() => { try { return localStorage.getItem('rtg_pda_kant') || 'warm'; } catch(e){ return 'warm'; } })();
  const heeftKeuken = () => !!(state && (state.menu||[]).some(m => m.station !== 'bar'));
  const heeftBar = () => !!(state && (state.menu||[]).some(m => m.station === 'bar'));
  const pkBarItem = it => { const m = (state.menu||[]).find(x => x.id === it.id); return !!(m && m.station === 'bar'); };
  const pkSectieOf = it => { const m = (state.menu||[]).find(x => x.id === it.id); return (m && m.station !== 'bar') ? (m.sectie || 'warm') : null; };
  const pkSecties = o => [...new Set((o.items||[]).map(pkSectieOf).filter(Boolean))];
  const pkAge = iso => Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  function pkDuur(o, sec){
    let t = PDA_KTIJD[sec] || 8;
    (o.items||[]).forEach(it => { const m = (state.menu||[]).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie||'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin); });
    return t;
  }
  function pkPlan(o){
    const nodig = pkSecties(o), fase = o.secties || {}, rest = {};
    const faseVan = k => k === 'bar' ? (o.stations||{}).bar : fase[k];
    nodig.forEach(sec => { const t = pkDuur(o, sec); rest[sec] = fase[sec]==='klaar' ? 0 : fase[sec]==='bezig' ? Math.ceil(t/2) : t; });
    // de bar telt mee, zodat drankjes en eten samen uitgaan
    if ((o.items||[]).some(it => { const m = (state.menu||[]).find(x => x.id === it.id); return m && m.station === 'bar'; })){
      const bf = (o.stations||{}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? 2 : 4;
    }
    const alle = Object.keys(rest);
    let doel = alle.length ? Math.max.apply(null, alle.map(k => rest[k])) : 0;
    // deurhost: deelt de gast zijn reis (GPS), dan mikt het plan op de aankomst
    if (!o.guestArrived && Number.isFinite(o.guestEtaMin) && o.guestEtaMin > doel) doel = o.guestEtaMin;
    const plan = {};
    alle.forEach(k => {
      const f = faseVan(k);
      if (f==='klaar') plan[k] = doel > 0 ? { doe:'warm', min:doel } : { doe:'pas', min:0 };
      else if (f==='bezig') plan[k] = { doe:'bezig', min:rest[k] };
      else { const w = doel - rest[k]; plan[k] = w >= 2 ? { doe:'wacht', min:w } : { doe:'nu', min:0 }; }
    });
    return { doel, plan };
  }
  // de deurhost-regel: waar is de gast (GPS uit de leden-app)
  function pkGast(o){
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
