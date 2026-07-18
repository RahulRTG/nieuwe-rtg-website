    const vrij = alle.filter(o => o.levering === 'bezorgen' && !o.bezorger);
    const mijnKlaar = mijn.filter(o => o.status === 'klaar').map(o => o.ref);
    const rij = (o, extra) => {
      const m = afstandNaar(o);
      return '<div class="task"><span class="ic">'+(o.status==='onderweg'?'\uD83D\uDEF5':'\uD83D\uDCE6')+'</span><div class="t">'+
        '<b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+(o.etaMin?' \u00B7 '+o.etaMin+' min':'')+'</b>'+
        '<span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+(m!=null?' \u00B7 '+(m<1000?m+' m':(m/1000).toFixed(1)+' km'):'')+'</span>'+
        '<span><a href="'+kaartLink(o)+'" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">\uD83D\uDDFA\uFE0F '+T('pd.bz.nav','Navigeer')+'</a></span></div>'+(extra||'')+'</div>';
    };
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.bz.gps','Live GPS')+'</div>'+
      '<div class="task"><span class="ic">\uD83D\uDEF0\uFE0F</span><div class="t"><b>'+(gpsWatch!=null?T('pd.bz.gpsaan','U deelt uw positie; de klant ziet u rijden.'):T('pd.bz.gpsuit','GPS staat uit.'))+'</b>'+
      '<span>'+T('pd.bz.gpsuitleg','Alleen tijdens uw rit; stopt zodra u hem uitzet.')+'</span></div>'+
      '<button class="abtn" id="pdGps">'+(gpsWatch!=null?T('pd.bz.stop','Stop'):T('pd.bz.start','Start'))+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.bz.mijn','Mijn rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(o => rij(o,
          o.status==='onderweg' ? '<button class="abtn" data-pdbz="'+o.ref+'" data-st="bezorgd">'+T('pd.bz.bezorgd','Bezorgd')+'</button>' : ''
        )).join('') +
        (mijnKlaar.length ? '<button class="abtn" id="pdVertrek" style="margin-top:0.6rem;">\uD83D\uDEF5 '+T('pd.bz.vertrek','Vertrek')+' ('+mijnKlaar.length+')</button>' : '')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenmijn','Geen rit op uw naam. Neem hieronder leveringen aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.vrij','Klaar om mee te nemen')+' ('+vrij.length+')</div>'+
      (vrij.length ? vrij.map(o =>
        '<label class="task" style="cursor:pointer;"><input type="checkbox" class="pdbzkies" value="'+o.ref+'" style="margin-right:0.4rem;accent-color:var(--gold);"'+(o.status==='klaar'?'':' ')+'>'+
        '<div class="t"><b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+'</b><span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+'</span></div></label>'
      ).join('') + '<button class="abtn" id="pdNeem" style="margin-top:0.6rem;">'+T('pd.bz.neem','Neem geselecteerde ritten (op uw naam)')+'</button>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenvrij','Niets klaar om mee te nemen. Nieuwe leveringen verschijnen hier live.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.ai','Snelle hulp (AI)')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      [[T('pd.bz.ai1','Adres klopt niet'),'Het bezorgadres lijkt niet te kloppen, wat doe ik?'],
       [T('pd.bz.ai2','Gast doet niet open'),'De gast doet niet open bij de bezorging, wat doe ik?'],
       [T('pd.bz.ai3','Ik heb vertraging'),'Ik heb vertraging met de bezorging, wat doe ik?'],
       [T('pd.bz.ai4','Bestelling beschadigd'),'De bestelling is onderweg beschadigd, wat doe ik?']]
      .map(c => '<button class="abtn" data-pdbzai="'+esc(c[1])+'">'+c[0]+'</button>').join('')+'</div>'+
      '<div id="pdBzAiUit" style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    const g = document.getElementById('pdGps'); if (g) g.addEventListener('click', gpsAanUit);
    const v = document.getElementById('pdVertrek'); if (v) v.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { refs: mijnKlaar, status: 'onderweg' }); if (gpsWatch == null) gpsAanUit(); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    const n = document.getElementById('pdNeem'); if (n) n.addEventListener('click', async () => {
      const refs = [...document.querySelectorAll('.pdbzkies:checked')].map(x => x.value);
      if (!refs.length) { toast(T('pd.bz.kies','Vink eerst een of meer leveringen aan.')); return; }
      try { const r = await API.call('/supplier/bezorg/neem', { refs }); toast(r.genomen.length + ' ' + T('pd.bz.opnaam','rit(ten) op uw naam.')); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-pdbz]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { ref: b.dataset.pdbz, status: b.dataset.st }); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    }));
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
  const PDA_KANTEN = { warm:['🔥','Warme kant'], koud:['❄️','Koude kant'], snack:['🍟','Snacks'], dessert:['🍰','Desserts'], bar:['🍸','Bar'], pas:['🍽️','De pas'] };
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
