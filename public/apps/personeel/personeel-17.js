/* de pas: wat er klaarstaat en wat er nog loopt */
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
        const items = (o.items||[]).filter(pkBarItem);
        return '<div class="card" style="border-left:4px solid '+(a>=8?'#E5484D':a>=4?'#C99A2E':'#2E7D5B')+';">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:1.05rem;color:var(--gold);">'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span style="font-size:0.78rem;font-weight:700;color:'+(a>=8?'#FF8589':a>=4?'#E2B93B':'#7BC79B')+';">'+a+' min</span></div>'+
          '<div style="margin:0.35rem 0 0.5rem;font-size:0.92rem;">'+items.map(it => '<div style="padding:0.15rem 0;">'+((o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id))?'':'')+'<b style="color:var(--gold);">'+it.qty+'×</b> '+esc(it.name)+'</div>').join('')+'</div>'+
          (fase==='bezig'?'<div style="font-size:0.68rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--soft);margin-bottom:0.5rem;">'+T('vp.bezig','bezig')+'</div>':'')+
          '<div style="display:flex;gap:0.5rem;">'+(!fase?'<button class="abtn ghost h-flex1" data-pkbar="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>':'')+
          '<button class="abtn h-flex1" data-pkbar="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div></div>';
      }).join('') : '<div class="card" style="color:var(--soft);font-size:0.85rem;">'+T('pd.b.leeg','Geen open drankbonnen. Nieuwe bestellingen verschijnen hier vanzelf, live met het barscherm.')+'</div>';
    } else {
      const sec = pdaKant;
      const mijn = live.filter(o => pkSecties(o).includes(sec) && (o.secties||{})[sec] !== 'klaar').sort((a,b) => ((b.spoed?1:0)-(a.spoed?1:0)) || (new Date(a.at)-new Date(b.at)));
      const laat = mijn.filter(o => pkAge(o.at) >= 12).length;
      // all day voor deze kant, net als op het grote scherm
      const per = {};
      mijn.forEach(o => (o.items||[]).forEach(it => { if (pkSectieOf(it) === sec) per[it.name] = (per[it.name]||0) + it.qty; }));
      pkMinOver(per);
      const allday = Object.entries(per).sort((a,b) => b[1]-a[1]).slice(0, 8);
      html += '<div class="card" style="display:flex;gap:1.2rem;align-items:center;"><div><b style="font-size:1.3rem;">'+mijn.length+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.open','Open bonnen')+'</span></div>'+
        '<div><b style="font-size:1.3rem;color:'+(laat?'#FF8589':'#7BC79B')+';">'+laat+'</b><span style="display:block;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);">'+T('kds.laat','Te laat')+'</span></div>'+
        (allday.length?'<div style="flex:1;font-size:0.72rem;color:var(--soft);">'+T('kds.allday','All day')+': '+allday.map(r => r[1]+'× '+esc(r[0])).join(', ')+'</div>':'')+'</div>';
      // de bezetting van deze kant: aanmelden = het scherm rekent met jou mee
      const koks = ((state.lijn||{})[sec]) || [];
      const ikSta = me && koks.some(k => k.id === me.staffId);
      const perKok = koks.length ? Math.ceil(mijn.length / koks.length) : mijn.length;
      html += '<div class="card" style="display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap;"><span style="font-size:0.8rem;">'+
        (koks.length ? esc(koks.map(k=>k.name.split(' ')[0]).join(', '))+' · <b>'+perKok+'</b> '+T('lijn.perkok','bon(nen) p.p.') : T('lijn.leeg','Niemand aangemeld'))+'</span>'+
        '<button class="abtn'+(ikSta?'':' ghost')+'" data-pklijn style="margin-left:auto;">'+(ikSta?'✓ '+T('lijn.af2','Aangemeld'):T('lijn.aan','Meld je aan op deze kant'))+'</button></div>';
      // maak nu: in een keer maken, gebundeld over de bonnen
      const nuPer = {};
      mijn.forEach(o => {
        const p2 = pkPlan(o).plan[sec];
        if (!p2 || (p2.doe !== 'nu' && p2.doe !== 'bezig')) return;
        (o.items||[]).forEach(it => { if (pkSectieOf(it) === sec){ nuPer[it.name] = (nuPer[it.name]||0) + it.qty; } });
      });
      pkMinOver(nuPer);
      const nuRows = Object.entries(nuPer).sort((a,b)=>b[1]-a[1]).slice(0,6);
      if (nuRows.length) html += '<div class="card" style="border-left:4px solid #2E7D5B;"><div class="k">'+T('lijn.maaknu','Maak nu, in een keer')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;">'+nuRows.map(r=>'<b style="color:var(--gold);">'+r[1]+'×</b> '+esc(r[0])).join(' · ')+'</div></div>';
      if (pkOverLijst().length) html += '<div class="card"><div class="k">'+T('over.h','Op de pas over')+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.85rem;">'+pkOverLijst().map(x=>'<b style="color:var(--gold);">'+x.qty+'×</b> '+esc(x.name)).join(' · ')+' · <span style="color:var(--soft);">'+T('over.eerst','gebruik eerst wat er ligt')+'</span></div></div>';
      html += mijn.length ? mijn.map(o => {
        const a = pkAge(o.at);
        const p = pkPlan(o).plan[sec];
        const adv = p ? ({ nu: '▶ '+T('vp.nu','start nu'), wacht: ''+T('vp.wacht','wacht')+' ~'+p.min+'m', bezig: ''+T('vp.bezig','bezig'), warm: ''+T('vp.warm','houd warm'), pas: '✓ '+T('vp.pas','naar de pas') })[p.doe] : '';
        const fase = (o.secties||{})[sec];
        const items = (o.items||[]).filter(it => pkSectieOf(it) === sec);
        return '<div class="card" style="border-left:4px solid '+(a>=12?'#E5484D':a>=6?'#C99A2E':'#2E7D5B')+';">'+
          '<div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:1.05rem;color:var(--gold);">'+o.pickup+(o.table?' · '+esc(o.table):'')+'</b><span style="font-size:0.78rem;font-weight:700;color:'+(a>=12?'#FF8589':a>=6?'#E2B93B':'#7BC79B')+';">'+a+' min</span></div>'+
          '<div style="margin:0.35rem 0 0.5rem;font-size:0.92rem;">'+items.map(it => '<div data-pkdish="'+it.id+'" style="padding:0.15rem 0;">'+((o.spoed && (!o.spoed.itemId || o.spoed.itemId === it.id))?'':'')+'<b style="color:var(--gold);">'+it.qty+'×</b> '+esc(it.name)+'</div>').join('')+'</div>'+
          (o.allergyNote?'<div style="font-size:0.76rem;color:#FF8589;border:1px solid rgba(229,72,77,0.4);border-radius:0;padding:0.35rem 0.5rem;margin-bottom:0.5rem;">'+esc(o.allergyNote)+'</div>':'')+
          (o.zorg?'<div style="font-size:0.76rem;color:#FF8589;border:1px solid rgba(229,72,77,0.4);border-radius:0;padding:0.35rem 0.5rem;margin-bottom:0.5rem;">'+T('pd.zorgp','Zorgprofiel gast')+': '+esc(pkZorg(o.zorg))+'</div>':'')+
          pkGast(o)+
          (adv?'<div style="font-size:0.68rem;letter-spacing:0.05em;text-transform:uppercase;color:var(--soft);margin-bottom:0.5rem;">'+adv+'</div>':'')+
          '<div style="display:flex;gap:0.5rem;">'+(!fase?'<button class="abtn ghost h-flex1" data-pkgo="'+o.ref+'" data-phase="bezig">'+T('st.start','Start')+'</button>':'')+
          '<button class="abtn h-flex1" data-pkgo="'+o.ref+'" data-phase="klaar">'+T('st.ready','Klaar')+'</button></div></div>';
      }).join('') : '<div class="card" style="color:var(--soft);font-size:0.85rem;">'+T('pd.k.leeg','Niets voor deze kant. Nieuwe bonnen verschijnen hier vanzelf, live met het keukenscherm.')+'</div>';
    }
