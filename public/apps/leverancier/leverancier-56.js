/* een cel op het zaakbord, en de samenvatting van schakelaars */
  function zbCel(n, label, waarschuw){
    return '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v'+(waarschuw?' a':'')+'">'+n+'</div><div class="l">'+label+'</div></div>';
  }
  /* Gedeeld met de Boardroom: vat een rij aan/uit-schakelaars samen tot een
     rustige, inklapbare kop "titel · X/Y aan". Alleen open als er iets uit staat
     (de uitzondering telt), of wanneer de gebruiker erop tikt. Zo lijken alle
     schakelpanelen op elkaar en oogt veel opties nooit slordig. */
  function funcBlok(titel, functies, chipsHTML){
    const totaal = functies.length;
    const aan = functies.filter(f => f.aan).length;
    const uit = totaal - aan;
    const afwijkt = uit > 0;
    return '<button type="button" class="func-kop" data-funcblok>'+
      '<span class="func-chev">'+(afwijkt?'▾':'▸')+'</span>'+
      '<span class="func-naam">'+esc(titel)+'</span>'+
      '<span class="func-tel'+(afwijkt?' let':'')+'">'+aan+'/'+totaal+' '+T('fb.aan','aan')+(uit?' · '+uit+' '+T('fb.uit','uit'):'')+'</span></button>'+
      '<div class="func-body"'+(afwijkt?'':' hidden')+'>'+chipsHTML+'</div>';
  }
  /* Klap elk funcBlok in een container open/dicht (chevron mee). */
  function wireFuncBlok(root){
    if (!root) return;
    root.querySelectorAll('[data-funcblok]').forEach(k => k.addEventListener('click', () => {
      const body = k.nextElementSibling; if (!body) return;
      const chev = k.querySelector('.func-chev');
      const dicht = body.hidden; body.hidden = !dicht;
      if (chev) chev.textContent = dicht ? '▾' : '▸';
    }));
  }

  /* ---- het beveiligings-commandocentrum ---- */
  let bevDatum = null; // gekozen roosterdag
  function bevVandaag(){ return new Date().toISOString().slice(0,10); }
  async function renderBeveiliging(){
    const el = $('#bevWrap'); if (!el) return;
    if (!has('beveiliging')) { el.innerHTML=''; return; }
    let cmd, roo;
    if (!bevDatum) bevDatum = bevVandaag();
    try { cmd = await API.call('/supplier/beveiliging/command'); } catch(e){ el.innerHTML='<div class="softline">'+esc(e.message)+'</div>'; return; }
    try { roo = await API.call('/supplier/beveiliging/rooster', { van: bevDatum, dagen: 1 }); } catch(e){ roo = { dagen: [] }; }
    const b = cmd.budget || {};
    // 1) momentopname
    let h = '<div class="stats s-fmbhfn">'+
      zbCel(cmd.opDienst.length, T('bev.opdienst','Op dienst'))+
      zbCel(cmd.team, T('bev.team','Bewakers'))+
      zbCel(cmd.posten, T('bev.posten','Posten'))+
      zbCel(cmd.openVandaag, T('bev.openvandaag','Open vandaag'), cmd.openVandaag)+
      zbCel(cmd.openAanvragen, T('bev.aanvragen','Aanvragen'), cmd.openAanvragen)+
      zbCel(cmd.incidentenOpen, T('bev.incidenten','Incidenten'), cmd.incidentenOpen)+'</div>';
    if (cmd.sosActief) h += '<div class="card" style="border:1px solid var(--rood);background:#3a1420;color:#F4B8C6;margin-bottom:0.75rem;font-weight:600;">'+T('bev.sos','Actieve SOS! Een bewaker heeft de noodknop ingedrukt. Bekijk het incident en stuur bijstand.')+'</div>';
    // 2) functies aan/uit
    const bevChips = '<div class="s-c1fzjn">'+
      (cmd.functies||[]).map(f => '<button class="js-bevf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:0;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+'</div>';
    h += funcBlok(T('bev.func','Functies (aan/uit)'), cmd.functies||[], bevChips);
    // 3) budget
    if (b.budgetUren){
      const kleur = b.overschrijding ? 'var(--rood)' : (b.pct>=85?'#E0A93A':'#7EE0A3');
      h += '<div class="st-sec">'+T('bev.budget','Budget & uren')+'</div>'+
        '<div class="card s-dj0tnd">'+
        '<div class="s-1s6beiz"><span>'+b.urenGepland+' / '+b.budgetUren+' '+T('bev.uur','uur')+' ('+b.maand+')</span><b>€ '+b.bestedBedrag+' / € '+b.budgetBedrag+'</b></div>'+
        '<div class="s-1hui97f"><div style="height:100%;width:'+Math.min(100,b.pct)+'%;background:'+kleur+';"></div></div>'+
        '<div class="sub h-mt40">'+esc(b.advies)+'</div>'+
        (b.perPost&&b.perPost.length? '<div class="sub h-mt40">'+b.perPost.map(p=>esc(p.naam)+': '+p.uren+' u (€ '+p.bedrag+')').join(' · ')+'</div>':'')+
        '<div class="s-1e47xc3"><input id="bevBudUren" type="number" min="0" placeholder="'+T('bev.buduren','budget-uren/mnd')+'" value="'+b.budgetUren+'" class="s-186ss1h">'+
        '<input id="bevBudTarief" type="number" min="0" placeholder="'+T('bev.tarief','tarief/uur')+'" value="'+b.tariefUur+'" class="s-186s51y">'+
        '<button class="abtn" id="bevBudSave">'+T('bev.opslaan','Opslaan')+'</button></div>'+
        '</div>';
    }
    // 4) rooster met AI-overname
    h += '<div class="st-sec">'+T('bev.rooster','Rooster')+'</div>'+
      '<div class="s-15oo0j7">'+
      '<input id="bevDag" type="date" value="'+bevDatum+'" class="s-k43idi">'+
      '<button class="abtn" id="bevAI">'+T('bev.ai','AI neemt het over')+'</button></div>';
    const dag = roo.dagen && roo.dagen[0];
    if (dag){
      h += '<div class="card s-xmivqi">'+ (dag.posten.length? dag.posten.map(p =>
        '<div class="s-l4s0j1">'+
          '<div class="s-7l4opl"><b>'+esc(p.post)+'</b>'+(p.open?'<span style="color:var(--rood);font-size:0.72rem;">'+p.open+' '+T('bev.open','open')+'</span>':'<span class="s-8zliaq">'+T('bev.gedekt','gedekt')+'</span>')+'</div>'+
          p.shifts.map(sl => '<div class="sub h-mt20">'+esc(sl.shift)+': '+
            (sl.bezet.length? sl.bezet.map(d=>'<span class="bev-chip'+(d.afwezig?' uit':d.status==='ingeklokt'?' on':'')+'"'+(d.afwezig?' title="'+esc(d.afwezig===true?T('bev.afwezig','afwezig'):d.afwezig)+'"':'')+'>'+esc(d.guardNaam||'?')+(d.afwezig?' · '+T('bev.afwezig','afwezig'):d.status==='ingeklokt'?' ●':'')+' <a data-schrap="'+d.id+'">✕</a></span>').join(' ') : '')+
            (sl.open? ' <button class="bev-plan" data-post="'+p.postId+'" data-shift="'+sl.shiftId+'">+ '+T('bev.plan','plan')+'</button>':'')+
          '</div>').join('')+
        '</div>'
      ).join('') : '<div class="softline">'+T('bev.geenpost','Nog geen posten. Voeg hieronder objecten toe.')+'</div>')+'</div>';
    }
    // 5) inzetaanvragen
    h += '<div class="st-sec">'+T('bev.inzet','Inzetaanvragen')+'</div>';
    const open = (cmd.functies||[]).find(f=>f.id==='aanvragen' && f.aan);
    h += '<div class="card s-xmivqi"><div id="bevAvLijst"></div>'+
      (open? '<div class="s-1738il7">'+
        '<input id="bevAvKlant" placeholder="'+T('bev.klant','klant')+'" class="s-186s51y">'+
        '<input id="bevAvObject" placeholder="'+T('bev.object','object/locatie')+'" class="s-186ss1h">'+
        '<input id="bevAvDatum" type="date" value="'+bevDatum+'" class="s-k42vdz">'+
        '<input id="bevAvAantal" type="number" min="1" value="1" class="s-186q83d" title="'+T('bev.aantal','aantal bewakers')+'">'+
        '<button class="abtn" id="bevAvAdd">'+T('bev.avadd','Aanvraag toevoegen')+'</button></div>':'')+
      '</div>';
    // 6) posten beheren
    const posten = cmd.postenLijst || [];
    h += '<div class="st-sec">'+T('bev.postbeheer','Posten & objecten')+'</div>'+
      '<div class="card s-xmivqi">'+
      (posten.length? posten.map(p => '<div class="s-lnqlha">'+
        '<span><b>'+esc(p.naam)+'</b>'+(p.klant?' · '+esc(p.klant):'')+' · '+(p.minMan||1)+' '+T('bev.man','man')+(p.orders?'<br><span class="sub">'+esc(p.orders)+'</span>':'')+'</span>'+
        '<button class="abtn ghost" data-postweg="'+p.id+'">✕</button></div>').join('') : '<div class="softline">'+T('bev.geenpost2','Nog geen posten.')+'</div>')+
      '<div class="s-1738il7">'+
      '<input id="bevPostNaam" placeholder="'+T('bev.postnaam','postnaam')+'" class="s-186ss1h">'+
      '<input id="bevPostKlant" placeholder="'+T('bev.klant','klant')+'" class="s-186s51y">'+
      '<input id="bevPostMin" type="number" min="1" value="1" class="s-186q83d" title="'+T('bev.min','min. bezetting')+'">'+
      '<button class="abtn" id="bevPostAdd">'+T('bev.postadd','Post toevoegen')+'</button></div></div>';
    // 7) incidenten
