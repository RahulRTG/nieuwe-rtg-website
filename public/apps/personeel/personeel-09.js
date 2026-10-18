/* de gereedschappen op een bord tekenen */
    const regel = (icoon, links, rechts, rood) => '<div class="s-b8infn"><span>'+(icoon?icoon+' ':'')+links+'</span>'+(rechts?'<b class="' + (rood ? 's-1smzt78' : 's-qopcz1') + '">'+rechts+'</b>':'')+'</div>';
    return t.tools.map(w => {
      if (w.type === 'cijfers') return kop(w.titel)+regel('', w.items.map(i => esc(i.label)+' <b>'+esc(String(i.waarde))+'</b>').join(' · '), '');
      if (w.type === 'lijst') return kop(w.titel)+((w.rijen||[]).length
        ? w.rijen.slice(0, 6).map(r => regel(r.icoon||'', esc(r.tekst)+(r.sub?'<span style="display:block;font-size:0.7rem;opacity:0.7;">'+esc(r.sub)+'</span>':''), r.rechts?esc(r.rechts):'', r.rood)).join('')
        : '<div style="font-size:0.75rem;opacity:0.65;margin-top:0.25rem;">'+esc(w.leeg||'')+'</div>');
      if (w.type === 'knoppen') return kop(w.titel)+'<div class="s-1n9jr2z">'+
        (w.knoppen||[]).map(k => '<button class="abtn ghost" data-pkdsnelknop="'+esc(k)+'">'+esc(k)+'</button>').join('')+'</div>';
      if (w.type === 'actie') return '<button class="abtn" data-pkdactie="'+esc(w.tekst)+'" style="width:100%;margin-top:0.5rem;">'+esc(w.knop)+'</button>';
      // de leeftijdscheck aan de deur: ja/nee op codenaam, zonder gegevens
      if (w.type === 'leeftijd') return kop(w.titel)+
        '<div class="s-vhf8p1"><input id="pkLftIn" placeholder="'+T('pd.lft.ph','Codenaam van de gast')+'" class="s-58tuot">'+
        '<button class="abtn" data-pklft="18">18+?</button><button class="abtn ghost" data-pklft="21">21+?</button></div>'+
        '<div id="pkLftUit" style="margin-top:0.25rem;font-size:0.78rem;color:var(--soft);">'+esc(w.hint||'')+'</div>';
      if (w.type === 'meter') return kop(w.titel)+'<div class="s-1n9jr2z">'+
        (w.opties||[]).map(o => '<button class="abtn'+(w.stand&&w.stand.stand===o?'':' ghost')+'" data-pkdmeter="'+esc(o)+'" style="flex:1;min-width:70px;">'+esc(o)+'</button>').join('')+'</div>';
      return '';
    }).join('');
  }
  function pkDorpKaart(){
    pkLaadDorp();
    if (!pkDorp) return '';
    const afd = pkDorp.afdelingen.find(a => a.key === pkDorpKant) || pkDorp.afdelingen[0];
    pkDorpKant = afd.key;
    pkLaadTools();
    return '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.dorp','Afdelingen')+
      '<button class="abtn ghost" id="pkDorpChat" style="font-size:0.66rem;">'+T('pd.dorp.chat','Teamchat')+'</button></div>'+
      '<div class="s-ddcl0h">'+pkDorp.afdelingen.map(a =>
        '<button class="abtn'+(a.key===pkDorpKant?'':' ghost')+'" data-pkdkant="'+a.key+'">'+RTGGlyf.tekst(a.icon)+(a.openAantal?' '+a.openAantal:'')+'</button>').join('')+'</div>'+
      '<div class="s-cb89dq">'+RTGGlyf.tekst(afd.icon)+' '+esc(afd.label)+' · '+afd.keten.join(' · ')+'</div>'+
      pkToolsHtml()+
      (afd.open.length ? afd.open.map(p => {
        const i = afd.keten.indexOf(p.status);
        const volgende = i >= 0 && i < afd.keten.length - 1 ? afd.keten[i + 1] : null;
        return '<div class="task"><div class="t"><b>'+(p.waar?esc(p.waar)+' · ':'')+esc(p.tekst)+'</b><span>'+esc(p.status)+' · '+esc(p.door)+' · '+timeAgo(p.updatedAt||p.at)+
          ((p.via||[]).length?' · '+T('pd.dorp.via','via')+' '+p.via.map(esc).join(', '):'')+'</span></div>'+
          '<div class="s-1x92i8j">'+(volgende?'<button class="abtn" data-pkdverder="'+p.id+'">'+esc(volgende)+'</button>':'')+
          '<button class="abtn ghost" data-pkdstuur="'+p.id+'" aria-label="doorsturen">↪</button></div></div>';
      }).join('') : '<div class="s-1sydj7f">'+T('pd.dorp.leeg','Niets open bij deze afdeling.')+'</div>')+
      (pkDorpKant === 'concierge' && pkBuurt && pkBuurt.length
        ? '<div class="s-1x1ad40">'+T('pd.dorp.buurt','In de buurt')+'</div>'+
          '<div class="s-1n9jr2z">'+pkBuurt.map(b =>
            '<button class="abtn ghost" data-pkdbuurt="'+esc(b.naam)+'" data-soort="'+esc(b.soort)+'" data-km="'+b.km+'">'+RTGGlyf.tekst(b.icon)+' '+esc(b.naam)+' · '+b.km+' km</button>').join('')+'</div>'
        : '')+
      '<button class="abtn ghost" data-pkdnieuw style="width:100%;margin-top:0.5rem;">+ '+T('pd.dorp.nieuw','Zet iets op de lijst')+'</button></div>';
  }
  // de buurt voor de concierge-kant op zak
  let pkBuurt = null, pkBuurtBezig = false;
  function pkLaadBuurt(){
    if (pkBuurt || pkBuurtBezig) return;
    pkBuurtBezig = true;
    API.call('/supplier/dorp/buurt').then(d => { pkBuurt = d.buurt || []; pkBuurtBezig = false; renderKamers(); })
      .catch(() => { pkBuurt = []; pkBuurtBezig = false; });
  }
  /* opdrachten: de flow voor schoonmaakbedrijven en zzp'ers. Geen kamerbord
     maar de eigen boekingen: bevestigen, op locatie werken en afronden. */
  function renderOpdrachten(wrap){
    const bs = state.boekingen || [];
    const open = bs.filter(b => b.status === 'aangevraagd');
    const komend = bs.filter(b => b.status === 'bevestigd');
    const kaart = (b, acties) => '<div class="card kamer '+(b.status==='bevestigd'?'bezig':'vuil')+'">'+
      '<div class="s-wdsbtk"><b class="s-2uj31e">'+esc(b.service && b.service.name || 'Opdracht')+'</b>'+
      '<span class="hkchip'+(b.status==='bevestigd'?' amber':' rood')+'">'+(b.status==='bevestigd'?T('hk.o.bevestigd','Ingepland'):T('hk.o.nieuw','Nieuw'))+'</span></div>'+
      '<div class="s-1m4ytk4">'+esc(b.customerCodename||'')+(b.wanneer?' · '+esc(b.wanneer):'')+(b.price?' · '+eur(b.price):'')+'</div>'+
      (b.note?'<div class="s-o2xnz3">'+esc(b.note)+'</div>':'')+
      (b.zorg?'<div class="s-sthtyi">'+esc(pkZorg(b.zorg))+'</div>':'')+
      '<div class="row s-q9vs12">'+acties+'</div></div>';
    let html = '<div class="card stat"><div><b class="s-15g9sga">'+open.length+'</b><span>'+T('hk.o.nieuw','Nieuw')+'</span></div>'+
      '<div><b class="s-14oeqwv">'+komend.length+'</b><span>'+T('hk.o.bevestigd','Ingepland')+'</span></div></div>';
    html += open.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="bevestigd">✓ '+T('hk.o.bevestig','Bevestig')+'</button><button class="abtn warn" data-bk="'+b.ref+'" data-st="geweigerd">'+T('hk.o.weiger','Weiger')+'</button>')).join('');
    html += komend.map(b => kaart(b, '<button class="abtn" data-bk="'+b.ref+'" data-st="afgerond">✓ '+T('hk.o.klaar','Rond af')+'</button>')).join('');
    if (!open.length && !komend.length) html += '<div class="card">'+T('hk.o.leeg','Geen open opdrachten. Nieuwe boekingen verschijnen hier vanzelf.')+'</div>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-bk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/booking/status', { ref: b.dataset.bk, status: b.dataset.st }); await refresh(); } catch(e){ toast(e.message); }
    }));
  }
  function minibarBlok(r){
    const mb = (state.minibar && state.minibar.catalog) || [];
    return '<div class="s-1yg94ks">'+
      mb.map(x => '<div class="mbrow"><span class="s-2ty0gz">'+esc(x.name)+' <span class="s-uqbevk">'+eur(x.price)+'</span></span>'+
        '<span class="q"><button data-mbmin="'+x.id+'" aria-label="minder">−</button><b>'+(mbTel[x.id]||0)+'</b><button data-mbplus="'+x.id+'" aria-label="meer">+</button></span></div>').join('')+
      '<button class="abtn" data-mbboek="'+esc(r.name)+'" style="width:100%;margin-top:0.5rem;">'+T('hk.boek','Boek op de kamer')+'</button></div>';
  }
  function bindKamers(wrap){
    // het hoteldorp: kant kiezen, posten doorzetten, en er iets bij zetten
    wrap.querySelectorAll('[data-pkdkant]').forEach(b => b.addEventListener('click', () => {
      pkDorpKant = b.dataset.pkdkant;
      try { localStorage.setItem('rtg_pda_dorp', pkDorpKant); } catch(e){}
      renderKamers();
    }));
    // het specialistische gereedschap: logmoment, meter en snelposten
    wrap.querySelectorAll('[data-pkdactie]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/dorp/post', { afdeling: pkDorpKant, waar: '', tekst: b.dataset.pkdactie, directKlaar: true }); toast(T('dorp.geklokt','Geklokt.')); pkDorpAt = 0; pkToolsKant = null; pkLaadDorp(); }
      catch(e){ toast(e.message); }
    }));
    // elke afdeling in een tik bij de teamchat, de collegachat en de teamcall
