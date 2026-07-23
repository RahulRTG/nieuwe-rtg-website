    if (!bevDatum) bevDatum = bevVandaag();
    try { cmd = await API.call('/supplier/beveiliging/command'); } catch(e){ el.innerHTML='<div class="softline">'+esc(e.message)+'</div>'; return; }
    try { roo = await API.call('/supplier/beveiliging/rooster', { van: bevDatum, dagen: 1 }); } catch(e){ roo = { dagen: [] }; }
    const b = cmd.budget || {};
    // 1) momentopname
    let h = '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem;">'+
      zbCel(cmd.opDienst.length, T('bev.opdienst','Op dienst'))+
      zbCel(cmd.team, T('bev.team','Bewakers'))+
      zbCel(cmd.posten, T('bev.posten','Posten'))+
      zbCel(cmd.openVandaag, T('bev.openvandaag','Open vandaag'), cmd.openVandaag)+
      zbCel(cmd.openAanvragen, T('bev.aanvragen','Aanvragen'), cmd.openAanvragen)+
      zbCel(cmd.incidentenOpen, T('bev.incidenten','Incidenten'), cmd.incidentenOpen)+'</div>';
    if (cmd.sosActief) h += '<div class="card" style="border:1px solid var(--rood);background:#3a1420;color:#F4B8C6;margin-bottom:0.8rem;font-weight:600;">'+T('bev.sos','Actieve SOS! Een bewaker heeft de noodknop ingedrukt. Bekijk het incident en stuur bijstand.')+'</div>';
    // 2) functies aan/uit
    const bevChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (cmd.functies||[]).map(f => '<button class="js-bevf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+'</div>';
    h += funcBlok(T('bev.func','Functies (aan/uit)'), cmd.functies||[], bevChips);
    // 3) budget
    if (b.budgetUren){
      const kleur = b.overschrijding ? 'var(--rood)' : (b.pct>=85?'#E0A93A':'#7EE0A3');
      h += '<div class="st-sec">'+T('bev.budget','Budget & uren')+'</div>'+
        '<div class="card" style="margin-bottom:1rem;">'+
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.3rem;"><span>'+b.urenGepland+' / '+b.budgetUren+' '+T('bev.uur','uur')+' ('+b.maand+')</span><b>€ '+b.bestedBedrag+' / € '+b.budgetBedrag+'</b></div>'+
        '<div style="height:8px;border-radius:99px;background:var(--card2);overflow:hidden;"><div style="height:100%;width:'+Math.min(100,b.pct)+'%;background:'+kleur+';"></div></div>'+
        '<div class="sub" style="margin-top:0.4rem;">'+esc(b.advies)+'</div>'+
        (b.perPost&&b.perPost.length? '<div class="sub" style="margin-top:0.4rem;">'+b.perPost.map(p=>esc(p.naam)+': '+p.uren+' u (€ '+p.bedrag+')').join(' · ')+'</div>':'')+
        '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="bevBudUren" type="number" min="0" placeholder="'+T('bev.buduren','budget-uren/mnd')+'" value="'+b.budgetUren+'" style="width:9rem;">'+
        '<input id="bevBudTarief" type="number" min="0" placeholder="'+T('bev.tarief','tarief/uur')+'" value="'+b.tariefUur+'" style="width:8rem;">'+
        '<button class="abtn" id="bevBudSave">'+T('bev.opslaan','Opslaan')+'</button></div>'+
        '</div>';
    }
    // 4) rooster met AI-overname
    h += '<div class="st-sec">'+T('bev.rooster','Rooster')+'</div>'+
      '<div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap;">'+
      '<input id="bevDag" type="date" value="'+bevDatum+'" style="width:11rem;">'+
      '<button class="abtn" id="bevAI">'+T('bev.ai','AI neemt het over')+'</button></div>';
    const dag = roo.dagen && roo.dagen[0];
    if (dag){
      h += '<div class="card" style="margin-bottom:1rem;">'+ (dag.posten.length? dag.posten.map(p =>
        '<div style="border-bottom:1px solid var(--line);padding:0.5rem 0;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+esc(p.post)+'</b>'+(p.open?'<span style="color:var(--rood);font-size:0.72rem;">'+p.open+' '+T('bev.open','open')+'</span>':'<span style="color:#7EE0A3;font-size:0.72rem;">'+T('bev.gedekt','gedekt')+'</span>')+'</div>'+
          p.shifts.map(sl => '<div class="sub" style="margin-top:0.2rem;">'+esc(sl.shift)+': '+
            (sl.bezet.length? sl.bezet.map(d=>'<span class="bev-chip'+(d.status==='ingeklokt'?' on':'')+'">'+esc(d.guardNaam||'?')+(d.status==='ingeklokt'?' ●':'')+' <a data-schrap="'+d.id+'">✕</a></span>').join(' ') : '')+
            (sl.open? ' <button class="bev-plan" data-post="'+p.postId+'" data-shift="'+sl.shiftId+'">+ '+T('bev.plan','plan')+'</button>':'')+
          '</div>').join('')+
        '</div>'
      ).join('') : '<div class="softline">'+T('bev.geenpost','Nog geen posten. Voeg hieronder objecten toe.')+'</div>')+'</div>';
    }
    // 5) inzetaanvragen
    h += '<div class="st-sec">'+T('bev.inzet','Inzetaanvragen')+'</div>';
    const open = (cmd.functies||[]).find(f=>f.id==='aanvragen' && f.aan);
    h += '<div class="card" style="margin-bottom:1rem;"><div id="bevAvLijst"></div>'+
      (open? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        '<input id="bevAvKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
        '<input id="bevAvObject" placeholder="'+T('bev.object','object/locatie')+'" style="width:9rem;">'+
        '<input id="bevAvDatum" type="date" value="'+bevDatum+'" style="width:10rem;">'+
        '<input id="bevAvAantal" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.aantal','aantal bewakers')+'">'+
        '<button class="abtn" id="bevAvAdd">'+T('bev.avadd','Aanvraag toevoegen')+'</button></div>':'')+
      '</div>';
    // 6) posten beheren
    const posten = cmd.postenLijst || [];
    h += '<div class="st-sec">'+T('bev.postbeheer','Posten & objecten')+'</div>'+
      '<div class="card" style="margin-bottom:1rem;">'+
      (posten.length? posten.map(p => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<span><b>'+esc(p.naam)+'</b>'+(p.klant?' · '+esc(p.klant):'')+' · '+(p.minMan||1)+' '+T('bev.man','man')+(p.orders?'<br><span class="sub">'+esc(p.orders)+'</span>':'')+'</span>'+
        '<button class="abtn ghost" data-postweg="'+p.id+'">✕</button></div>').join('') : '<div class="softline">'+T('bev.geenpost2','Nog geen posten.')+'</div>')+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      '<input id="bevPostNaam" placeholder="'+T('bev.postnaam','postnaam')+'" style="width:9rem;">'+
      '<input id="bevPostKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
      '<input id="bevPostMin" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.min','min. bezetting')+'">'+
      '<button class="abtn" id="bevPostAdd">'+T('bev.postadd','Post toevoegen')+'</button></div></div>';
    // 7) incidenten
    if (cmd.incidenten && cmd.incidenten.length){
      h += '<div class="st-sec">'+T('bev.incs','Incidenten')+'</div><div class="card" style="margin-bottom:0.5rem;">'+
        cmd.incidenten.map(x => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
          '<span><b'+(x.ernst==='kritiek'||x.ernst==='hoog'?' style="color:var(--rood);"':'')+'>'+(x.sos?'':'')+esc(x.soort)+'</b> · '+esc(x.post)+' · '+esc(x.guardNaam||'')+'<br><span class="sub">'+esc(x.tekst)+'</span></span>'+
          '<button class="bev-inc" data-id="'+x.id+'" style="align-self:flex-start;">'+(x.status==='open'?T('bev.afh','Afhandelen'):T('bev.heropen','Heropen'))+'</button></div>').join('')+'</div>';
    }
    el.innerHTML = h;
    wireFuncBlok(el);
    // bindingen
    el.querySelectorAll('.js-bevf').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/functie', { id:x.dataset.id, aan: x.dataset.aan!=='true' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    const bind = (id, fn) => { const e2=$('#'+id); if (e2) e2.addEventListener('click', fn); };
