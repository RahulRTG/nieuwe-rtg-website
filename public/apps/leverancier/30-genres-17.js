
  // ---- vracht & expeditie: internationale zendingen over lucht, water en land ----
  /* Zonder pictogrammen: de gedeelde themalaag houdt lopende tekst bewust
     zakelijk (emoticons worden eruit geveegd), dus hier alleen woorden. */
  const VR_MOD = {
    lucht:       { label:'Lucht' },
    zee:         { label:'Zee' },
    binnenvaart: { label:'Binnenvaart' },
    weg:         { label:'Weg' },
    spoor:       { label:'Spoor' }
  };
  const VR_STATUS = { onderweg:'onderweg', douane:'bij de douane', aangekomen:'aangekomen', afgeleverd:'afgeleverd' };
  let vrEtappes = [{ modaliteit:'weg', van:'', naar:'' }];

  function vrModOpties(gekozen){
    return Object.keys(VR_MOD).map(k => '<option value="'+k+'"'+(k===gekozen?' selected':'')+'>'+T('vr.mod.'+k, VR_MOD[k].label)+'</option>').join('');
  }
  function vrEtappeRijen(){
    return vrEtappes.map((e,i) =>
      '<div class="row-gap" style="margin-top:0.35rem;align-items:center;">'+
      '<select class="st-in js-vrmod" data-i="'+i+'" style="flex:0 0 9rem;">'+vrModOpties(e.modaliteit)+'</select>'+
      '<input class="st-in js-vrvan" data-i="'+i+'" placeholder="'+T('vr.et.van','Van (haven, airport, depot)')+'" value="'+escAttr(e.van)+'" maxlength="60" style="flex:1;">'+
      '<input class="st-in js-vrnaar" data-i="'+i+'" placeholder="'+T('vr.et.naar','Naar')+'" value="'+escAttr(e.naar)+'" maxlength="60" style="flex:1;">'+
      (vrEtappes.length>1 ? '<button class="js-vretweg" data-i="'+i+'" aria-label="'+T('vr.et.weg','Etappe weghalen')+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.6rem;color:var(--soft);font-family:inherit;">✕</button>' : '')+
      '</div>').join('');
  }
  function vrTijdlijn(z){
    return '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.45rem;">'+z.etappes.map(e => {
      const stijl = e.status==='bezig' ? 'border-color:var(--gold);background:rgba(201,162,75,0.12);' : e.status==='klaar' ? 'opacity:0.6;' : 'opacity:0.85;';
      return '<span title="'+escAttr(e.document)+'" style="border:1px solid var(--line);'+stijl+'border-radius:999px;padding:0.2rem 0.6rem;font-size:0.72rem;">'+
        T('vr.mod.'+e.modaliteit, VR_MOD[e.modaliteit].label)+' · '+esc(e.van)+' → '+esc(e.naar)+(e.status==='klaar'?' · '+T('vr.et.klaar','klaar'):e.status==='bezig'?' · '+T('vr.et.nu','nu'):'')+'</span>';
    }).join('')+'</div>';
  }
  function vrKaart(z){
    const docs = z.etappes.map(e => esc(e.document)).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
    let acties = '';
    if (z.status==='onderweg') acties += '<button data-vret="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.etklaar','Etappe klaar')+'</button>';
    if (z.status==='douane') acties += '<button data-vrdouane="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.douane','Douane heeft ingeklaard')+'</button>';
    if (z.status==='aangekomen') acties += '<button data-vraf="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.afleveren','Afleveren')+'</button>';
    if (z.status!=='afgeleverd') acties += '<button data-vrmeld="'+z.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('vr.melding','Melding')+'</button>';
    return '<div style="border:1px solid '+(z.status==='afgeleverd'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(z.ref)+' · '+esc(z.klant)+'</b>'+
      '<span style="border:1px solid var(--line);border-radius:999px;padding:0.1rem 0.55rem;font-size:0.7rem;">'+esc(T('vr.st.'+z.status, VR_STATUS[z.status]||z.status))+'</span></div>'+
      '<div class="sub">'+esc(z.inhoud)+' · '+z.gewichtKg.toLocaleString('nl-NL')+' kg · '+z.colli+' colli · '+esc(z.incoterm)+'</div>'+
      '<div class="sub">'+esc(z.van.plaats)+' ('+esc(z.van.land)+') → '+esc(z.naar.plaats)+' ('+esc(z.naar.land)+') · ETA '+esc(z.eta)+'</div>'+
      vrTijdlijn(z)+
      '<div class="sub" style="margin-top:0.4rem;">'+T('vr.docs','Documenten')+': '+docs+' · '+T('vr.volgcode','volgcode voor de klant')+': <b>'+esc(z.volgcode)+'</b></div>'+
      (z.gebeurtenissen.length ? '<details style="margin-top:0.35rem;"><summary class="sub" style="cursor:pointer;">'+T('vr.logboek','Logboek')+' ('+z.gebeurtenissen.length+')</summary>'+
        z.gebeurtenissen.map(g=>'<div class="sub">'+new Date(g.at).toLocaleString('nl-NL')+' · '+esc(g.tekst)+'</div>').join('')+'</details>' : '')+
      (acties ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">'+acties+'</div>' : '')+'</div>';
  }

